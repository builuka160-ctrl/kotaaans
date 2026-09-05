const express = require("express");
const store = require("../store");
const rateLimiter = require("../rateLimiter");
const { SERVICES, SERVICE_KEYS, priceFor, dayOfWeek, findNextSlot, addMinutes } = require("../scheduleUtils");

const router = express.Router();

const bookingLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: 8 });

router.get("/config", (req, res) => {
  // Reserved for a future Web Push key; the current frontend just calls this
  // on load and ignores the result if it's empty.
  res.json({ pushPublicKey: "" });
});

router.get("/availability", async (req, res, next) => {
  try {
    const date = String(req.query.date || "");
    const service = String(req.query.service || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "validation" });
    if (service && !SERVICE_KEYS.includes(service)) return res.status(400).json({ error: "validation" });

    const hours = await store.getHours();
    const today = hours[dayOfWeek(date)];
    if (!today) return res.json({ closed: true });

    let available = true;
    if (service) {
      const bookingsThatDay = (await store.listBookings()).filter((b) => b.date === date && b.status !== "rejected");
      available = Boolean(findNextSlot({
        open: today.open,
        close: today.close,
        durationMinutes: SERVICES[service].duration,
        busy: bookingsThatDay
      }));
    }

    res.json({ closed: false, available, hours: today });
  } catch (err) {
    next(err);
  }
});

router.post("/bookings", bookingLimiter, async (req, res, next) => {
  try {
    const { name, age, service, date, locale } = req.body || {};

    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) return res.status(400).json({ error: "validation" });
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 12 || ageNum > 120) return res.status(400).json({ error: "validation" });
    if (!SERVICE_KEYS.includes(service)) return res.status(400).json({ error: "validation" });
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "validation" });
    const lang = ["ru", "lv", "en"].includes(locale) ? locale : "en";

    const ip = req.ip;
    if (await store.isBanned(ip)) return res.status(403).json({ error: "blocked" });

    const hours = await store.getHours();
    const today = hours[dayOfWeek(date)];
    if (!today) return res.status(409).json({ error: "closed" });

    const durationMinutes = SERVICES[service].duration;
    const bookingsThatDay = (await store.listBookings()).filter((b) => b.date === date && b.status !== "rejected");
    const time = findNextSlot({ open: today.open, close: today.close, durationMinutes, busy: bookingsThatDay });
    if (!time) return res.status(409).json({ error: "no_slot" });

    const booking = await store.createBooking({
      name: name.trim(),
      age: ageNum,
      service,
      date,
      time,
      endTime: addMinutes(time, durationMinutes),
      price: priceFor(service, lang),
      ip
    });

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
