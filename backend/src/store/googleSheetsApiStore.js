const fs = require("fs");
const crypto = require("crypto");
// The per-API package, not the full `googleapis` monolith: same client, a few
// megabytes instead of a hundred, which matters when the function is bundled.
const { sheets: sheetsApi, auth: googleAuth } = require("@googleapis/sheets");
const { DEFAULT_HOURS, findNextSlot, addMinutes } = require("../scheduleUtils");
const HEADERS = require("./schema");

const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"];
const DEFAULT_SCHEDULE = DAY_KEYS.map((day) => ({
  id: day,
  open: DEFAULT_HOURS[day] ? DEFAULT_HOURS[day].open : "",
  close: DEFAULT_HOURS[day] ? DEFAULT_HOURS[day].close : ""
}));

function readCredentials(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    try {
      return JSON.parse(fs.readFileSync(value, "utf8"));
    } catch (__) {
      return null;
    }
  }
}

/**
 * Advanced alternative to the Apps Script connector: talks to the Google
 * Sheets API directly with a service account. Needs GOOGLE_SHEET_ID plus
 * GOOGLE_SERVICE_ACCOUNT_JSON (the JSON itself or a path to the key file),
 * and the spreadsheet shared with that service account as Editor.
 */
function createGoogleSheetsApiStore(config) {
  const spreadsheetId = config.googleSheetId;
  const credentials = readCredentials(config.googleServiceAccountJson);
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON and is not a readable key file");

  const auth = new googleAuth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = sheetsApi({ version: "v4", auth });
  let ready = null;

  async function ensureTabs() {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = new Set(meta.data.sheets.map((sheet) => sheet.properties.title));
    const missing = Object.keys(HEADERS).filter((name) => !existing.has(name));
    if (missing.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }
      });
    }
    for (const [name, headers] of Object.entries(HEADERS)) {
      const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${name}!1:1` });
      if (!current.data.values?.[0]?.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId, range: `${name}!A1`, valueInputOption: "RAW", requestBody: { values: [headers] }
        });
      }
    }
    const schedule = await rows("Schedule");
    if (!schedule.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: "Schedule!A:Z", valueInputOption: "RAW",
        requestBody: { values: DEFAULT_SCHEDULE.map((row) => HEADERS.Schedule.map((header) => row[header] ?? "")) }
      });
    }
  }

  function connect() {
    if (!ready) ready = ensureTabs().catch((err) => { ready = null; throw err; });
    return ready;
  }

  async function rows(name) {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${name}!A:Z` });
    const [headers = [], ...values] = result.data.values || [];
    return values
      .filter((row) => row.some((value) => value !== ""))
      .map((row, index) => {
        const item = { _row: index + 2 };
        headers.forEach((header, column) => { item[header] = row[column] ?? ""; });
        return item;
      });
  }

  async function list(name) {
    await connect();
    return (await rows(name)).map(strip);
  }

  function strip(row) {
    const { _row, ...rest } = row;
    return rest;
  }

  async function append(name, record) {
    await connect();
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: `${name}!A:Z`, valueInputOption: "RAW",
      requestBody: { values: [HEADERS[name].map((header) => record[header] ?? "")] }
    });
    return record;
  }

  async function update(name, id, patch) {
    await connect();
    const existing = (await rows(name)).find((row) => String(row.id) === String(id));
    if (!existing) return null;
    const record = { ...strip(existing), ...patch };
    await sheets.spreadsheets.values.update({
      spreadsheetId, range: `${name}!A${existing._row}:Z${existing._row}`, valueInputOption: "RAW",
      requestBody: { values: [HEADERS[name].map((header) => record[header] ?? "")] }
    });
    return record;
  }

  async function remove(name, id) {
    await connect();
    const existing = (await rows(name)).find((row) => String(row.id) === String(id));
    if (!existing) return false;
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = meta.data.sheets.find((sheet) => sheet.properties.title === name).properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: existing._row - 1, endIndex: existing._row } } }] }
    });
    return true;
  }

  // The Sheets API has no equivalent of the Apps Script lock, so bookings are
  // at least serialised inside this process before the slot search runs.
  let queue = Promise.resolve();
  function serialize(work) {
    const next = queue.then(work, work);
    queue = next.then(() => {}, () => {});
    return next;
  }

  return {
    async listBookings() {
      return list("Bookings");
    },

    async createBooking(data) {
      return append("Bookings", {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        status: "pending",
        reason: "",
        ...data
      });
    },

    async reserveBooking({ booking, open, close, durationMinutes }) {
      return serialize(async () => {
        const busy = (await list("Bookings")).filter((b) => b.date === booking.date && b.status !== "rejected" && b.status !== "cancelled");
        const time = findNextSlot({ open, close, durationMinutes, busy });
        if (!time) return null;
        return append("Bookings", {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          statusUpdatedAt: new Date().toISOString(),
          status: "pending",
          reason: "",
          ...booking,
          time,
          endTime: addMinutes(time, durationMinutes)
        });
      });
    },

    async updateBooking(id, patch) {
      return update("Bookings", id, { ...patch, statusUpdatedAt: new Date().toISOString() });
    },

    async deleteBooking(id) {
      await remove("Bookings", id);
    },

    async listBlockedIps() {
      return list("BlockedIps");
    },

    async isBanned(ip) {
      return (await list("BlockedIps")).some((row) => row.ip === ip);
    },

    async addBlockedIp({ ip, reason }) {
      if (await this.isBanned(ip)) return;
      await append("BlockedIps", { id: ip, ip, reason: reason || "", bannedAt: new Date().toISOString() });
    },

    async removeBlockedIp(ip) {
      await remove("BlockedIps", ip);
    },

    async getHours() {
      const hours = { ...DEFAULT_HOURS };
      (await list("Schedule")).forEach((row) => {
        const key = String(row.id);
        if (DAY_KEYS.includes(key)) hours[key] = row.open && row.close ? { open: row.open, close: row.close } : null;
      });
      return hours;
    },

    async setHours(hours) {
      const existing = new Set((await list("Schedule")).map((row) => String(row.id)));
      for (const day of DAY_KEYS) {
        const value = hours[day] || null;
        const data = { open: value ? value.open : "", close: value ? value.close : "" };
        if (existing.has(day)) await update("Schedule", day, data);
        else await append("Schedule", { id: day, ...data });
      }
      return hours;
    },

    async listAdminSubscribers() {
      return list("AdminSubscribers");
    },

    async addAdminSubscriber(subscription) {
      const existing = (await list("AdminSubscribers")).find((row) => row.endpoint === subscription.endpoint);
      const data = { ...subscription, createdAt: new Date().toISOString() };
      if (existing) return update("AdminSubscribers", existing.id, data);
      return append("AdminSubscribers", { id: crypto.randomUUID(), ...data });
    },

    async removeAdminSubscriber(endpoint) {
      const existing = (await list("AdminSubscribers")).find((row) => row.endpoint === endpoint);
      if (existing) await remove("AdminSubscribers", existing.id);
    }
  };
}

module.exports = createGoogleSheetsApiStore;
