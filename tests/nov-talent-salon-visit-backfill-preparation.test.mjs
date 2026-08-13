import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { SALON_VISIT_2027_BACKFILL, salonVisit2027BackfillEnvelope, validateSalonVisitCanonicalStores } from "../supabase/functions/nov-talent-staging-api/salon-visit-2027-backfill.ts";
import { createRecruitingSalonVisitBackfillClient } from "../portal/talent/recruiting-salon-visit-backfill-admin.mjs";

const PASS = {
  state: "PASS", exact_preflight_passed: true,
  review_package_sha256: SALON_VISIT_2027_BACKFILL.reviewPackageSha256,
  canonical_source_sha256: SALON_VISIT_2027_BACKFILL.canonicalSourceSha256,
  source_event_count: 4, store_visit_fact_count: 15, unique_candidate_count: 4,
  distinct_store_count: 8, unexpected_source_event_count: 0, existing_fact_count: 0,
  original_actor_status: "UNAVAILABLE",
};

const CANONICAL_STORES = SALON_VISIT_2027_BACKFILL.canonicalStores.map((store) => ({
  id: store.id, store_id: store.code, corporation_id: store.corporationId,
  business_unit_id: SALON_VISIT_2027_BACKFILL.canonicalBusinessUnitId, is_active: true,
}));

test("Canonical Store reconciliation requires all eight exact active master bindings", () => {
  assert.equal(validateSalonVisitCanonicalStores(CANONICAL_STORES), true);
  assert.equal(validateSalonVisitCanonicalStores(CANONICAL_STORES.slice(1)), false);
  assert.equal(validateSalonVisitCanonicalStores([...CANONICAL_STORES, CANONICAL_STORES[0]]), false);
  assert.equal(validateSalonVisitCanonicalStores(CANONICAL_STORES.map((store, index) => index ? store : { ...store, is_active: false })), false);
  assert.equal(validateSalonVisitCanonicalStores(CANONICAL_STORES.map((store, index) => index ? store : { ...store, store_id: "ambiguous" })), false);
});

test("SALON_VISIT exact preflight separates source events, store Facts and Planning unique Candidates", () => {
  const result = salonVisit2027BackfillEnvelope(PASS, false, true);
  assert.equal(result.data.state, "PASS");
  assert.equal(result.data.exactPreflightPassed, true);
  assert.equal(result.data.canExecute, false);
  assert.equal(result.data.sourceEventCount, 4);
  assert.equal(result.data.storeVisitFactCount, 15);
  assert.equal(result.data.uniqueCandidateCount, 4);
  assert.equal(result.data.sourceEventGrain, "CANDIDATE_VISIT_DATE");
  assert.equal(result.data.factGrain, "CANDIDATE_VISIT_DATE_STORE");
  assert.equal(result.data.planningActualGrain, "UNIQUE_CANDIDATE");
  assert.equal(result.data.canonicalStoreState, "READY");
  assert.doesNotMatch(JSON.stringify(result), /candidate_id|student_name|actor_employee_id|token|store_id/iu);
});

test("SALON_VISIT preflight fails closed for changed digests and stays flag-gated", () => {
  assert.equal(salonVisit2027BackfillEnvelope({ ...PASS, canonical_source_sha256: "0".repeat(64) }, true, true).data.state, "UNAVAILABLE");
  assert.equal(salonVisit2027BackfillEnvelope({ ...PASS, state: "FUTURE" }, true, true).data.state, "UNAVAILABLE");
  assert.equal(salonVisit2027BackfillEnvelope(PASS, true, false).data.state, "BLOCKED");
  assert.equal(salonVisit2027BackfillEnvelope(PASS, true, true).data.canExecute, true);
});

test("Operator uses HUB Session, sends an empty command, and is one-shot", async () => {
  const calls = [];
  const globalObject = { location:{ origin:"https://ideanow-shift.github.io" }, NOV_TALENT_CONFIG:{ runtimeMode:"staging", networkEnabled:true, readonlyApiBaseUrl:"https://staging.example" } };
  const preview = { graduationYear:2027, period:{ start:"2026-04-01", end:"2027-03-31" }, sourceEventCount:4,
    storeVisitFactCount:15, planningUniqueCandidateCount:4, distinctStoreCount:8,
    excludedScopes:["CONTACT","APPLICATION","OFFERED","OFFER_ACCEPTED","RECRUITING_SPEND","SELECTION","FAIR","PLANNING"] };
  const client = createRecruitingSalonVisitBackfillClient({ globalObject,
    hubSessionHelper:{ getSessionToken:async()=>"x".repeat(30) },
    fetchImpl:async(url,init)=>{ calls.push({ url:String(url), init }); return String(url).endsWith("/preflight")
      ? Response.json({ ok:true, data:{ recruiting_salon_visit_backfill_preflight_contract_version:"1.0.0", state:"PASS", exactPreflightPassed:true, canExecute:true,
        reviewPackageSha256:SALON_VISIT_2027_BACKFILL.reviewPackageSha256.toUpperCase(), canonicalSourceSha256:SALON_VISIT_2027_BACKFILL.canonicalSourceSha256,
        sourceEventCount:4, storeVisitFactCount:15, uniqueCandidateCount:4, distinctStoreCount:8,
        unexpectedSourceEventCount:0, existingFactCount:0, originalActorStatus:"UNAVAILABLE",
        canonicalStoreState:"READY",
        sourceEventGrain:"CANDIDATE_VISIT_DATE", factGrain:"CANDIDATE_VISIT_DATE_STORE", planningActualGrain:"UNIQUE_CANDIDATE", preview } })
      : Response.json({ ok:true, data:{ state:"COMPLETED", sourceEventCount:4, storeVisitFactCount:15, planningUniqueCandidateCount:4 } }, { status:201 }); },
  });
  assert.equal((await client.preflight()).ok, true);
  assert.equal((await client.execute()).ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.body, "{}");
  assert.doesNotMatch(calls[1].init.body, /actor|role|token|candidate|store/iu);
  assert.equal((await client.execute()).requestCount, 0);
});

test("Operator blocks expired Session before fetch and never calls Hosted Edge from loopback", async () => {
  let fetchCount = 0;
  const expired = createRecruitingSalonVisitBackfillClient({
    globalObject:{ location:{ origin:"https://ideanow-shift.github.io" }, NOV_TALENT_CONFIG:{ runtimeMode:"staging", networkEnabled:true, readonlyApiBaseUrl:"https://staging.example" } },
    hubSessionHelper:{ getSessionToken:async()=>{ throw new Error("expired"); } }, fetchImpl:async()=>{ fetchCount++; },
  });
  assert.equal((await expired.preflight()).category, "auth_required");
  assert.equal(fetchCount, 0);
  const loopback = createRecruitingSalonVisitBackfillClient({
    globalObject:{ location:{ origin:"http://127.0.0.1:4173" }, NOV_TALENT_CONFIG:{ runtimeMode:"staging", networkEnabled:true, readonlyApiBaseUrl:"https://staging.example" } },
    hubSessionHelper:{ getSessionToken:async()=>"x".repeat(30) }, fetchImpl:async()=>{ throw new Error("request must stay at zero"); },
  });
  assert.equal(loopback, null);
});

test("Migration candidate fixes four source events to fifteen store Facts with atomic receipt and append-only void", () => {
  const migration = fs.readFileSync(new URL("../supabase/migrations/20260813063843_nov_talent_salon_visit_backfill_preparation.sql", import.meta.url), "utf8");
  assert.match(migration, /10c87773b376dddaf044dc1c3e2dd88e68b759e2a237df0e406a8a563a192540/iu);
  assert.match(migration, /ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023/iu);
  assert.match(migration, /source_event_id uuid references public\.nov_talent_recruitment_events_v1/iu);
  assert.match(migration, /salon_visit_2027_human_review_mappings_v1/iu);
  assert.match(migration, /v_store_mappings=15/iu);
  assert.match(migration, /v_source_events=4/iu);
  assert.match(migration, /v_candidates=4/iu);
  assert.match(migration, /pg_advisory_xact_lock/iu);
  assert.match(migration, /SALON_VISIT_2027_HUMAN_REVIEW/iu);
  assert.match(migration, /nov_talent_recruiting_salon_visit_backfill_receipts_v1/iu);
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /revoke all on public\.nov_talent_recruiting_salon_visit_backfill_receipts_v1/iu);
  assert.match(migration, /CONTACTS_27_SALON_VISIT_HUMAN_REVIEW_VOID/iu);
  assert.doesNotMatch(migration, /update\s+public\.nov_talent_recruiting_engagement_facts_v1|delete\s+from\s+public\.nov_talent_recruiting_engagement_facts_v1/iu);
  assert.doesNotMatch(migration, /drop\s+(table|column|constraint)|truncate/iu);
  assert.doesNotMatch(migration, /APPLICATION_RECEIVED|OFFER_ACCEPTED|748000/iu);
});

test("One-Shot UI is management-only, aggregate-only and names the grain", () => {
  const html = fs.readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  assert.match(html, /id="planning-admin-panel"[\s\S]*id="salon-visit-backfill-operator"/u);
  assert.match(html, /見学日4件・unique Candidate 4名/u);
  assert.match(html, /8店舗・店舗別15件/u);
  assert.match(html, /Actual 4名 \/ Plan 112名 \/ Remaining 108名 \/ Achievement 約3\.6%/u);
  assert.match(html, /10C87773B376DDDAF044DC1C3E2DD88E68B759E2A237DF0E406A8A563A192540/u);
  assert.match(html, /ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023/u);
  assert.doesNotMatch(html, /data-candidate-(?:id|name)/u);
  assert.match(css, /salon-visit-backfill-operator/u);
});
