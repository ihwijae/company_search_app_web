#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_CODEX=0
SKIP_APT=0

for arg in "$@"; do
  case "$arg" in
    --install-codex)
      INSTALL_CODEX=1
      ;;
    --skip-apt)
      SKIP_APT=1
      ;;
    -h|--help)
      cat <<'EOF'
Usage: bash scripts/setup-wsl-dev.sh [options]

Options:
  --install-codex   Install Codex CLI globally in WSL with npm
  --skip-apt        Skip apt package installation
  -h, --help        Show help
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

require_command() {
  local cmd="$1"
  local message="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: $message" >&2
    exit 1
  fi
}

ensure_node_20_or_newer() {
  require_command node "Node.js is not installed in WSL. Install Node.js 20 LTS first, then rerun this script."
  require_command npm "npm is not installed in WSL. Install Node.js 20 LTS first, then rerun this script."

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"

  if [ "$node_major" -lt 20 ]; then
    echo "ERROR: Node.js 20 LTS or newer is required. Current version: $(node -v)" >&2
    exit 1
  fi
}

install_apt_packages() {
  require_command sudo "sudo is required to install WSL packages."
  require_command apt "apt is required to install WSL packages."

  log "Installing required WSL packages"
  sudo apt update
  sudo apt install -y git curl build-essential unzip
}

install_project_dependencies() {
  log "Installing project npm dependencies"
  cd "$ROOT_DIR"
  npm install
}

install_codex_cli() {
  log "Installing Codex CLI globally in WSL"
  npm install -g @openai/codex

  log "Codex CLI installed"
  codex --version
  cat <<'EOF'

Next step:
  codex login
EOF
}

print_summary() {
  cat <<EOF

Setup finished.

Project root:
  $ROOT_DIR

Recommended next steps:
  1. Restore .env and .env.local
  2. Run: npm run build
  3. Run: npm run dev
EOF
}

log "Checking WSL development environment"
ensure_node_20_or_newer

if [ "$SKIP_APT" -eq 0 ]; then
  install_apt_packages
else
  log "Skipping apt package installation"
fi

install_project_dependencies

if [ "$INSTALL_CODEX" -eq 1 ]; then
  install_codex_cli
fi

print_summary
