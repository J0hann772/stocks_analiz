# stockscreener.ru — Инструкция по деплою

## Требования на сервере

- Linux (Ubuntu 22.04 рекомендуется)
- Docker >= 24.0
- Docker Compose v2 (`docker compose`)
- DNS: A-запись `stockscreener.ru` и `www.stockscreener.ru` → IP сервера

---

## Первый деплой

### 1. deploy.sh — всё автоматически

```bash
# Первый деплой (клонирует repo, настраивает SSL)
bash <(curl -s https://raw.githubusercontent.com/J0hann772/stocks_analiz/main/deploy.sh) --init
```

Или если уже скачан:

```bash
# Первый деплой (с получением SSL)
bash deploy.sh --init

# Обновление без rebuild
bash deploy.sh

# Обновление с полной пересборкой
bash deploy.sh --rebuild
```

### 2. Что делает скрипт автоматически

1. Клонирует / обновляет repo с `https://github.com/J0hann772/stocks_analiz.git`
2. Если `.env` нет — просит заполнить из шаблона `.env.prod`
3. При `--init` получает SSL-сертификат от Let's Encrypt
4. Обновляет базовые образы (pull), **пересобирает** проект и запускает все сервисы в фоне
5. **Автоматически выводит логи** (`docker compose logs -f`) после запуска

### 3. Единственное, что нужно сделать вручную

```bash
# Перед первым запуском — заполни реальные секреты
cp .env.prod .env
nano .env
```

---

## Последующие обновления

```bash
git pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

## Полезные команды

```bash
# Логи API
docker logs stock_analyzer_api -f

# Логи nginx
docker logs stock_nginx -f

# Ошибки SSL
docker logs stock_certbot -f

# Проверка сертификата
docker compose -f docker-compose.prod.yml run --rm certbot certificates

# Принудительное продление сертификата
docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal

# Перезагрузить nginx (после обновления конфига)
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## Структура файлов деплоя

```
docker-compose.prod.yml   # Продакшн-конфиг (nginx + certbot + все сервисы)
nginx/
  nginx.conf              # Основная конфигурация: rate-limit, bad-bot block, логи
  conf.d/
    default.conf          # HTTPS, SSL, прокси на api/frontend, WebSocket
certbot/
  init-letsencrypt.sh     # Скрипт первичного получения сертификата
  conf/                   # SSL сертификаты (НЕ в git!)
  www/                    # Webroot для ACME challenge
.env.prod                 # Шаблон prod-переменных (НЕ в git!)
backend/core/
  logging_config.py       # Централизованный логгинг с timestamp
```

---

## Защита от DDoS и сканеров

В `nginx/conf.d/default.conf` настроено:

- **Rate limiting**: 10 req/s для API, 3 req/s для авторизации, burst-защита
- **Блокировка путей**: `/.env`, `/.git`, `/wp-admin`, `/phpmyadmin`, SQL/backup-файлы → **403**
- **Блокировка User-Agent**: nikto, sqlmap, nmap, masscan, zgrab и другие → **444** (drop)
- **HSTS**: HTTP Strict Transport Security на год вперёд
- **Скрытие версии**: nginx не раскрывает свою версию

## Логирование

- Все сервисы: формат `2026-03-05 23:15:00 [ERROR] ...`
- Шум (request-логи, SQL-запросы, httpx connection) — отключён
- Все ошибки (ERROR и выше) всегда выводятся
- Nginx access-лог: ISO8601 формат в `/var/log/nginx/access.log`
