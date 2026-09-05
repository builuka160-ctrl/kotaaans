const { DEFAULT_HOURS } = require("../scheduleUtils");

const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"];

/**
 * Talks to the Google Apps Script Web App (see google-apps-script/Code.gs)
 * which exposes a tiny JSON CRUD API backed by a Google Sheet.
 */
function createSheetsStore(config) {
  const { sheetsUrl, sheetsToken } = config;

  async function call(method, params, body) {
    const url = new URL(sheetsUrl);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: body ? JSON.stringify({ token: sheetsToken, ...body }) : undefined
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (_) {
      throw new Error("Apps Script returned a non-JSON response: " + text.slice(0, 200));
    }
    if (!res.ok || json.error) throw new Error("Apps Script error: " + (json.error || res.statusText));
    return json;
  }

  async function listRows(sheet) {
    const json = await call("GET", { action: "list", sheet, token: sheetsToken });
    return json.rows || [];
  }

  async function appendRow(sheet, data) {
    return (await call("POST", {}, { action: "append", sheet, data })).row;
  }

  async function updateRow(sheet, id, patch) {
    return (await call("POST", {}, { action: "update", sheet, id, data: patch })).row;
  }

  async function deleteRow(sheet, id) {
    await call("POST", {}, { action: "delete", sheet, id });
  }

  return {
    async listBookings() {
      return listRows("Bookings");
    },

    async createBooking(data) {
      return appendRow("Bookings", {
        status: "pending",
        reason: "",
        createdAt: new Date().toISOString(),
        statusUpdatedAt: new Date().toISOString(),
        ...data
      });
    },

    async updateBooking(id, patch) {
      return updateRow("Bookings", id, { ...patch, statusUpdatedAt: new Date().toISOString() });
    },

    async deleteBooking(id) {
      await deleteRow("Bookings", id);
    },

    async listBlockedIps() {
      return listRows("BlockedIps");
    },

    async isBanned(ip) {
      const rows = await listRows("BlockedIps");
      return rows.some((row) => row.ip === ip);
    },

    async addBlockedIp({ ip, reason }) {
      const rows = await listRows("BlockedIps");
      if (rows.some((row) => row.ip === ip)) return;
      await appendRow("BlockedIps", { id: ip, ip, reason: reason || "", bannedAt: new Date().toISOString() });
    },

    async removeBlockedIp(ip) {
      await deleteRow("BlockedIps", ip);
    },

    async getHours() {
      const rows = await listRows("Schedule");
      const hours = { ...DEFAULT_HOURS };
      rows.forEach((row) => {
        const key = String(row.id);
        if (DAY_KEYS.includes(key)) {
          hours[key] = row.open && row.close ? { open: row.open, close: row.close } : null;
        }
      });
      return hours;
    },

    async setHours(hours) {
      const rows = await listRows("Schedule");
      const existing = new Set(rows.map((r) => String(r.id)));
      for (const day of DAY_KEYS) {
        const value = hours[day] || null;
        const data = { open: value ? value.open : "", close: value ? value.close : "" };
        if (existing.has(day)) await updateRow("Schedule", day, data);
        else await appendRow("Schedule", { id: day, ...data });
      }
      return hours;
    }
  };
}

module.exports = createSheetsStore;
