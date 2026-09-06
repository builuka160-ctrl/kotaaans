const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DEFAULT_HOURS, findNextSlot, addMinutes } = require("../scheduleUtils");

// LOCAL_DB_PATH exists so tests (and a host with a writable volume elsewhere)
// can point the file somewhere other than backend/data/db.json.
const DB_PATH = process.env.LOCAL_DB_PATH
  ? path.resolve(process.env.LOCAL_DB_PATH)
  : path.join(__dirname, "..", "..", "data", "db.json");

function readDb() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    db.bookings = db.bookings || [];
    db.blockedIps = db.blockedIps || [];
    db.adminSubscribers = db.adminSubscribers || [];
    db.hours = db.hours || { ...DEFAULT_HOURS };
    return db;
  } catch (_) {
    return { bookings: [], blockedIps: [], hours: { ...DEFAULT_HOURS }, adminSubscribers: [] };
  }
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/** JSON-file store used when no Google Sheets connection is configured yet. */
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

    /**
     * Picks the first free slot and writes the booking in one go. Reading,
     * choosing and writing happen without an await in between, so two requests
     * arriving together can never be handed the same slot.
     */
    async reserveBooking({ booking, open, close, durationMinutes }) {
      const db = readDb();
      const busy = db.bookings.filter((b) => b.date === booking.date && b.status !== "rejected" && b.status !== "cancelled");
      const time = findNextSlot({ open, close, durationMinutes, busy });
      if (!time) return null;
      const record = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        status: "pending",
        reason: "",
        ...booking,
        time,
        endTime: addMinutes(time, durationMinutes)
      };
      db.bookings.push(record);
      writeDb(db);
      return record;
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
    },

    async listAdminSubscribers() {
      return readDb().adminSubscribers;
    },

    async addAdminSubscriber(subscription) {
      const db = readDb();
      db.adminSubscribers = db.adminSubscribers.filter((row) => row.endpoint !== subscription.endpoint);
      db.adminSubscribers.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...subscription });
      writeDb(db);
    },

    async removeAdminSubscriber(endpoint) {
      const db = readDb();
      db.adminSubscribers = db.adminSubscribers.filter((row) => row.endpoint !== endpoint);
      writeDb(db);
    }
  };
}

module.exports = createLocalStore;
