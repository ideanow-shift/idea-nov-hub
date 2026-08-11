import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRecruitingIntelligenceDiagnosticExecutor, summarizeResponse } from "../portal/talent/recruiting-intelligence-diagnostic.mjs";

const ID = "10000000-0000-4000-8000-000000000001";
const response = ({ coverage = "COMPLETE", sourceReady = true } = {}) => ({ ok: true, data: {
  recruiting_intelligence_contract_version: "1.0.0", generatedAt: "2026-08-11T00:00:00.000Z", sourceCoverageState: coverage,
  sourceAvailability: { candidates: true, selectionHistory: sourceReady, communications: true, nextActions: true, fairAttributions: true, schoolMasters: true },
  currentPosition: { state: "READY", candidateCount: 636, projectionCounts: { INITIAL: 635, INTERVIEW_COMPLETED: 1 } },
  funnel: { state: sourceReady ? "READY" : "PREPARING", uniqueCandidateReachedCounts: sourceReady ? { INTERVIEW_COMPLETED: 1 } : null, rates: null },
  graduationYears: { state: "READY", rows: { 2027: { candidateCount: 528 }, 2028: { candidateCount: 108 } } },
  schoolProgress: { state: "READY", rows: [{ schoolId: ID, candidateCount: 1, officialSelectionCandidateCount: 1 }] },
  assigneeWorkload: { state: "READY", openActionCounts: { [ID]: 2, UNASSIGNED: 1 } },
  priorities: { state: "READY", stallThresholdDays: 7, buckets: [
    { bucket: "OVERDUE", count: 1, candidates: [{ candidateId: ID }], truncated: false },
    { bucket: "DUE_TODAY", count: 0, candidates: [], truncated: false },
    { bucket: "AWAITING_REPLY", count: 0, candidates: [], truncated: false },
    { bucket: "SELECTION_WITHOUT_NEXT_ACTION", count: 0, candidates: [], truncated: false },
    { bucket: "UNASSIGNED_ACTION", count: 0, candidates: [], truncated: false },
    { bucket: "STALLED", count: 0, candidates: [], truncated: false }
  ] },
  fairResults: { state: "READY", confirmedOriginCandidateCount: 1, rows: [{ fairId: ID, confirmedOriginCandidateCount: 1, officialSelectionCandidateCount: 1 }] },
  managementDiagnostics: { state: "READY", pendingFairAttributionCandidateCount: 160, pendingFairAttributionRowCount: 200 },
  targets: { state: "UNSET", candidateTarget: null, achievementRate: null }
} });

test("administrator diagnostic uses existing HUB session for one GET and returns summaries only", async () => {
  const calls = [];
  const executor = createRecruitingIntelligenceDiagnosticExecutor({
    globalObject: { NOV_TALENT_CONFIG: { readonlyApiBaseUrl: "https://staging.example.invalid/functions/v1/nov-talent-staging-api" } },
    hubSessionHelper: { async getSessionToken() { return "x".repeat(32); } },
    async fetchImpl(url, init) { calls.push({ url, init }); return Response.json(response()); }
  });
  const result = await executor.run();
  assert.equal(result.ok, true);
  assert.equal(result.httpStatus, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "GET");
  assert.equal("body" in calls[0].init, false);
  assert.match(calls[0].url, /\/api\/talent\/v1\/recruiting-intelligence$/);
  assert.equal(result.data.priorities.duplicateCandidateCount, 0);
  assert.deepEqual(result.data.priorities.buckets.map((row) => row.bucket), ["OVERDUE", "DUE_TODAY", "AWAITING_REPLY", "SELECTION_WITHOUT_NEXT_ACTION", "UNASSIGNED_ACTION", "STALLED"]);
  assert.deepEqual(result.data.fairPending, { state: "READY", candidateCount: 160, rowCount: 200 });
  assert.deepEqual(result.data.target, { state: "UNSET", candidateTarget: null, achievementRate: null });
  assert.equal(JSON.stringify(result.data).includes(ID), false);
  assert.equal(result.rawResponseReturned, false);
  assert.equal(result.tokenValueReturned, false);
});

test("missing session stops before fetch and HTTP 401 stays auth_required", async () => {
  let fetches = 0;
  const base = { globalObject: { NOV_TALENT_CONFIG: { readonlyApiBaseUrl: "https://staging.example.invalid" } }, fetchImpl: async () => { fetches += 1; return Response.json({}, { status: 401 }); } };
  const missing = await createRecruitingIntelligenceDiagnosticExecutor({ ...base, hubSessionHelper: { async getSessionToken() { return null; } } }).run();
  assert.equal(missing.category, "auth_required");
  assert.equal(fetches, 0);
  const rejected = await createRecruitingIntelligenceDiagnosticExecutor({ ...base, hubSessionHelper: { async getSessionToken() { return "x".repeat(32); } } }).run();
  assert.equal(rejected.category, "auth_required");
  assert.equal(fetches, 1);
});

test("PREPARING remains explicit and is never rewritten as formal zero", () => {
  const summary = summarizeResponse(response({ coverage: "PREPARING", sourceReady: false }));
  assert.equal(summary.sourceCoverageState, "PREPARING");
  assert.equal(summary.sourceAvailability.selectionHistory, false);
  assert.equal(summary.funnel.state, "PREPARING");
  assert.equal(summary.funnel.uniqueCandidateReachedCounts, null);
});

test("invalid bucket order, duplicate Candidate, PII, and version drift fail closed", () => {
  const wrongOrder = response(); wrongOrder.data.priorities.buckets.reverse();
  assert.equal(summarizeResponse(wrongOrder), null);
  const duplicate = response(); duplicate.data.priorities.buckets[1].candidates.push({ candidateId: ID }); duplicate.data.priorities.buckets[1].count = 1;
  assert.equal(summarizeResponse(duplicate), null);
  const pii = response(); pii.data.phone = "090";
  assert.equal(summarizeResponse(pii), null);
  const version = response(); version.data.recruiting_intelligence_contract_version = "2.0.0";
  assert.equal(summarizeResponse(version), null);
});

test("diagnostic is administrator-only and normal four-tab navigation remains unchanged", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8")
  ]);
  const tabs = [...html.matchAll(/data-secondary-tab="([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(tabs.slice(0, 4), ["summary", "students", "fairs", "schools"]);
  assert.match(html, /id="outcome3-diagnostic-panel"[\s\S]*data-management-section="outcome3-diagnostic"/);
  assert.doesNotMatch(html.match(/id="recruitment-schools"[\s\S]*?id="recruitment-management"/)?.[0] || "", /outcome3-diagnostic/);
  assert.match(app, /authorization\.access\?\.profile === "full"[\s\S]*initializeRecruitingIntelligenceDiagnostic/);
});
