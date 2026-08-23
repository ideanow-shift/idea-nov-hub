import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { createStoreOperationsStagingServer } = await import("../deploy/store-operations-staging-ui/server.mjs");

async function withServer(edgeFetch, run) {
  const server = createStoreOperationsStagingServer({
    edgeFetch,
    exchangeSecret: "server-boundary-secret-with-32-bytes-minimum",
    edgeUrl: "https://edge.invalid/nov-hub-api",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("BFF exchanges only the opaque code and keeps the app session HttpOnly", async () => {
  const calls = [];
  await withServer(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return Response.json({ ok: true, session: { sessionToken: "private-app-session", expiresAt: new Date(Date.now() + 600_000).toISOString() } });
  }, async (origin) => {
    const response = await fetch(`${origin}/session/handoff/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handoffCode: "A".repeat(43), state: "state_1234567890123456789012" }),
    });
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /private-app-session/u);
    assert.match(response.headers.get("set-cookie") || "", /Secure; HttpOnly; SameSite=Lax/u);
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.action, "storeOperationsHandoffExchangeV1");
  assert.equal(calls[0].init.headers["x-store-operations-exchange-secret"], "server-boundary-secret-with-32-bytes-minimum");
  assert.equal("authorization" in calls[0].init.headers, false);
});

test("BFF ignores browser authority and forwards only the read-only projection", async () => {
  const calls = [];
  await withServer(async (url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({ ok: true, projection: { dataState: "preparing" } });
  }, async (origin) => {
    const response = await fetch(`${origin}/api/store-operations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "__Host-store_ops_session=private-app-session" },
      body: JSON.stringify({ action: "storeMonthlyActualProjectionV1", payload: { selectedMonth: "2026-06", role: "executive", scope: "all", employeeId: "spoof", storeId: "spoof" } }),
    });
    assert.equal(response.status, 200);
  });
  assert.deepEqual(calls[0], { action: "storeMonthlyActualProjectionV1", payload: { selectedMonth: "2026-06", authType: "store_operations_staging_session", responseProfile: "" } });
});

test("BFF fails closed without its server exchange secret", async () => {
  const server = createStoreOperationsStagingServer({ edgeFetch: async () => { throw new Error("must not call edge"); }, exchangeSecret: "" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/session/handoff/exchange`, { method: "POST", body: "{}" });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "EXCHANGE_BOUNDARY_UNAVAILABLE");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
