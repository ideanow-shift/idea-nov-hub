import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDbfStagingServer } from "../deploy/dbf-cloud-run-staging-bff-candidate/server.mjs";
import { IAP_AUDIENCE, IAP_ISSUER } from "../deploy/dbf-cloud-run-staging-bff-candidate/iap-jwt-validator.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "bff-test";
jwk.alg = "ES256";
const now = Date.parse("2026-08-12T04:00:00Z");
function assertion(overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: jwk.kid })).toString("base64url");
  const epoch = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: IAP_ISSUER, aud: IAP_AUDIENCE, iat: epoch - 5, exp: epoch + 300, sub: "masked-subject", email: "owner@example.invalid", ...overrides })).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

let exchangeCalls = 0;
const validAssertion = assertion();
const server = createDbfStagingServer({
  staticRoot: fileURLToPath(new URL("../build/dbf-staging-pages", import.meta.url)),
  fetchJwks: async () => ({ keys: [jwk] }),
  now: () => now,
  exchangeWithHubBackend: async (request) => {
    exchangeCalls += 1;
    assert.equal(request.iapAssertion, validAssertion);
    assert.equal(request.payload.origin, "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app");
    return { status: 200, body: { sessionToken: "staging-session", expiresAt: new Date(now + 900_000).toISOString(), audience: "dbf_staging_session_v1", capability: { businessDataAdmin: true }, runtimeImport: "DISABLED", productionWrite: "DISABLED" } };
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/session/handoff/exchange`;
  const health = await fetch(`http://127.0.0.1:${address.port}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ready" });
  const staticResponse = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(staticResponse.status, 200);
  assert.match(await staticResponse.text(), /DBF STAGING/u);
  const missing = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(missing.status, 401);
  const expired = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-iap-jwt-assertion": assertion({ exp: Math.floor(now / 1000) - 60 }) }, body: "{}" });
  assert.equal(expired.status, 401);
  const wrongAudience = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-iap-jwt-assertion": assertion({ aud: "wrong-audience" }) }, body: "{}" });
  assert.equal(wrongAudience.status, 401);
  const invalid = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-iap-jwt-assertion": `${validAssertion.slice(0, -2)}aa` }, body: "{}" });
  assert.equal(invalid.status, 401);
  const valid = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-iap-jwt-assertion": validAssertion }, body: JSON.stringify({ handoffCode: "a".repeat(43), state: "state_1234567890123456789012" }) });
  assert.equal(valid.status, 200);
  assert.equal(exchangeCalls, 1);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const storage = new Map();
let replaced = "";
globalThis.sessionStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
globalThis.document = { title: "DBF" };
globalThis.window = { location: { href: "https://staging.example/#handoff_code=" + "a".repeat(43) + "&state=state_1234567890123456789012" }, history: { replaceState: (_a, _b, value) => { replaced = value; } } };
const frontend = await import("../portal/js/dbf-staging-session-handoff-candidate.js");
assert.equal(await frontend.initializeDbfStagingSession({ url: "https://staging.example/", exchange: async () => { throw new Error("must not exchange"); } }), null);
const session = await frontend.initializeDbfStagingSession({ url: window.location.href, exchange: async ({ handoffCode, state }) => {
  assert.equal(replaced, "https://staging.example/");
  assert.equal(handoffCode, "a".repeat(43));
  assert.equal(state, "state_1234567890123456789012");
  return { sessionToken: "staging-session", expiresAt: new Date(Date.now() + 900_000).toISOString(), audience: "dbf_staging_session_v1", capability: { businessDataAdmin: true }, runtimeImport: "DISABLED", productionWrite: "DISABLED" };
} });
assert.equal(session.sessionToken, "staging-session");
await import("./dbf-cloud-run-canonical-routing.test.mjs");
console.log("dbf handoff bff and frontend: PASS");
