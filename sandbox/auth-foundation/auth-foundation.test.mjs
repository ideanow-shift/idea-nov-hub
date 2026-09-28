import assert from "node:assert/strict";
import test from "node:test";
import {
  AppSessionStore,
  AuthError,
  AuthorizationEvaluator,
  CoreActorResolver,
  CoreReadAdapterMock,
  HandoffVerifier,
  OneTimeCodeExchange,
  formatAuditEvent
} from "./foundation.mjs";
import { createSyntheticFixture, IDS } from "./fixtures.mjs";

const NOW = Date.parse("2026-07-28T03:00:00.000Z");
const APP = "sandbox-store-app";
const ISSUER = "https://sandbox-hub.invalid";
const KEY = "synthetic-sandbox-signing-key-not-a-production-secret";
const fixture = createSyntheticFixture();
const resolver = new CoreActorResolver(fixture);
const evaluator = new AuthorizationEvaluator();

function verifier(overrides = {}) {
  return new HandoffVerifier({
    issuer: ISSUER,
    audience: APP,
    appId: APP,
    sandboxSigningKey: KEY,
    now: () => NOW,
    ...overrides
  });
}

function claims(overrides = {}) {
  return {
    iss: ISSUER,
    aud: APP,
    iat: NOW / 1000 - 1,
    exp: NOW / 1000 + 60,
    nonce: "nonce-synthetic-001",
    jti: `jti-${Math.random()}`,
    app_id: APP,
    principal_type: "employee",
    firebase_uid: "uid-active.test",
    employee_id: IDS.active,
    session_id: "hub-session-synthetic",
    login_method: "firebase",
    ...overrides
  };
}

function expectAuthError(reason, operation) {
  assert.throws(operation, (error) => error instanceof AuthError && error.reason === reason);
}

function employeeActor(uid = "uid-active.test") {
  return resolver.resolve({ firebase_uid: uid, principal_type: "employee", app_id: APP });
}

test("valid handoff verifies all required claims", () => {
  const value = claims();
  assert.deepEqual(verifier().verify(verifier().issue(value), {
    nonce: value.nonce,
    resolvedEmployeeId: IDS.active
  }), value);
});

test("tokenなし denies authentication_required", () => {
  expectAuthError("authentication_required", () => verifier().verify(""));
});

test("invalid signature denies invalid_signature", () => {
  const token = verifier().issue(claims());
  expectAuthError("invalid_signature", () => verifier().verify(`${token.slice(0, -1)}x`));
});

test("wrong issuer denies invalid_issuer", () => {
  const service = verifier();
  expectAuthError("invalid_issuer", () => service.verify(service.issue(claims({ iss: "https://wrong.invalid" }))));
});

test("wrong audience denies invalid_audience", () => {
  const service = verifier();
  expectAuthError("invalid_audience", () => service.verify(service.issue(claims({ aud: "other-app" }))));
});

test("expired handoff denies expired", () => {
  const service = verifier();
  expectAuthError("expired", () => service.verify(service.issue(claims({ exp: NOW / 1000 }))));
});

test("future issued_at denies issued_at_invalid", () => {
  const service = verifier();
  expectAuthError("issued_at_invalid", () => service.verify(service.issue(claims({ iat: NOW / 1000 + 61 }))));
});

test("nonce mismatch denies nonce_mismatch", () => {
  const service = verifier();
  expectAuthError("nonce_mismatch", () => service.verify(service.issue(claims()), { nonce: "wrong" }));
});

test("replay denies handoff_replayed", () => {
  const service = verifier();
  const token = service.issue(claims());
  service.verify(token);
  expectAuthError("handoff_replayed", () => service.verify(token));
});

test("app mismatch denies app_mismatch", () => {
  const service = verifier();
  expectAuthError("app_mismatch", () => service.verify(service.issue(claims({ app_id: "other-app" }))));
});

test("employee_id差し替え denies identity_mismatch", () => {
  const service = verifier();
  expectAuthError("identity_mismatch", () => service.verify(service.issue(claims({ employee_id: IDS.storeManager })), {
    resolvedEmployeeId: IDS.active
  }));
});

test("UIDとemployee不一致 denies identity_mismatch after server resolution", () => {
  const actor = resolver.resolve({ firebase_uid: "uid-store-manager.test", principal_type: "employee", app_id: APP });
  const service = verifier();
  expectAuthError("identity_mismatch", () => service.verify(service.issue(claims({
    firebase_uid: "uid-store-manager.test",
    employee_id: IDS.active
  })), { resolvedEmployeeId: actor.actorEmployeeId }));
});

test("one-time code is opaque and atomically consumed once", () => {
  const exchange = new OneTimeCodeExchange({ now: () => NOW });
  const signed = verifier().issue(claims());
  const code = exchange.register(signed);
  assert.match(code, /^otc_[a-f0-9]+$/);
  assert.equal(code.includes(signed), false);
  assert.equal(exchange.consume(code), signed);
  expectAuthError("code_invalid_or_consumed", () => exchange.consume(code));
});

test("expired one-time code denies code_expired", () => {
  let time = NOW;
  const exchange = new OneTimeCodeExchange({ ttlMs: 10, now: () => time });
  const code = exchange.register("signed-mock");
  time += 10;
  expectAuthError("code_expired", () => exchange.consume(code));
});

test("unknown UID denies identity_unresolved", () => {
  expectAuthError("identity_unresolved", () => employeeActor("uid-unknown.test"));
});

test("duplicate UID denies identity_ambiguous", () => {
  expectAuthError("identity_ambiguous", () => employeeActor("uid-duplicate.test"));
});

test("inactive employee denies employee_inactive", () => {
  expectAuthError("employee_inactive", () => employeeActor("uid-inactive.test"));
});

test("retired employee denies employee_retired", () => {
  expectAuthError("employee_retired", () => employeeActor("uid-retired.test"));
});

test("login disabled employee denies login_disabled", () => {
  expectAuthError("login_disabled", () => employeeActor("uid-disabled.test"));
});

test("terminal principal never resolves to employee", () => {
  const actor = resolver.resolve({ principal_type: "terminal", terminal_id: IDS.terminal, app_id: APP });
  assert.equal(actor.principalType, "terminal");
  assert.equal(actor.actorEmployeeId, undefined);
});

test("system service resolves only for authorized app", () => {
  const actor = resolver.resolve({ principal_type: "service", service_id: IDS.service, app_id: "sandbox-notification" });
  assert.equal(actor.principalType, "service");
  expectAuthError("service_unresolved", () => resolver.resolve({
    principal_type: "service", service_id: IDS.service, app_id: APP
  }));
});

test("roleなし denies role_missing", () => {
  const decision = evaluator.evaluate({ actor: employeeActor("uid-no-role.test"), resource: fixture.resources.openStoreA, action: "view" });
  assert.equal(decision.reason, "role_missing");
});

test("scope外店舗 denies store_scope_denied", () => {
  const decision = evaluator.evaluate({ actor: employeeActor(), resource: { ...fixture.resources.openStoreA, storeId: IDS.storeB }, action: "view" });
  assert.equal(decision.reason, "store_scope_denied");
});

test("他法人 denies corporation_scope_denied", () => {
  const decision = evaluator.evaluate({ actor: employeeActor(), resource: fixture.resources.openStoreOther, action: "view" });
  assert.equal(decision.reason, "corporation_scope_denied");
});

test("FC ownerが別FC閲覧 denies corporation_scope_denied", () => {
  const decision = evaluator.evaluate({ actor: employeeActor("uid-fc-owner.test"), resource: fixture.resources.openStoreOther, action: "view" });
  assert.equal(decision.reason, "corporation_scope_denied");
});

test("店長が別店舗更新 denies store_scope_denied", () => {
  const decision = evaluator.evaluate({
    actor: employeeActor("uid-store-manager.test"),
    resource: { ...fixture.resources.openStoreA, storeId: IDS.storeB },
    action: "update"
  });
  assert.equal(decision.reason, "store_scope_denied");
});

test("一般社員が管理者action denies action_denied", () => {
  const decision = evaluator.evaluate({ actor: employeeActor(), resource: fixture.resources.openStoreA, action: "manage_permission" });
  assert.equal(decision.reason, "action_denied");
});

test("request actor差し替え denies actor_mismatch", () => {
  const decision = evaluator.evaluate({
    actor: employeeActor(),
    resource: fixture.resources.openStoreA,
    action: "view",
    request: { employee_id: IDS.storeManager }
  });
  assert.equal(decision.reason, "actor_mismatch");
});

test("request store差し替え denies request_store_mismatch", () => {
  const decision = evaluator.evaluate({
    actor: employeeActor(),
    resource: fixture.resources.openStoreA,
    action: "view",
    request: { store_id: IDS.storeB }
  });
  assert.equal(decision.reason, "request_store_mismatch");
});

test("terminalが個人データ閲覧 denies step_up_required", () => {
  const actor = resolver.resolve({ principal_type: "terminal", terminal_id: IDS.terminal, app_id: APP });
  assert.equal(evaluator.evaluate({ actor, resource: fixture.resources.personalActive, action: "view", sensitivity: "pii" }).reason, "step_up_required");
});

test("service principalがuser action実行 denies service_not_allowed", () => {
  const actor = resolver.resolve({ principal_type: "service", service_id: IDS.service, app_id: "sandbox-notification" });
  assert.equal(evaluator.evaluate({ actor, resource: fixture.resources.openStoreA, action: "approve" }).reason, "service_not_allowed");
});

test("close後write denies record_closed", () => {
  assert.equal(evaluator.evaluate({ actor: employeeActor("uid-store-manager.test"), resource: fixture.resources.closedStoreA, action: "update" }).reason, "record_closed");
});

test("duplicate request denies duplicate_request", () => {
  const store = new Set();
  const input = {
    actor: employeeActor("uid-store-manager.test"),
    resource: fixture.resources.openStoreA,
    action: "update",
    request: { idempotency_key: "synthetic-request-1" },
    idempotencyStore: store
  };
  assert.equal(evaluator.evaluate(input).reason, "allow");
  assert.equal(evaluator.evaluate(input).reason, "duplicate_request");
});

test("all required role classes have deterministic decisions", () => {
  const cases = [
    ["uid-platform-admin.test", "manage_permission", "allow"],
    ["uid-executive.test", "view", "allow"],
    ["uid-area-manager.test", "approve", "allow"],
    ["uid-fc-owner.test", "view", "allow"],
    ["uid-store-manager.test", "close", "allow"],
    ["uid-active.test", "view", "allow"],
    ["uid-finance.test", "approve", "allow"],
    ["uid-hr.test", "view", "allow"]
  ];
  for (const [uid, action, reason] of cases) {
    assert.equal(evaluator.evaluate({ actor: employeeActor(uid), resource: fixture.resources.openStoreA, action }).reason, reason);
  }
});

test("app session cookie contract, app isolation and revoke work", () => {
  const sessions = new AppSessionStore({ now: () => NOW });
  const created = sessions.create({ appId: APP, actor: employeeActor(), hubSessionId: "hub-synthetic" });
  assert.deepEqual(created.cookie, {
    name: "__Host-nov_app_session", value: created.sessionId, httpOnly: true, secure: true, sameSite: "Lax", path: "/"
  });
  assert.equal(sessions.validate(created.sessionId, { appId: APP }).appId, APP);
  expectAuthError("session_app_mismatch", () => sessions.validate(created.sessionId, { appId: "other-app" }));
  sessions.revoke(created.sessionId);
  expectAuthError("session_revoked", () => sessions.validate(created.sessionId, { appId: APP }));
});

test("app session enforces idle and absolute timeout", () => {
  let time = NOW;
  const idle = new AppSessionStore({ idleTimeoutMs: 10, absoluteTimeoutMs: 100, now: () => time });
  const idleSession = idle.create({ appId: APP, actor: employeeActor() });
  time += 10;
  expectAuthError("session_idle_expired", () => idle.validate(idleSession.sessionId, { appId: APP }));

  time = NOW;
  const absolute = new AppSessionStore({ idleTimeoutMs: 100, absoluteTimeoutMs: 10, now: () => time });
  const absoluteSession = absolute.create({ appId: APP, actor: employeeActor() });
  time += 10;
  expectAuthError("session_absolute_expired", () => absolute.validate(absoluteSession.sessionId, { appId: APP }));
});

test("app session renewal rejects inactive, retired and login disabled actor", () => {
  const sessions = new AppSessionStore({ now: () => NOW });
  const inactive = sessions.create({ appId: APP, actor: { ...employeeActor(), active: false } });
  expectAuthError("employee_inactive", () => sessions.validate(inactive.sessionId, { appId: APP }));
  const retired = sessions.create({ appId: APP, actor: { ...employeeActor(), retired: true } });
  expectAuthError("employee_retired", () => sessions.validate(retired.sessionId, { appId: APP }));
  const disabled = sessions.create({ appId: APP, actor: { ...employeeActor(), loginEnabled: false } });
  expectAuthError("login_disabled", () => sessions.validate(disabled.sessionId, { appId: APP }));
});

test("terminal and system_service allow only their bounded actions", () => {
  const terminal = resolver.resolve({ principal_type: "terminal", terminal_id: IDS.terminal, app_id: APP });
  assert.equal(evaluator.evaluate({ terminal, actor: terminal, resource: fixture.resources.openStoreA, action: "create" }).reason, "allow");
  const service = resolver.resolve({ principal_type: "service", service_id: IDS.service, app_id: "sandbox-notification" });
  assert.equal(evaluator.evaluate({ actor: service, resource: fixture.resources.openStoreA, action: "system_execute" }).reason, "allow");
});

test("Core Read Adapter exposes required interface over fixture", () => {
  const adapter = new CoreReadAdapterMock(fixture);
  assert.equal(adapter.getEmployeeSummary(IDS.active).id, IDS.active);
  assert.deepEqual(adapter.getEmployeeRoles(IDS.storeManager), ["store_manager"]);
  assert.equal(adapter.getActiveAssignments(IDS.multiStore).length, 2);
  assert.equal(adapter.getStore(IDS.storeA).corporationId, IDS.corpA);
  assert.equal(adapter.getCorporation(IDS.corpB).id, IDS.corpB);
  assert.ok(adapter.getApplicationPermissions(APP).includes("view"));
  assert.deepEqual(adapter.getIdentityStatus("uid-duplicate.test"), {
    resolved: false, duplicate: true, active: false, loginEnabled: false
  });
});

test("audit formatter emits success and deny without copying secrets or PII", () => {
  const actor = employeeActor();
  const base = {
    actor,
    appId: APP,
    sessionId: "session-synthetic",
    action: "view",
    resource: fixture.resources.openStoreA,
    requestId: "request-synthetic",
    correlationId: "correlation-synthetic",
    secret: "must-not-appear",
    personalName: "must-not-appear"
  };
  const success = formatAuditEvent({ ...base, result: "allow" }, {
    now: () => "2026-07-28T03:00:00.000Z",
    uuid: () => "event-synthetic-allow"
  });
  const denied = formatAuditEvent({ ...base, result: "deny", denyReason: "scope_denied" }, {
    now: () => "2026-07-28T03:00:00.000Z",
    uuid: () => "event-synthetic-deny"
  });
  assert.equal(success.deny_reason, null);
  assert.equal(denied.deny_reason, "scope_denied");
  assert.equal(JSON.stringify([success, denied]).includes("must-not-appear"), false);
});
