#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ihwijae/projects/company_search_app_web}"
WEB_PM2_NAME="${WEB_PM2_NAME:-company-search}"
PY_PM2_NAME="${PY_PM2_NAME:-company-search-excel-backend}"
APP_DATA_ROOT="${COMPANY_SEARCH_APP_DATA_ROOT:-$HOME/app-data/company-search}"
ARCHIVE_ROOT="${EXCEL_EDIT_ARCHIVE_ROOT:-$HOME/app-data/스캔본}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[ERROR] required command not found: $1"
    exit 1
  fi
}

install_python_runtime_if_needed() {
  local need_update=0
  if ! command -v python3 >/dev/null 2>&1; then
    need_update=1
  fi
  if ! dpkg -s python3-venv >/dev/null 2>&1; then
    need_update=1
  fi
  if [ "$need_update" -eq 1 ]; then
    sudo apt-get update
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    sudo apt-get install -y python3
  fi
  if ! dpkg -s python3-venv >/dev/null 2>&1; then
    sudo apt-get install -y python3-venv
  fi
}

ensure_pm2_process() {
  local name="$1"
  local command_line="$2"
  shift
  if pm2 describe "$name" >/dev/null 2>&1; then
    pm2 restart "$name" --update-env
  else
    pm2 start /bin/bash --name "$name" --time -- -lc "$command_line"
  fi
}

require_cmd git
require_cmd npm
require_cmd pm2

install_python_runtime_if_needed

mkdir -p "$APP_DATA_ROOT/uploads/master-files"
mkdir -p "$ARCHIVE_ROOT"

cd "$APP_DIR"

npm ci
npm run build

cd "$APP_DIR/backend/python"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

cd "$APP_DIR"

ensure_pm2_process "$WEB_PM2_NAME" "cd \"$APP_DIR\" && COMPANY_SEARCH_APP_DATA_ROOT=\"$APP_DATA_ROOT\" npm run serve:prod:lan"
ensure_pm2_process "$PY_PM2_NAME" "cd \"$APP_DIR\" && COMPANY_SEARCH_APP_DATA_ROOT=\"$APP_DATA_ROOT\" EXCEL_EDIT_ARCHIVE_ROOT=\"$ARCHIVE_ROOT\" ./scripts/run-excel-backend-prod.sh"

pm2 save

echo "[DONE] PM2 web process: $WEB_PM2_NAME"
echo "[DONE] PM2 python process: $PY_PM2_NAME"
echo "[INFO] APP_DATA_ROOT=$APP_DATA_ROOT"
echo "[INFO] EXCEL_EDIT_ARCHIVE_ROOT=$ARCHIVE_ROOT"
