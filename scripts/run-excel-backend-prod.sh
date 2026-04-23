#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ihwijae/projects/company_search_app_web}"
APP_DATA_ROOT="${COMPANY_SEARCH_APP_DATA_ROOT:-$HOME/app-data/company-search}"
ARCHIVE_ROOT="${EXCEL_EDIT_ARCHIVE_ROOT:-$HOME/app-data/스캔본}"

cd "$APP_DIR/backend/python"

mkdir -p "$APP_DATA_ROOT/uploads/master-files"
mkdir -p "$ARCHIVE_ROOT"

export COMPANY_SEARCH_APP_DATA_ROOT="$APP_DATA_ROOT"
export EXCEL_EDIT_ARCHIVE_ROOT="$ARCHIVE_ROOT"

exec ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8787

