import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRecruitingIntelligenceV1, RECRUITING_INTELLIGENCE_CONTRACT_VERSION, validateRecruitingIntelligenceResponseV1 } from "../supabase/functions/nov-talent-staging-api/recruiting-intelligence-v1.ts";

const c = (id, status = "INTERVIEW_COMPLETED") => ({ candidate_id: id, graduation_year: 2027, current_status_code: status });
const selection = (candidate_id, selection_code, effective_date) => ({ selection_history_id: `${candidate_id}-${selection_code}`, candidate_id, selection_code, effective_date, created_at: `${effective_date}T01:00:00Z`, is_active: true });
const action = (candidate_id, due_date, state = "OPEN", assigned_employee_id = "employee") => ({ next_action_id: `${candidate_id}-${due_date}`, candidate_id, due_date, state, assigned_employee_id, created_at: "2026-08-01T00:00:00Z", is_active: true });
const ready = { candidates: true, selectionHistory: true, communications: true, nextActions: true, fairAttributions: true, schoolMasters: true, planningTargets: true, planningBudgets: true };
const approvedTarget = (target_metric, target_count, overrides = {}) => ({ recruiting_track: "NEW_GRAD", graduation_year: 2027, target_metric, recruiting_period_code: "NEW_GRAD_2027", recruiting_period_start: "2025-09-01", recruiting_period_end: "2026-08-31", scope_type: "COMPANY", target_count, version: 1, record_state: "APPROVED", ...overrides });
const approvedBudget = (overrides = {}) => ({ recruiting_track: "NEW_GRAD", graduation_year: 2027, recruiting_period_code: "NEW_GRAD_2027", recruiting_period_start: "2025-09-01", recruiting_period_end: "2026-08-31", scope_type: "COMPANY", total_budget: 7385350, currency: "JPY", version: 1, record_state: "APPROVED", ...overrides });

test("projection and official-history funnel stay separate; terminal contract is exact", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date("2026-08-11T03:00:00Z"), candidates: [c("a", "OFFERED"), c("b", "OFFER_ACCEPTED"), c("c", "WITHDRAWN"), c("d", "REJECTED")], selections: [selection("a", "OFFERED", "2026-08-01"), selection("b", "OFFER_ACCEPTED", "2026-08-02")], communications: [], actions: [], attributions: [], availability: ready });
  assert.equal(data.recruiting_intelligence_contract_version, RECRUITING_INTELLIGENCE_CONTRACT_VERSION);
  assert.deepEqual(data.currentPosition.projectionCounts, { OFFERED: 1, OFFER_ACCEPTED: 1, WITHDRAWN: 1, REJECTED: 1 });
  assert.equal(data.funnel.uniqueCandidateReachedCounts.OFFERED, 1);
  assert.equal(data.funnel.uniqueCandidateReachedCounts.OFFER_ACCEPTED, 1);
  assert.equal(data.funnel.uniqueCandidateReachedCounts.INTERVIEW_COMPLETED, 0);
  assert.equal(data.funnel.rates, null);
  assert.equal(data.priorities.buckets.flatMap((row) => row.candidates).some((row) => row.candidateId === "a"), true);
  assert.equal(data.priorities.buckets.flatMap((row) => row.candidates).some((row) => ["b", "c", "d"].includes(row.candidateId)), false);
});

test("priority buckets are exclusive, ordered, and future OPEN action prevents stalled", () => {
  const candidates = [c("overdue"), c("today"), c("future"), c("stalled", "INITIAL"), c("unassigned")];
  const selections = candidates.filter((row) => row.candidate_id !== "stalled").map((row) => selection(row.candidate_id, "INTERVIEW_COMPLETED", "2026-07-01"));
  const data = buildRecruitingIntelligenceV1({ now: new Date("2026-08-11T03:00:00Z"), candidates, selections, communications: [{ candidate_id: "stalled", event_id: "old", communication_at: "2026-07-01T00:00:00Z", awaiting_reply: false }], actions: [action("overdue", "2026-08-10"), action("today", "2026-08-11"), action("future", "2026-08-20"), action("unassigned", null, "OPEN", null)], attributions: [], availability: ready });
  const byBucket = Object.fromEntries(data.priorities.buckets.map((row) => [row.bucket, row.candidates.map((item) => item.candidateId)]));
  assert.deepEqual(byBucket.OVERDUE, ["overdue"]);
  assert.deepEqual(byBucket.DUE_TODAY, ["today"]);
  assert.deepEqual(byBucket.UNASSIGNED_ACTION, ["unassigned"]);
  assert.deepEqual(byBucket.STALLED, ["stalled"]);
  assert.equal(data.priorities.buckets.flatMap((row) => row.candidates).some((row) => row.candidateId === "future"), false);
});

test("new nonterminal official fact without OPEN next action has zero-day priority", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date("2026-08-11T03:00:00Z"), candidates: [c("x", "APPLICATION_RECEIVED")], selections: [selection("x", "APPLICATION_RECEIVED", "2026-08-11")], communications: [], actions: [], attributions: [], availability: ready });
  assert.deepEqual(data.priorities.buckets.find((row) => row.bucket === "SELECTION_WITHOUT_NEXT_ACTION").candidates.map((row) => row.candidateId), ["x"]);
});

test("missing source is PREPARING and never promoted to formal zero", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [c("x")], selections: [], communications: [], actions: [], attributions: [], availability: { ...ready, selectionHistory: false, fairAttributions: false } });
  assert.equal(data.sourceCoverageState, "PREPARING");
  assert.equal(data.funnel.state, "PREPARING");
  assert.equal(data.funnel.uniqueCandidateReachedCounts, null);
  assert.equal(data.priorities.state, "PREPARING");
  assert.deepEqual(data.priorities.buckets, []);
  assert.equal(data.managementDiagnostics.pendingFairAttributionRowCount, null);
});

test("Fair PENDING stays only in management diagnostics", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [c("x")], selections: [], communications: [], actions: [], attributions: [{ candidate_id: "x", attribution_type: "ORIGIN", attribution_status: "PENDING" }, { candidate_id: "x", attribution_type: "ORIGIN", attribution_status: "PENDING" }], availability: ready });
  assert.equal(data.managementDiagnostics.pendingFairAttributionCandidateCount, 1);
  assert.equal(data.managementDiagnostics.pendingFairAttributionRowCount, 2);
  assert.equal(JSON.stringify(data.priorities).includes("PENDING"), false);
  assert.deepEqual(data.targets, { state: "UNSET", candidateTarget: null, achievementRate: null });
});

test("Contract 1.1 compares only approved plan with official actual sources", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date("2026-08-11T03:00:00Z"), candidates: [c("application"), c("offered"), { ...c("other-cohort"), graduation_year: 2028 }], selections: [selection("application", "APPLICATION_RECEIVED", "2026-08-01"), selection("offered", "OFFERED", "2026-08-02"), selection("other-cohort", "APPLICATION_RECEIVED", "2026-08-03")], communications: [], actions: [], attributions: [], planningTargets: [approvedTarget("CONTACT_COUNT", 563), approvedTarget("SALON_VISIT_COUNT", 112), approvedTarget("APPLICATION_COUNT", 45), approvedTarget("OFFERED_COUNT", 99, { record_state: "DRAFT" })], planningBudgets: [approvedBudget()], availability: ready });
  assert.equal(data.recruiting_intelligence_contract_version, "1.1.0");
  const row = data.planningComparison.rows[0];
  assert.equal(row.approvedPlanningVersion, 1);
  assert.deepEqual(row.metrics.CONTACT_COUNT, { targetStatus: "APPROVED", plan: 563, approvedVersion: 1, actualSourceStatus: "ACTUAL_SOURCE_UNAVAILABLE", actual: null, achievementRate: null, remaining: null });
  assert.equal(row.metrics.SALON_VISIT_COUNT.actualSourceStatus, "ACTUAL_SOURCE_UNAVAILABLE");
  assert.equal(row.metrics.APPLICATION_COUNT.actual, 1);
  assert.equal(row.metrics.APPLICATION_COUNT.remaining, 44);
  assert.equal(row.metrics.OFFERED_COUNT.targetStatus, "NO_APPROVED_TARGET");
  assert.equal(row.metrics.OFFERED_COUNT.plan, null);
  assert.equal(row.metrics.OFFERED_COUNT.actual, 1);
  assert.equal(row.budget.plan, 7385350);
  assert.equal(row.budget.actualSourceStatus, "ACTUAL_SOURCE_UNAVAILABLE");
  assert.equal(row.budget.actualSpend, null);
  assert.equal(row.budget.remaining, null);
});

test("DRAFT and SUPERSEDED planning are excluded and duplicate current APPROVED fails closed", () => {
  const ignored = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [], selections: [], communications: [], actions: [], attributions: [], planningTargets: [approvedTarget("APPLICATION_COUNT", 45, { record_state: "DRAFT" }), approvedTarget("APPLICATION_COUNT", 40, { record_state: "SUPERSEDED", version: 0 })], planningBudgets: [], availability: ready });
  assert.deepEqual(ignored.planningComparison.rows, []);
  const duplicate = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [], selections: [], communications: [], actions: [], attributions: [], planningTargets: [approvedTarget("APPLICATION_COUNT", 45), approvedTarget("APPLICATION_COUNT", 46, { version: 2 })], planningBudgets: [], availability: ready });
  assert.equal(duplicate.planningComparison.state, "PREPARING");
  assert.equal(duplicate.sourceCoverageState, "PREPARING");
});

test("planning source failure is PREPARING, never false zero", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [], selections: [], communications: [], actions: [], attributions: [], planningTargets: [], planningBudgets: [], availability: { ...ready, planningTargets: false } });
  assert.equal(data.planningComparison.state, "PREPARING");
  assert.deepEqual(data.planningComparison.rows, []);
  assert.equal(data.sourceCoverageState, "PREPARING");
});

test("response carries no contact details, notes, evidence, actor, or audit payload", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [{ ...c("x"), phone: "secret", email: "secret@example.com", notes: "secret" }], selections: [], communications: [{ candidate_id: "x", event_id: "e", communication_at: "2026-08-01T00:00:00Z", contact_content: "secret" }], actions: [], attributions: [], availability: ready });
  const json = JSON.stringify(data);
  for (const forbidden of ["secret", "phone", "email", "notes", "contact_content", "actor_employee_id"]) assert.equal(json.includes(forbidden), false);
});

test("response contract is exact and rejects unknown keys", () => {
  const data = buildRecruitingIntelligenceV1({ now: new Date(), candidates: [], selections: [], communications: [], actions: [], attributions: [], availability: ready });
  assert.equal(validateRecruitingIntelligenceResponseV1({ ok: true, data }).ok, true);
  assert.equal(validateRecruitingIntelligenceResponseV1({ ok: true, data: { ...data, unknown: true } }).ok, false);
});

test("committed schema and runtime pin Contract v1.1.0", async () => {
  const schema = JSON.parse(await readFile(new URL("../contracts/nov-talent/recruiting-intelligence-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(schema["x-recruiting-intelligence-contract-version"], RECRUITING_INTELLIGENCE_CONTRACT_VERSION);
  assert.deepEqual(schema.properties.data.required.sort(), ["recruiting_intelligence_contract_version", "generatedAt", "sourceCoverageState", "sourceAvailability", "currentPosition", "funnel", "graduationYears", "schoolProgress", "assigneeWorkload", "priorities", "fairResults", "managementDiagnostics", "planningComparison", "targets"].sort());
});
