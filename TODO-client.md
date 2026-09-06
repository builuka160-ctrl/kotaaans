# Перед публикацией

## Backend
- Задать `ADMIN_PASSWORD` и длинный случайный `SESSION_SECRET` в
  `backend/.env` (сейчас там заглушки). Без `SESSION_SECRET` вход в админку
  слетает при каждом перезапуске, а на Netlify не работает вовсе.
- Настроить Google Sheets: создать таблицу, вставить `backend/google-apps-script/Code.gs`,
  один раз запустить `setup`, задеплоить как Web App и вставить ссылку в
  `GOOGLE_SHEETS_WEB_APP_URL` в `backend/src/config.js` (или в переменную
  `GOOGLE_SHEETS_URL`). Подробности — `backend/README.md`.
- Выбрать способ деплоя — пошагово всё описано в `HOSTING.md`:
  - **Проще всего**: задеплоить проект целиком (backend сам отдаёт фронтенд)
    на Render/Railway/VPS и направить домен туда.
  - **Netlify**: `netlify.toml` и `backend/netlify/functions/api.js` уже
    готовы, фронт отдаёт CDN, API работает как serverless-функция.
  - **Docker**: в корне есть `Dockerfile`.
- После этого обновления на сервере появились новые зависимости
  (`helmet`, `web-push`, `serverless-http`, `@googleapis/sheets`). В
  `/srv/kotaaans/deploy.sh` (его запускает GitHub Action) должен быть шаг
  `npm --prefix backend ci --omit=dev` перед перезапуском.
- Когда сайт будет на HTTPS — выставить `COOKIE_SECURE=1` и `TRUST_PROXY=1`
  в `.env` (за прокси/хостингом без этого блокировка IP работает неверно).

## Уведомления (необязательно)
- Чтобы уведомления приходили при закрытой вкладке, сгенерировать ключи
  `npx web-push generate-vapid-keys` и задать `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY`. Бэкенд и service worker `sw.js` уже готовы: барберу
  придёт push о новой заявке, клиенту — о решении по его заявке.
- Сейчас фронтенд только спрашивает разрешение браузера и не подписывается
  на push (`js/app.js` оставлен без изменений). Когда ключи появятся, нужно
  добавить в него регистрацию `sw.js` и отправку подписки на
  `POST /api/admin/push-subscriptions` (админ) и в теле заявки (клиент).

## Проверить содержание
- Длительность консультаций по тонированию — сейчас 60 мин (значение из
  проекта заказчика `kotans-barber-booking`, было 30). Подтвердить с
  барбером и при необходимости поправить в `backend/src/scheduleUtils.js`.
- Проверить финальные тексты и переводы RU/LV/EN в `js/app.js` перед публикацией.
