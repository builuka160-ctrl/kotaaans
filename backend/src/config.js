require("dotenv").config();

// Быстрое подключение: вставьте сюда URL развёрнутого Apps Script Web App.
// Google API credentials и service-account файлы не используются.
const GOOGLE_SHEETS_WEB_APP_URL = "";

module.exports = {
  port: Number(process.env.PORT) || 4000,
  adminPassword: process.env.ADMIN_PASSWORD || "change-me",
  trustProxy: process.env.TRUST_PROXY === "1",
  // Set COOKIE_SECURE=1 once the site is served over HTTPS so the admin
  // session cookie gets the Secure flag. Leave it off for local http testing.
  cookieSecure: process.env.COOKIE_SECURE === "1",
  sheetsUrl: (GOOGLE_SHEETS_WEB_APP_URL || process.env.GOOGLE_SHEETS_URL || "").trim(),
  sheetsToken: (process.env.GOOGLE_SHEETS_TOKEN || "").trim()
};
