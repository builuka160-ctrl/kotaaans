# Kotans Barber — backend

Express API for the Kotans Barber site. It also serves the frontend
directly (see `server.js`), so `npm start` gives you the whole site on one
port with no CORS or proxy setup needed. Storage is a Google Sheet, reached
through a single pasted Apps Script Web App URL.

## Quick start

```bash
cp .env.example .env      # edit ADMIN_PASSWORD
npm install
npm start                 # http://localhost:4000 — the whole site
```

With `GOOGLE_SHEETS_URL` left empty, everything is stored in
`backend/data/db.json` so you can develop and test the whole flow first.

## Connecting Google Sheets

1. Create a new Google Sheet.
2. `Extensions -> Apps Script`, delete the placeholder, paste the contents
   of `google-apps-script/Code.gs`.
3. `Project Settings` (gear icon) -> `Script Properties` -> add
   `API_TOKEN` = any long random string (shared secret; skip only if you
   don't mind the sheet being writable by anyone who gets the URL).
4. In the Apps Script editor, pick `setup` in the function dropdown and
   click **Run** once — creates the `Bookings`, `BlockedIps` and `Schedule`
   tabs with the right columns and default working hours.
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
- **Keep the frontend on Netlify:** deploy `backend/` separately and use
  the `netlify.toml` at the repo root, which proxies `/api/*` to the
  backend URL. The browser still sees one origin, so the admin cookie
  works. Fill in `YOUR-BACKEND-URL` in that file first.

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

## Booking rules

- A client picks a service and a date (native date input, no time picker).
- `GET /api/availability?date=...&service=...` tells the frontend if that
  day is open and still has a suitable slot, without exposing an exact time.
- `POST /api/bookings` computes the first free slot that fits in that day's
  hours, given other pending+accepted bookings. Durations/prices per
  service live in `src/scheduleUtils.js` (`SERVICES`): haircut 60 min/20 €,
  beard 90 min/20 €, combo 90 min/35–40 €, hair/beard toning 30 min each,
  price "message the barber" (no fixed slot length was specified for these in
  the brief, so a 30-minute placeholder consultation slot is booked —
  adjust `SERVICES` if the real barber wants a different length).
- No slot fits that day → `409 {"error":"no_slot"}`. Closed day → `409
  {"error":"closed"}`. Banned IP → `403 {"error":"blocked"}`.
- `POST /api/bookings` is rate-limited (8 requests / 10 min / IP) as basic
  anti-spam alongside manual IP banning.

## Environment variables

See `.env.example`. Change `ADMIN_PASSWORD` before going live, and set
`COOKIE_SECURE=1` once served over HTTPS.
