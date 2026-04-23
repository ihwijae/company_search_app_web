#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ihwijae/projects/company_search_app_web"
PM2_NAME="company-search"
PY_PM2_NAME="company-search-excel-backend"
APP_DATA_ROOT="${COMPANY_SEARCH_APP_DATA_ROOT:-$HOME/app-data/company-search}"
ARCHIVE_ROOT="${EXCEL_EDIT_ARCHIVE_ROOT:-$HOME/app-data/스캔본}"

cd "$APP_DIR"

git checkout main
git pull --ff-only origin main

npm ci
npm run build

cd "$APP_DIR/backend/python"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
./.venv/bin/pip install -r requirements.txt

cd "$APP_DIR"
mkdir -p "$APP_DATA_ROOT/uploads/master-files"
mkdir -p "$ARCHIVE_ROOT"

pm2 restart "$PM2_NAME" --update-env
if pm2 describe "$PY_PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PY_PM2_NAME" --update-env
else
  pm2 start /bin/bash --name "$PY_PM2_NAME" --time -- -lc "cd \"$APP_DIR\" && COMPANY_SEARCH_APP_DATA_ROOT=\"$APP_DATA_ROOT\" EXCEL_EDIT_ARCHIVE_ROOT=\"$ARCHIVE_ROOT\" ./scripts/run-excel-backend-prod.sh"
fi
pm2 save
