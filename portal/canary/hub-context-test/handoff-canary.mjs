import { createHash, randomBytes, randomUUID } from "node:crypto";

export const CANARY_APP_ID = "hub-context-test";
export const CANARY_ISSUER = "nov-hub-canary";

export class CanaryDenied extends Error {
  constructor(reason, status = 403) {
    super(reason);
    this.name = "CanaryDenied";
    this.reason = reason;
    this.status = status;
  }
}

const deny = (reason, status) => { throw new CanaryDenied(reason, status); };
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function createCanaryFlags(overrides = {}) {
  return Object.freeze({
    globalEnabled: false,
    appEnabled: false,
    environmentEnabled: false,
    environment: "development",
    allowedSyntheticActors: [],
    killSwitch: true,
    ...overrides
  });
}

export function evaluateCanaryFlags(flags, syntheticActorId) {
  if (flags.killSwitch) return { enabled: false, reason: "kill_switch" };
  if (!flags.globalEnabled) return { enabled: false, reason: "global_flag_off" };
  if (!flags.appEnabled) return { enabled: false, reason: "app_flag_off" };
  if (!flags.environmentEnabled || flags.environment === "production") {
    return { enabled: false, reason: "environment_denied" };
  }
  if (!flags.allowedSyntheticActors.includes(syntheticActorId)) {
    return { enabled: false, reason: "allowlist_denied" };
  }
  return { enabled: true, reason: "enabled" };
}

export class MemoryAuditSink {
  constructor({ failWrites = false } = {}) {
    this.failWrites = failWrites;
    this.events = [];
  }
  append(type, details = {}) {
    if (this.failWrites) deny("audit_unavailable", 503);
    const safe = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      app_id: details.appId ?? CANARY_APP_ID,
      principal_type: details.principalType ?? null,
      synthetic_actor_id: details.syntheticActorId ?? null,
      result: details.result ?? null,
      deny_reason: details.denyReason ?? null,
      correlation_id: details.correlationId ?? null,
      audit_status: "persisted"
    };
    this.events.push(Object.freeze(safe));
    return safe;
  }
}

export class InMemoryOneTimeCodeStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.entries = new Map();
  }
  put(payload, ttlMs) {
    const code = randomBytes(32).toString("base64url");
    this.entries.set(hash(code), { payload: structuredClone(payload), expiresAt: this.now() + ttlMs });
    return code;
  }
  consume(code) {
    const key = hash(String(code ?? ""));
    const entry = this.entries.get(key);
    if (!entry) deny("code_invalid_or_consumed", 401);
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) deny("code_expired", 401);
    return entry.payload;
  }
  revoke(code) { this.entries.delete(hash(String(code ?? ""))); }
}

export const syntheticIdentities = Object.freeze([
  { id: "syn-active-01", principalType: "employee", active: true, retired: false, loginEnabled: true },
  { id: "syn-terminal-01", principalType: "terminal", active: true, retired: false, loginEnabled: true },
  { id: "syn-service-01", principalType: "service", active: true, retired: false, loginEnabled: true },
  { id: "syn-inactive-01", principalType: "employee", active: false, retired: false, loginEnabled: true },
  { id: "syn-retired-01", principalType: "employee", active: true, retired: true, loginEnabled: true },
  { id: "syn-disabled-01", principalType: "employee", active: true, retired: false, loginEnabled: false },
  { id: "syn-duplicate-01", principalType: "employee", active: true, retired: false, loginEnabled: true },
  { id: "syn-duplicate-01", principalType: "employee", active: true, retired: false, loginEnabled: true }
]);

export class SyntheticActorResolver {
  constructor(identities = syntheticIdentities) { this.identities = identities; }
  resolve({ syntheticActorId, principalType }) {
    const matches = this.identities.filter((item) => item.id === syntheticActorId && item.principalType === principalType);
    if (matches.length === 0) deny("identity_unresolved");
    if (matches.length > 1) deny("identity_ambiguous", 409);
    const actor = matches[0];
    if (!actor.active) deny("actor_inactive");
    if (actor.retired) deny("actor_retired");
    if (!actor.loginEnabled) deny("login_disabled");
    return Object.freeze({ syntheticActorId: actor.id, principalType: actor.principalType, active: true });
  }
}

export class AppSessionStore {
  constructor({ now = () => Date.now(), idleTimeoutMs = 15 * 60_000, absoluteTimeoutMs = 60 * 60_000 } = {}) {
    this.now = now;
    this.idleTimeoutMs = idleTimeoutMs;
    this.absoluteTimeoutMs = absoluteTimeoutMs;
    this.sessions = new Map();
  }
  create({ appId, actor, correlationId }) {
    const id = randomUUID();
    const now = this.now();
    this.sessions.set(id, { appId, actor, correlationId, createdAt: now, lastSeenAt: now, revoked: false });
    return {
      id,
      expiresAt: now + this.absoluteTimeoutMs,
      cookie: `__Host-nov_canary_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax`
    };
  }
  validate(id, appId) {
    const item = this.sessions.get(id);
    if (!item || item.revoked) deny("session_revoked", 401);
    if (item.appId !== appId) deny("session_app_mismatch", 401);
    const now = this.now();
    if (now - item.lastSeenAt >= this.idleTimeoutMs) deny("session_idle_expired", 401);
    if (now - item.createdAt >= this.absoluteTimeoutMs) deny("session_absolute_expired", 401);
    item.lastSeenAt = now;
    return Object.freeze({ ...item });
  }
  logout(id) { const item = this.sessions.get(id); if (item) item.revoked = true; }
}

export class CommonHandoffIssuer {
  constructor({ flags, codeStore, audit, now = () => Date.now(), redirectAllowlist }) {
    this.flags = flags;
    this.codeStore = codeStore;
    this.audit = audit;
    this.now = now;
    this.redirectAllowlist = new Set(redirectAllowlist);
  }
  issueAppHandoff({ appId, hubSession, principal, redirectUri, correlationId }) {
    const flag = evaluateCanaryFlags(this.flags, principal?.syntheticActorId);
    if (!flag.enabled) {
      this.audit.append(flag.reason === "kill_switch" ? "kill_switch_used" : "fallback_used", {
        appId, syntheticActorId: principal?.syntheticActorId, correlationId, denyReason: flag.reason, result: "deny"
      });
      deny(flag.reason);
    }
    if (appId !== CANARY_APP_ID) deny("app_mismatch");
    if (!hubSession?.sessionId || hubSession.syntheticActorId !== principal.syntheticActorId) deny("actor_mismatch");
    if (!this.redirectAllowlist.has(redirectUri)) deny("redirect_denied");
    const now = this.now();
    const payload = {
      appId,
      issuer: CANARY_ISSUER,
      audience: appId,
      expiresAt: now + 60_000,
      issuedAt: now,
      nonce: randomUUID(),
      jti: randomUUID(),
      hubSessionId: hubSession.sessionId,
      syntheticActorId: principal.syntheticActorId,
      principalType: principal.principalType,
      loginMethod: hubSession.loginMethod,
      redirectUri,
      correlationId
    };
    const code = this.codeStore.put(payload, 60_000);
    this.audit.append("handoff_issued", { appId, principalType: principal.principalType, syntheticActorId: principal.syntheticActorId, correlationId, result: "allow" });
    return Object.freeze({ code, redirectUri, expiresAt: payload.expiresAt });
  }
}

export class CanaryExchange {
  constructor({ codeStore, actorResolver, sessions, audit, now = () => Date.now(), redirectAllowlist }) {
    this.codeStore = codeStore;
    this.actorResolver = actorResolver;
    this.sessions = sessions;
    this.audit = audit;
    this.now = now;
    this.redirectAllowlist = new Set(redirectAllowlist);
  }
  exchange({ code, appId, audience, redirectUri, requestedActorId, csrfValid = true }) {
    if (!csrfValid) deny("csrf_denied");
    let payload;
    try { payload = this.codeStore.consume(code); }
    catch (error) {
      this.audit.append(error.reason === "code_invalid_or_consumed" ? "replay" : "exchange_denied", { appId, denyReason: error.reason, result: "deny" });
      throw error;
    }
    const fail = (reason) => {
      this.audit.append("exchange_denied", { appId, correlationId: payload.correlationId, denyReason: reason, result: "deny" });
      deny(reason);
    };
    if (payload.expiresAt <= this.now()) fail("code_expired");
    if (payload.appId !== appId) fail("app_mismatch");
    if (payload.audience !== audience) fail("audience_mismatch");
    if (payload.redirectUri !== redirectUri || !this.redirectAllowlist.has(redirectUri)) fail("redirect_denied");
    if (requestedActorId && requestedActorId !== payload.syntheticActorId) fail("actor_mismatch");
    let actor;
    try {
      actor = this.actorResolver.resolve({ syntheticActorId: payload.syntheticActorId, principalType: payload.principalType });
    } catch (error) {
      this.audit.append("exchange_denied", { appId, correlationId: payload.correlationId, denyReason: error.reason, result: "deny" });
      throw error;
    }
    let session;
    try {
      session = this.sessions.create({ appId, actor, correlationId: payload.correlationId });
    } catch {
      this.audit.append("exchange_denied", { appId, correlationId: payload.correlationId, denyReason: "session_issuance_failed", result: "deny" });
      deny("session_issuance_failed", 503);
    }
    this.audit.append("session_created", { appId, principalType: actor.principalType, syntheticActorId: actor.syntheticActorId, correlationId: payload.correlationId, result: "allow" });
    this.audit.append("exchange_success", { appId, principalType: actor.principalType, syntheticActorId: actor.syntheticActorId, correlationId: payload.correlationId, result: "allow" });
    return Object.freeze({
      appId,
      audience,
      principalType: actor.principalType,
      syntheticActorId: actor.syntheticActorId,
      sessionExpiresAt: session.expiresAt,
      correlationId: payload.correlationId,
      auditStatus: "persisted",
      setCookie: session.cookie,
      sessionId: session.id
    });
  }
  logout(sessionId, correlationId) {
    this.sessions.logout(sessionId);
    this.audit.append("logout", { correlationId, result: "allow" });
  }
}
