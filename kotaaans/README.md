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

Автодеплой настроен через GitHub Actions — при каждом пуше в `main` сервер сам подтягивает изменения.

Подробная инструкция по первоначальной настройке сервера: [DEPLOY.md](DEPLOY.md)

## Переменные окружения

Смотри [.env.example](.env.example)
