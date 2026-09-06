const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "kotans-test-"));
process.env.LOCAL_DB_PATH = path.join(dbDir, "db.json");
process.env.ADMIN_PASSWORD = "test-password";
process.env.SESSION_SECRET = "test-secret";

const app = require("../app");

let baseUrl;
let server;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(dbDir, { recursive: true, force: true });
});

function call(pathname, options = {}) {
  return fetch(baseUrl + pathname, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
}

/** Next Monday, which DEFAULT_HOURS always has open. */
function nextMonday() {
  const date = new Date();
  date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return date.toISOString().slice(0, 10);
}

const workday = nextMonday();

test("config reports the storage mode", async () => {
  const res = await call("/api/config");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { pushPublicKey: "", storageMode: "local-file" });
});

test("availability answers for an open day", async () => {
  const res = await call(`/api/availability?date=${workday}&service=haircut`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.closed, false);
  assert.equal(body.available, true);
});

test("a booking gets the first free slot, the next one the slot after it", async () => {
  const first = await call("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ name: "Jānis Bērziņš", age: 30, service: "haircut", date: workday, locale: "lv" })
  });
  assert.equal(first.status, 201);
  const one = (await first.json()).booking;
  assert.equal(one.time, "09:00");
  assert.equal(one.endTime, "10:00");
  assert.equal(one.status, "pending");

  const second = await call("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ name: "Anna Kalniņa", age: 25, service: "beard", date: workday, locale: "ru" })
  });
  const two = (await second.json()).booking;
  assert.equal(two.time, "10:00");
  assert.equal(two.endTime, "11:30");
});

test("a date already past in Rēzekne is refused", async () => {
  const res = await call("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ name: "Test Client", age: 30, service: "haircut", date: "2020-01-06" })
  });
  assert.equal(res.status, 400);
});

test("the form asks for name and surname, so one word is refused", async () => {
  const res = await call("/api/bookings", {
    method: "POST",
    body: JSON.stringify({ name: "Jānis", age: 30, service: "haircut", date: workday })
  });
  assert.equal(res.status, 400);
});

test("admin endpoints need the session cookie", async () => {
  assert.equal((await call("/api/admin/bookings")).status, 401);

  const wrong = await call("/api/admin/login", { method: "POST", body: JSON.stringify({ password: "nope" }) });
  assert.equal(wrong.status, 401);

  const login = await call("/api/admin/login", { method: "POST", body: JSON.stringify({ password: "test-password" }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie()[0].split(";")[0];

  const list = await call("/api/admin/bookings", { headers: { cookie } });
  assert.equal(list.status, 200);
  const { bookings } = await list.json();
  assert.equal(bookings.length, 2);

  const accept = await call(`/api/admin/bookings/${bookings[0].id}`, {
    method: "PATCH", headers: { cookie }, body: JSON.stringify({ action: "accept" })
  });
  assert.equal((await accept.json()).booking.status, "accepted");

  const subscribe = await call("/api/admin/push-subscriptions", {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({ subscription: { endpoint: "https://push.example/abc", keys: { p256dh: "key", auth: "auth" } } })
  });
  assert.equal(subscribe.status, 201);
});

test("the frontend is served, the server sources are not", async () => {
  const page = await fetch(baseUrl + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Kotans/i);

  assert.equal((await fetch(baseUrl + "/sw.js")).status, 200);
  assert.equal((await fetch(baseUrl + "/backend/src/config.js")).status, 404);
  assert.equal((await fetch(baseUrl + "/backend/.env")).status, 404);
});

test("a blocked IP is turned away from the public API", async () => {
  const login = await call("/api/admin/login", { method: "POST", body: JSON.stringify({ password: "test-password" }) });
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  // Whatever loopback form Express reports for this connection — the booking
  // rows already recorded it, which is also how the admin panel blocks people.
  const { bookings } = await (await call("/api/admin/bookings", { headers: { cookie } })).json();
  const ip = bookings[0].ip;

  await call("/api/admin/blocked-ips", { method: "POST", headers: { cookie }, body: JSON.stringify({ ip }) });
  assert.equal((await call(`/api/availability?date=${workday}&service=haircut`)).status, 403);

  await call("/api/admin/blocked-ips/" + encodeURIComponent(ip), { method: "DELETE", headers: { cookie } });
  assert.equal((await call(`/api/availability?date=${workday}&service=haircut`)).status, 200);
});
