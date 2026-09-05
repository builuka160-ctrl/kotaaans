# Kotans Barber · Rēzekne

Barbershop booking site with a light-first editorial frontend, an optional dark
theme, purple accents and a seven-day booking line. `backend/` is the Express
API it talks to, storing everything in a Google Sheet via a single pasted Apps
Script link.

## Run everything

```bash
cd backend
cp .env.example .env   # set ADMIN_PASSWORD
npm install
npm start
```

Open `http://localhost:4000/` — the backend serves the frontend itself, so
`js/app.js`'s `fetch('/api/...')` calls work with no extra setup. See
`backend/README.md` for connecting Google Sheets and for the alternative
(frontend on Netlify + `netlify.toml` proxy to a separately hosted backend).

## What's implemented, mapped to the brief

- **Google Sheets via Apps Script, just a pasted link** —
  `backend/google-apps-script/Code.gs` is the Sheets-side API; paste the Web
  App URL into `backend/src/config.js` (an optional shared token is supported).
- **Admin panel** (footer "Administrator"): accept/reject requests with a
  rejection reason, permanently delete a request, block/unblock an IP, see
  and edit the full week's schedule — including turning weekends on or off
  and setting each day's start/end hours.
- **Price list**: Haircut 20€, Beard trim 20€, Haircut + beard 35–40€,
  hair/beard toning — "ask your barber" (no fixed price; see
  `backend/README.md` for the placeholder slot length used for scheduling).
- **Booking flow**: the client picks a service and one of the next seven
  available days, never an exact time — the backend assigns the first free
  slot in that day's hours, and the admin then confirms or declines it.

## Repository layout

```
index.html, css/, js/, images/, media/   — responsive frontend
backend/                                  — Express API + Apps Script
netlify.toml                              — optional Netlify->backend proxy
```

## Still needed before launch

See `TODO-client.md`.
