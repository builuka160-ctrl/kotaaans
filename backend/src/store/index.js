const config = require("../config");

// Three storage modes, in order of preference:
//   1. Google Sheets through the Apps Script Web App URL — one pasted link,
//      no Google Cloud credentials (see google-apps-script/Code.gs).
//   2. Google Sheets through the API with a service account, for setups that
//      already have one (GOOGLE_SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON).
//   3. A local JSON file, so the API works out of the box for development.
//      Serverless hosts and containers wipe it, so it is not for production.
function pick() {
  if (config.sheetsUrl) return { store: require("./sheetsStore")(config), mode: "google-apps-script" };
  if (config.googleSheetId && config.googleServiceAccountJson) {
    return { store: require("./googleSheetsApiStore")(config), mode: "google-sheets-api" };
  }
  return { store: require("./localStore")(), mode: "local-file" };
}

module.exports = pick();
