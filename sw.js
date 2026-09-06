// Service worker for Web Push notifications about bookings.
// Registering it is optional: the site works without it, and the backend only
// sends anything once VAPID keys are configured (see backend/.env.example).
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(self.registration.showNotification(payload.title || "Kotans Barber", {
    body: payload.body || "",
    icon: "/images/logo.png",
    badge: "/images/logo.png",
    data: { url: payload.url || "/" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
