# Публикация Kotans Barber

Сайт можно разместить четырьмя способами. Во всех случаях фронтенд лежит в
корне репозитория (`index.html`, `css/`, `js/`, `images/`, `media/`), а API —
в `backend/`.

1. **Обычный Node.js-хостинг** — Render, Railway, Fly.io, VPS. Один постоянно
   работающий процесс отдаёт и сайт, и API. Самый простой вариант.
2. **Netlify** — дизайн и видео отдаёт CDN, а API записи и админ-панель
   исполняются в одной serverless-функции.
3. **Docker** — любой хостинг или VPS, где можно запустить контейнер.
4. **VPS без Docker** — Node.js 20+, PM2 и nginx/Caddy впереди.

Чисто статический хостинг без Node.js (например, GitHub Pages) не подойдёт: он
не может хранить пароль администратора, принимать заявки и обращаться к Google
Sheets.

## Главное перед публикацией

В настройках хостинга задайте переменные окружения (полный список —
`backend/.env.example`):

```text
NODE_ENV=production
ADMIN_PASSWORD=длинный_уникальный_пароль
SESSION_SECRET=длинная_случайная_строка
GOOGLE_SHEETS_URL=https://script.google.com/macros/s/.../exec
GOOGLE_SHEETS_TOKEN=значение_API_TOKEN_из_Apps_Script
TRUST_PROXY=1
COOKIE_SECURE=1
```

`GOOGLE_SHEETS_URL` на хостинге указывать **обязательно**: локальный файл
`backend/data/db.json` предназначен только для проверки на компьютере —
serverless и контейнеры очищают его при перезапуске.

`SESSION_SECRET` тоже обязателен: без него сессия администратора живёт до
перезапуска процесса, а на Netlify — до конца одного запроса.

## Подключение Google Sheets (Apps Script, без ключей Google Cloud)

1. Создайте пустую Google-таблицу.
2. `Extensions → Apps Script`, удалите шаблонный код и вставьте всё
   содержимое `backend/google-apps-script/Code.gs`.
3. `Project Settings → Script Properties` → добавьте свойство `API_TOKEN` с
   любой длинной случайной строкой. Это же значение пойдёт в
   `GOOGLE_SHEETS_TOKEN`.
4. В выпадающем списке функций выберите `setup` и нажмите **Run** — скрипт
   создаст вкладки `Bookings`, `BlockedIps`, `Schedule`, `AdminSubscribers`
   с нужными колонками. Повторный запуск данные не удаляет и добавляет
   недостающие колонки.
5. **Deploy → New deployment → Web app**. Execute as: **Me**, Who has access:
   **Anyone**. Подтвердите разрешения Google.
6. Скопируйте адрес, оканчивающийся на `/exec`, и вставьте его в
   `GOOGLE_SHEETS_URL` на хостинге (либо в `GOOGLE_SHEETS_WEB_APP_URL` в
   `backend/src/config.js`, если хостинг не умеет переменные окружения).

Ссылку `/exec` и `API_TOKEN` публиковать нельзя.

Альтернатива для тех, у кого уже есть сервисный аккаунт Google Cloud:
включите Sheets API, дайте сервисному аккаунту доступ Editor к таблице и
задайте `GOOGLE_SHEET_ID` и `GOOGLE_SERVICE_ACCOUNT_JSON` (сам JSON или путь
к файлу ключа). Тогда backend работает с таблицей напрямую, без Apps Script.

## Вариант 1 — Render или Railway

1. Загрузите проект в GitHub.
2. Создайте **Web Service** (Render) или **New Project** (Railway) и
   подключите репозиторий.
3. Укажите:

   ```text
   Build command: npm --prefix backend ci --omit=dev
   Start command: node backend/server.js
   ```

4. Добавьте переменные окружения из раздела «Главное перед публикацией».
5. `PORT` вручную не задавайте, если платформа выдаёт его сама — приложение
   использует `process.env.PORT`.
6. Подключите домен и убедитесь, что HTTPS включён.

`Procfile` в корне уже добавлен для панелей, которые читают его сами.

## Вариант 2 — Netlify

В проекте есть `netlify.toml` и функция `backend/netlify/functions/api.js`,
менять в коде ничего не нужно.

1. Загрузите проект в приватный GitHub-репозиторий.
2. В Netlify: **Add new project → Import an existing project**.
3. Netlify прочитает `netlify.toml`. Должно отображаться:

   ```text
   Build command:      npm --prefix backend ci --omit=dev && node scripts/build-static.js
   Publish directory:  dist
   Functions directory: backend/netlify/functions
   ```

   `scripts/build-static.js` собирает в `dist/` только фронтенд, поэтому
   исходники сервера на CDN не попадают.
4. Сначала выполните раздел про Google Sheets, затем в **Project
   configuration → Environment variables** добавьте переменные из раздела
   «Главное перед публикацией». В `netlify.toml` их писать нельзя.
5. Запустите Deploy, сделайте тестовую запись и проверьте строку в таблице.
6. В **Domain management** подключите домен. HTTPS Netlify выдаёт сам.

Все адреса `/api/...` автоматически уходят в защищённую функцию — в адресной
строке `/.netlify/functions/` не появляется.

## Вариант 3 — Docker

```bash
docker build -t kotans-barber .
docker run --rm -p 4000:4000 --env-file backend/.env kotans-barber
```

Откройте `http://localhost:4000`. На хостинге выберите развёртывание через
Dockerfile и задайте переменные окружения в панели, а не внутри образа.

## Вариант 4 — VPS без Docker

```bash
git clone <адрес-вашего-репозитория> kotaaans
cd kotaaans/backend
npm ci --omit=dev
cp .env.example .env
nano .env
npm start
```

Для постоянной работы — PM2:

```bash
npm install --global pm2
pm2 start server.js --name kotans-barber --cwd /srv/kotaaans/backend
pm2 save
pm2 startup
```

Впереди поставьте nginx или Caddy, подключите домен и HTTPS, проксируйте на
`http://127.0.0.1:4000` и передавайте заголовок `X-Forwarded-For`, а в `.env`
выставьте `TRUST_PROXY=1` — иначе блокировка IP будет блокировать сам прокси.

## Уведомления (необязательно)

Кнопки уведомлений на сайте и в админ-панели запрашивают разрешение браузера
и работают без всякой настройки. Чтобы уведомления приходили и при закрытой
вкладке, нужны ключи VAPID:

```bash
npx web-push generate-vapid-keys
```

Полученные значения задайте в `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY`. Тогда
backend отправляет push администраторам о новых заявках и клиенту — о решении
по его заявке; за показ уведомления отвечает `sw.js` в корне сайта.

## Проверка после публикации

1. Откройте опубликованный HTTPS-адрес с телефона.
2. Отправьте тестовую заявку.
3. Проверьте, что строка появилась во вкладке `Bookings` в Google Sheets.
4. Войдите в админ-панель, подтвердите и удалите тестовую заявку.
5. Убедитесь, что строка исчезла из таблицы.
6. Проверьте расписание: измените часы, сохраните, обновите страницу.
