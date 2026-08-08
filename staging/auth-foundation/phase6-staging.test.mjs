import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { AuthError, AppSessionStore, AuthorizationEvaluator, CoreActorResolver, HandoffVerifier } from "../../sandbox/auth-foundation/foundation.mjs";
import { createSyntheticFixture, IDS } from "../../sandbox/auth-foundation/fixtures.mjs";
import { Ed25519Issuer, Ed25519Verifier, generateEphemeralEd25519Key } from "./asymmetric-handoff.mjs";
import { FileAtomicOneTimeStore } from "./file-atomic-store.mjs";
import { JsonlAuditStore, StagingCoreReadAdapter, SyntheticCoreRepository } from "./staging-adapters.mjs";

const NOW = Date.parse("2026-07-28T04:00:00.000Z");
const ISSUER = "https://staging-hub.invalid";
const APP = "sandbox-store-app";
const fixture = createSyntheticFixture();
const resolver = new CoreActorResolver(fixture);
const actor = resolver.resolve({ firebase_uid: "uid-active.test", principal_type: "employee", app_id: APP });
const claims = (overrides = {}) => ({
  aud: APP, app_id: APP, iat: NOW / 1000 - 1, exp: NOW / 1000 + 60,
  nonce: "staging-nonce", jti: "staging-jti", principal_type: "employee",
  firebase_uid: "uid-active.test", employee_id: IDS.active, session_id: "staging-session",
  login_method: "firebase", ...overrides
});
const authReason = async (promise, reason) => assert.rejects(promise, (error) => error instanceof AuthError && error.reason === reason);

test("Ed25519 private issuer and public verifier validate handoff", () => {
  const key = generateEphemeralEd25519Key("kid-a");
  const issuer = new Ed25519Issuer({ issuer: ISSUER, activeKey: key, now: () => NOW });
  const verifier = new Ed25519Verifier({ issuer: ISSUER, audience: APP, appId: APP, now: () => NOW });
  verifier.trust(key);
  assert.equal(verifier.verify(issuer.issue(claims())).employee_id, IDS.active);
});

test("unknown kid is rejected", () => {
  const issuer = new Ed25519Issuer({ issuer: ISSUER, activeKey: generateEphemeralEd25519Key("unknown"), now: () => NOW });
  const verifier = new Ed25519Verifier({ issuer: ISSUER, audience: APP, appId: APP, now: () => NOW });
  assert.throws(() => verifier.verify(issuer.issue(claims())), (error) => error.reason === "unknown_kid");
});

test("wrong algorithm and algorithm confusion are rejected", () => {
  const key = generateEphemeralEd25519Key("kid-a");
  const issuer = new Ed25519Issuer({ issuer: ISSUER, activeKey: key, now: () => NOW });
  const verifier = new Ed25519Verifier({ issuer: ISSUER, audience: APP, appId: APP, now: () => NOW });
  verifier.trust(key);
  const token = issuer.issue(claims());
  const [header, payload, signature] = token.split(".");
  const altered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(header, "base64url")), alg: "HS256" })).toString("base64url");
  assert.throws(() => verifier.verify(`${altered}.${payload}.${signature}`), (error) => error.reason === "algorithm_denied");
});

test("public/private key misuse is rejected by interfaces", () => {
  const key = generateEphemeralEd25519Key("kid-a");
  assert.throws(() => new Ed25519Issuer({ issuer: ISSUER, activeKey: { kid: key.kid, publicKey: key.publicKey } }), /issuer_private_key_required/);
  const verifier = new Ed25519Verifier({ issuer: ISSUER, audience: APP, appId: APP });
  assert.throws(() => verifier.trust({ kid: key.kid, publicKey: key.privateKey }), /verifier_public_key_required/);
});

test("key rotation allows old key only during grace period", () => {
  let time = NOW;
  const first = generateEphemeralEd25519Key("kid-old");
  const next = generateEphemeralEd25519Key("kid-new");
  const issuer = new Ed25519Issuer({ issuer: ISSUER, activeKey: first, now: () => time });
  const verifier = new Ed25519Verifier({ issuer: ISSUER, audience: APP, appId: APP, now: () => time, oldKeyGraceMs: 100 });
  verifier.trust(first);
  const oldToken = issuer.issue(claims());
  issuer.rotate(next);
  verifier.trust(next);
  verifier.retire(first.kid, time);
  assert.equal(verifier.verify(oldToken).employee_id, IDS.active);
  time += 101;
  assert.throws(() => verifier.verify(oldToken), (error) => error.reason === "key_grace_expired");
  assert.equal(verifier.verify(issuer.issue(claims({ jti: "new-jti" }))).employee_id, IDS.active);
});

test("app audience mismatch is rejected", () => {
  const key = generateEphemeralEd25519Key("kid-a");
  const issuer = new Ed25519Issuer({ issuer: ISSUER, activeKey: key, now: () => NOW });
  const verifier = new Ed25519Verifier({ issuer: ISSUER, audience: APP, appId: APP, now: () => NOW });
  verifier.trust(key);
  assert.throws(() => verifier.verify(issuer.issue(claims({ aud: "app-b", app_id: "app-b" }))), (error) => error.reason === "invalid_audience");
});

test("file store SET NX equivalent, TTL and atomic 100 consume", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nov-auth-store-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileAtomicOneTimeStore({ directory, now: () => NOW });
  const code = await store.register({ value: "signed", ttlMs: 1_000, issuer: ISSUER, appId: APP, jti: "jti-1" });
  const results = await Promise.allSettled(Array.from({ length: 100 }, () => store.consume(code, { issuer: ISSUER, appId: APP })));
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected" && item.reason.reason === "code_invalid_or_consumed").length, 99);
});

test("file store rejects expiry, wrong binding and revoked code", async (context) => {
  let time = NOW;
  const directory = await mkdtemp(join(tmpdir(), "nov-auth-store-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileAtomicOneTimeStore({ directory, now: () => time });
  const wrong = await store.register({ value: "x", ttlMs: 100, issuer: ISSUER, appId: APP, jti: "jti-a" });
  await authReason(store.consume(wrong, { issuer: ISSUER, appId: "app-b" }), "code_binding_mismatch");
  const expired = await store.register({ value: "x", ttlMs: 1, issuer: ISSUER, appId: APP, jti: "jti-b" });
  time += 1;
  await authReason(store.consume(expired, { issuer: ISSUER, appId: APP }), "code_expired");
  const revoked = await store.register({ value: "x", ttlMs: 100, issuer: ISSUER, appId: APP, jti: "jti-c" });
  await store.revoke(revoked);
  await authReason(store.consume(revoked, { issuer: ISSUER, appId: APP }), "code_revoked");
});

test("multiple processes allow exactly one consume", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nov-auth-multiprocess-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileAtomicOneTimeStore({ directory });
  const code = await store.register({ value: "signed", ttlMs: 10_000, issuer: ISSUER, appId: APP, jti: "jti-multi" });
  const worker = join(import.meta.dirname, "consume-worker.mjs");
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker, directory, code, ISSUER, APP], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", () => resolve(output));
  });
  const outputs = await Promise.all(Array.from({ length: 12 }, run));
  assert.equal(outputs.filter((value) => value === "CONSUMED").length, 1);
  assert.equal(outputs.filter((value) => value === "code_invalid_or_consumed").length, 11);
});

test("session renewal and revoke race ends revoked", async () => {
  const sessions = new AppSessionStore({ now: () => NOW });
  const created = sessions.create({ appId: APP, actor });
  await Promise.allSettled([
    Promise.resolve().then(() => sessions.validate(created.sessionId, { appId: APP })),
    Promise.resolve().then(() => sessions.revoke(created.sessionId))
  ]);
  assert.throws(() => sessions.validate(created.sessionId, { appId: APP }), (error) => error.reason === "session_revoked");
});

test("100 concurrent session renewals preserve one valid session", async () => {
  const sessions = new AppSessionStore({ now: () => NOW });
  const created = sessions.create({ appId: APP, actor });
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    Promise.resolve().then(() => sessions.validate(created.sessionId, { appId: APP }))
  ));
  assert.equal(results.length, 100);
  assert.ok(results.every((session) => session.appId === APP && session.actor.actorEmployeeId === IDS.active));
});

test("100 concurrent same-jti verifications allow one and reject 99 replays", async () => {
  const verifier = new HandoffVerifier({
    issuer: ISSUER, audience: APP, appId: APP,
    sandboxSigningKey: "staging-concurrency-synthetic", now: () => NOW
  });
  const token = verifier.issue({ ...claims(), iss: ISSUER });
  const results = await Promise.allSettled(Array.from({ length: 100 }, () =>
    Promise.resolve().then(() => verifier.verify(token))
  ));
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected" && item.reason.reason === "handoff_replayed").length, 99);
});

test("100 duplicate writes allow one idempotency key and deny 99", async () => {
  const evaluator = new AuthorizationEvaluator();
  const idempotencyStore = new Set();
  const manager = resolver.resolve({ firebase_uid: "uid-store-manager.test", principal_type: "employee", app_id: APP });
  const results = await Promise.all(Array.from({ length: 100 }, () =>
    Promise.resolve().then(() => evaluator.evaluate({
      actor: manager,
      resource: fixture.resources.openStoreA,
      action: "update",
      request: { idempotency_key: "phase6-duplicate-write" },
      idempotencyStore
    }))
  ));
  assert.equal(results.filter((item) => item.allowed).length, 1);
  assert.equal(results.filter((item) => item.reason === "duplicate_request").length, 99);
});

test("staging adapter returns versioned active data with effective assignments", async () => {
  const enriched = createSyntheticFixture();
  enriched.employees.find((item) => item.id === IDS.multiStore).assignments[1].effectiveFrom = "2026-08-01T00:00:00.000Z";
  const adapter = new StagingCoreReadAdapter(new SyntheticCoreRepository(enriched, { generatedAt: NOW }), { now: () => NOW });
  assert.equal((await adapter.getEmployeeSummary(IDS.active)).adapterVersion, "staging-v1");
  assert.deepEqual((await adapter.getEmployeeRoles(IDS.storeManager)).data, ["store_manager"]);
  assert.equal((await adapter.getActiveAssignments(IDS.multiStore)).data.length, 1);
  assert.equal((await adapter.getStore(IDS.storeA, actor)).data.id, IDS.storeA);
  assert.equal((await adapter.getCorporation(IDS.corpA, actor)).data.id, IDS.corpA);
  assert.ok((await adapter.getApplicationPermissions(APP)).data.includes("view"));
  assert.equal((await adapter.getIdentityStatus("uid-active.test")).data.active, true);
});

test("adapter denies inactive, duplicate, unresolved and scope violations", async () => {
  const adapter = new StagingCoreReadAdapter(new SyntheticCoreRepository(fixture, { generatedAt: NOW }), { now: () => NOW });
  await authReason(adapter.getEmployeeSummary(IDS.retired), "employee_not_active");
  await authReason(adapter.getIdentityStatus("uid-duplicate.test"), "identity_ambiguous");
  await authReason(adapter.getIdentityStatus("uid-unknown.test"), "identity_unresolved");
  await authReason(adapter.getStore(IDS.storeOther, actor), "corporation_scope_denied");
  const terminal = resolver.resolve({ principal_type: "terminal", terminal_id: IDS.terminal, app_id: APP });
  await authReason(adapter.getCorporation(IDS.corpA, terminal), "principal_type_denied");
});

test("adapter timeout and stale cache fail closed", async () => {
  const slow = new StagingCoreReadAdapter(new SyntheticCoreRepository(fixture, { latencyMs: 20, generatedAt: NOW }), { timeoutMs: 1, now: () => NOW });
  await authReason(slow.getEmployeeSummary(IDS.active), "adapter_timeout");
  const stale = new StagingCoreReadAdapter(new SyntheticCoreRepository(fixture, { generatedAt: NOW - 101 }), { staleAfterMs: 100, now: () => NOW });
  await authReason(stale.getEmployeeSummary(IDS.active), "adapter_stale");
});

test("revoked role and store assignment disappear on fresh adapter read", async () => {
  const mutable = createSyntheticFixture();
  const repository = new SyntheticCoreRepository(mutable, { generatedAt: NOW });
  const adapter = new StagingCoreReadAdapter(repository, { now: () => NOW });
  repository.fixture.employees.find((item) => item.id === IDS.storeManager).roles = [];
  repository.fixture.employees.find((item) => item.id === IDS.multiStore).assignments[0].active = false;
  assert.deepEqual((await adapter.getEmployeeRoles(IDS.storeManager)).data, []);
  assert.equal((await adapter.getActiveAssignments(IDS.multiStore)).data.length, 1);
});

test("audit persists allow/deny/security events with masking and integrity chain", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nov-auth-audit-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "audit.jsonl");
  const audit = new JsonlAuditStore({ path });
  const events = [
    ["employee", "view", "allow", null],
    ["employee", "view", "deny", "scope_violation"],
    ["employee", "exchange", "deny", "handoff_replayed"],
    ["anonymous", "exchange", "deny", "invalid_token"],
    ["employee", "update", "deny", "actor_mismatch"],
    ["service", "system_execute", "allow", null],
    ["terminal", "create", "allow", null]
  ];
  for (const [principal, action, result, reason] of events) {
    await audit.append({
      actor_principal: principal,
      firebase_uid: "uid-active.test", session_id: "secret-session", app_id: APP,
      action, resource_type: "record", resource_id: "synthetic-resource",
      result, deny_reason: reason, request_id: randomId(), correlation_id: randomId(),
      secret: "must-not-persist", employee_name: "must-not-persist"
    });
  }
  assert.equal(await audit.verifyIntegrity(), true);
  const persisted = await readFile(path, "utf8");
  assert.equal(persisted.includes("uid-active.test"), false);
  assert.equal(persisted.includes("secret-session"), false);
  assert.equal(persisted.includes("must-not-persist"), false);
});

test("audit tampering is detected", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nov-auth-audit-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "audit.jsonl");
  const audit = new JsonlAuditStore({ path });
  await audit.append({ actor_principal: "terminal", app_id: APP, action: "create", result: "allow", request_id: "r", correlation_id: "c" });
  const original = await readFile(path, "utf8");
  await writeFile(path, original.replace('"result":"allow"', '"result":"deny"'), "utf8");
  assert.equal(await audit.verifyIntegrity(), false);
});

test("privileged audit write failure fails closed", async () => {
  const audit = new JsonlAuditStore({ path: "unused", failWrites: true });
  await authReason(audit.append({ action: "manage_permission" }, { privileged: true }), "audit_unavailable");
  assert.deepEqual(await audit.append({ action: "view" }), { persisted: false });
});

test("terminal and service cannot escalate principal type", () => {
  const terminal = resolver.resolve({ principal_type: "terminal", terminal_id: IDS.terminal, app_id: APP });
  const service = resolver.resolve({ principal_type: "service", service_id: IDS.service, app_id: "sandbox-notification" });
  assert.equal(terminal.actorEmployeeId, undefined);
  assert.equal(service.actorEmployeeId, undefined);
  assert.throws(() => resolver.resolve({ principal_type: "employee", terminal_id: IDS.terminal, app_id: APP }), (error) => error.reason === "identity_unresolved");
  assert.throws(() => resolver.resolve({ principal_type: "employee", service_id: IDS.service, app_id: APP }), (error) => error.reason === "identity_unresolved");
});

function randomId() {
  return Math.random().toString(16).slice(2);
}
