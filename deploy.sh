#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  deploy.sh — Full deploy / update script for stockscreener.ru
#
#  First deploy:   bash deploy.sh --init
#  Update:         bash deploy.sh
#  With rebuild:   bash deploy.sh --rebuild
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/J0hann772/stocks_analiz.git"
DEPLOY_DIR=$(pwd)
BRANCH="main"
COMPOSE_FILE="docker-compose.prod.yml"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; NC="\033[0m"
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${GREEN}══ $* ══${NC}"; }

INIT_MODE=false
REBUILD=false

for arg in "$@"; do
  case $arg in
    --init)    INIT_MODE=true ;;
    --rebuild) REBUILD=true ;;
    *) warn "Unknown argument: $arg" ;;
  esac
done

# ── Check dependencies ────────────────────────────────────────────────────────
step "Checking dependencies"
for cmd in docker git curl; do
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is not installed. Please install it first."
    exit 1
  fi
done
DOCKER_COMPOSE="docker compose"
if ! docker compose version &>/dev/null; then
  error "Docker Compose v2 not found. Install Docker Desktop >= 24 or docker-compose-plugin."
  exit 1
fi
info "All dependencies OK"

# ── Clone or update repo ──────────────────────────────────────────────────────
step "Syncing repository"
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  info "Cloning from $REPO_URL ..."
  git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
else
  info "Pulling latest from $BRANCH ..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
fi
cd "$DEPLOY_DIR"
info "Repo at: $(git log -1 --pretty='%h %s (%ci)')"

# ── .env setup ────────────────────────────────────────────────────────────────
step "Environment file"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  if [ -f "$DEPLOY_DIR/.env.prod" ]; then
    cp "$DEPLOY_DIR/.env.prod" "$DEPLOY_DIR/.env"
    warn ".env created from .env.prod template."
    warn "IMPORTANT: Fill in real secrets in $DEPLOY_DIR/.env before continuing!"
    warn "Then re-run:  bash $DEPLOY_DIR/deploy.sh ${INIT_MODE:+--init}"
    read -rp "Press ENTER when .env is filled, or Ctrl+C to abort..." _
  else
    error ".env file not found and .env.prod template is missing. Cannot continue."
    exit 1
  fi
else
  info ".env found"
fi

# ── SSL init (first time only) ────────────────────────────────────────────────
if [ "$INIT_MODE" = true ]; then
  step "Initialising SSL certificate (Let's Encrypt)"
  if [ ! -f "$DEPLOY_DIR/certbot/init-letsencrypt.sh" ]; then
    error "certbot/init-letsencrypt.sh not found."
    exit 1
  fi
  bash "$DEPLOY_DIR/certbot/init-letsencrypt.sh"
else
  # Check if certs already exist
  if [ ! -d "$DEPLOY_DIR/certbot/conf/live/stockscreener.ru" ]; then
    warn "SSL certs not found! Run  bash deploy.sh --init  for first-time setup."
  else
    info "SSL certificates found"
  fi
fi

# ── Build & deploy ────────────────────────────────────────────────────────────
step "Building and starting services"
cd "$DEPLOY_DIR"

info "Pulling latest base images..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" pull redis db postgres:15 nginx:1.25-alpine certbot/certbot

info "Building and starting containers in background..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --build --remove-orphans

step "Deployment complete. Showing logs..."
info "Press Ctrl+C to stop viewing logs (containers will keep running in background)."
echo ""
$DOCKER_COMPOSE -f "$COMPOSE_FILE" logs -f --tail 100
