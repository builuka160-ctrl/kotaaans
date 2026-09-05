const crypto = require("crypto");
const config = require("./config");

const COOKIE_NAME = "kotans_admin_sid";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h, matches the previous token lifetime

// Single-process in-memory session store. Fine for one small shop's server;
// a multi-instance deployment would need a shared store instead.
const sessions = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [id, expiresAt] of sessions) {
    if (expiresAt < now) sessions.delete(id);
  }
}

function createSession(res) {
  pruneExpired();
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, Date.now() + SESSION_TTL_MS);
  res.cookie(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: SESSION_TTL_MS,
    path: "/"
  });
}

function destroySession(req, res) {
  const id = req.cookies?.[COOKIE_NAME];
  if (id) sessions.delete(id);
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

function isAuthenticated(req) {
  const id = req.cookies?.[COOKIE_NAME];
  if (!id) return false;
  const expiresAt = sessions.get(id);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: "unauthorized" });
  next();
}

module.exports = { createSession, destroySession, isAuthenticated, requireAdmin };
