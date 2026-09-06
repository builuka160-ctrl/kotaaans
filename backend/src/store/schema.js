// Tab names and column order shared by every Google Sheets code path: the
// Apps Script connector (google-apps-script/Code.gs), the direct Sheets API
// store and the docs. Add new columns at the end so existing sheets keep
// working — the readers look columns up by header name.
module.exports = {
  Bookings: [
    "id", "createdAt", "name", "age", "service", "date", "time", "endTime",
    "price", "status", "reason", "ip", "statusUpdatedAt", "locale",
    "pushEndpoint", "pushP256dh", "pushAuth"
  ],
  BlockedIps: ["id", "ip", "reason", "bannedAt"],
  // id is the weekday number (0 = Sunday ... 6 = Saturday, JS Date#getDay()).
  Schedule: ["id", "open", "close"],
  AdminSubscribers: ["id", "endpoint", "p256dh", "auth", "createdAt"]
};
