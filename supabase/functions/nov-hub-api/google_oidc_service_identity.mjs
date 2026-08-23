const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const encoder = new TextEncoder();

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function decodePart(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeJson(value) {
  try {
    return JSON.parse(new TextDecoder().decode(decodePart(value)));
  } catch {
    fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Cloud Run identity token is malformed.");
  }
}

export async function verifyGoogleCloudRunIdentity(token, options) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) fail(401, "CLOUD_RUN_IDENTITY_REQUIRED", "Google Cloud Run identity token is required.");
  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]);
  if (header.alg !== "RS256" || !header.kid) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google Cloud Run identity algorithm is invalid.");
  const response = await options.fetchJwks(GOOGLE_JWKS_URL);
  if (!response?.ok) fail(503, "GOOGLE_JWKS_UNAVAILABLE", "Google signing keys are unavailable.");
  const keys = (await response.json()).keys || [];
  const jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA" && candidate.alg === "RS256");
  if (!jwk) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google signing key is not authorized.");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const validSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodePart(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  if (!validSignature) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google signature verification failed.");
  const now = Math.floor(options.now() / 1000);
  if (!GOOGLE_ISSUERS.has(String(claims.iss || ""))) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google issuer is invalid.");
  if (String(claims.aud || "") !== options.audience) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google audience is invalid.");
  if (!Number.isInteger(claims.iat) || claims.iat > now + 30 || claims.iat < now - 3600) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google issued-at time is invalid.");
  if (!Number.isInteger(claims.exp) || claims.exp <= now || claims.exp > now + 3900) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google identity token expired.");
  if (!claims.sub || claims.email_verified !== true) fail(401, "CLOUD_RUN_IDENTITY_INVALID", "Google service identity claims are incomplete.");
  if (String(claims.email || "").toLowerCase() !== String(options.authorizedServiceAccount || "").toLowerCase()) {
    fail(403, "CLOUD_RUN_IDENTITY_FORBIDDEN", "Cloud Run service identity is not authorized.");
  }
  if (options.authorizedSubject && String(claims.sub) !== String(options.authorizedSubject)) {
    fail(403, "CLOUD_RUN_IDENTITY_FORBIDDEN", "Cloud Run service identity subject is not authorized.");
  }
  return { subject: String(claims.sub), email: String(claims.email), expiresAt: new Date(claims.exp * 1000).toISOString() };
}

