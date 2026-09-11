import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export class AuthError extends Error {
  constructor(status, reason) {
    super(reason);
    this.name = "AuthError";
    this.status = status;
    this.reason = reason;
  }
}

const deny = (status, reason) => { throw new AuthError(status, reason); };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const sign = (body, key) => createHmac("sha256", key).update(body).digest("base64url");

export class HandoffVerifier {
  constructor({ issuer, audience, appId, sandboxSigningKey, now = () => Date.now() }) {
    this.issuer = issuer;
    this.audience = audience;
    this.appId = appId;
    this.key = sandboxSigningKey;
    this.now = now;
    this.seenJti = new Set();
  }

  issue(claims) {
    const body = encode(claims);
    return `${body}.${sign(body, this.key)}`;
  }

  verify(token, { nonce, resolvedEmployeeId } = {}) {
    if (!token) deny(401, "authentication_required");
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra) deny(401, "invalid_signature");
    const expected = sign(body, this.key);
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      deny(401, "invalid_signature");
    }
    let claims;
    try { claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { deny(401, "invalid_token"); }
    const required = ["iss", "aud", "iat", "exp", "nonce", "jti", "app_id", "principal_type", "session_id", "login_method"];
    if (required.some((key) => claims[key] === undefined || claims[key] === "")) deny(401, "missing_claim");
    if (claims.iss !== this.issuer) deny(401, "invalid_issuer");
    if (claims.aud !== this.audience) deny(401, "invalid_audience");
    if (claims.app_id !== this.appId || claims.aud !== claims.app_id) deny(401, "app_mismatch");
    const nowSeconds = Math.floor(this.now() / 1000);
    if (claims.iat > nowSeconds + 60) deny(401, "issued_at_invalid");
    if (claims.exp <= nowSeconds) deny(401, "expired");
    if (nonce !== undefined && claims.nonce !== nonce) deny(401, "nonce_mismatch");
    if (this.seenJti.has(claims.jti)) deny(401, "handoff_replayed");
    if (claims.principal_type === "employee") {
      if (!claims.firebase_uid || !claims.employee_id) deny(401, "missing_claim");
      if (resolvedEmployeeId && claims.employee_id !== resolvedEmployeeId) deny(403, "identity_mismatch");
    }
    this.seenJti.add(claims.jti);
    return Object.freeze({ ...claims });
  }
}

export class OneTimeCodeExchange {
  constructor({ ttlMs = 60_000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.codes = new Map();
  }

  register(signedHandoff) {
    const code = `otc_${randomUUID().replaceAll("-", "")}`;
    this.codes.set(code, { signedHandoff, expiresAt: this.now() + this.ttlMs });
    return code;
  }

  consume(code) {
    const entry = this.codes.get(code);
    if (!entry) deny(401, "code_invalid_or_consumed");
    this.codes.delete(code);
    if (entry.expiresAt <= this.now()) deny(401, "code_expired");
    return entry.signedHandoff;
  }
}

export class CoreActorResolver {
  constructor(fixture) { this.fixture = fixture; }

  resolve({ firebase_uid, principal_type, terminal_id, service_id, app_id }) {
    if (principal_type === "terminal") {
      const terminal = this.fixture.terminals.find((item) => item.id === terminal_id);
      if (!terminal || !terminal.active || !terminal.appIds.includes(app_id)) deny(403, "terminal_unresolved");
      return this.#principal(terminal, "terminal", { terminalId: terminal.id });
    }
    if (principal_type === "service") {
      const service = this.fixture.services.find((item) => item.id === service_id);
      if (!service || !service.active || !service.appIds.includes(app_id)) deny(403, "service_unresolved");
      return this.#principal(service, "service", { serviceId: service.id });
    }
    if (principal_type !== "employee") deny(403, "principal_type_denied");
    const matches = this.fixture.employees.filter((item) => item.firebaseUid === firebase_uid);
    if (matches.length === 0) deny(403, "identity_unresolved");
    if (matches.length > 1) deny(409, "identity_ambiguous");
    const employee = matches[0];
    if (!employee.active) deny(403, "employee_inactive");
    if (employee.retired) deny(403, "employee_retired");
    if (!employee.loginEnabled) deny(403, "login_disabled");
    return this.#principal(employee, "employee", {
      actorEmployeeId: employee.id,
      firebaseUid: employee.firebaseUid
    });
  }

  #principal(source, principalType, extra) {
    return Object.freeze({
      principalType,
      roles: [...source.roles],
      scopes: structuredClone(source.scopes),
      active: source.active,
      retired: source.retired ?? false,
      loginEnabled: source.loginEnabled ?? true,
      assignments: structuredClone(source.assignments ?? []),
      corporationId: source.corporationId,
      storeIds: [...(source.storeIds ?? source.assignments?.filter((a) => a.active).map((a) => a.storeId) ?? [])],
      ...extra
    });
  }
}

const roleActions = Object.freeze({
  platform_admin: ["view", "manage_permission"],
  executive: ["view", "approve"],
  area_manager: ["view", "update", "approve", "close"],
  fc_owner: ["view", "update", "approve"],
  store_manager: ["view", "update", "close"],
  employee: ["view", "create", "update"],
  finance_operator: ["view", "update", "approve", "close", "export"],
  hr_operator: ["view", "update", "approve", "export"],
  system_service: ["system_execute"],
  terminal: ["create"]
});

export class AuthorizationEvaluator {
  evaluate({ actor, resource, action, sensitivity = "internal", recordState = resource?.state, request = {}, idempotencyStore }) {
    if (!actor) return this.#denied("actor_required");
    if (request.employee_id && request.employee_id !== actor.actorEmployeeId) return this.#denied("actor_mismatch");
    if (request.store_id && request.store_id !== resource.storeId) return this.#denied("request_store_mismatch");
    if (!actor.roles?.length) return this.#denied("role_missing");
    if (actor.principalType === "terminal" && resource.type === "employee_private") return this.#denied("step_up_required");
    if (actor.principalType === "service" && action !== "system_execute") return this.#denied("service_not_allowed");
    if (recordState === "deleted") return this.#denied("record_deleted");
    if (recordState === "closed" && ["create", "update", "delete", "close"].includes(action)) return this.#denied("record_closed");
    if (!actor.roles.some((role) => roleActions[role]?.includes(action))) return this.#denied("action_denied");
    if (["pii", "restricted"].includes(sensitivity) && !actor.roles.some((role) => ["hr_operator", "finance_operator"].includes(role))) {
      return this.#denied("sensitivity_denied");
    }
    if (actor.principalType === "employee" && !actor.scopes.some((scope) =>
      scope.type === "all" ||
      (scope.type === "assigned_store" && scope.storeId === resource.storeId) ||
      (scope.type === "corporation" && scope.corporationId === resource.corporationId) ||
      (scope.type === "own_record" && resource.ownerEmployeeId === actor.actorEmployeeId)
    )) {
      return this.#denied(resource.corporationId !== actor.corporationId ? "corporation_scope_denied" : "store_scope_denied");
    }
    if (actor.principalType === "terminal" && !actor.storeIds.includes(resource.storeId)) return this.#denied("store_scope_denied");
    if (idempotencyStore && request.idempotency_key) {
      if (idempotencyStore.has(request.idempotency_key)) return this.#denied("duplicate_request");
      idempotencyStore.add(request.idempotency_key);
    }
    return Object.freeze({ allowed: true, reason: "allow" });
  }

  #denied(reason) { return Object.freeze({ allowed: false, reason }); }
}

export class AppSessionStore {
  constructor({ idleTimeoutMs = 15 * 60_000, absoluteTimeoutMs = 8 * 60 * 60_000, now = () => Date.now() } = {}) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.absoluteTimeoutMs = absoluteTimeoutMs;
    this.now = now;
    this.sessions = new Map();
  }

  create({ appId, actor, hubSessionId }) {
    const sessionId = randomUUID();
    const now = this.now();
    this.sessions.set(sessionId, { appId, actor, hubSessionId, createdAt: now, lastSeenAt: now, revoked: false });
    return {
      sessionId,
      cookie: { name: "__Host-nov_app_session", value: sessionId, httpOnly: true, secure: true, sameSite: "Lax", path: "/" }
    };
  }

  validate(sessionId, { appId }) {
    const session = this.sessions.get(sessionId);
    if (!session || session.revoked) deny(401, "session_revoked");
    if (session.appId !== appId) deny(401, "session_app_mismatch");
    const now = this.now();
    if (now - session.lastSeenAt >= this.idleTimeoutMs) deny(401, "session_idle_expired");
    if (now - session.createdAt >= this.absoluteTimeoutMs) deny(401, "session_absolute_expired");
    if (!session.actor.active) deny(403, "employee_inactive");
    if (session.actor.retired) deny(403, "employee_retired");
    if (!session.actor.loginEnabled) deny(403, "login_disabled");
    session.lastSeenAt = now;
    return Object.freeze({ ...session, actor: session.actor });
  }

  revoke(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) session.revoked = true;
  }
}

export class CoreReadAdapterMock {
  constructor(fixture) { this.fixture = fixture; }
  getEmployeeSummary(id) {
    const value = this.fixture.employees.find((item) => item.id === id);
    return value ? { id: value.id, displayName: value.displayName, active: value.active } : null;
  }
  getEmployeeRoles(id) { return [...(this.fixture.employees.find((item) => item.id === id)?.roles ?? [])]; }
  getActiveAssignments(id) { return structuredClone(this.fixture.employees.find((item) => item.id === id)?.assignments.filter((item) => item.active) ?? []); }
  getStore(id) { return structuredClone(this.fixture.stores.find((item) => item.id === id) ?? null); }
  getCorporation(id) { return structuredClone(this.fixture.corporations.find((item) => item.id === id) ?? null); }
  getApplicationPermissions(appId) { return [...(this.fixture.permissions[appId] ?? [])]; }
  getIdentityStatus(uid) {
    const matches = this.fixture.employees.filter((item) => item.firebaseUid === uid);
    return { resolved: matches.length === 1, duplicate: matches.length > 1, active: matches.length === 1 && matches[0].active, loginEnabled: matches.length === 1 && matches[0].loginEnabled };
  }
}

export function formatAuditEvent(input, { now = () => new Date().toISOString(), uuid = randomUUID } = {}) {
  const actor = input.actor ?? {};
  return Object.freeze({
    event_id: uuid(),
    timestamp: now(),
    actor_principal: actor.principalType ?? "anonymous",
    employee_id: actor.actorEmployeeId ?? null,
    terminal_id: actor.terminalId ?? null,
    firebase_uid: actor.firebaseUid ?? null,
    app_id: input.appId,
    session_id: input.sessionId ?? null,
    action: input.action,
    resource_type: input.resource?.type ?? null,
    resource_id: input.resource?.id ?? null,
    store_id: input.resource?.storeId ?? null,
    corporation_id: input.resource?.corporationId ?? null,
    result: input.result,
    deny_reason: input.denyReason ?? null,
    request_id: input.requestId,
    correlation_id: input.correlationId
  });
}
