import { createPublicKey, verify as verifySignature } from "node:crypto";

export const IAP_ISSUER = "https://cloud.google.com/iap";
export const IAP_AUDIENCE = "/projects/787968950888/locations/asia-northeast1/services/idea-nov-dbf-staging-ui";

function reject(code) {
  const error = new Error(code);
  error.status = 401;
  error.code = code;
  throw error;
}

function decode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

export async function validateIapAssertion(assertion, { fetchJwks, now = () => Date.now() }) {
  const parts = String(assertion || "").split(".");
  if (parts.length !== 3) reject("IAP_ASSERTION_REQUIRED");
  let header;
  let claims;
  try { header = decode(parts[0]); claims = decode(parts[1]); } catch (_) { reject("IAP_ASSERTION_INVALID"); }
  if (header.alg !== "ES256" || !header.kid) reject("IAP_ASSERTION_INVALID");
  const jwks = await fetchJwks();
  const jwk = jwks?.keys?.find((key) => key.kid === header.kid && key.alg === "ES256");
  if (!jwk) reject("IAP_SIGNING_KEY_UNKNOWN");
  const valid = verifySignature("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), {
    key: createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363"
  }, Buffer.from(parts[2], "base64url"));
  if (!valid) reject("IAP_SIGNATURE_INVALID");
  const epoch = Math.floor(now() / 1000);
  if (claims.iss !== IAP_ISSUER || claims.aud !== IAP_AUDIENCE) reject("IAP_CLAIMS_INVALID");
  if (!Number.isFinite(claims.iat) || !Number.isFinite(claims.exp)
    || claims.iat > epoch + 30 || claims.exp <= epoch - 30 || claims.exp - claims.iat > 660) reject("IAP_ASSERTION_EXPIRED");
  if (!String(claims.sub || "") || !String(claims.email || "")) reject("IAP_IDENTITY_MISSING");
  return { verified: true };
}
