# WSL 꺼지는 문제 정리

## 1. 문제 상황
- 서버 PC에서 WSL을 켜 둔 상태인데, 하루 정도 지나면 WSL이 내려간 것처럼 보이는 현상이 반복됨.
- WSL이 다시 올라오면 내부 서비스(`pm2`, `cloudflared`)는 자동 복구되는 구조로 운영 중임.
- 사용자는 "자동 실행 설정이 원인인지", "WSL 내부 문제인지", "Windows 쪽 문제인지"를 구분하려고 함.

## 2. 현재 운영 구조
- WSL(Ubuntu) 안에서 앱 실행
- 앱 프로세스 관리: `pm2`
- 자동 시작: `systemd` + `pm2-ihwijae.service`
- 외부 터널: `cloudflared-company-search.service`
- 배포: GitHub Actions self-hosted runner

관련 문서:
- `docs/cicd세팅.md`

핵심 해석:
- `pm2`, `systemd`, `cloudflared`는 "WSL이 시작된 뒤 내부 서비스를 올리는 구조"임.
- 이 설정만으로 "WSL이 하루 지나도 절대 안 꺼지게" 만들지는 못함.

## 3. 1차 결론
- 현재까지 확인한 내용만 보면, 자동 실행 설정이 WSL 종료의 직접 원인일 가능성은 낮음.
- 더 유력한 원인은 WSL 바깥쪽, 즉 호스트 Windows 측 이벤트임.

유력 후보:
- Windows 재부팅
- Windows Update 후 자동 재시작
- 절전 / 최대 절전
- 세션 종료 또는 정책에 의한 종료
- WSL 인스턴스 자체 종료

덜 유력한 후보:
- `pm2` 오작동
- `cloudflared` 장애
- 앱 자동 실행 스크립트 자체가 WSL 종료를 유발

## 4. 확인한 로그와 해석

### 4-1. `pm2-ihwijae` 로그
확인 명령:

```bash
sudo journalctl -u pm2-ihwijae --no-pager -n 100
```

확인된 패턴:
- `Stopping pm2-ihwijae.service`
- `All Applications Stopped`
- `PM2 Daemon Stopped`
- `Deactivated successfully`
- 이후 `-- Boot ... --`
- 다시 `Starting pm2-ihwijae.service`

해석:
- `pm2`가 비정상 크래시한 패턴이 아님.
- `systemd`가 정상 종료 절차로 `pm2`를 내린 것에 가까움.
- 즉, 앱이 먼저 죽은 게 아니라 WSL/systemd 인스턴스 종료 흐름 안에서 함께 정리된 것으로 보는 게 맞음.

### 4-2. `cloudflared-company-search` 로그
확인 명령:

```bash
sudo journalctl -u cloudflared-company-search --no-pager -n 100
```

확인된 패턴:
- `Stopping cloudflared-company-search.service`
- `Initiating graceful shutdown due to signal terminated`
- `Unregistered tunnel connection`
- `Deactivated successfully`
- 이후 `-- Boot ... --`
- 다시 `Started cloudflared-company-search.service`

해석:
- `cloudflared`도 자체 장애로 폭사한 패턴이 아님.
- `systemd`가 종료 신호를 보내 정상 종료시킨 흐름임.
- `pm2`와 같은 시점대에 함께 내려가므로, 개별 서비스 문제가 아니라 WSL/systemd 전체 종료 쪽 정황이 강함.

## 5. 로그로 본 중간 결론
- `pm2`와 `cloudflared` 모두 "서비스 장애"보다는 "WSL/systemd 전체 종료에 따라 정상 종료"된 것으로 해석됨.
- 따라서 현재까지는 WSL 내부 앱 문제가 아니라 호스트 Windows 이벤트가 원인일 가능성이 높음.
- 다만 이 단계는 추정이며, 확정은 Windows 이벤트 로그 확인이 필요함.

## 6. 로그에서 별도로 보인 사항

### 6-1. `pm2-ihwijae.service` 환경변수 경고
로그 예시:

```text
/etc/systemd/system/pm2-ihwijae.service:12: Invalid environment assignment, ignoring: ...
```

해석:
- `Environment=` 줄에 Windows PATH 같은 값이 잘못 들어간 것으로 보임.
- 정리 필요는 있음.
- 하지만 "하루 뒤 WSL 전체가 내려가는 현상"의 주원인으로 보이진 않음.

### 6-2. `cloudflared`의 `127.0.0.1:4173 connection refused`
로그 예시:

```text
Unable to reach the origin service: dial tcp 127.0.0.1:4173: connect: connection refused
```

해석:
- 특정 시점에 앱 서버가 `4173`에서 응답하지 않았다는 뜻임.
- 외부 접속 실패 원인은 될 수 있음.
- 하지만 WSL 자체가 꺼지는 직접 원인으로 보이진 않음.

## 7. 최종 판단 기준
현재까지 가장 타당한 해석:

- 자동 실행 설정이 WSL 종료의 직접 원인일 가능성은 낮음
- WSL 내부 서비스 문제 정황은 약함
- 호스트 Windows의 재부팅/절전/세션 정책 때문에 WSL 전체가 내려갔을 가능성이 높음

정확한 표현:
- "내부 앱 문제로 보기 어렵고, Windows 쪽 이벤트가 원인일 가능성이 높다"
- 단, 확정은 Windows 이벤트 로그 확인 후 가능

## 8. 다음 세션에서 우선 확인할 로그

### 8-1. Windows 이벤트 로그
가장 우선 확인할 위치:
- `이벤트 뷰어`
- `Windows 로그 > 시스템`

중점적으로 볼 원본:
- `Kernel-Power`
- `User32`
- `WindowsUpdateClient`
- `Power-Troubleshooter`
- `EventLog`

확인 목적:
- 재부팅 여부
- 절전/복귀 여부
- 업데이트 후 자동 재시작 여부

### 8-2. WSL 내부 로그
다음 명령으로 확인:

```bash
journalctl --list-boots
sudo journalctl -b -1 --no-pager
sudo journalctl -u pm2-ihwijae --no-pager -n 100
sudo journalctl -u cloudflared-company-search --no-pager -n 100
pm2 list
pm2 logs company-search --lines 100
```

## 9. 다음 세션에서 물어볼 핵심 질문
- 문제 발생 시각이 언제였는지
- 그 시각에 Windows가 재부팅됐는지
- 절전/최대절전 정책이 켜져 있는지
- 원격 데스크톱 세션 종료 정책이 있는지
- Windows 작업 스케줄러/GPO/보안 정책이 야간에 개입하는지

## 10. 인계용 요약
- 현재까지 본 WSL 내부 로그만으로는 `pm2`, `cloudflared`, 자동 실행 설정이 직접 원인이라는 증거는 없음.
- 두 서비스 모두 `systemd`에 의해 정상 종료된 패턴을 보였음.
- 따라서 원인은 WSL 내부보다는 호스트 Windows 쪽일 가능성이 높음.
- 다음 세션에서는 Windows 이벤트 로그를 우선 확인해 재부팅, 절전, 업데이트, 세션 종료 흔적을 찾는 것이 핵심임.
