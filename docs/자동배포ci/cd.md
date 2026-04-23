# 자동배포 CI/CD 정리

## 1. 목적
- 개발 PC에서 `git push` 하면 서버에서 자동으로 배포되도록 구성한다.
- 수동 `git pull`/수동 재시작 작업을 제거한다.

## 2. 현재 구성(적용 완료)
- 서버 환경: WSL (Ubuntu)
- 프로젝트 경로: `/home/ihwijae/projects/company_search_app_web`
- 앱 실행: `pm2` + `npm run serve:prod:lan` + `python excel backend(8787)`
- PM2 서비스: `pm2-ihwijae.service` (`systemd`)
- GitHub Actions Runner: self-hosted runner (서버에 서비스로 등록)

## 3. 배포 동작 흐름
1. 개발 PC에서 `main` 브랜치로 `git push`
2. GitHub Actions의 `deploy.yml` 워크플로우 실행
3. self-hosted runner가 서버에서 `scripts/deploy-prod.sh` 실행
4. 서버에서 `git pull -> npm ci -> npm run build -> python venv/pip sync -> pm2 restart`
5. 서비스 반영 완료

## 4. 서버 배포 스크립트
파일: `scripts/deploy-prod.sh`

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

### 4-1. 운영 초기 1회 세팅 스크립트 (신규)
파일: `scripts/setup-prod-services.sh`

- 목적: 운영 서버에서 Node + Python PM2 프로세스를 한 번에 준비
- 포함 작업:
  - `python3-venv` 설치(없을 때만)
  - `backend/python/.venv` 생성 및 `requirements.txt` 설치
  - `company-search` PM2 프로세스 준비
  - `company-search-excel-backend` PM2 프로세스 준비
  - `pm2 save`

실행:

```bash
cd /home/ihwijae/projects/company_search_app_web
chmod +x scripts/setup-prod-services.sh scripts/run-excel-backend-prod.sh scripts/deploy-prod.sh
./scripts/setup-prod-services.sh
```

기본 경로:
- `COMPANY_SEARCH_APP_DATA_ROOT=$HOME/app-data/company-search`
- `EXCEL_EDIT_ARCHIVE_ROOT=$HOME/app-data/스캔본`

필요 시 실행 시점에 환경변수로 덮어쓰기:

```bash
COMPANY_SEARCH_APP_DATA_ROOT=/home/ihwijae/app-data/company-search \
EXCEL_EDIT_ARCHIVE_ROOT=/home/ihwijae/app-data/스캔본 \
./scripts/setup-prod-services.sh
```

## 5. GitHub Actions 워크플로우
파일: `.github/workflows/deploy.yml`

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

## 6. 운영 확인 명령어

### 서버 상태 확인
```bash
pm2 list
pm2 logs company-search --lines 120
pm2 logs company-search-excel-backend --lines 120
```

### PM2 자동시작(systemd) 확인
```bash
sudo systemctl status pm2-ihwijae --no-pager
```
- 정상 기준: `active (running)`

### Runner 서비스 확인
```bash
cd ~/actions-runner
sudo ./svc.sh status
```
- 정상 기준: `Connected to GitHub`, `Listening for Jobs`

## 7. 트러블슈팅

### 7-1. `systemctl` 에러 (`System has not been booted with systemd`)
- 원인: WSL에서 `systemd` 비활성화
- 조치:
  1. `/etc/wsl.conf`에 아래 설정
     ```ini
     [boot]
     systemd=true
     ```
  2. Windows PowerShell에서 `wsl --shutdown`
  3. WSL 재접속 후 `ps -p 1 -o comm=` 결과가 `systemd`인지 확인

### 7-2. Actions가 `Waiting for a runner...`
- 원인: self-hosted runner 미설치 또는 중지
- 조치: `~/actions-runner`에서 `sudo ./svc.sh start` 후 상태 확인

### 7-3. `deploy.yml` 저장 시 `No such file or directory`
- 원인: `.github/workflows` 폴더 없음
- 조치: `mkdir -p .github/workflows` 후 파일 생성

## 8. 운영 원칙
- 배포 트리거 브랜치는 `main`으로 유지한다.
- 서버 반영은 `deploy-prod.sh`를 단일 진입점으로 관리한다.
- 배포 실패 시 Actions 로그와 `pm2 logs`를 함께 확인한다.
