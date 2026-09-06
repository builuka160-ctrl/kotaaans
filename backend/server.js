const app = require("./app");
const config = require("./src/config");
const push = require("./src/push");

app.listen(config.port, () => {
  console.log(`Kotans Barber server listening on port ${config.port}`);
  console.log(`Storage: ${app.locals.storageMode}`);
  console.log(`Web Push: ${push.enabled ? "on" : "off (no VAPID keys)"}`);
});
