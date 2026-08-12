import assert from "node:assert/strict";
import { generateKeyPairSync, sign, webcrypto } from "node:crypto";
import {
  DBF_IAP_AUDIENCE,
  DBF_IAP_ISSUER,
  validateDbfIapAssertion
} from "../supabase/functions/nov-hub-api/dbf_iap_assertion_validator_candidate.mjs";

globalThis.crypto ||= webcrypto;
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
jwk.kid = "edge-test";
jwk.alg = "ES256";
const now = Date.parse("2026-08-12T04:00:00Z");

function makeAssertion(overrides = {}) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: jwk.kid })).toString("base64url");
  const epoch = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: DBF_IAP_ISSUER,
    aud: DBF_IAP_AUDIENCE,
    iat: epoch - 5,
    exp: epoch + 300,
    sub: "masked-subject",
    ...overrides
  })).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: privateKey,
    dsaEncoding: "ieee-p1363"
  }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const deps = { fetchJwks: async () => ({ keys: [jwk] }), now: () => now };
assert.deepEqual(await validateDbfIapAssertion(makeAssertion(), deps), { verified: true });
await assert.rejects(() => validateDbfIapAssertion(makeAssertion({ aud: "wrong" }), deps), (error) => error.status === 401);
await assert.rejects(() => validateDbfIapAssertion(makeAssertion({ exp: Math.floor(now / 1000) - 60 }), deps), (error) => error.status === 401);
await assert.rejects(() => validateDbfIapAssertion("invalid", deps), (error) => error.status === 401);
console.log("dbf Edge IAP assertion validator: PASS");
