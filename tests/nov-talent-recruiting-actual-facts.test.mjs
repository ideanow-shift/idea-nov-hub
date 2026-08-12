import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { engagementActual, selectionActual, spendActual } from "../supabase/functions/nov-talent-staging-api/recruiting-actual-facts-v1.ts";

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
