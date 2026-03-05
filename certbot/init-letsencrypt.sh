#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# init-letsencrypt.sh — Get first SSL certificate from Let's Encrypt.
#
# HOW TO USE:
#   1. Point stockscreener.ru DNS A-record to your server IP.
#   2. Copy the whole project to the server.
#   3. Run:  bash certbot/init-letsencrypt.sh
#   4. Then start production stack:  docker compose -f docker-compose.prod.yml up -d
# ──────────────────────────────────────────────────────────────────────────────

set -e

DOMAINS=("stockscreener.ru" "www.stockscreener.ru")
EMAIL="your@email.com"      # ← ЗАМЕНИ на реальный email (для уведомлений о продлении)
STAGING=0                   # 1 = тест-режим Let's Encrypt, 0 = боевой

DATA_PATH="./certbot"

echo "### Starting Certbot SSL init..."

# Create required dirs
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

# Download recommended TLS settings
echo "### Downloading recommended TLS settings..."
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
  -o "$DATA_PATH/conf/options-ssl-nginx.conf" || true
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
  -o "$DATA_PATH/conf/ssl-dhparams.pem" || true

# Create dummy cert so nginx can start on first run
echo "### Creating dummy certificate for ${DOMAINS[0]}..."
DUMMY_PATH="$DATA_PATH/conf/live/${DOMAINS[0]}"
mkdir -p "$DUMMY_PATH"
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  certbot/certbot \
  certonly --standalone --non-interactive --agree-tos \
  --email "$EMAIL" \
  --force-renewal \
  -d "${DOMAINS[0]}" \
  $([ $STAGING -eq 1 ] && echo "--staging" || echo "") \
  2>&1 || {
    # Fallback: generate a self-signed dummy
    openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
      -keyout "$DUMMY_PATH/privkey.pem" \
      -out    "$DUMMY_PATH/fullchain.pem" \
      -subj "/CN=${DOMAINS[0]}"
    cp "$DUMMY_PATH/fullchain.pem" "$DUMMY_PATH/chain.pem"
  }

# Start nginx so certbot can verify the domain
echo "### Starting nginx for domain verification..."
docker compose -f docker-compose.prod.yml up --force-recreate -d nginx

# Obtain real certificate
echo "### Requesting Let's Encrypt certificate..."
DOMAIN_ARGS=""
for d in "${DOMAINS[@]}"; do DOMAIN_ARGS="$DOMAIN_ARGS -d $d"; done

docker compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  $DOMAIN_ARGS \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  $([ $STAGING -eq 1 ] && echo "--staging" || echo "") \
  --force-renewal

echo "### Reloading nginx..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "✅  SSL certificate issued successfully for ${DOMAINS[*]}"
echo "📋  Auto-renewal: Certbot service in docker-compose.prod.yml renews certificates automatically."
