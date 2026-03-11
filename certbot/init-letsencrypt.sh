#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# init-letsencrypt.sh — Получить первый SSL-сертификат от Let's Encrypt.
#
# Использование:
#   1. Убедитесь, что DNS A-запись stockscreener.ru указывает на IP сервера.
#   2. Установите DOMAIN и EMAIL в .env.prod (или .env).
#   3. Запустите:  bash certbot/init-letsencrypt.sh
#   4. Затем:     docker compose -f docker-compose.prod.yml up -d
# ──────────────────────────────────────────────────────────────────────────────

set -e

if ! [ -x "$(command -v docker)" ]; then
  echo 'Error: docker is not installed.' >&2
  exit 1
fi

# Подтягиваем переменные окружения
if [ -f .env.prod ]; then
  export $(grep -v '^#' .env.prod | xargs)
elif [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DOMAIN=${DOMAIN:-"stockscreener.ru"}
domains=($DOMAIN www.$DOMAIN)
rsa_key_size=4096
data_path="./certbot"
email="${EMAIL:-gea54845@mail.ru}"
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

# Проверяем наличие существующих сертификатов (не просто папки certbot)
if [ -d "$data_path/conf/live/$DOMAIN" ]; then
  read -p "Existing certificate found for $DOMAIN. Continue and replace? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

# Скачиваем рекомендуемые TLS-параметры, если их ещё нет
if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  echo "### Downloading recommended TLS parameters ..."
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
  echo
fi

echo "### Creating dummy certificate for ${domains[*]} ..."
path="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "$data_path/conf/live/$DOMAIN"
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
# Создаём chain.pem (нужен для ssl_trusted_certificate в nginx)
cp "$data_path/conf/live/$DOMAIN/fullchain.pem" "$data_path/conf/live/$DOMAIN/chain.pem" 2>/dev/null || true
echo

echo "### Starting nginx ..."
docker compose -f docker-compose.prod.yml up --force-recreate -d nginx
echo

echo "### Deleting dummy certificate for ${domains[*]} ..."
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for ${domains[*]} ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Определяем аргумент email
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Включаем staging-режим если нужно (для тестирования)
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

echo "### Reloading nginx ..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ""
echo "✅  SSL certificate issued successfully for ${domains[*]}"
echo "📋  Auto-renewal is handled by the certbot service in docker-compose.prod.yml"
