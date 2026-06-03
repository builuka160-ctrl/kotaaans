# Kotaaans — деплой на Arch Linux (Node.js)

## 1. Установка Node.js

```bash
sudo pacman -S nodejs npm
node -v   # >= 18.17
```

## 2. Создание пользователя и папки

```bash
sudo useradd -r -s /bin/false -d /srv/kotaaans kotaaans
sudo mkdir -p /srv/kotaaans
sudo chown kotaaans:kotaaans /srv/kotaaans
```

## 3. Загрузка файлов проекта

```bash
sudo cp -r ./kotaaans-prod/. /srv/kotaaans/
sudo chown -R kotaaans:kotaaans /srv/kotaaans
```

## 4. Настройка переменных окружения

```bash
sudo cp /srv/kotaaans/.env.example /srv/kotaaans/.env
sudo nano /srv/kotaaans/.env
```

Заполни реальные значения:
```
PORT=3000
NODE_ENV=production
ALLOWED_ORIGIN=https://твой-домен.lv
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
ADMIN_EMAILS=admin@твой-домен.lv
```

```bash
sudo chmod 600 /srv/kotaaans/.env
```

## 5. Установка зависимостей

```bash
cd /srv/kotaaans
sudo -u kotaaans npm ci --omit=dev
```

## 6. Установка systemd-сервиса

```bash
sudo cp /srv/kotaaans/kotaaans.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kotaaans
sudo systemctl start kotaaans
sudo systemctl status kotaaans
```

## 7. Nginx как reverse proxy (рекомендуется)

```bash
sudo pacman -S nginx
```

Создай `/etc/nginx/sites-available/kotaaans`:
```nginx
server {
    listen 80;
    server_name твой-домен.lv www.твой-домен.lv;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name твой-домен.lv www.твой-домен.lv;

    ssl_certificate     /etc/letsencrypt/live/твой-домен.lv/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/твой-домен.lv/privkey.pem;

    client_max_body_size 35M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/kotaaans /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable --now nginx
```

## 8. SSL-сертификат (Let's Encrypt)

```bash
sudo pacman -S certbot certbot-nginx
sudo certbot --nginx -d твой-домен.lv -d www.твой-домен.lv
```

## Полезные команды

```bash
sudo systemctl restart kotaaans       # перезапуск
sudo journalctl -u kotaaans -f        # логи в реальном времени
sudo journalctl -u kotaaans -n 100    # последние 100 строк логов
curl http://localhost:3000/healthz    # проверка работы
```
