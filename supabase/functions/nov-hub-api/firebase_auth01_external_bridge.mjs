export const FIREBASE_AUTH01_BRIDGE = Object.freeze({
  contract: "NOV_HUB_STAGING_FIREBASE_AUTH01_BRIDGE_V1",
  bindingContract: "NOV_HUB_STAGING_EXTERNAL_SUBJECT_BINDING_V1",
  projectId: "idea-nov-group-portal",
  issuer: "https://securetoken.google.com/idea-nov-group-portal",
  provider: "google.com",
  principals: Object.freeze({
    "m.wakita@idea-nov.com": Object.freeze({ identityKey: "uat-executive", roleKey: "executive", scopeMode: "all", storeCount: 20 }),
    "uat-area-manager@idea-nov.com": Object.freeze({ identityKey: "uat-area-manager", roleKey: "area_manager", scopeMode: "assigned", storeCount: 1 }),
    "uat-store-manager@idea-nov.com": Object.freeze({ identityKey: "uat-store-manager", roleKey: "store_manager", scopeMode: "own", storeCount: 1 }),
  }),
  maxSessionSeconds: 15 * 60,
  fingerprintKeyVersion: 1,
});

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

function decodePayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) fail(401, "TOKEN_VERIFICATION_FAILED", "Firebase ID token is invalid.");
  try {
    const normalized = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
  } catch {
    fail(401, "TOKEN_VERIFICATION_FAILED", "Firebase ID token is invalid.");
  }
}

export async function verifyFirebaseBridgeToken(token, deps) {
  if (!token) fail(401, "TOKEN_MISSING", "Firebase ID token is required.");
  const claims = decodePayload(token);
  const now = Math.floor(deps.now() / 1000);
  if (claims.iss !== FIREBASE_AUTH01_BRIDGE.issuer) fail(401, "TOKEN_ISSUER_INVALID", "Firebase issuer is invalid.");
  if (claims.aud !== FIREBASE_AUTH01_BRIDGE.projectId) fail(401, "TOKEN_AUDIENCE_INVALID", "Firebase audience is invalid.");
  if (!claims.sub || claims.sub !== claims.user_id) fail(401, "TOKEN_SUBJECT_INVALID", "Firebase subject is invalid.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now) fail(401, "TOKEN_EXPIRED", "Firebase token has expired.");
  if (!Number.isFinite(claims.iat) || claims.iat > now + 30 || claims.iat < now - 60 * 60 * 24) fail(401, "TOKEN_IAT_INVALID", "Firebase issued-at is invalid.");
  if (!Number.isFinite(claims.auth_time) || claims.auth_time > now + 30) fail(401, "TOKEN_AUTH_TIME_INVALID", "Firebase auth time is invalid.");
  if (claims.firebase?.sign_in_provider !== FIREBASE_AUTH01_BRIDGE.provider) fail(403, "FIREBASE_PROVIDER_DENIED", "Google sign-in is required.");
  if (claims.email_verified !== true) fail(403, "FIREBASE_EMAIL_UNVERIFIED", "Verified Google email is required.");
  const email = String(claims.email || "").toLowerCase();
  if (!Object.hasOwn(FIREBASE_AUTH01_BRIDGE.principals, email)) fail(403, "FIREBASE_ACCOUNT_DENIED", "The approved Google account is required.");
  const principal = FIREBASE_AUTH01_BRIDGE.principals[email];
  const lookup = await deps.lookup(token);
  if (!lookup || lookup.disabled === true || lookup.localId !== claims.sub || lookup.emailVerified !== true
    || String(lookup.email || "").toLowerCase() !== email) {
    fail(401, "TOKEN_VERIFICATION_FAILED", "Firebase token lookup failed.");
  }
  return { subject: claims.sub, expiresAt: claims.exp, issuedAt: claims.iat, identityKey: principal.identityKey,
    expectedRole: principal.roleKey, expectedScopeMode: principal.scopeMode, expectedStoreCount: principal.storeCount };
}

export async function subjectFingerprint(verified, secret) {
  if (String(secret || "").length < 32) fail(500, "SETUP_MISSING", "External subject fingerprint secret is missing.");
  const material = [FIREBASE_AUTH01_BRIDGE.provider, FIREBASE_AUTH01_BRIDGE.issuer,
    FIREBASE_AUTH01_BRIDGE.projectId, verified.subject].join("\n");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(material)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function bridgeFirebaseAuth01(input, deps) {
  const acceptedBrowserKeys = new Set(["enrollmentChallenge","employeeId","email","firebaseUid","authSubject","role","scope","storeId"]);
  if (Object.keys(input.payload || {}).some((key) => !acceptedBrowserKeys.has(key))) {
    fail(400, "INVALID_REQUEST", "Bridge payload is invalid.");
  }
  const verified = await verifyFirebaseBridgeToken(input.token, deps);
  const fingerprint = await subjectFingerprint(verified, deps.fingerprintSecret);
  const challenge = String(input.payload?.enrollmentChallenge || "");
  const resolved = challenge
    ? await deps.consumeEnrollment({ challenge, fingerprint, requestId: deps.randomUuid(), expectedIdentityKey: verified.identityKey })
    : await deps.resolveBinding({ fingerprint });
  const employeeId = String(resolved?.employeeId || "");
  const access = resolved?.access || {};
  if (!employeeId || access.employeeId !== employeeId || access.scope?.mode !== verified.expectedScopeMode
    || access.scope?.storeIds?.length !== verified.expectedStoreCount || access.roleKeys?.length !== 1
    || access.roleKeys[0] !== verified.expectedRole) {
    fail(403, "AUTH01_CONVERGENCE_DENIED", "AUTH-01 convergence failed.");
  }
  const now = Math.floor(deps.now() / 1000);
  const expiresAt = Math.min(verified.expiresAt, now + FIREBASE_AUTH01_BRIDGE.maxSessionSeconds);
  if (expiresAt <= now) fail(401, "TOKEN_EXPIRED", "Firebase token has expired.");
  return {
    hubSession: {
      sessionToken: await deps.signSession({
        iss: "nov_hub_staging", aud: "nov_hub", sub: employeeId, sid: deps.randomUuid(),
        auth_source: "firebase_auth01_external_binding_v1", bridge_contract: FIREBASE_AUTH01_BRIDGE.contract,
        iat: now, exp: expiresAt,
      }),
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      audience: "nov_hub",
    },
  };
}
