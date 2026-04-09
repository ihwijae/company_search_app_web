# CI/CD 세팅 정리

## 1. 목표
- 개발 PC에서 `main` 브랜치로 `git push`하면 서버 PC(WSL)에 자동 배포.
- 수동 `git pull`, 수동 재시작 작업 제거.

## 2. 최종 구성
- 서버 실행 환경: WSL(Ubuntu)
- 앱 경로: `/home/ihwijae/projects/company_search_app_web`
- 앱 프로세스: `pm2` (`company-search`)
- 앱 자동시작: `systemd` + `pm2-ihwijae.service`
- 배포 실행기: GitHub Actions `self-hosted runner` (서버에 설치)
- 터널: `cloudflared-company-search.service` (systemd)

## 3. 배포 파일 구성

### 3-1. 워크플로우 파일
- 경로: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: prod-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: [self-hosted, linux]
    steps:
      - name: Run deploy script on server
        run: /home/ihwijae/projects/company_search_app_web/scripts/deploy-prod.sh
```

### 3-2. 서버 배포 스크립트
- 경로: `scripts/deploy-prod.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ihwijae/projects/company_search_app_web"
PM2_NAME="company-search"

cd "$APP_DIR"

git checkout main
git pull --ff-only origin main

npm ci
npm run build

pm2 restart "$PM2_NAME" --update-env
pm2 save
```

## 4. 서버에서 수행한 작업

### 4-1. PM2 실행/자동시작 설정
- `pm2 start "npm run serve:prod:lan" --name company-search --time`
- `pm2 save`
- `pm2 startup` 후 안내된 `sudo ...` 실행
- `sudo systemctl status pm2-ihwijae --no-pager`로 `active (running)` 확인

### 4-2. self-hosted runner 설치
- GitHub: `Settings > Actions > Runners > New self-hosted runner > Linux`
- 서버에서 안내된 Download/Configure 명령 실행
- 서비스 등록:
  - `sudo ./svc.sh install`
  - `sudo ./svc.sh start`
  - `sudo ./svc.sh status`
- 정상 기준: `Connected to GitHub`, `Listening for Jobs`

### 4-3. cloudflared 자동시작 설정
- 기존 수동 실행 명령: `cloudflared tunnel run --protocol http2 company-search`
- systemd 서비스 파일 생성: `/etc/systemd/system/cloudflared-company-search.service`
- 적용:
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable cloudflared-company-search`
  - `sudo systemctl start cloudflared-company-search`
- 정상 기준:
  - `sudo systemctl status cloudflared-company-search --no-pager`
  - `active (running)`
  - `Registered tunnel connection` 로그

## 5. 실제 장애와 해결

### 5-1. Actions Failure (Invalid workflow file)
- 증상: `Invalid workflow file: .github/workflows/deploy.yml#L1`
- 원인: `deploy.yml`에 YAML이 아니라 shell script 내용이 들어감.
- 해결: `deploy.yml`을 올바른 YAML로 복구.

### 5-2. `git push` 거절 (`fetch first`)
- 증상: 원격이 앞서 있어 push 거절.
- 해결:
  - `git fetch origin`
  - `git pull --rebase origin main`
  - `git push origin main`

### 5-3. WSL systemd 이슈
- 증상: `System has not been booted with systemd`.
- 원인: WSL에서 systemd 미적용 상태.
- 해결: `/etc/wsl.conf`에 `systemd=true` 설정 + `wsl --shutdown` 후 재접속.

## 6. 확인 명령어

### 6-1. 앱/배포 상태
```bash
pm2 list
pm2 logs company-search --lines 120
```

### 6-2. PM2 systemd 상태
```bash
sudo systemctl status pm2-ihwijae --no-pager
```

### 6-3. Runner 상태
```bash
cd ~/actions-runner
sudo ./svc.sh status
```

### 6-4. 터널 상태
```bash
sudo systemctl status cloudflared-company-search --no-pager
journalctl -u cloudflared-company-search -n 50 --no-pager
```

## 7. 접속 관련 정리
- WSL 내부 앱 확인: `curl -I http://127.0.0.1:4173`
- Windows에서 WSL 앱 접속이 `localhost`로 안 될 때:
  - WSL IP 확인: `ip -4 addr show eth0`
  - 예: `172.21.250.81`
  - 접속: `http://172.21.250.81:4173`

## 8. 운영 결론
- 현재 자동배포는 정상 동작.
- 개발 PC에서 `main`에 `git push`하면 서버에서 자동 배포.
- 서버 재시작 후에도 앱/터널 자동 복구.
- 단, "코드"(git)와 "서버 로컬 설정"(pm2/systemd/runner/cloudflared)은 별개이므로,
  서버 교체 시 로컬 설정은 다시 해야 함.
