#!/bin/bash
# Скрипт для установки и запуска kotaaans на Arch Linux с Cloudflare Tunnel

set -e

echo "🚀 Установка kotaaans на Arch Linux с Cloudflare Tunnel..."

# Проверка root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Скрипт должен запуститься с sudo"
  exit 1
fi

# Переменные
INSTALL_DIR="/opt/kotaaans"
SERVICE_USER="kotaaans"
SERVICE_NAME="kotaaans"
TUNNEL_NAME="kotaaans-tunnel"

# API ключи Supabase
SUPABASE_URL="https://zcxncvwxxvtazdhddfet.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_DnGQ754Q9UraQ4reMcjdhg_SHB_u7LU"
SUPABASE_SERVICE_KEY="sb_secret_4LwyCAxo_YpK6tk4ywPxkQ_u5fOUuk4"
ADMIN_EMAILS="admin@kotaaans.lv"
ALLOWED_ORIGIN="https://kotaaans.lv"

# 1. Установка зависимостей
echo "📦 Установка зависимостей..."
pacman -Sy --noconfirm nodejs npm git

# 2. Создание пользователя для сервиса
echo "👤 Создание пользователя $SERVICE_USER..."
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd -r -s /bin/bash -d "$INSTALL_DIR" "$SERVICE_USER"
fi

# 3. Клонирование репо
echo "📥 Клонирование репо..."
if [ -d "$INSTALL_DIR" ]; then
  cd "$INSTALL_DIR"
  git pull origin main
else
  git clone https://github.com/builuka160-ctrl/kotaaans.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 4. Установка Node зависимостей
echo "📚 Установка npm пакетов..."
npm install --production

# 5. Создание .env файла с API ключами
echo "⚙️  Настройка .env..."
cat > "$INSTALL_DIR/.env" << EOF
PORT=3000
NODE_ENV=production
ALLOWED_ORIGIN=$ALLOWED_ORIGIN
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
ADMIN_EMAILS=$ADMIN_EMAILS
EOF

echo "✅ .env файл создан с API ключами"

# 6. Установка Cloudflare Tunnel (warp-cli/cloudflared)
echo "☁️  Установка Cloudflare Tunnel..."
pacman -S --noconfirm cloudflare-warp-bin 2>/dev/null || {
  echo "📥 Установка cloudflared через yay..."
  if ! command -v yay &> /dev/null; then
    pacman -S --noconfirm yay
  fi
  yay -S --noconfirm cloudflare-warp-bin
}

# 7. Установка systemd сервиса для приложения
echo "🔧 Установка systemd сервиса..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Kotaaans Node.js Application
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
Environment="NODE_ENV=production"
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kotaaans

[Install]
WantedBy=multi-user.target
EOF

# 8. Установка Cloudflare Tunnel сервиса
echo "🌐 Настройка Cloudflare Tunnel..."
cat > /etc/systemd/system/${SERVICE_NAME}-tunnel.service << EOF
[Unit]
Description=Cloudflare Tunnel for Kotaaans
After=${SERVICE_NAME}.service
Requires=${SERVICE_NAME}.service

[Service]
Type=simple
User=${SERVICE_USER}
ExecStart=/usr/bin/cloudflared tunnel run ${TUNNEL_NAME}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kotaaans-tunnel

[Install]
WantedBy=multi-user.target
EOF

# 9. Разрешения папок
echo "🔐 Установка разрешений..."
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"

# 10. Reload systemd и запуск сервисов
echo "🚀 Запуск сервисов..."
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}.service
systemctl start ${SERVICE_NAME}.service

systemctl enable ${SERVICE_NAME}-tunnel.service
systemctl start ${SERVICE_NAME}-tunnel.service

# 11. Вывод информации
echo ""
echo "✅ Установка завершена!"
echo ""
echo "📋 Статус сервиса:"
systemctl status ${SERVICE_NAME}.service --no-pager
echo ""
echo "🌐 Статус Cloudflare Tunnel:"
systemctl status ${SERVICE_NAME}-tunnel.service --no-pager
echo ""
echo "📝 Полезные команды:"
echo "  # Просмотр логов приложения:"
echo "  journalctl -u ${SERVICE_NAME}.service -f"
echo ""
echo "  # Просмотр логов Tunnel:"
echo "  journalctl -u ${SERVICE_NAME}-tunnel.service -f"
echo ""
echo "  # Перезагрузка приложения:"
echo "  systemctl restart ${SERVICE_NAME}.service"
echo ""
echo "  # Редактирование .env:"
echo "  sudo nano $INSTALL_DIR/.env"
echo ""
echo "⚠️  ВАЖНО: Отредактируй .env и добавь API ключи Supabase:"
echo "  sudo nano $INSTALL_DIR/.env"
echo ""
echo "☁️  Для настройки Cloudflare Tunnel:"
echo "  cloudflared tunnel login"
echo "  cloudflared tunnel create ${TUNNEL_NAME}"
echo ""
