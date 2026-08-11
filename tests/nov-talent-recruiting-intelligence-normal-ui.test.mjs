import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRecruitingIntelligenceViewModel, createRecruitingIntelligenceViewExecutor, validateResponse } from "../portal/talent/recruiting-intelligence-view.mjs";

const ID = "10000000-0000-4000-8000-000000000001";
const response = () => ({ ok: true, data: {
  recruiting_intelligence_contract_version: "1.1.0", sourceCoverageState: "COMPLETE",
  sourceAvailability: { candidates: true, selectionHistory: true, communications: true, nextActions: true, fairAttributions: true, schoolMasters: true, planningTargets: true, planningBudgets: true },
  currentPosition: { state: "READY", candidateCount: 636, projectionCounts: {} },
  funnel: { state: "READY", uniqueCandidateReachedCounts: { APPLICATION_RECEIVED: 0, OFFERED: 0, OFFER_ACCEPTED: 0 }, rates: null },
  graduationYears: { state: "READY", rows: {} }, schoolProgress: { state: "READY", rows: [{ schoolId: ID, candidateCount: 2, officialSelectionCandidateCount: 0 }] },
  assigneeWorkload: { state: "READY", openActionCounts: { [ID]: 1 } },
  priorities: { state: "READY", stallThresholdDays: 7, buckets: [
    { bucket: "OVERDUE", count: 1, candidates: [{ candidateId: ID, deadline: "2026-08-10" }], truncated: false },
    { bucket: "DUE_TODAY", count: 0, candidates: [], truncated: false }, { bucket: "AWAITING_REPLY", count: 0, candidates: [], truncated: false },
    { bucket: "SELECTION_WITHOUT_NEXT_ACTION", count: 0, candidates: [], truncated: false }, { bucket: "UNASSIGNED_ACTION", count: 0, candidates: [], truncated: false },
    { bucket: "STALLED", count: 0, candidates: [], truncated: false }
  ] },
  fairResults: { state: "READY", confirmedOriginCandidateCount: 0, rows: [] }, managementDiagnostics: { state: "READY", pendingFairAttributionCandidateCount: 161, pendingFairAttributionRowCount: 201 },
  planningComparison: { state: "READY", rows: [{ recruitingTrack: "NEW_GRAD", graduationYear: 2027, period: { code: "GRAD_2027", start: "2025-09-01", end: "2026-08-31" }, scope: "COMPANY", approvedPlanningVersion: 1,
    metrics: {
      CONTACT_COUNT: { targetStatus: "APPROVED", plan: 563, actualSourceStatus: "ACTUAL_SOURCE_UNAVAILABLE", actual: null, achievementRate: null, remaining: null },
      SALON_VISIT_COUNT: { targetStatus: "APPROVED", plan: 112, actualSourceStatus: "ACTUAL_SOURCE_UNAVAILABLE", actual: null, achievementRate: null, remaining: null },
      APPLICATION_COUNT: { targetStatus: "APPROVED", plan: 45, actualSourceStatus: "READY", actual: 0, achievementRate: 0, remaining: 45 },
      OFFERED_COUNT: { targetStatus: "NO_APPROVED_TARGET", plan: null, actualSourceStatus: "READY", actual: 0, achievementRate: null, remaining: null },
      OFFER_ACCEPTED_COUNT: { targetStatus: "NO_APPROVED_TARGET", plan: null, actualSourceStatus: "READY", actual: 0, achievementRate: null, remaining: null }
    }, budget: { targetStatus: "APPROVED", plan: 7385350, currency: "JPY", approvedVersion: 1, actualSourceStatus: "ACTUAL_SOURCE_UNAVAILABLE", actualSpend: null, remaining: null }
  }] }, targets: { state: "UNSET" }
} });

test("normal analysis performs one authenticated read-only GET", async () => {
  const calls = [];
  const result = await createRecruitingIntelligenceViewExecutor({
    globalObject: { NOV_TALENT_CONFIG: { readonlyApiBaseUrl: "https://staging.example.invalid" } }, hubSessionHelper: { async getSessionToken() { return "x".repeat(32); } },
    async fetchImpl(url, init) { calls.push({ url, init }); return Response.json(response()); }
  }).run();
  assert.equal(result.ok, true); assert.equal(calls.length, 1); assert.equal(calls[0].init.method, "GET"); assert.equal("body" in calls[0].init, false);
  assert.match(calls[0].url, /recruiting-intelligence$/);
});

test("missing or invalid auth fails closed and does not retry", async () => {
  let calls = 0;
  const result = await createRecruitingIntelligenceViewExecutor({ globalObject: { NOV_TALENT_CONFIG: { readonlyApiBaseUrl: "https://staging.example.invalid" } },
    hubSessionHelper: { async getSessionToken() { return null; } }, fetchImpl: async () => { calls += 1; } }).run();
  assert.equal(result.category, "auth_required"); assert.equal(calls, 0); assert.equal(result.requestCount, 0);
});

test("view distinguishes formal zero, unavailable actual, and missing target", () => {
  const model = buildRecruitingIntelligenceViewModel(validateResponse(response()), { resolveCandidateName: () => "対象学生" });
  assert.equal(model.state, "READY"); assert.match(model.summary, /応募45名目標.*正式応募0名/); assert.match(model.summary, /接触・サロン見学実績は現在集計準備中/);
  assert.equal(model.cards.find((row) => row.key === "CONTACT_COUNT").actualText, "集計準備中");
  assert.equal(model.cards.find((row) => row.key === "APPLICATION_COUNT").actualText, "0名");
  assert.equal(model.cards.find((row) => row.key === "OFFERED_COUNT").planText, "目標未設定");
  assert.equal(model.budget.planText, "7,385,350円"); assert.equal(model.budget.remainingText, "集計準備中");
  assert.equal(model.priorities[0].candidateName, "対象学生"); assert.deepEqual(model.funnel.map((row) => row.value), ["集計準備中", "集計準備中", "0名", "0名", "0名"]);
});

test("priority order is contractual, duplicate Candidate fails closed, and Fair PENDING stays outside results", () => {
  const duplicate = response(); duplicate.data.priorities.buckets[1].candidates.push({ candidateId: ID });
  assert.equal(validateResponse(duplicate), null);
  const model = buildRecruitingIntelligenceViewModel(validateResponse(response()));
  assert.equal(model.breakdown.FAIR.length, 0); assert.equal(model.priorities.length, 1);
  assert.equal(JSON.stringify(model).includes("pendingFairAttribution"), false);
});

test("normal Analysis keeps the four existing daily routes and diagnostic remains separate", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"), readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8"), readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8")
  ]);
  const tabs = [...html.matchAll(/data-secondary-tab="([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(tabs.slice(0, 4), ["summary", "students", "fairs", "schools"]);
  const normal = html.match(/id="recruitment-schools"[\s\S]*?id="recruitment-management"/)?.[0] || "";
  assert.match(normal, /id="recruiting-intelligence-view"/); assert.match(normal, /今週の優先確認/); assert.doesNotMatch(normal, /Contract 1\.1\.0|UUID|Coverage|RPC/);
  assert.match(html, /id="outcome3-diagnostic-panel"/); assert.match(app, /initializeRecruitingIntelligenceView/); assert.match(app, /onOpenCandidate/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.intelligence-kpis \{ grid-template-columns: 1fr/);
});
