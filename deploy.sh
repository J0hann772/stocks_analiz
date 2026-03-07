#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# deploy.sh — Обновление и перезапуск production-стека
#
# Использование:
#   bash deploy.sh
# ──────────────────────────────────────────────────────────────────

set -e

echo "--- 🔄 Обновление кода из Git ---"
git pull

echo "--- 🐳 Сборка и перезапуск контейнеров ---"
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "--- ✅ Деплой завершён! ---"
echo "[INFO] Press Ctrl+C to stop viewing logs (containers will keep running in background)."
echo ""

docker compose -f docker-compose.prod.yml logs -f
