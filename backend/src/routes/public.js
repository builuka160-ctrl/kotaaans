const express = require("express");
const { store, mode } = require("../store");
const push = require("../push");
const rateLimiter = require("../rateLimiter");
const { SERVICES, SERVICE_KEYS, priceFor, dayOfWeek, todayInRiga, findNextSlot } = require("../scheduleUtils");

const router = express.Router();

const bookingLimiter = rateLimiter({ windowMs: 10 * 60 * 1000, max: 8 });

router.get("/config", (req, res) => {
  // pushPublicKey stays empty until VAPID keys are configured; the frontend
  // reads this on load and simply keeps notifications local without one.
  res.json({ pushPublicKey: push.publicKey, storageMode: mode });
});

// A banned IP is turned away from every public endpoint, not just the booking
// form, so a blocked visitor cannot keep probing availability either. The
// admin API is mounted under the same /api prefix and is deliberately exempt,
// otherwise blocking the shop's own address would lock the panel out — and
// unblocking it again would be impossible.
router.use(async (req, res, next) => {
  try {
    if (req.path.startsWith("/admin")) return next();
    if (await store.isBanned(req.ip)) return res.status(403).json({ error: "blocked" });
    next();
  } catch (err) {
    next(err);
  }
});

router.get("/availability", async (req, res, next) => {
  try {
    const date = String(req.query.date || "");
    const service = String(req.query.service || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "validation" });
    if (service && !SERVICE_KEYS.includes(service)) return res.status(400).json({ error: "validation" });

    const hours = await store.getHours();
    const today = hours[dayOfWeek(date)];
    if (!today || date < todayInRiga()) return res.json({ closed: true });

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
    const { name, age, service, date, locale, subscription } = req.body || {};

    if (typeof name !== "string") return res.status(400).json({ error: "validation" });
    const fullName = name.trim().replace(/\s+/g, " ");
    // The form asks for name and surname, so a single word is rejected here too.
    if (fullName.split(" ").filter(Boolean).length < 2 || fullName.length > 100) return res.status(400).json({ error: "validation" });
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 12 || ageNum > 120) return res.status(400).json({ error: "validation" });
    if (!SERVICE_KEYS.includes(service)) return res.status(400).json({ error: "validation" });
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "validation" });
    // A date already gone in Rēzekne can never be served, whatever the host's clock says.
    if (date < todayInRiga()) return res.status(400).json({ error: "validation" });
    const lang = ["ru", "lv", "en"].includes(locale) ? locale : "en";

    const hours = await store.getHours();
    const today = hours[dayOfWeek(date)];
    if (!today) return res.status(409).json({ error: "closed" });

    const durationMinutes = SERVICES[service].duration;
    // Optional: the client's browser push subscription, so the barber's
    // decision can reach them later. Absent for browsers that said no.
    const clientPush = push.normalizeSubscription(subscription);

    const booking = await store.reserveBooking({
      booking: {
        name: fullName,
        age: ageNum,
        service,
        date,
        price: priceFor(service, lang),
        ip: req.ip,
        locale: lang,
        pushEndpoint: clientPush?.endpoint || "",
        pushP256dh: clientPush?.p256dh || "",
        pushAuth: clientPush?.auth || ""
      },
      open: today.open,
      close: today.close,
      durationMinutes
    });
    if (!booking) return res.status(409).json({ error: "no_slot" });

    // Fire and forget: a push problem must not fail a booking that was saved.
    push.notifyAdmins(store, {
      title: "Kotans Barber",
      body: `${booking.name} · ${booking.date} ${booking.time}`,
      url: "/"
    }).catch(() => {});

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
