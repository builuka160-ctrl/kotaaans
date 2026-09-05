const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const config = require("./src/config");
const publicRoutes = require("./src/routes/public");
const adminRoutes = require("./src/routes/admin");

const app = express();

if (config.trustProxy) app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

// The frontend (index.html, css/, js/, images/, media/) lives one level up
// from backend/. Serving it here means the site's relative fetch("/api/...")
// calls and the admin session cookie are same-origin — no CORS, no proxy
// config needed for local use or a single combined deployment.
const FRONTEND_DIR = path.join(__dirname, "..");
app.use(express.static(FRONTEND_DIR));

app.use((req, res) => res.status(404).json({ error: "not_found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.listen(config.port, () => {
  console.log(`Kotans Barber server listening on port ${config.port}`);
  console.log(`Storage: ${config.sheetsUrl ? "Google Sheets (Apps Script)" : "local JSON file (backend/data/db.json)"}`);
});
