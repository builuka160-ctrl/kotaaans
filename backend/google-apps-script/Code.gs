/**
 * Kotans Barber — Google Sheets backend.
 *
 * Turns this spreadsheet into a tiny JSON CRUD API so the Node backend can
 * use it as its database with nothing more than a pasted Web App URL.
 *
 * SETUP
 * 1. Create a new Google Sheet (any name).
 * 2. Extensions -> Apps Script, delete the placeholder code, paste this file.
 * 3. Project Settings (gear icon) -> Script Properties -> Add property:
 *      name: API_TOKEN   value: <any long random string>
 *    (Optional but recommended — without it, anyone with the URL can write
 *    to your sheet.)
 * 4. Deploy -> New deployment -> select type "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Copy the "Web app URL" and paste it into backend/.env as
 *    GOOGLE_SHEETS_URL. Paste the same API_TOKEN value into
 *    GOOGLE_SHEETS_TOKEN.
 * 6. Run the `setup` function once from the Apps Script editor (select it in
 *    the toolbar dropdown and click Run) so the three tabs and their headers
 *    get created. Re-running it later is safe, it won't erase data.
 */

const SHEETS = {
  Bookings: ["id", "createdAt", "name", "age", "service", "date", "time", "endTime", "price", "status", "reason", "ip", "statusUpdatedAt"],
  BlockedIps: ["id", "ip", "reason", "bannedAt"],
  // id is the weekday number (0 = Sunday ... 6 = Saturday, matches JS Date#getDay()).
  // Empty open/close means the shop is closed that day.
  Schedule: ["id", "open", "close"]
};

const DEFAULT_SCHEDULE_ROWS = [
  ["0", "", ""],
  ["1", "09:00", "18:00"],
  ["2", "09:00", "18:00"],
  ["3", "09:00", "18:00"],
  ["4", "09:00", "18:00"],
  ["5", "09:00", "18:00"],
  ["6", "", ""]
];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach((name) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SHEETS[name]);
    }
  });

  const scheduleSheet = ss.getSheetByName("Schedule");
  if (scheduleSheet.getLastRow() <= 1) {
    DEFAULT_SCHEDULE_ROWS.forEach((row) => scheduleSheet.appendRow(row));
  }
}

function checkToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty("API_TOKEN");
  if (!expected) return true; // no token configured: open access (not recommended)
  return token === expected;
}

function getSheet(name) {
  if (!SHEETS[name]) throw new Error("Unknown sheet: " + name);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    setup();
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

function sheetToRows(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const params = e.parameter || {};
    if (!checkToken(params.token)) return jsonResponse({ error: "unauthorized" });
    if (params.action !== "list") return jsonResponse({ error: "unknown_action" });

    const sheet = getSheet(params.sheet);
    return jsonResponse({ rows: sheetToRows(sheet) });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    if (!checkToken(body.token)) return jsonResponse({ error: "unauthorized" });

    const sheet = getSheet(body.sheet);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    if (body.action === "append") {
      const data = body.data || {};
      const id = data.id !== undefined && data.id !== "" ? data.id : Utilities.getUuid();
      const row = headers.map((h) => (h === "id" ? id : data[h] !== undefined ? data[h] : ""));
      sheet.appendRow(row);
      const result = {};
      headers.forEach((h, i) => { result[h] = row[i]; });
      return jsonResponse({ row: result });
    }

    if (body.action === "update") {
      const rows = sheet.getDataRange().getValues();
      const idCol = headers.indexOf("id");
      for (let r = 1; r < rows.length; r++) {
        if (String(rows[r][idCol]) === String(body.id)) {
          const patch = body.data || {};
          headers.forEach((h, i) => {
            if (h !== "id" && patch[h] !== undefined) {
              sheet.getRange(r + 1, i + 1).setValue(patch[h]);
            }
          });
          const updated = sheet.getRange(r + 1, 1, 1, headers.length).getValues()[0];
          const result = {};
          headers.forEach((h, i) => { result[h] = updated[i]; });
          return jsonResponse({ row: result });
        }
      }
      return jsonResponse({ error: "not_found" });
    }

    if (body.action === "delete") {
      const rows = sheet.getDataRange().getValues();
      const idCol = headers.indexOf("id");
      for (let r = 1; r < rows.length; r++) {
        if (String(rows[r][idCol]) === String(body.id)) {
          sheet.deleteRow(r + 1);
          return jsonResponse({ ok: true });
        }
      }
      return jsonResponse({ error: "not_found" });
    }

    return jsonResponse({ error: "unknown_action" });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}
