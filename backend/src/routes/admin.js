const express = require("express");
const crypto = require("crypto");
const config = require("../config");
const store = require("../store");
const { createSession, destroySession, isAuthenticated, requireAdmin } = require("../auth");
const rateLimiter = require("../rateLimiter");

const router = express.Router();

const loginLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get("/me", (req, res) => {
  res.json({ isAdmin: isAuthenticated(req) });
});

router.post("/login", loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== "string" || !timingSafeEqual(password, config.adminPassword)) {
    return res.status(401).json({ error: "wrong_password" });
  }
  createSession(res);
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.use(requireAdmin);

router.get("/bookings", async (req, res, next) => {
  try {
    res.json({ bookings: await store.listBookings() });
  } catch (err) {
    next(err);
  }
});

router.patch("/bookings/:id", async (req, res, next) => {
  try {
    const { action, reason } = req.body || {};
    let patch;
    if (action === "accept") {
      patch = { status: "accepted", reason: "" };
    } else if (action === "reject") {
      if (typeof reason !== "string" || !reason.trim()) return res.status(400).json({ error: "validation" });
      patch = { status: "rejected", reason: reason.trim().slice(0, 300) };
    } else {
      return res.status(400).json({ error: "validation" });
    }
    const booking = await store.updateBooking(req.params.id, patch);
    if (!booking) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, booking });
  } catch (err) {
    next(err);
  }
});

router.delete("/bookings/:id", async (req, res, next) => {
  try {
    await store.deleteBooking(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/settings", async (req, res, next) => {
  try {
    res.json({ hours: await store.getHours() });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    const { hours } = req.body || {};
    if (!hours || typeof hours !== "object") return res.status(400).json({ error: "validation" });
    const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    for (const day of ["0", "1", "2", "3", "4", "5", "6"]) {
      const value = hours[day];
      if (value !== null && (!value || !validTime.test(value.open) || !validTime.test(value.close) || value.open >= value.close)) {
        return res.status(400).json({ error: "validation", field: day });
      }
    }
    res.json({ hours: await store.setHours(hours) });
  } catch (err) {
    next(err);
  }
});

router.get("/blocked-ips", async (req, res, next) => {
  try {
    res.json({ blockedIps: await store.listBlockedIps() });
  } catch (err) {
    next(err);
  }
});

router.post("/blocked-ips", async (req, res, next) => {
  try {
    const { ip, reason } = req.body || {};
    if (typeof ip !== "string" || !ip.trim()) return res.status(400).json({ error: "validation" });
    await store.addBlockedIp({ ip: ip.trim(), reason: (reason || "").slice(0, 200) });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/blocked-ips/:ip", async (req, res, next) => {
  try {
    await store.removeBlockedIp(req.params.ip);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
