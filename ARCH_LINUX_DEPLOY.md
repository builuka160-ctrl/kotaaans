# Развертывание Kotaaans на Arch Linux с Cloudflare Tunnel

Этот документ описывает, как развернуть приложение Kotaaans на Arch Linux сервере с использованием Cloudflare Tunnel.

## Требования

- Arch Linux
- Root доступ (sudo)
- Cloudflare аккаунт (для Tunnel)

## Быстрая установка

### 1. Загрузить скрипт установки

```bash
sudo bash -c 'curl -sSL https://raw.githubusercontent.com/builuka160-ctrl/kotaaans/main/install-and-run.sh | bash'
```

Или скачать и запустить локально:

```bash
wget https://raw.githubusercontent.com/builuka160-ctrl/kotaaans/main/install-and-run.sh
sudo bash install-and-run.sh
```

### 2. Настроить Cloudflare Tunnel

После установки нужно создать и запустить Cloudflare Tunnel:

```bash
# Авторизоваться в Cloudflare
cloudflared tunnel login

# Создать новый tunnel
cloudflared tunnel create kotaaans-tunnel

# Удалить существующий сервис и переконфигурировать
sudo systemctl stop kotaaans-tunnel
sudo systemctl disable kotaaans-tunnel
```

Затем отредактировать конфиг Cloudflare Tunnel (обычно `~/.cloudflared/config.yml`):

```yaml
tunnel: kotaaans-tunnel
credentials-file: /home/your-user/.cloudflared/zcxncvwxxvtazdhddfet.json

ingress:
  - hostname: kotaaans.example.com
    service: http://localhost:3000
  - service: http_status:404
```

Запустить tunnel:

```bash
cloudflared tunnel run kotaaans-tunnel
```

## Структура установки

- **Приложение**: `/opt/kotaaans/`
- **Пользователь сервиса**: `kotaaans`
- **Systemd сервис**: `kotaaans.service`
- **Cloudflare Tunnel сервис**: `kotaaans-tunnel.service`

## Полезные команды

### Просмотр логов приложения

```bash
sudo journalctl -u kotaaans.service -f
```

### Просмотр логов Tunnel

```bash
sudo journalctl -u kotaaans-tunnel.service -f
```

### Перезагрузка приложения

```bash
sudo systemctl restart kotaaans.service
```

### Проверка статуса

```bash
sudo systemctl status kotaaans.service
sudo systemctl status kotaaans-tunnel.service
```

## Переменные окружения

Все переменные окружения хранятся в `/opt/kotaaans/.env`

Основные переменные:
- `PORT` — порт приложения (default: 3000)
- `NODE_ENV` — окружение (production/development)
- `SUPABASE_URL` — URL Supabase проекта
- `SUPABASE_ANON_KEY` — публичный API ключ
- `SUPABASE_SERVICE_KEY` — приватный API ключ
- `ADMIN_EMAILS` — почта администратора
- `ALLOWED_ORIGIN` — разрешенные источники для CORS

## Обновление приложения

```bash
cd /opt/kotaaans
sudo git pull origin main
sudo npm install --production
sudo systemctl restart kotaaans.service
```

## Troubleshooting

### Приложение не запускается

```bash
sudo journalctl -u kotaaans.service -n 50
```

Проверить, что `.env` файл содержит правильные значения:

```bash
sudo cat /opt/kotaaans/.env
```

### Cloudflare Tunnel не подключается

```bash
sudo journalctl -u kotaaans-tunnel.service -n 50
cloudflared tunnel status kotaaans-tunnel
```

### Ошибка разрешений

Убедиться, что пользователь `kotaaans` имеет разрешения на папку:

```bash
sudo chown -R kotaaans:kotaaans /opt/kotaaans
```

## Безопасность

⚠️ **Важно**: 
- Не коммитьте реальные API ключи в публичный репо
- Используйте GitHub Secrets для CI/CD
- Регулярно ротируйте Supabase ключи
- Ограничивайте доступ к серверу через firewall

## Лицензия

MIT
