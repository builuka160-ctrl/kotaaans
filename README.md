# Kotaaans Barbershop

Сайт барбершопа — портфолио, онлайн-запись, магазин и закрытая админка.

**Стек:** Node.js + Express + Supabase

---

## Локальный запуск

```bash
cp .env.example .env
# заполни .env реальными значениями

npm install
node server.js
```

## Деплой

### На сервер (Arch Linux + Cloudflare Tunnel)

Быстрый старт на Arch Linux:

```bash
# 1️⃣  Установить приложение
sudo bash -c 'curl -sSL https://raw.githubusercontent.com/builuka160-ctrl/kotaaans/main/install-and-run.sh | bash'

# 2️⃣  Настроить Cloudflare Tunnel
bash setup-cloudflare-tunnel.sh kotaaans.example.com
```

Подробная инструкция: [ARCH_LINUX_DEPLOY.md](ARCH_LINUX_DEPLOY.md)

### Автодеплой через GitHub Actions

Автодеплой настроен через GitHub Actions — при каждом пуше в `main` сервер сам подтягивает изменения.

Подробная инструкция по первоначальной настройке сервера: [DEPLOY.md](DEPLOY.md)

## Переменные окружения

Смотри [.env.example](.env.example)
