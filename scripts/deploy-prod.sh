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
