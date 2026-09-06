const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const config = require("./src/config");
const { mode } = require("./src/store");
const publicRoutes = require("./src/routes/public");
const adminRoutes = require("./src/routes/admin");

const app = express();

if (config.trustProxy) app.set("trust proxy", 1);

// Sensible security headers. CSP stays off because the frontend uses inline
// styles and attributes, and COEP off so the hero videos keep playing.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);

// The frontend (index.html, css/, js/, images/, media/) lives one level up
// from backend/. Serving it here means the site's relative fetch("/api/...")
// calls and the admin session cookie are same-origin — no CORS, no proxy
// config needed for local use or a single combined deployment.
const FRONTEND_DIR = path.join(__dirname, "..");
// ...but only the frontend: everything else in the repository (server sources,
// .env, deployment files) must never be downloadable from the site.
const NOT_PUBLIC = /^\/(backend|netlify|scripts|dist|node_modules|\.[^/]+)(\/|$)/;

app.use((req, res, next) => {
  if (NOT_PUBLIC.test(req.path)) return res.status(404).json({ error: "not_found" });
  next();
});
app.use(express.static(FRONTEND_DIR, { index: "index.html" }));

app.use((req, res) => res.status(404).json({ error: "not_found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.locals.storageMode = mode;

module.exports = app;
