import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildRecruitingActualFactsV1, engagementActual, selectionActual, spendActual } from "../supabase/functions/nov-talent-staging-api/recruiting-actual-facts-v1.ts";

const ids = new Set(["c1", "c2"]), period = { start: "2026-04-01", end: "2027-03-31" };

test("duplicate Contact events count one Planning Candidate and retain event count", () => {
  const value = engagementActual({ plan: 563, type: "CONTACT", sourceStatus: "READY", candidateIds: ids, ...period, rows: [
    { engagement_fact_id: "e1", candidate_id: "c1", engagement_type: "CONTACT", engagement_status: "COMPLETED", occurred_at: "2026-05-01T00:00:00Z" },
    { engagement_fact_id: "e2", candidate_id: "c1", engagement_type: "CONTACT", engagement_status: "COMPLETED", occurred_at: "2026-06-01T00:00:00Z" }
  ] });
  assert.equal(value.actual, 1); assert.equal(value.eventCount, 2); assert.equal(value.remaining, 562);
});

test("Salon Visit uses effective COMPLETED unique Candidate and excludes cancelled/no-show", () => {
  const value = engagementActual({ plan: 112, type: "SALON_VISIT", sourceStatus: "READY", candidateIds: ids, ...period, rows: [
    { engagement_fact_id: "v1", candidate_id: "c1", engagement_type: "SALON_VISIT", engagement_status: "COMPLETED", occurred_at: "2026-05-01" },
    { engagement_fact_id: "v2", candidate_id: "c1", engagement_type: "SALON_VISIT", engagement_status: "COMPLETED", occurred_at: "2026-06-01" },
    { engagement_fact_id: "v3", candidate_id: "c2", engagement_type: "SALON_VISIT", engagement_status: "NO_SHOW", occurred_at: "2026-06-01" },
    { engagement_fact_id: "v4", candidate_id: "c2", engagement_type: "SALON_VISIT", engagement_status: "CANCELLED", occurred_at: "2026-06-02" }
  ] });
  assert.equal(value.actual, 1); assert.equal(value.eventCount, 2);
});

test("correction lineage removes the replaced engagement", () => {
  const value = engagementActual({ plan: 112, type: "SALON_VISIT", sourceStatus: "READY", candidateIds: ids, ...period, rows: [
    { engagement_fact_id: "v1", candidate_id: "c1", engagement_type: "SALON_VISIT", engagement_status: "COMPLETED", occurred_at: "2026-05-01" },
    { engagement_fact_id: "v2", correction_of_fact_id: "v1", candidate_id: "c1", engagement_type: "SALON_VISIT", engagement_status: "CANCELLED", occurred_at: "2026-05-01" }
  ] });
  assert.equal(value.actual, 0); assert.equal(value.actualState, "ACTUAL_CONFIRMED_ZERO");
});

for (const [metric, code] of [["Application", "APPLICATION_RECEIVED"], ["Offered", "OFFERED"], ["Accepted", "OFFER_ACCEPTED"]]) test(`${metric} counts exact official evidence only`, () => {
  const value = selectionActual({ plan: 37, selectionCode: code, coverageState: "COMPLETE", candidateIds: ids, ...period, rows: [
    { candidate_id: "c1", selection_code: code, effective_date: "2026-05-01", is_active: true },
    { candidate_id: "c1", selection_code: code, effective_date: "2026-05-02", is_active: true },
    { candidate_id: "c2", selection_code: "INTERVIEW_COMPLETED", effective_date: "2026-05-01", is_active: true }
  ] });
  assert.equal(value.actual, 1); assert.equal(value.actualGrain, "UNIQUE_CANDIDATE");
});

test("missing coverage is unavailable while COMPLETE with no facts is confirmed zero", () => {
  const missing = selectionActual({ plan: 45, selectionCode: "APPLICATION_RECEIVED", coverageState: "UNAVAILABLE", candidateIds: ids, ...period, rows: [] });
  assert.equal(missing.actual, null); assert.equal(missing.actualState, "UNAVAILABLE");
  const zero = selectionActual({ plan: 45, selectionCode: "APPLICATION_RECEIVED", coverageState: "COMPLETE", candidateIds: ids, ...period, rows: [] });
  assert.equal(zero.actual, 0); assert.equal(zero.actualState, "ACTUAL_CONFIRMED_ZERO");
});

test("Spend separates provisional reference from confirmed Actual and honors correction", () => {
  const common = { recruiting_track: "NEW_GRAD", graduation_year: 2027, occurred_at: "2026-05-01" };
  const value = spendActual({ plan: 7385350, sourceStatus: "PARTIAL_SOURCE", track: "NEW_GRAD", graduationYear: 2027, ...period, rows: [
    { spend_fact_id: "s1", ...common, spend_status: "PROVISIONAL", amount: 748000 },
    { spend_fact_id: "s2", ...common, spend_status: "CONFIRMED", amount: 100000 },
    { spend_fact_id: "s3", correction_of_fact_id: "s2", ...common, spend_status: "VOIDED", amount: 100000 }
  ] });
  assert.equal(value.actual, null); assert.equal(value.referenceValue, 748000); assert.equal(value.remaining, null);
});

test("source-only migration is additive, forced-RLS, explicit-grant and backfill-free", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260811224534_nov_talent_recruiting_actual_fact_foundation.sql", import.meta.url), "utf8");
  assert.equal((sql.match(/force row level security/gi) || []).length, 6);
  assert.match(sql, /revoke all on public\.nov_talent_recruiting_engagement_facts_v1[\s\S]+from public,anon,authenticated,service_role/i);
  assert.match(sql, /grant select on public\.nov_talent_recruiting_engagement_facts_v1[\s\S]+to service_role/i);
  assert.doesNotMatch(sql, /alter table public\.nov_talent_(candidates|selection_history|candidate_fair|recruiting_funnel_targets|recruiting_budgets)_v1/i);
  assert.doesNotMatch(sql, /insert into public\.nov_talent_(candidates|selection_history|candidate_fair|recruiting_funnel_targets|recruiting_budgets)_v1/i);
  assert.doesNotMatch(sql, /CONTACTS_27|SALON_TOUR_COMPLETED/);
});

test("Actual Fact response contract distinguishes confirmed zero, provisional and unavailable", async () => {
  const schema = JSON.parse(await readFile(new URL("../contracts/nov-talent/recruiting-actual-facts-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(schema["x-recruiting-actual-fact-contract-version"], "1.0.0");
  assert.deepEqual(schema.$defs.sourceStatus.enum, ["READY", "PARTIAL_SOURCE", "ACTUAL_SOURCE_UNAVAILABLE", "PREPARING"]);
  assert.ok(schema.$defs.actualState.enum.includes("ACTUAL_CONFIRMED_ZERO"));
  assert.ok(schema.$defs.actualState.enum.includes("ACTUAL_PROVISIONAL"));
});

test("1.2 runtime binds approved 2027 Planning and does not turn empty foundations into zero", () => {
  const data = buildRecruitingActualFactsV1({
    candidates: [{ candidate_id: "c1", graduation_year: 2027 }], selections: [], engagementFacts: [], engagementAudits: [], backfillReceipts: [], salonVisitBackfillReceipts: [], coverageReleases: [], spendFacts: [],
    planningTargets: [
      ["CONTACT_COUNT",563],["SALON_VISIT_COUNT",112],["APPLICATION_COUNT",45],["OFFERED_COUNT",37],["OFFER_ACCEPTED_COUNT",37]
    ].map(([target_metric,target_count]) => ({ recruiting_track:"NEW_GRAD", graduation_year:2027, scope_type:"COMPANY", record_state:"APPROVED", recruiting_period_start:"2026-04-01", recruiting_period_end:"2027-03-31", target_metric, target_count })),
    planningBudgets: [{ recruiting_track:"NEW_GRAD", graduation_year:2027, scope_type:"COMPANY", record_state:"APPROVED", recruiting_period_start:"2026-04-01", recruiting_period_end:"2027-03-31", total_budget:7385350 }],
    availability: { selections:true, engagementFacts:true, backfillReceipts:true, coverageReleases:true, spendFacts:true, planningTargets:true, planningBudgets:true }
  });
  assert.equal(data.recruiting_intelligence_contract_version, "1.2.0");
  assert.deepEqual(data.planningBinding, { recruitingTrack:"NEW_GRAD", graduationYear:2027, periodStart:"2026-04-01", periodEnd:"2027-03-31", scope:"COMPANY" });
  assert.equal(data.metrics.CONTACT_COUNT.actualSourceStatus, "ACTUAL_SOURCE_UNAVAILABLE");
  assert.equal(data.metrics.APPLICATION_COUNT.actualState, "UNAVAILABLE");
  assert.equal(data.metrics.APPLICATION_COUNT.actual, null);
  assert.equal(data.budget.plan, 7385350);
  assert.equal(data.budget.actual, null);
});

test("approved CONTACT receipt releases exactly 11 Facts as 10 unique Candidate Actual", () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({ candidate_id: `c${index + 1}`, graduation_year: 2027 }));
  const engagementFacts = Array.from({ length: 11 }, (_, index) => ({
    engagement_fact_id: `e${index + 1}`, candidate_id: index === 10 ? "c1" : `c${index + 1}`,
    engagement_type: "CONTACT", engagement_status: "COMPLETED", occurred_at: `2026-05-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    source_type: "CONTACTS_27_HUMAN_REVIEW", original_actor_status: "UNAVAILABLE", correction_of_fact_id: null,
  }));
  const data = buildRecruitingActualFactsV1({
    candidates, selections: [], engagementFacts, engagementAudits: [], coverageReleases: [], spendFacts: [], salonVisitBackfillReceipts: [],
    backfillReceipts: [{ backfill_code: "CONTACT_2027_HUMAN_REVIEW", receipt_state: "COMPLETED", review_status: "APPROVED_FOR_BACKFILL",
      review_package_sha256: "139d6b1b222cd7a7d820375c08e1b4ace811fc285ed89e27dd924d2bfb8c9125",
      canonical_source_sha256: "725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77",
      source_event_count: 11, unique_candidate_count: 10, fact_count: 11 }],
    planningTargets: [{ recruiting_track:"NEW_GRAD", graduation_year:2027, scope_type:"COMPANY", record_state:"APPROVED", recruiting_period_start:"2026-04-01", recruiting_period_end:"2027-03-31", target_metric:"CONTACT_COUNT", target_count:563 }],
    planningBudgets: [], availability: { selections:true, engagementFacts:true, engagementAudits:true, backfillReceipts:true, salonVisitBackfillReceipts:true, coverageReleases:true, spendFacts:true, planningTargets:true, planningBudgets:true },
  });
  assert.equal(data.metrics.CONTACT_COUNT.actualSourceStatus, "READY");
  assert.equal(data.metrics.CONTACT_COUNT.actual, 10);
  assert.equal(data.metrics.CONTACT_COUNT.eventCount, 11);
  assert.equal(data.metrics.CONTACT_COUNT.remaining, 553);
  assert.equal(data.metrics.SALON_VISIT_COUNT.actualSourceStatus, "ACTUAL_SOURCE_UNAVAILABLE");
});

test("missing, mismatched or voided CONTACT receipt never releases zero or partial Facts", () => {
  const common = {
    candidates: [{ candidate_id:"c1", graduation_year:2027 }], selections: [], engagementAudits: [], salonVisitBackfillReceipts: [], coverageReleases: [], spendFacts: [], planningBudgets: [],
    planningTargets: [{ recruiting_track:"NEW_GRAD", graduation_year:2027, scope_type:"COMPANY", record_state:"APPROVED", recruiting_period_start:"2026-04-01", recruiting_period_end:"2027-03-31", target_metric:"CONTACT_COUNT", target_count:563 }],
    availability: { selections:true, engagementFacts:true, backfillReceipts:true, coverageReleases:true, spendFacts:true, planningTargets:true, planningBudgets:true },
  };
  const fact = { engagement_fact_id:"e1", candidate_id:"c1", engagement_type:"CONTACT", engagement_status:"COMPLETED", occurred_at:"2026-05-01T00:00:00Z", source_type:"CONTACTS_27_HUMAN_REVIEW", original_actor_status:"UNAVAILABLE" };
  for (const [engagementFacts, backfillReceipts] of [[[fact], []], [[], []], [[fact], [{ backfill_code:"CONTACT_2027_HUMAN_REVIEW", receipt_state:"VOIDED" }]]]) {
    const data = buildRecruitingActualFactsV1({ ...common, engagementFacts, backfillReceipts });
    assert.equal(data.metrics.CONTACT_COUNT.actualSourceStatus, "ACTUAL_SOURCE_UNAVAILABLE");
    assert.equal(data.metrics.CONTACT_COUNT.actual, null);
  }
});

test("approved SALON_VISIT receipt releases exactly 15 Facts as 4 unique Candidate Actual", () => {
  const candidates = Array.from({ length: 4 }, (_, index) => ({ candidate_id: `c${index + 1}`, graduation_year: 2027 }));
  const stores = Array.from({ length: 8 }, (_, index) => `s${index + 1}`);
  const engagementFacts = Array.from({ length: 15 }, (_, index) => ({
    engagement_fact_id: `v${index + 1}`, candidate_id: `c${(index % 4) + 1}`,
    engagement_type: "SALON_VISIT", engagement_status: "COMPLETED", occurred_at: `2026-06-${String((index % 4) + 1).padStart(2, "0")}T00:00:00Z`,
    store_id: stores[index % 8], source_event_id: `source-${(index % 4) + 1}`,
    source_type: "CONTACTS_27_SALON_VISIT_HUMAN_REVIEW", source_fingerprint: String(index).padStart(64, "0"),
    original_actor_status: "UNAVAILABLE", correction_of_fact_id: null,
  }));
  const engagementAudits = engagementFacts.map((row) => ({ engagement_fact_id: row.engagement_fact_id, event_type: "FACT_APPENDED" }));
  const salonVisitBackfillReceipts = [{
    backfill_code: "SALON_VISIT_2027_HUMAN_REVIEW", receipt_state: "COMPLETED", review_status: "APPROVED_FOR_BACKFILL",
    review_package_sha256: "10c87773b376dddaf044dc1c3e2dd88e68b759e2a237df0e406a8a563a192540",
    canonical_source_sha256: "ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023",
    source_event_count: 4, unique_candidate_count: 4, fact_count: 15, original_actor_status: "UNAVAILABLE",
  }];
  const common = {
    candidates, selections: [], engagementFacts, engagementAudits, backfillReceipts: [], salonVisitBackfillReceipts,
    coverageReleases: [], spendFacts: [], planningBudgets: [],
    planningTargets: [{ recruiting_track:"NEW_GRAD", graduation_year:2027, scope_type:"COMPANY", record_state:"APPROVED", recruiting_period_start:"2026-04-01", recruiting_period_end:"2027-03-31", target_metric:"SALON_VISIT_COUNT", target_count:112 }],
    availability: { selections:true, engagementFacts:true, engagementAudits:true, backfillReceipts:true, salonVisitBackfillReceipts:true, coverageReleases:true, spendFacts:true, planningTargets:true, planningBudgets:true },
  };
  const data = buildRecruitingActualFactsV1(common);
  assert.equal(data.metrics.SALON_VISIT_COUNT.actualSourceStatus, "READY");
  assert.equal(data.metrics.SALON_VISIT_COUNT.actual, 4);
  assert.equal(data.metrics.SALON_VISIT_COUNT.eventCount, 15);
  assert.equal(data.metrics.SALON_VISIT_COUNT.remaining, 108);
  assert.equal(data.metrics.SALON_VISIT_COUNT.achievementRate, 4 / 112);
  assert.equal(data.metrics.SALON_VISIT_COUNT.coverageState, "COMPLETE");

  for (const input of [
    { ...common, engagementAudits: engagementAudits.slice(1) },
    { ...common, salonVisitBackfillReceipts: [{ ...salonVisitBackfillReceipts[0], canonical_source_sha256: "0".repeat(64) }] },
    { ...common, salonVisitBackfillReceipts: [...salonVisitBackfillReceipts, { ...salonVisitBackfillReceipts[0], receipt_state: "VOIDED" }] },
  ]) {
    const unavailable = buildRecruitingActualFactsV1(input);
    assert.equal(unavailable.metrics.SALON_VISIT_COUNT.actualSourceStatus, "ACTUAL_SOURCE_UNAVAILABLE");
    assert.equal(unavailable.metrics.SALON_VISIT_COUNT.actual, null);
  }
});

test("FK index corrective is forward-only and contains exactly the six required indexes", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20260812035051_nov_talent_recruiting_actual_fact_fk_indexes.sql", import.meta.url), "utf8");
  assert.equal((sql.match(/create index /g) || []).length, 6);
  assert.doesNotMatch(sql, /\b(drop|delete|update|insert|truncate|alter\s+table)\b/i);
  for (const column of ["candidate_id", "engagement_fact_id", "supersedes_release_id", "superseded_by_release_id", "coverage_release_id", "spend_fact_id"]) assert.match(sql, new RegExp(`\\(${column}\\)`));
});
