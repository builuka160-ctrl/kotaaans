const crypto = require("crypto");
const config = require("./config");

const COOKIE_NAME = "kotans_admin_sid";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

// Stateless, HMAC-signed session token. Nothing is kept in process memory, so
// the same cookie keeps working across a restart, behind several instances and
// inside a Netlify function — where an in-memory session map would be lost
// between invocations. Without SESSION_SECRET a random one is generated at
// boot, which just means sessions end when the process does.
const secret = config.sessionSecret || crypto.randomBytes(32).toString("hex");

function sign(payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && Number(data.exp) > Date.now();
  } catch (_) {
    return false;
  }
}

function createSession(res) {
  res.cookie(COOKIE_NAME, createToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: SESSION_TTL_MS,
    path: "/"
  });
}

function destroySession(req, res) {
  res.clearCookie(COOKIE_NAME, { path: "/", sameSite: "lax", secure: config.cookieSecure });
}

function isAuthenticated(req) {
  return verifyToken(req.cookies?.[COOKIE_NAME]);
}

function requireAdmin(req, res, next) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: "unauthorized" });
  next();
}

module.exports = { createSession, destroySession, isAuthenticated, requireAdmin };
