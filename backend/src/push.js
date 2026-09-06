const config = require("./config");

// Web Push is optional: without VAPID keys every helper here is a no-op, so the
// booking flow keeps working exactly as before on a host that has none.
const enabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey);

let webpush = null;
if (enabled) {
  webpush = require("web-push");
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
}

function toSubscription(row) {
  if (!row || !row.endpoint) return null;
  const p256dh = row.p256dh || row.keys?.p256dh;
  const auth = row.auth || row.keys?.auth;
  return p256dh && auth ? { endpoint: row.endpoint, keys: { p256dh, auth } } : null;
}

/** Accepts either the browser's PushSubscription JSON or our flat row shape. */
function normalizeSubscription(value) {
  if (!value || typeof value !== "object") return null;
  const endpoint = String(value.endpoint || "").trim().slice(0, 2000);
  const p256dh = String(value.keys?.p256dh || value.p256dh || "").trim().slice(0, 1000);
  const auth = String(value.keys?.auth || value.auth || "").trim().slice(0, 1000);
  return endpoint && p256dh && auth ? { endpoint, p256dh, auth } : null;
}

async function send(row, payload) {
  const subscription = toSubscription(row);
  if (!enabled || !subscription) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    // 404/410 mean the browser dropped the subscription; anything else is
    // logged and ignored so a push failure never fails the booking request.
    if (err.statusCode === 404 || err.statusCode === 410) return "gone";
    console.error("push failed:", err.statusCode || err.message);
    return false;
  }
}

/** Notifies every staff browser that subscribed from the admin panel. */
async function notifyAdmins(store, payload) {
  if (!enabled || typeof store.listAdminSubscribers !== "function") return;
  const subscribers = await store.listAdminSubscribers();
  const results = await Promise.all(subscribers.map((row) => send(row, payload)));
  await Promise.all(
    subscribers
      .filter((_, index) => results[index] === "gone")
      .map((row) => store.removeAdminSubscriber(row.endpoint).catch(() => {}))
  );
}

/** Notifies the client who left the booking, if their browser subscribed. */
async function notifyBooking(booking, payload) {
  if (!enabled) return;
  await send({ endpoint: booking?.pushEndpoint, p256dh: booking?.pushP256dh, auth: booking?.pushAuth }, payload);
}

module.exports = { enabled, publicKey: config.vapidPublicKey, normalizeSubscription, notifyAdmins, notifyBooking };
