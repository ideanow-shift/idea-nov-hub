import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDbfStagingServer } from "../deploy/dbf-cloud-run-staging-bff-candidate/server.mjs";
import { IAP_AUDIENCE, IAP_ISSUER } from "../deploy/dbf-cloud-run-staging-bff-candidate/iap-jwt-validator.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "phase-c-bff";
jwk.alg = "ES256";
const now = Date.parse("2026-08-15T00:00:00Z");
function assertion() {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: jwk.kid })).toString("base64url");
  const epoch = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: IAP_ISSUER, aud: IAP_AUDIENCE,
    iat: epoch - 5, exp: epoch + 300, sub: "masked", email: "masked@example.invalid" })).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey,
    dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

test("Cloud Run BFF requires IAP and forwards only the opaque staging session", async () => {
  let forwarded = null;
  const server = createDbfStagingServer({
    staticRoot: fileURLToPath(new URL("../build/dbf-staging-pages", import.meta.url)),
    fetchJwks: async () => ({ keys: [jwk] }), now: () => now,
    exchangeWithHubBackend: async () => ({ status: 500, body: {} }),
    forwardDbfRuntime: async (request) => { forwarded = request; return { status: 200, body: { ok: true, data: { items: [] } } }; },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/dbf/import`;
    const withoutIap = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${"x".repeat(30)}` }, body: "{}" });
    assert.equal(withoutIap.status, 401);
    const withoutSession = await fetch(url, { method: "POST", headers: { "x-goog-iap-jwt-assertion": assertion() }, body: "{}" });
    assert.equal(withoutSession.status, 401);
    const valid = await fetch(url, { method: "POST", headers: {
      "content-type": "application/json", "x-goog-iap-jwt-assertion": assertion(),
      authorization: `Bearer ${"x".repeat(30)}`,
    }, body: JSON.stringify({ action: "dbfImportHistoryV1", payload: {} }) });
    assert.equal(valid.status, 200);
    assert.deepEqual(forwarded.payload, { action: "dbfImportHistoryV1", payload: {} });
    assert.equal(forwarded.authorization, `Bearer ${"x".repeat(30)}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
