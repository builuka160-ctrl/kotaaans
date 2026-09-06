# Kotans Barber — backend

Express API for the Kotans Barber site. It also serves the frontend
directly (see `app.js`), so `npm start` gives you the whole site on one
port with no CORS or proxy setup needed. Storage is a Google Sheet, reached
through a single pasted Apps Script Web App URL.

## Quick start

```bash
cp .env.example .env      # edit ADMIN_PASSWORD
npm install
npm start                 # http://localhost:4000 — the whole site
npm test                  # API smoke tests (booking, admin, blocking)
```

With no Google Sheets connection configured, everything is stored in
`backend/data/db.json` so you can develop and test the whole flow first.
That file is development-only: serverless hosts and containers wipe it.

## Storage modes

The startup log prints which one was picked:

| Mode | Chosen when | Notes |
| --- | --- | --- |
| `google-apps-script` | `GOOGLE_SHEETS_URL` (or `GOOGLE_APPS_SCRIPT_URL`) is set | Recommended. One pasted Web App URL, no Google Cloud credentials. |
| `google-sheets-api` | `GOOGLE_SHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` are set | Direct Sheets API for setups that already have a service account. |
| `local-file` | neither of the above | `data/db.json`. Development only. |

All three share the same tab and column layout (`src/store/schema.js`):
`Bookings`, `BlockedIps`, `Schedule`, `AdminSubscribers`.

## Connecting Google Sheets

1. Create a new Google Sheet.
2. `Extensions -> Apps Script`, delete the placeholder, paste the contents
   of `google-apps-script/Code.gs`.
3. `Project Settings` (gear icon) -> `Script Properties` -> add
   `API_TOKEN` = any long random string (shared secret; skip only if you
   don't mind the sheet being writable by anyone who gets the URL).
4. In the Apps Script editor, pick `setup` in the function dropdown and
   click **Run** once — creates the `Bookings`, `BlockedIps`, `Schedule` and
   `AdminSubscribers` tabs with the right columns and default working hours.
   Re-run it after updating the script: it adds new columns without touching
   existing rows.
5. `Deploy -> New deployment -> Web app`. Execute as **Me**, who has access
   **Anyone**. Deploy and copy the Web app URL.
6. Paste that URL into `GOOGLE_SHEETS_WEB_APP_URL` at the top of
   `src/config.js`. No Google credentials or service-account file is needed.
   For hosted deployments you can alternatively use `GOOGLE_SHEETS_URL` in
   `.env`. `GOOGLE_SHEETS_TOKEN` remains optional hardening.
7. Restart the backend. The startup log line says which storage it picked.

That's the entire integration — one Apps Script Web App URL.

## How the frontend and backend fit together

`js/app.js` (unmodified — it's the file you provided) calls relative paths
like `fetch('/api/bookings')`, with no configurable base URL. Two ways to
serve that:

- **Combined (default, recommended):** `backend/server.js` serves the
  frontend itself via `express.static`, so frontend and API are the same
  origin automatically. Deploy `backend/` as one Node app anywhere (Render,
  Railway, a VPS...) and point your domain at it.
- **Netlify:** the CDN serves the frontend and `netlify/functions/api.js`
  runs this same Express app (`app.js`) as one serverless function for
  `/api/*`. Set `SESSION_SECRET` there — the admin cookie is a signed token
  precisely so it survives a host with no shared process memory. A proxy to
  a separately hosted backend is still possible; the commented-out redirect
  in `netlify.toml` does that. Full steps: `HOSTING.md`.

`app.js` builds the app and `server.js` only starts listening, which is what
lets the serverless function and the tests reuse it. Static serving covers
the frontend only: `/backend/...`, `/netlify/...`, dotfiles and the like are
404, so server sources and `.env` are never downloadable.

## Admin panel

Session-cookie auth, matching the frontend exactly:

- `POST /api/admin/login` `{ password }` sets an httpOnly session cookie
  valid 12 hours (password = `ADMIN_PASSWORD`).
- `GET /api/admin/me` → `{ isAdmin }`, used by the admin dialog to decide
  whether to show the login form or the panel.
- `POST /api/admin/logout` clears the session.
- `GET /api/admin/bookings`, `PATCH /api/admin/bookings/:id` (`{action:
  "accept"}` or `{action: "reject", reason}`), `DELETE
  /api/admin/bookings/:id` (permanent delete, including from Sheets).
- `GET`/`PUT /api/admin/settings` — the weekly schedule, keyed `"0"`–`"6"`
  (JS `Date#getDay()`, 0 = Sunday). Each day is `null` (closed) or `{open,
  close}`. This is exactly how weekends get turned on/off and hours changed.
- `GET`/`POST /api/admin/blocked-ips`, `DELETE /api/admin/blocked-ips/:ip`.
  A banned IP is refused on every public endpoint, but never on `/api/admin/*`
  — otherwise banning the shop's own address would lock the panel out.
- `POST`/`DELETE /api/admin/push-subscriptions` — register or drop a staff
  browser's Web Push subscription.

## Booking rules

- A client picks a service and a date (native date input, no time picker).
- `GET /api/availability?date=...&service=...` tells the frontend if that
  day is open and still has a suitable slot, without exposing an exact time.
- `POST /api/bookings` computes the first free slot that fits in that day's
  hours, given other pending+accepted bookings. Durations/prices per
  service live in `src/scheduleUtils.js` (`SERVICES`): haircut 60 min/20 €,
  beard 90 min/20 €, combo 90 min/35–40 €, hair/beard toning 60 min each,
  price "message the barber" (the toning length matches the client's own
  booking build; adjust `SERVICES` if the real barber wants a different one).
- Finding the slot and writing the booking are atomic: the Apps Script
  `reserve` action holds a script lock, the local store does the whole
  read-modify-write synchronously, and the Sheets API store serialises
  requests in process. Two clients submitting together get different times.
- A date already in the past in Rēzekne (`Europe/Riga`, not the server's
  timezone) is refused, and the name field must contain a name and a surname.
- No slot fits that day → `409 {"error":"no_slot"}`. Closed day → `409
  {"error":"closed"}`. Banned IP → `403 {"error":"blocked"}`.
- `POST /api/bookings` is rate-limited (8 requests / 10 min / IP) as basic
  anti-spam alongside manual IP banning.

## Notifications

Optional. With `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` set
(`npx web-push generate-vapid-keys`), `src/push.js` sends the barber a push
for every new request and the client a push when it is accepted or declined.
`GET /api/config` hands the public key to the frontend, and `sw.js` in the
repo root displays the notifications. Without keys nothing is sent and the
site's notification buttons stay simple permission prompts. A failed push is
logged and never fails the booking itself.

## Environment variables

See `.env.example`. Change `ADMIN_PASSWORD` before going live, set a long
`SESSION_SECRET` (required on Netlify), and set `COOKIE_SECURE=1` once served
over HTTPS.
