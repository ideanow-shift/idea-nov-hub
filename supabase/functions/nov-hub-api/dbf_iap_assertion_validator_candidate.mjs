export const DBF_IAP_ISSUER = "https://cloud.google.com/iap";
export const DBF_IAP_AUDIENCE = "/projects/787968950888/locations/asia-northeast1/services/idea-nov-dbf-staging-ui";
const JWK_URL = "https://www.gstatic.com/iap/verify/public_key-jwk";

function fail(code) {
  const error = new Error(code);
  error.status = 401;
  error.code = code;
  throw error;
}

function decodeBase64Url(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

export async function validateDbfIapAssertion(assertion, {
  fetchJwks = async () => {
    const response = await fetch(JWK_URL, { redirect: "error" });
    if (!response.ok) fail("IAP_JWKS_UNAVAILABLE");
    return response.json();
  },
  now = () => Date.now()
} = {}) {
  const parts = String(assertion || "").split(".");
  if (parts.length !== 3) fail("IAP_ASSERTION_REQUIRED");
  let header;
  let claims;
  try { header = decodeJson(parts[0]); claims = decodeJson(parts[1]); } catch (_) { fail("IAP_ASSERTION_INVALID"); }
  if (header.alg !== "ES256" || !header.kid) fail("IAP_ASSERTION_INVALID");
  const jwks = await fetchJwks();
  const jwk = jwks?.keys?.find((key) => key.kid === header.kid && key.alg === "ES256");
  if (!jwk) fail("IAP_SIGNING_KEY_UNKNOWN");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) fail("IAP_SIGNATURE_INVALID");
  const epoch = Math.floor(now() / 1000);
  if (claims.iss !== DBF_IAP_ISSUER || claims.aud !== DBF_IAP_AUDIENCE) fail("IAP_CLAIMS_INVALID");
  if (!Number.isFinite(claims.iat) || !Number.isFinite(claims.exp)
    || claims.iat > epoch + 30 || claims.exp <= epoch - 30 || claims.exp - claims.iat > 660) fail("IAP_ASSERTION_EXPIRED");
  if (!String(claims.sub || "")) fail("IAP_IDENTITY_MISSING");
  return { verified: true };
}
