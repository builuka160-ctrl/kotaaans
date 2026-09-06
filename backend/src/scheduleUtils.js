// Day keys match JS Date#getDay() directly: 0 = Sunday ... 6 = Saturday.
// This is also exactly how the frontend's admin.dayN i18n keys are numbered.
const DEFAULT_HOURS = {
  0: null,
  1: { open: "09:00", close: "18:00" },
  2: { open: "09:00", close: "18:00" },
  3: { open: "09:00", close: "18:00" },
  4: { open: "09:00", close: "18:00" },
  5: { open: "09:00", close: "18:00" },
  6: null
};

// Duration (minutes) and displayed price per service, per locale — matches the
// price list from the brief and the exact "ask your barber" wording already
// used in the frontend's own translation dictionary (services.ask). Toning
// slots are 60 minutes, the length used by the client's own booking build.
const SERVICES = {
  haircut: { duration: 60, price: { ru: "20 €", lv: "20 €", en: "20 €" } },
  beard: { duration: 90, price: { ru: "20 €", lv: "20 €", en: "20 €" } },
  combo: { duration: 90, price: { ru: "35–40 €", lv: "35–40 €", en: "35–40 €" } },
  // "toning" is the generic toning request kept for compatibility with the
  // Apps Script price list; the frontend offers the two specific variants.
  toning: { duration: 60, price: { ru: "писать барберу", lv: "rakstiet bārddzinim", en: "message the barber" } },
  hairTone: { duration: 60, price: { ru: "писать барберу", lv: "rakstiet bārddzinim", en: "message the barber" } },
  beardTone: { duration: 60, price: { ru: "писать барберу", lv: "rakstiet bārddzinim", en: "message the barber" } }
};

const SERVICE_KEYS = Object.keys(SERVICES);

function priceFor(service, locale) {
  const entry = SERVICES[service];
  return entry.price[locale] || entry.price.en;
}

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addMinutes(hhmm, minutes) {
  return minutesToTime(timeToMinutes(hhmm) + minutes);
}

// The shop's calendar day, not the server's: a host in another timezone must
// not let a client book a date that is already in the past in Rēzekne.
function todayInRiga() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Riga" }).format(new Date());
}

function dayOfWeek(dateStr) {
  // Parsed as local midnight, not UTC, so the weekday matches the shop's calendar.
  return new Date(dateStr + "T00:00:00").getDay();
}

/**
 * Finds the first free slot of `durationMinutes` between open/close, given the
 * day's other non-rejected bookings. Returns "HH:MM" or null if the day is full.
 */
function findNextSlot({ open, close, durationMinutes, busy }) {
  const startMin = timeToMinutes(open);
  const endMin = timeToMinutes(close);
  const sorted = busy
    .map((b) => ({ start: timeToMinutes(b.time), end: timeToMinutes(b.endTime) }))
    .sort((a, b) => a.start - b.start);

  let cursor = startMin;
  for (const interval of sorted) {
    if (cursor + durationMinutes <= interval.start) return minutesToTime(cursor);
    cursor = Math.max(cursor, interval.end);
  }
  return cursor + durationMinutes <= endMin ? minutesToTime(cursor) : null;
}

module.exports = {
  DEFAULT_HOURS,
  SERVICES,
  SERVICE_KEYS,
  priceFor,
  timeToMinutes,
  minutesToTime,
  addMinutes,
  dayOfWeek,
  todayInRiga,
  findNextSlot
};
