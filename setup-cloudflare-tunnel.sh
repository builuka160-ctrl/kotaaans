#!/bin/bash
# Скрипт для быстрой настройки Cloudflare Tunnel для Kotaaans

set -e

TUNNEL_NAME="kotaaans-tunnel"
DOMAIN="${1:-kotaaans.example.com}"
PORT="${2:-3000}"

echo "🌐 Настройка Cloudflare Tunnel для Kotaaans"
echo "📍 Туннель: $TUNNEL_NAME"
echo "🔗 Домен: $DOMAIN"
echo "🚪 Порт: $PORT"
echo ""

# Проверка cloudflared
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared не установлен"
    echo "Установите: yay -S cloudflare-warp-bin"
    exit 1
fi

# Проверка авторизации
echo "🔑 Проверка авторизации Cloudflare..."
if [ ! -d ~/.cloudflared ]; then
    echo "⚠️  Сначала нужно авторизоваться:"
    echo "   cloudflared tunnel login"
    exit 1
fi

# Получить учетные данные
CERT_FILE=$(ls ~/.cloudflared/*.json 2>/dev/null | head -1)
if [ -z "$CERT_FILE" ]; then
    echo "⚠️  Не найдены учетные данные. Авторизуйтесь:"
    echo "   cloudflared tunnel login"
    exit 1
fi

ACCOUNT_ID=$(jq -r '.AccountID' "$CERT_FILE" 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ Не удалось получить Account ID"
    exit 1
fi

echo "✅ Авторизация найдена"
echo ""

# Создать туннель
echo "🔧 Создание туннеля '$TUNNEL_NAME'..."
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "⚠️  Туннель '$TUNNEL_NAME' уже существует"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
else
    echo "Создаю новый туннель..."
    TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" | grep -oP '(?<=\().*(?=\))')
fi

echo "✅ Туннель ID: $TUNNEL_ID"
echo ""

# Создать конфиг
CONFIG_FILE="$HOME/.cloudflared/config.yml"

echo "📝 Создание конфига Cloudflare Tunnel..."
cat > "$CONFIG_FILE" << EOF
tunnel: $TUNNEL_NAME
credentials-file: $CERT_FILE

ingress:
  - hostname: $DOMAIN
    service: http://localhost:$PORT
  - service: http_status:404
EOF

echo "✅ Конфиг создан: $CONFIG_FILE"
echo ""

# Маршруты DNS
echo "📍 Конфигурирование маршрутов DNS..."
echo ""
echo "Для подключения домена, добавьте CNAME запись в DNS:"
echo "  Имя: @ (или поддомен)"
echo "  Целевой хост: $TUNNEL_ID.cfargotunnel.com"
echo ""
echo "Например, для Route 53 или других DNS хостов:"
echo "  $DOMAIN CNAME $TUNNEL_ID.cfargotunnel.com"
echo ""

# Опция для создания systemd сервиса
read -p "Создать systemd сервис для автозапуска? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Создание systemd сервиса..."

    sudo bash -c "cat > /etc/systemd/system/cloudflare-tunnel.service << 'SYSTEMD'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=$(which cloudflared) tunnel run $TUNNEL_NAME
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflare-tunnel

[Install]
WantedBy=multi-user.target
SYSTEMD"

    sudo systemctl daemon-reload
    sudo systemctl enable cloudflare-tunnel.service
    sudo systemctl start cloudflare-tunnel.service

    echo "✅ Сервис создан и запущен"
    echo ""
    echo "Команды управления:"
    echo "  sudo systemctl status cloudflare-tunnel.service"
    echo "  sudo journalctl -u cloudflare-tunnel.service -f"
else
    echo "⏭️  Пропуск создания systemd сервиса"
    echo ""
    echo "Для запуска туннеля вручную:"
    echo "  cloudflared tunnel run $TUNNEL_NAME"
fi

echo ""
echo "✨ Настройка завершена!"
echo ""
echo "Проверить статус туннеля:"
echo "  cloudflared tunnel status $TUNNEL_NAME"
echo ""
echo "Просмотреть логи:"
echo "  sudo journalctl -u cloudflare-tunnel.service -f"
