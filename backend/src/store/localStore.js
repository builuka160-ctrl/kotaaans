const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DEFAULT_HOURS } = require("../scheduleUtils");

const DB_PATH = path.join(__dirname, "..", "..", "data", "db.json");

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (_) {
    return { bookings: [], blockedIps: [], hours: { ...DEFAULT_HOURS } };
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/** JSON-file store used when GOOGLE_SHEETS_URL is not configured yet. */
function createLocalStore() {
  return {
    async listBookings() {
      return readDb().bookings;
    },

    async createBooking(data) {
      const db = readDb();
      const booking = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        status: "pending",
        reason: "",
        ...data
      };
      db.bookings.push(booking);
      writeDb(db);
      return booking;
    },

    async updateBooking(id, patch) {
      const db = readDb();
      const idx = db.bookings.findIndex((b) => b.id === id);
      if (idx === -1) return null;
      db.bookings[idx] = { ...db.bookings[idx], ...patch, statusUpdatedAt: new Date().toISOString() };
      writeDb(db);
      return db.bookings[idx];
    },

    async deleteBooking(id) {
      const db = readDb();
      db.bookings = db.bookings.filter((b) => b.id !== id);
      writeDb(db);
    },

    async listBlockedIps() {
      return readDb().blockedIps;
    },

    async isBanned(ip) {
      return readDb().blockedIps.some((row) => row.ip === ip);
    },

    async addBlockedIp({ ip, reason }) {
      const db = readDb();
      if (!db.blockedIps.some((row) => row.ip === ip)) {
        db.blockedIps.push({ ip, reason: reason || "", bannedAt: new Date().toISOString() });
        writeDb(db);
      }
    },

    async removeBlockedIp(ip) {
      const db = readDb();
      db.blockedIps = db.blockedIps.filter((row) => row.ip !== ip);
      writeDb(db);
    },

    async getHours() {
      const db = readDb();
      return { ...DEFAULT_HOURS, ...db.hours };
    },

    async setHours(hours) {
      const db = readDb();
      db.hours = hours;
      writeDb(db);
      return hours;
    }
  };
}

module.exports = createLocalStore;
