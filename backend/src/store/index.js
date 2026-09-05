const config = require("../config");

// Google Sheets (via the Apps Script Web App URL) is the store once a URL is
// pasted into .env; otherwise everything is kept in a local JSON file so the
// API works out of the box for development.
module.exports = config.sheetsUrl
  ? require("./sheetsStore")(config)
  : require("./localStore")();
