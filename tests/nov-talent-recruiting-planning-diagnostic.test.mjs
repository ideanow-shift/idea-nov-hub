import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createRecruitingPlanningDiagnosticExecutor, summarize } from "../portal/talent/recruiting-planning-diagnostic.mjs";

const TOKEN = "t".repeat(40);
const base = "https://staging.example.invalid/functions/v1/nov-talent-staging-api";

function envelope(kind, extra = {}) {
  return { ok: true, data: {
    recruiting_planning_contract_version: "1.0.0", kind,
    targets: [], budgets: [], budgetLines: [], sourceAvailability: true,
    actualSources: {
      CONTACT_COUNT: "ACTUAL_SOURCE_UNAVAILABLE",
      SALON_VISIT_COUNT: "ACTUAL_SOURCE_UNAVAILABLE",
      APPLICATION_COUNT: "SELECTION_HISTORY:APPLICATION_RECEIVED",
      OFFERED_COUNT: "SELECTION_HISTORY:OFFERED",
      OFFER_ACCEPTED_COUNT: "SELECTION_HISTORY:OFFER_ACCEPTED",
      EXPECTED_JOIN_COUNT: "NOT_OPERATIONAL"
    }, ...extra
  } };
}

test("authenticated diagnostic reads current/history then proves flag OFF without retry or write", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body, auth: init.headers.Authorization });
    if (String(url).endsWith("/current")) return Response.json(envelope("APPROVED"));
    if (String(url).endsWith("/history")) return Response.json(envelope("HISTORY"));
    return Response.json({ ok: false, safeCode: "RECRUITING_PLANNING_WRITES_DISABLED" }, { status: 503 });
  };
  const executor = createRecruitingPlanningDiagnosticExecutor({
    globalObject: { NOV_TALENT_CONFIG: { readonlyApiBaseUrl: base } }, fetchImpl,
    hubSessionHelper: { async getSessionToken() { return TOKEN; } }
  });
  const result = await executor.run();
  assert.equal(result.ok, true);
  assert.equal(result.requestCount, 3);
  assert.deepEqual(calls.map(({ method, url }) => [method, url.slice(base.length)]), [
    ["GET", "/api/talent/v1/recruiting-planning/current"],
    ["GET", "/api/talent/v1/recruiting-planning/history"],
    ["POST", "/api/talent/v1/recruiting-planning/targets/drafts"]
  ]);
  assert.equal(calls[2].body, "{}");
  assert.equal(result.data.currentTargetCount, 0);
  assert.equal(result.data.currentBudgetCount, 0);
  assert.equal(result.data.channels.length, 12);
  assert.equal(result.data.writeFlag, "OFF");
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  const second = await executor.run();
  assert.equal(second.category, "duplicate_prevented");
  assert.equal(calls.length, 3);
});

test("missing session fails closed before fetch", async () => {
  let calls = 0;
  const result = await createRecruitingPlanningDiagnosticExecutor({
    globalObject: { NOV_TALENT_CONFIG: { readonlyApiBaseUrl: base } },
    fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); },
    hubSessionHelper: { async getSessionToken() { return null; } }
  }).run();
  assert.equal(result.category, "auth_required");
  assert.equal(result.requestCount, 0);
  assert.equal(calls, 0);
});

test("diagnostic rejects PII-bearing planning responses", () => {
  assert.equal(summarize(envelope("APPROVED", { approvedBy: "employee-uuid" }), envelope("HISTORY")), null);
});

test("Planning diagnostic remains inside management and normal navigation is unchanged", () => {
  const html = fs.readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const normalNav = html.match(/class="primary-navigation"[\s\S]*?<\/nav>/u)?.[0] || "";
  assert.doesNotMatch(normalNav, /Planning|Diagnostic/u);
  assert.match(html, /id="recruitment-management"[\s\S]*id="planning-diagnostic-panel"/u);
  assert.match(html, /id="planning-diagnostic-panel"[\s\S]*data-management-section="planning-diagnostic"/u);
});
