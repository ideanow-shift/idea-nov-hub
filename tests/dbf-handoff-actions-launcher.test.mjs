import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleDbfHandoffAction } from "../supabase/functions/nov-hub-api/dbf_handoff_actions_candidate.mjs";
import { routeDbfHandoffCandidate } from "../supabase/functions/nov-hub-api/dbf_handoff_route_candidate.mjs";
import { buildDbfStagingLaunchUrl } from "../portal/js/dbf-staging-launcher-candidate.js";

const now = Date.parse("2026-08-12T04:00:00Z");
const rows = [];
const deps = {
  now: () => now,
  randomUuid: () => "00000000-0000-4000-8000-000000000009",
  verifyHubRequest: async (request) => {
    if (!request.token) { const error = new Error("missing"); error.status = 401; throw error; }
    return { employeeId: "employee", sessionId: "00000000-0000-4000-8000-000000000008", authSource: "hub_session", expiresAt: new Date(now + 3_600_000).toISOString() };
  },
  verifyStagingBffRequest: async ({ iapAssertion, expectedOrigin }) => ({
    verified: iapAssertion === "valid-iap-assertion" && expectedOrigin === "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app"
  }),
  resolveBusinessDataAdmin: async () => ({ businessDataAdmin: true, scope: "all" }),
  verifyHubSessionContinuity: async () => ({ valid: true }),
  signSession: async () => "signed-staging-session",
  store: {
    insert: async (row) => rows.push(row),
    consumeAtomic: async (match) => {
      const row = rows.find((value) => !value.consumedAt && value.codeHash === match.codeHash && value.stateHash === match.stateHash && value.nonceHash === match.nonceHash && value.audience === match.audience);
      if (!row) return null;
      row.consumedAt = match.now;
      return row;
    }
  }
};

await assert.rejects(() => handleDbfHandoffAction({ action: "dbfStagingHandoffIssueV1", token: "", payload: { state: "state_1234567890123456789012" } }, deps), (error) => error.status === 401);
const issue = await handleDbfHandoffAction({ action: "dbfStagingHandoffIssueV1", token: "hub", payload: { state: "state_1234567890123456789012" } }, deps);
assert.equal(issue.status, 200);
assert.match(issue.body.handoffCode, /^[A-Za-z0-9_-]{43}$/u);
await assert.rejects(() => handleDbfHandoffAction({ action: "dbfStagingHandoffExchangeV1", payload: { handoffCode: issue.body.handoffCode, state: issue.body.state, origin: issue.body.targetOrigin } }, deps), (error) => error.status === 401);
const exchanged = await handleDbfHandoffAction({ action: "dbfStagingHandoffExchangeV1", iapAssertion: "valid-iap-assertion", payload: { handoffCode: issue.body.handoffCode, state: issue.body.state, origin: issue.body.targetOrigin } }, deps);
assert.equal(exchanged.body.audience, "dbf_staging_session_v1");

const routeRequest = new Request("https://hub.example.invalid/functions/v1/nov-hub-api", {
  method: "POST",
  headers: { "x-dbf-iap-assertion": "valid-iap-assertion" }
});
const routedError = await routeDbfHandoffCandidate({
  request: routeRequest,
  body: { action: "dbfStagingHandoffExchangeV1", payload: { handoffCode: "x".repeat(43), state: "state_1234567890123456789012", origin: issue.body.targetOrigin } }
}, { ...deps, store: { ...deps.store, consumeAtomic: async () => null } }).catch((error) => error);
assert.equal(routedError.status, 401);

const launched = await buildDbfStagingLaunchUrl({ issue: async () => ({ handoffCode: "z".repeat(43) }) });
const url = new URL(launched);
assert.equal(url.origin, "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app");
assert.equal(url.search, "");
assert.equal(url.hash.includes("handoff_code="), true);
assert.equal(/token|email|role|permission/iu.test(url.hash), false);
const masterAdminHtml = await readFile(new URL("../portal/master-admin-stable/index.html", import.meta.url), "utf8");
const masterAdminJs = await readFile(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
assert.match(masterAdminHtml, /DBF経営データ管理 Stagingを開く/u);
assert.match(masterAdminJs, /openDbfStagingFromAuthorizedAdmin/u);
assert.match(masterAdminJs, /callApiAction\(action, payload\)/u);
console.log("dbf handoff actions and launcher: PASS");
