#!/bin/bash
set -e

echo "=== Deploy started: $(date) ==="

cd /srv/kotaaans

# Тянем свежий код
git pull origin main

# Устанавливаем только новые зависимости
npm ci --omit=dev

# Перезапускаем сервис
sudo systemctl restart kotaaans

echo "=== Deploy done: $(date) ==="
