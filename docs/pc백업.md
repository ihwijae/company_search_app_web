# 새 PC + WSL 작업 환경 세팅 / 백업 문서

이 문서는 PC 포맷 후, 새 PC에서 `WSL` 기반으로 다시 개발 환경을 복구하기 위한 메모다.

기준:
- 저장소: `company_search_app_web`
- 현재 개발 방식: `Windows + WSL + VS Code Remote`
- 현재 작업 원칙: `웹 전용`

관련 기준 문서:
- 루트 `규칙.md`
- `docs/웹앱_26.03.27.md`

## 1. 먼저 이해할 구분

이 문서에는 설치 대상이 3종류 있다.

### A. Windows에 직접 설치하는 프로그램
- WSL
- VS Code
- Git
- Chrome / Edge
- Excel

### B. WSL(Ubuntu) 안에 설치하는 개발 도구
- Node.js
- npm
- Git
- Codex CLI

### C. 프로젝트 폴더 안에 설치되는 라이브러리
- `npm install`로 설치되는 `react`, `vite`, `xlsx` 같은 패키지

중요:
- 내가 실제 개발하는 위치는 `WSL 내부 리눅스 경로`다.
- 즉, Node/npm/Codex도 `Windows가 아니라 WSL 안에` 설치되어 있어야 한다.

## 2. Windows에 직접 설치할 프로그램

### 필수
- WSL2
- Ubuntu
- Visual Studio Code
- VS Code 확장: `Remote - WSL`
- Google Chrome 또는 Microsoft Edge

### 권장
- Git for Windows
- Microsoft Excel
- Windows Terminal

설명:
- VS Code는 WSL에 붙어서 사용한다.
- Chrome/Edge는 웹 앱 동작 확인용이다.
- Excel은 생성된 `.xlsx` 결과 파일 확인용이다.
- Git은 WSL 안에도 설치하겠지만, Windows 쪽 Git도 있으면 편할 수 있다.

## 3. WSL 내부에 설치할 개발 도구

새 PC에서 Ubuntu를 연 뒤 설치한다.

### 필수
- `git`
- `curl`
- `build-essential`
- `node`
- `npm`
- `codex`

### 권장
- `unzip`

예시:

```bash
sudo apt update
sudo apt install -y git curl build-essential unzip
```

## 4. WSL 내부에 설치할 Node.js / npm

권장 버전:
- Node.js 20 LTS
- npm 10 이상

설치 확인:

```bash
node -v
npm -v
git --version
```

중요:
- 프로젝트는 WSL 안에서 돌리므로 `node -v`와 `npm -v` 확인도 반드시 WSL 터미널에서 해야 한다.

## 5. WSL 내부에 다시 설치할 Codex

현재 환경 기준으로 Codex는 WSL 안에 전역 npm 패키지로 설치되어 있다.

확인 기준:
- 실행 파일: `/usr/bin/codex`
- 연결 위치: `@openai/codex`

설치 예시:

```bash
npm install -g @openai/codex
```

설치 확인:

```bash
codex --version
codex --help
```

로그인:

```bash
codex login
```

메모:
- Codex는 WSL 안에 다시 설치해야 한다.
- Windows에만 설치하고 WSL 안에 없으면 지금 같은 개발 방식으로 바로 쓰기 어렵다.

자동 설치를 같이 하려면 아래 스크립트도 사용 가능:

```bash
bash scripts/setup-wsl-dev.sh --install-codex
```

## 6. Codex 관련 백업 대상

포맷 전에 아래 경로를 따로 백업하면 복구가 편하다.

### WSL 사용자 홈의 Codex 설정
- `~/.codex/config.toml`
- `~/.codex/auth.json`
- 필요 시 `~/.codex/skills/`
- 필요 시 `~/.codex/memories/`
- 필요 시 `~/.codex/rules/`

현재 확인된 Codex 설정 특징:
- 기본 모델: `gpt-5.4`
- 현재 프로젝트 신뢰 설정 존재

주의:
- `auth.json`에는 인증 정보가 포함될 수 있다.
- 안전한 개인 백업 위치에만 저장한다.

실무적으로는 아래 2가지 방식 중 하나면 된다.
- 최소 백업: `config.toml`만 백업하고 새 PC에서 `codex login` 다시 수행
- 완전 복구: `~/.codex` 전체 백업 후 새 WSL에 복원

## 7. 프로젝트에서 `npm install`로 설치되는 라이브러리

아래는 `package.json` 기준으로 프로젝트 폴더에서 `npm install` 실행 시 설치되는 라이브러리 목록이다.

중요:
- 이 목록은 사용자가 웹사이트에서 하나씩 직접 설치하는 프로그램 목록이 아니다.
- 프로젝트 루트에서 `npm install` 한 번 실행하면 된다.
- 현재 저장소는 웹 전용 기준으로 작업 중이지만, `package.json`에는 아직 Electron 관련 의존성도 남아 있어서 같이 설치된다.

### dependencies
- `@vercel/blob`
- `adm-zip`
- `axios`
- `axios-cookiejar-support`
- `cheerio`
- `chokidar`
- `exceljs`
- `nodemailer`
- `react`
- `react-dom`
- `react-quill`
- `sql.js`
- `tough-cookie`
- `xlsx`

### devDependencies
- `@types/react`
- `@types/react-dom`
- `@vitejs/plugin-react`
- `concurrently`
- `electron`
- `electron-builder`
- `electron-icon-builder`
- `eslint`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `vite`

## 8. 포맷 전에 꼭 백업할 항목

### 프로젝트 자체
- Git 원격 저장소에 푸시
- 또는 프로젝트 폴더 전체 백업

### 환경변수 파일
- `.env`
- `.env.local`
- 필요 시 `.env.local.example`

### 데이터/리소스 폴더
- `db/`
- `public/`
- `template/`
- `템플릿/`
- `image/`

설명:
- `db/` 안의 원본 xlsx는 빌드 전 정적 JSON 데이터셋 생성에 필요하다.
- 템플릿 폴더는 엑셀 내보내기에 필요하다.

### 개인 설정/운영 정보
- Blob/Vercel 관련 토큰
- SMTP 계정 정보
- 필요 시 SMPP 계정 정보
- Git 계정 설정
- Codex 설정 파일

주의:
- 민감정보는 문서 본문에 직접 적지 않는다.
- 별도 비공개 백업 장소나 비밀번호 관리자에 저장한다.

## 9. 새 PC 복구 순서

### 1) Windows 기본 세팅
- WSL2 설치
- Ubuntu 설치
- VS Code 설치
- `Remote - WSL` 확장 설치
- Chrome 또는 Edge 설치
- 필요 시 Excel 설치

### 2) WSL(Ubuntu) 기본 세팅

```bash
sudo apt update
sudo apt install -y git curl build-essential unzip
```

### 3) WSL 안에 Node.js / npm 설치
- Node.js 20 LTS 기준으로 설치

설치 확인:

```bash
node -v
npm -v
git --version
```

### 4) WSL 안에 Codex 설치

```bash
npm install -g @openai/codex
codex --version
codex login
```

또는 아래 스크립트로 프로젝트 의존성 설치와 함께 진행 가능:

```bash
bash scripts/setup-wsl-dev.sh --install-codex
codex login
```

### 5) 필요 시 Codex 백업 복원
- 백업해둔 `~/.codex/config.toml` 복원
- 필요 시 `~/.codex/skills/`, `~/.codex/memories/`, `~/.codex/rules/` 복원
- `auth.json`을 복원하지 않으면 `codex login`으로 다시 로그인

### 6) 저장소 가져오기

```bash
git clone <저장소 주소>
cd company_search_app_web
```

또는 백업한 프로젝트 폴더를 WSL 작업 경로에 복사한다.

권장 작업 경로 예시:

```bash
/home/<사용자명>/projects/company_search_app_web
```

### 7) 환경변수 복원
- 프로젝트 루트에 `.env`, `.env.local` 복원

현재 확인된 예시:
- `.env.local.example`에는 `BLOB_READ_WRITE_TOKEN` 예시가 있음

### 8) 프로젝트 의존성 설치

```bash
npm install
```

또는 스크립트 사용:

```bash
bash scripts/setup-wsl-dev.sh
```

### 9) 실행 확인

웹 개발 서버:

```bash
npm run dev
```

빌드 확인:

```bash
npm run build
```

Electron 포함 실행이 필요할 때만:

```bash
npm run start:dev
```

중요:
- 현재 작업 원칙은 `웹 전용`이다.
- 평소 개발 확인은 `npm run dev`, `npm run build` 중심으로 한다.

## 10. 빌드/실행 관련 메모

### WSL 복구 스크립트
- 경로: `scripts/setup-wsl-dev.sh`
- 용도:
  - WSL 필수 패키지 설치
  - 프로젝트 `npm install`
  - 선택 시 Codex CLI 전역 설치

사용 예시:

```bash
bash scripts/setup-wsl-dev.sh
```

Codex까지 같이 설치:

```bash
bash scripts/setup-wsl-dev.sh --install-codex
```

apt 설치를 이미 마쳤으면:

```bash
bash scripts/setup-wsl-dev.sh --skip-apt
```

주의:
- 이 스크립트는 `Node.js 20 이상`이 이미 WSL에 설치되어 있다는 전제로 동작한다.
- Node가 없거나 버전이 낮으면 오류를 내고 종료한다.
- Codex 설치 후 로그인은 별도로 `codex login`을 실행해야 한다.

### 빌드 전에 자동 실행되는 것
- `npm run build` 전에 `prebuild` 실행
- 스크립트: `scripts/build-static-datasets.js`

의미:
- `db/` 폴더의 원본 xlsx를 읽어서 정적 JSON 데이터셋을 생성한다.
- 새 PC에서도 `db/` 폴더가 빠지면 검색 데이터가 정상 빌드되지 않을 수 있다.

### 주요 실행 명령
- `npm run dev`: Vite 웹 개발 서버
- `npm run build`: 웹 빌드
- `npm run start`: 빌드 후 Electron 실행
- `npm run start:dev`: Vite + Electron 동시 실행
- `npm run dist:win`: Windows 설치파일 빌드

## 11. 외부 서비스/토큰 메모

### Blob
- 사용 기능:
  - 협정보드 저장/불러오기
  - 공용 주소록 저장
  - 첨부 임시 업로드
  - 일부 데이터셋 API
- 필요한 값:
  - `BLOB_READ_WRITE_TOKEN`

### 메일
- 메일 발송은 `nodemailer` 기반
- SMTP 계정 정보 필요

### SMPP
- 기존 기능 확인이 필요하면 계정 정보 백업 권장

## 12. 새 PC에서 최종 체크리스트

- Windows에서 WSL/Ubuntu 설치 완료
- WSL 안에서 `node -v`, `npm -v`, `git --version` 정상 확인
- WSL 안에서 `codex --version` 정상 확인
- `codex login` 완료
- 필요 시 `~/.codex/config.toml` 복원 완료
- 필요 시 `bash scripts/setup-wsl-dev.sh --install-codex` 실행 완료
- 프로젝트 루트에 `.env`, `.env.local` 복원 완료
- `db/`, `template/`, `템플릿/` 누락 없음
- `npm install` 완료
- `npm run build` 성공
- `npm run dev` 접속 확인
- 업체조회 데이터 정상 조회 확인
- 협정보드 저장/불러오기 확인
- 메일 기능이 필요하면 SMTP 테스트 확인

## 13. 작업 시작 전에 다시 볼 문서

- `규칙.md`
- `docs/웹앱_26.03.27.md`
- 필요 시 `docs/리팩토링_기능분리_26.03.06.md`
- 필요 시 `docs/알림공통UI.md`

## 14. 한 줄 요약

새 PC에서는 Windows에 `WSL + Ubuntu + VS Code`를 먼저 설치하고, WSL 안에 `Node.js + npm + Git + Codex`를 다시 설치한 뒤, `~/.codex`와 프로젝트의 `.env/.env.local`, `db/`, 템플릿 폴더를 복원하고 `npm install`, `npm run build`, `npm run dev` 순서로 확인하면 된다.
