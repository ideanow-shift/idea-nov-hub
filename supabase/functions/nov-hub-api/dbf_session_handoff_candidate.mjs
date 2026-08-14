const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const TARGET = "DBF_STAGING";
const TARGET_ORIGIN = "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app";
const HANDOFF_AUDIENCE = "dbf_staging_handoff_exchange_v1";
const SESSION_AUDIENCE = "dbf_staging_session_v1";

function b64url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hash(value) {
  const bytes = new TextEncoder().encode(String(value));
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function opaqueCode() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

function requireActiveHubIdentity(identity, now) {
  const expiresAt = Date.parse(String(identity?.expiresAt || ""));
  if (!identity?.employeeId || !identity?.sessionId || !Number.isFinite(expiresAt) || expiresAt <= now) {
    fail(401, "HUB_AUTH_REQUIRED", "A valid HUB session is required.");
  }
  return expiresAt;
}

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

export const DBF_HANDOFF = Object.freeze({
  target: TARGET,
  targetOrigin: TARGET_ORIGIN,
  handoffAudience: HANDOFF_AUDIENCE,
  sessionAudience: SESSION_AUDIENCE,
  handoffTtlSeconds: 60,
  sessionTtlSeconds: 900
});

export async function issueDbfStagingHandoff(input, deps) {
  const now = deps.now();
  const hubSessionExpiresAt = requireActiveHubIdentity(input?.hubIdentity, now);
  if (input.targetOrigin !== TARGET_ORIGIN || input.target !== TARGET) {
    fail(403, "TARGET_MISMATCH", "The handoff target is not allowed.");
  }
  if (!/^[A-Za-z0-9_-]{22,128}$/u.test(String(input.state || ""))) {
    fail(400, "INVALID_STATE", "A valid launch state is required.");
  }

  const capability = await deps.resolveBusinessDataAdmin({
    employeeId: input.hubIdentity.employeeId,
    effectiveAt: now
  });
  if (capability?.businessDataAdmin !== true) {
    fail(403, "BUSINESS_DATA_ADMIN_REQUIRED", "Business data administration permission is required.");
  }

  const code = opaqueCode();
  const expiresAt = now + DBF_HANDOFF.handoffTtlSeconds * 1000;
  if (hubSessionExpiresAt <= expiresAt) fail(401, "HUB_SESSION_TOO_SHORT", "HUB session expires too soon.");
  await deps.store.insert({
    codeHash: await hash(code),
    employeeId: input.hubIdentity.employeeId,
    hubSessionId: input.hubIdentity.sessionId,
    hubSessionExpiresAt,
    authSource: input.hubIdentity.authSource,
    target: TARGET,
    targetOrigin: TARGET_ORIGIN,
    audience: HANDOFF_AUDIENCE,
    issuedAt: now,
    expiresAt,
    nonceHash: await hash(`${code}.${input.state}`),
    stateHash: await hash(input.state),
    consumedAt: null
  });
  return {
    handoffCode: code,
    state: input.state,
    target: TARGET,
    targetOrigin: TARGET_ORIGIN,
    audience: HANDOFF_AUDIENCE,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export async function exchangeDbfStagingHandoff(input, deps) {
  if (!input?.iapVerified) fail(401, "IAP_REQUIRED", "Verified IAP identity is required.");
  if (input.origin !== TARGET_ORIGIN) fail(403, "ORIGIN_MISMATCH", "Staging origin is required.");
  if (!CODE_PATTERN.test(String(input.handoffCode || ""))) fail(400, "INVALID_CODE", "Invalid handoff code.");
  const state = String(input.state || "");
  const row = await deps.store.consumeAtomic({
    codeHash: await hash(input.handoffCode),
    stateHash: await hash(state),
    nonceHash: await hash(`${input.handoffCode}.${state}`),
    audience: HANDOFF_AUDIENCE,
    target: TARGET,
    targetOrigin: TARGET_ORIGIN,
    now: deps.now()
  });
  if (!row) fail(401, "HANDOFF_REJECTED", "Handoff is expired, mismatched, or already used.");

  const hubIdentity = await deps.verifyHubSessionContinuity({
    employeeId: row.employeeId,
    sessionId: row.hubSessionId,
    expiresAt: row.hubSessionExpiresAt,
    effectiveAt: deps.now()
  });
  if (!hubIdentity?.valid) fail(401, "HUB_SESSION_EXPIRED", "The source HUB session is no longer valid.");

  const capability = await deps.resolveBusinessDataAdmin({
    employeeId: row.employeeId,
    effectiveAt: deps.now()
  });
  if (capability?.businessDataAdmin !== true) {
    fail(403, "BUSINESS_DATA_ADMIN_REQUIRED", "Business data administration permission is required.");
  }
  const expiresAt = Math.min(
    deps.now() + DBF_HANDOFF.sessionTtlSeconds * 1000,
    Number(row.hubSessionExpiresAt)
  );
  return {
    sessionToken: await deps.signSession({
      sub: row.employeeId,
      sid: deps.randomUuid(),
      aud: SESSION_AUDIENCE,
      target: TARGET,
      targetOrigin: TARGET_ORIGIN,
      iat: Math.floor(deps.now() / 1000),
      exp: Math.floor(expiresAt / 1000)
    }),
    audience: SESSION_AUDIENCE,
    expiresAt: new Date(expiresAt).toISOString(),
    capability: { businessDataAdmin: true, scope: capability.scope },
    runtimeImport: "ENABLED",
    productionWrite: "DISABLED"
  };
}
