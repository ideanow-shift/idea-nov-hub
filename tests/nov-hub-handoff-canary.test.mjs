import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AppSessionStore, CANARY_APP_ID, CANARY_ISSUER, CanaryExchange, CommonHandoffIssuer,
  InMemoryOneTimeCodeStore, MemoryAuditSink, SyntheticActorResolver, createCanaryFlags,
  evaluateCanaryFlags
} from "../portal/canary/hub-context-test/handoff-canary.mjs";

const redirect = "https://canary.invalid/hub-context-test";
const active = { syntheticActorId: "syn-active-01", principalType: "employee" };
const enabledFlags = () => createCanaryFlags({
  globalEnabled: true, appEnabled: true, environmentEnabled: true,
  environment: "development", allowedSyntheticActors: ["syn-active-01", "syn-terminal-01", "syn-service-01", "syn-inactive-01", "syn-retired-01", "syn-disabled-01", "syn-duplicate-01"],
  killSwitch: false
});
const setup = ({ flags = enabledFlags(), now = () => Date.now(), audit = new MemoryAuditSink(), resolver = new SyntheticActorResolver(), sessions } = {}) => {
  const codeStore = new InMemoryOneTimeCodeStore({ now });
  const sessionStore = sessions ?? new AppSessionStore({ now });
  return {
    audit, codeStore, sessions: sessionStore,
    issuer: new CommonHandoffIssuer({ flags, codeStore, audit, now, redirectAllowlist: [redirect] }),
    exchange: new CanaryExchange({ codeStore, actorResolver: resolver, sessions: sessionStore, audit, now, redirectAllowlist: [redirect] })
  };
};
const issue = (system, principal = active, extra = {}) => system.issuer.issueAppHandoff({
  appId: CANARY_APP_ID,
  hubSession: { sessionId: "hub-synthetic-session", syntheticActorId: principal.syntheticActorId, loginMethod: "synthetic" },
  principal, redirectUri: redirect, correlationId: "corr-test", ...extra
});
const exchange = (system, handoff, extra = {}) => system.exchange.exchange({
  code: handoff.code, appId: CANARY_APP_ID, audience: CANARY_APP_ID, redirectUri: redirect, ...extra
});
const rejects = async (fn, reason) => {
  try {
    await fn();
    assert.fail(`expected denial: ${reason}`);
  } catch (error) {
    assert.equal(error?.reason, reason);
  }
};

test("flags default to fail closed", () => {
  const flags = createCanaryFlags();
  assert.equal(flags.globalEnabled, false);
  assert.equal(flags.appEnabled, false);
  assert.equal(flags.environmentEnabled, false);
  assert.equal(flags.killSwitch, true);
});
test("global flag off", () => assert.equal(evaluateCanaryFlags(createCanaryFlags({ killSwitch: false }), active.syntheticActorId).reason, "global_flag_off"));
test("app flag off", () => assert.equal(evaluateCanaryFlags(createCanaryFlags({ killSwitch: false, globalEnabled: true }), active.syntheticActorId).reason, "app_flag_off"));
test("environment flag off", () => assert.equal(evaluateCanaryFlags(createCanaryFlags({ killSwitch: false, globalEnabled: true, appEnabled: true }), active.syntheticActorId).reason, "environment_denied"));
test("production is denied even when environment flag is on", () => assert.equal(evaluateCanaryFlags(createCanaryFlags({ killSwitch: false, globalEnabled: true, appEnabled: true, environmentEnabled: true, environment: "production" }), active.syntheticActorId).reason, "environment_denied"));
test("allowlist outsider denied", () => assert.equal(evaluateCanaryFlags(enabledFlags(), "syn-outsider").reason, "allowlist_denied"));
test("kill switch wins", () => assert.equal(evaluateCanaryFlags({ ...enabledFlags(), killSwitch: true }, active.syntheticActorId).reason, "kill_switch"));
test("enabled synthetic actor allowed", () => assert.equal(evaluateCanaryFlags(enabledFlags(), active.syntheticActorId).enabled, true));

test("valid issue and exchange", () => {
  const system = setup();
  const result = exchange(system, issue(system));
  assert.equal(result.appId, CANARY_APP_ID);
  assert.equal(result.syntheticActorId, active.syntheticActorId);
});
test("opaque code contains no actor or token", () => {
  const handoff = issue(setup());
  assert.equal(handoff.code.includes(active.syntheticActorId), false);
  assert.equal(handoff.code.split(".").length, 1);
});
test("issuer does not trust request actor mismatch", async () => {
  const system = setup();
  await rejects(() => Promise.resolve(issue(system, active, { hubSession: { sessionId: "x", syntheticActorId: "syn-other", loginMethod: "synthetic" } })), "actor_mismatch");
});
test("issuer rejects wrong app", async () => {
  const system = setup();
  await rejects(() => Promise.resolve(issue(system, active, { appId: "other-app" })), "app_mismatch");
});
test("issuer rejects invalid redirect", async () => {
  const system = setup();
  await rejects(() => Promise.resolve(issue(system, active, { redirectUri: "https://evil.invalid/" })), "redirect_denied");
});
test("replay denied", async () => {
  const system = setup(); const handoff = issue(system); exchange(system, handoff);
  await rejects(() => Promise.resolve(exchange(system, handoff)), "code_invalid_or_consumed");
});
test("expired code denied", async () => {
  let clock = 1_000; const system = setup({ now: () => clock }); const handoff = issue(system); clock += 60_001;
  await rejects(() => Promise.resolve(exchange(system, handoff)), "code_expired");
});
test("wrong audience denied", async () => {
  const system = setup(); const handoff = issue(system);
  await rejects(() => Promise.resolve(exchange(system, handoff, { audience: "other-app" })), "audience_mismatch");
});
test("wrong app denied", async () => {
  const system = setup(); const handoff = issue(system);
  await rejects(() => Promise.resolve(exchange(system, handoff, { appId: "other-app" })), "app_mismatch");
});
test("redirect substitution denied", async () => {
  const system = setup(); const handoff = issue(system);
  await rejects(() => Promise.resolve(exchange(system, handoff, { redirectUri: "https://evil.invalid/" })), "redirect_denied");
});
test("request actor substitution denied", async () => {
  const system = setup(); const handoff = issue(system);
  await rejects(() => Promise.resolve(exchange(system, handoff, { requestedActorId: "syn-other" })), "actor_mismatch");
});
test("CSRF failure denied", async () => {
  const system = setup(); const handoff = issue(system);
  await rejects(() => Promise.resolve(exchange(system, handoff, { csrfValid: false })), "csrf_denied");
});

for (const [label, principal, reason] of [
  ["unknown identity", { syntheticActorId: "syn-unknown-01", principalType: "employee" }, "identity_unresolved"],
  ["duplicate identity", { syntheticActorId: "syn-duplicate-01", principalType: "employee" }, "identity_ambiguous"],
  ["inactive identity", { syntheticActorId: "syn-inactive-01", principalType: "employee" }, "actor_inactive"],
  ["retired identity", { syntheticActorId: "syn-retired-01", principalType: "employee" }, "actor_retired"],
  ["login disabled identity", { syntheticActorId: "syn-disabled-01", principalType: "employee" }, "login_disabled"]
]) {
  test(`${label} denied`, async () => {
    const flags = { ...enabledFlags(), allowedSyntheticActors: [...enabledFlags().allowedSyntheticActors, principal.syntheticActorId] };
    const system = setup({ flags }); const handoff = issue(system, principal);
    await rejects(() => Promise.resolve(exchange(system, handoff)), reason);
  });
}
test("terminal principal remains terminal", () => {
  const system = setup(); const principal = { syntheticActorId: "syn-terminal-01", principalType: "terminal" };
  assert.equal(exchange(system, issue(system, principal)).principalType, "terminal");
});
test("service principal remains service", () => {
  const system = setup(); const principal = { syntheticActorId: "syn-service-01", principalType: "service" };
  assert.equal(exchange(system, issue(system, principal)).principalType, "service");
});
test("cookie contract is HttpOnly Secure SameSite Lax", () => {
  const system = setup(); const result = exchange(system, issue(system));
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /Secure/);
  assert.match(result.setCookie, /SameSite=Lax/);
});
test("app session cannot be reused across apps", async () => {
  const system = setup(); const result = exchange(system, issue(system));
  await rejects(() => Promise.resolve(system.sessions.validate(result.sessionId, "other-app")), "session_app_mismatch");
});
test("logout revokes app session", async () => {
  const system = setup(); const result = exchange(system, issue(system)); system.exchange.logout(result.sessionId, "corr-logout");
  await rejects(() => Promise.resolve(system.sessions.validate(result.sessionId, CANARY_APP_ID)), "session_revoked");
});
test("idle timeout enforced", async () => {
  let clock = 1_000; const sessions = new AppSessionStore({ now: () => clock, idleTimeoutMs: 100, absoluteTimeoutMs: 1_000 });
  const system = setup({ now: () => clock, sessions }); const result = exchange(system, issue(system)); clock += 100;
  await rejects(() => Promise.resolve(sessions.validate(result.sessionId, CANARY_APP_ID)), "session_idle_expired");
});
test("absolute timeout enforced", async () => {
  let clock = 1_000; const sessions = new AppSessionStore({ now: () => clock, idleTimeoutMs: 1_000, absoluteTimeoutMs: 100 });
  const system = setup({ now: () => clock, sessions }); const result = exchange(system, issue(system)); clock += 100;
  await rejects(() => Promise.resolve(sessions.validate(result.sessionId, CANARY_APP_ID)), "session_absolute_expired");
});
test("audit records issue success and session", () => {
  const system = setup(); exchange(system, issue(system));
  assert.deepEqual(system.audit.events.map((event) => event.type), ["handoff_issued", "session_created", "exchange_success"]);
});
test("audit excludes tokens uid email and role detail", () => {
  const system = setup(); exchange(system, issue(system));
  const text = JSON.stringify(system.audit.events);
  assert.equal(/firebase|email|token|role/i.test(text), false);
});
test("audit failure fails issuer closed", async () => {
  const system = setup({ audit: new MemoryAuditSink({ failWrites: true }) });
  await rejects(() => Promise.resolve(issue(system)), "audit_unavailable");
});
test("session issuance failure denies and records the reason", async () => {
  const sessions = { create() { throw new Error("synthetic failure"); } };
  const system = setup({ sessions }); const handoff = issue(system);
  await rejects(() => Promise.resolve(exchange(system, handoff)), "session_issuance_failed");
  assert.equal(system.audit.events.at(-1).deny_reason, "session_issuance_failed");
});
test("kill switch emits audit", async () => {
  const system = setup({ flags: { ...enabledFlags(), killSwitch: true } });
  await rejects(() => Promise.resolve(issue(system)), "kill_switch");
  assert.equal(system.audit.events[0].type, "kill_switch_used");
});
test("flag fallback emits audit", async () => {
  const system = setup({ flags: createCanaryFlags({ killSwitch: false }) });
  await rejects(() => Promise.resolve(issue(system)), "global_flag_off");
  assert.equal(system.audit.events[0].type, "fallback_used");
});
test("issued metadata has required contract", () => {
  const system = setup(); const handoff = issue(system); const stored = system.codeStore.consume(handoff.code);
  for (const key of ["appId", "issuer", "audience", "expiresAt", "nonce", "jti", "hubSessionId", "principalType", "loginMethod", "redirectUri", "correlationId"]) assert.ok(stored[key]);
  assert.equal(stored.issuer, CANARY_ISSUER);
});

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");
test("regression: Google login implementation remains present", async () => assert.match(await source("../portal/js/auth.js"), /GoogleAuthProvider/));
test("regression: email PIN login remains present", async () => assert.match(await source("../portal/js/main.js"), /email.*pin/is));
test("regression: HUB session generation remains present", async () => assert.match(await source("../supabase/functions/nov-hub-api/index.ts"), /issueHubSession/));
test("regression: app card rendering remains present", async () => assert.match(await source("../portal/js/main.js"), /renderApps/));
test("regression: IDEA LINK launch remains present", async () => assert.match(await source("../portal/js/main.js"), /createIdeaLinkHandoff/));
test("regression: legacy hub_context generation remains present", async () => assert.match(await source("../portal/js/hub-context.js"), /hub_context/));
test("regression: logout remains present", async () => assert.match(await source("../portal/js/main.js"), /logout/i));
test("canary module is not imported by current main", async () => assert.doesNotMatch(await source("../portal/js/main.js"), /handoff-canary|hub-context-test/));
test("diagnostic page uses textContent and strips query", async () => {
  const html = await source("../portal/canary/hub-context-test/index.html");
  assert.match(html, /textContent/);
  assert.match(html, /history\.replaceState/);
  assert.doesNotMatch(html, /innerHTML|localStorage|firebase_uid|employee_id|token/);
});
test("diagnostic page is hidden unless all development flags pass", async () => {
  const html = await source("../portal/canary/hub-context-test/index.html");
  assert.match(html, /<main hidden>/);
  assert.match(html, /environment === "development"/);
  assert.match(html, /document\.body\.replaceChildren/);
});
