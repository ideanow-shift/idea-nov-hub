import assert from "node:assert/strict";
import { DBF_HANDOFF, exchangeDbfStagingHandoff, issueDbfStagingHandoff } from "../supabase/functions/nov-hub-api/dbf_session_handoff_candidate.mjs";

let clock = Date.parse("2026-08-12T04:00:00Z");
const rows = [];
const store = {
  async insert(row) { rows.push(row); },
  async consumeAtomic(match) {
    const row = rows.find((item) => !item.consumedAt
      && item.codeHash === match.codeHash
      && item.stateHash === match.stateHash
      && item.nonceHash === match.nonceHash
      && item.audience === match.audience
      && item.target === match.target
      && item.targetOrigin === match.targetOrigin
      && item.expiresAt > match.now);
    if (!row) return null;
    row.consumedAt = match.now;
    return row;
  }
};
const deps = (allowed = true) => ({
  now: () => clock,
  store,
  randomUuid: () => "00000000-0000-4000-8000-000000000001",
  signSession: async (claims) => `signed.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`,
  verifyHubSessionContinuity: async ({ expiresAt }) => ({ valid: Number(expiresAt) > clock }),
  resolveBusinessDataAdmin: async () => allowed
    ? { businessDataAdmin: true, scope: { companyIds: ["c1"] }, sourceSessionExpiresAt: clock + 3_600_000 }
    : { businessDataAdmin: false }
});

const state = "state_1234567890123456789012";
const issued = await issueDbfStagingHandoff({
  hubIdentity: { employeeId: "e1", sessionId: "s1", authSource: "hub_session", expiresAt: new Date(clock + 3_600_000).toISOString() },
  target: DBF_HANDOFF.target,
  targetOrigin: DBF_HANDOFF.targetOrigin,
  state
}, deps());
assert.equal(rows.length, 1);
assert.equal(rows[0].codeHash.includes(issued.handoffCode), false, "plaintext code must not be stored");

const exchanged = await exchangeDbfStagingHandoff({
  iapVerified: true,
  origin: DBF_HANDOFF.targetOrigin,
  handoffCode: issued.handoffCode,
  state
}, deps());
assert.equal(exchanged.capability.businessDataAdmin, true);
assert.equal(exchanged.runtimeImport, "ENABLED");
assert.equal(exchanged.productionWrite, "DISABLED");
const sessionClaims = JSON.parse(Buffer.from(exchanged.sessionToken.split(".")[1], "base64url").toString("utf8"));
assert.equal(sessionClaims.aud, "dbf_staging_session_v1");
assert.ok(sessionClaims.exp - sessionClaims.iat <= 900, "Staging session must not exceed 15 minutes");

await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued.handoffCode, state }, deps()), (e) => e.status === 401);
const issued2 = await issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock + 3_600_000).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps());
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: false, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued2.handoffCode, state }, deps()), (e) => e.status === 401);
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: "https://example.invalid", handoffCode: issued2.handoffCode, state }, deps()), (e) => e.status === 403);
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued2.handoffCode, state: `${state}x` }, deps()), (e) => e.status === 401);

const issued3 = await issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock + 3_600_000).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps());
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued3.handoffCode, state }, deps(false)), (e) => e.status === 403);
const issued4 = await issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock + 3_600_000).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps());
clock += 61_000;
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued4.handoffCode, state }, deps()), (e) => e.status === 401);

const continuityDeps = deps();
continuityDeps.verifyHubSessionContinuity = async () => ({ valid: false });
const issued5 = await issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock + 3_600_000).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps());
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued5.handoffCode, state }, continuityDeps), (e) => e.status === 401);

const issued6 = await issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock + 3_600_000).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps());
rows.at(-1).audience = "wrong_audience";
await assert.rejects(() => exchangeDbfStagingHandoff({ iapVerified: true, origin: DBF_HANDOFF.targetOrigin, handoffCode: issued6.handoffCode, state }, deps()), (e) => e.status === 401);

await assert.rejects(() => issueDbfStagingHandoff({ hubIdentity: null, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps()), (e) => e.status === 401);
await assert.rejects(() => issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock - 1).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps()), (e) => e.status === 401);
await assert.rejects(() => issueDbfStagingHandoff({ hubIdentity: { employeeId: "e1", sessionId: "s1", expiresAt: new Date(clock + 3_600_000).toISOString() }, target: DBF_HANDOFF.target, targetOrigin: DBF_HANDOFF.targetOrigin, state }, deps(false)), (e) => e.status === 403);

console.log("dbf hub session handoff: PASS");
