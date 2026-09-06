require("dotenv").config();

// Быстрое подключение: вставьте сюда URL развёрнутого Apps Script Web App.
// Google API credentials и service-account файлы не используются.
const GOOGLE_SHEETS_WEB_APP_URL = "";

// Netlify runs the API as a serverless function, so anything that relies on
// process memory surviving between requests (sessions, rate-limit counters)
// has to be stateless there.
const isNetlify = process.env.NETLIFY === "true";

module.exports = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  isNetlify,
  adminPassword: process.env.ADMIN_PASSWORD || "change-me",
  // Signs the admin session cookie. Left empty, a random secret is generated at
  // boot, which simply means open sessions end when the process restarts.
  sessionSecret: (process.env.SESSION_SECRET || "").trim(),
  trustProxy: process.env.TRUST_PROXY === "1" || isNetlify,
  // Set COOKIE_SECURE=1 once the site is served over HTTPS so the admin
  // session cookie gets the Secure flag. Leave it off for local http testing.
  cookieSecure: process.env.COOKIE_SECURE === "1" || process.env.NODE_ENV === "production" || isNetlify,

  // --- Storage ------------------------------------------------------------
  // 1. Apps Script Web App URL (simplest, no Google Cloud credentials).
  sheetsUrl: (GOOGLE_SHEETS_WEB_APP_URL || process.env.GOOGLE_SHEETS_URL || process.env.GOOGLE_APPS_SCRIPT_URL || "").trim(),
  sheetsToken: (process.env.GOOGLE_SHEETS_TOKEN || process.env.APPS_SCRIPT_SECRET || "").trim(),
  // 2. Direct Google Sheets API with a service account (advanced alternative).
  googleSheetId: (process.env.GOOGLE_SHEET_ID || "").trim(),
  googleServiceAccountJson: (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim(),

  // --- Web Push (optional) ------------------------------------------------
  // Generate a key pair once with `npx web-push generate-vapid-keys`.
  vapidPublicKey: (process.env.VAPID_PUBLIC_KEY || "").trim(),
  vapidPrivateKey: (process.env.VAPID_PRIVATE_KEY || "").trim(),
  vapidSubject: (process.env.VAPID_SUBJECT || "mailto:kotans.barber@gmail.com").trim()
};
