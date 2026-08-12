import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { CONTACT_2027_BACKFILL, contact2027BackfillEnvelope } from "../supabase/functions/nov-talent-staging-api/contact-2027-backfill.ts";
import { createRecruitingContactBackfillClient } from "../portal/talent/recruiting-contact-backfill-admin.mjs";

const PASS = {
  state: "PASS", exact_preflight_passed: true,
  review_package_sha256: CONTACT_2027_BACKFILL.reviewPackageSha256,
  canonical_source_sha256: CONTACT_2027_BACKFILL.canonicalSourceSha256,
  source_event_count: 11, unique_candidate_count: 10, existing_fact_count: 0,
  original_actor_status: "UNAVAILABLE",
};

test("CONTACT exact preflight exposes no PII and stays disabled while Edge flag is OFF", () => {
  const result = contact2027BackfillEnvelope(PASS, false);
  assert.equal(result.data.state, "PASS");
  assert.equal(result.data.exactPreflightPassed, true);
  assert.equal(result.data.canExecute, false);
  assert.equal(result.data.sourceEventCount, 11);
  assert.equal(result.data.uniqueCandidateCount, 10);
  assert.doesNotMatch(JSON.stringify(result), /candidate_id|student_name|actor_employee_id|token/iu);
});

test("CONTACT preflight fails closed for a changed digest or unknown state", () => {
  assert.equal(contact2027BackfillEnvelope({ ...PASS, canonical_source_sha256: "0".repeat(64) }, true).data.state, "UNAVAILABLE");
  assert.equal(contact2027BackfillEnvelope({ ...PASS, state: "FUTURE" }, true).data.state, "UNAVAILABLE");
  assert.equal(contact2027BackfillEnvelope(PASS, true).data.canExecute, true);
});

test("Operator uses HUB Session, sends an empty body and never accepts Actor input", async () => {
  const calls = [];
  const globalObject = { location:{ origin:"https://ideanow-shift.github.io" }, NOV_TALENT_CONFIG: { runtimeMode:"staging", networkEnabled:true, readonlyApiBaseUrl:"https://staging.example" } };
  const preview = { graduationYear:2027, period:{ start:"2026-04-01", end:"2027-03-31" }, factEventCount:11,
    planningUniqueCandidateCount:10, excludedScopes:["SALON_VISIT","APPLICATION","OFFERED","OFFER_ACCEPTED","RECRUITING_SPEND","OTHER_B_OR_C"] };
  const client = createRecruitingContactBackfillClient({ globalObject,
    hubSessionHelper:{ getSessionToken:async()=>"x".repeat(30) },
    fetchImpl:async(url,init)=>{ calls.push({ url:String(url), init }); return String(url).endsWith("/preflight")
      ? Response.json({ ok:true, data:{ recruiting_contact_backfill_preflight_contract_version:"1.0.0", state:"PASS", exactPreflightPassed:true, canExecute:true,
        reviewPackageSha256:CONTACT_2027_BACKFILL.reviewPackageSha256.toUpperCase(), canonicalSourceSha256:CONTACT_2027_BACKFILL.canonicalSourceSha256,
        sourceEventCount:11, uniqueCandidateCount:10, existingFactCount:0, originalActorStatus:"UNAVAILABLE", planningActualGrain:"UNIQUE_CANDIDATE", preview } })
      : Response.json({ ok:true, data:{ state:"COMPLETED", factEventCount:11, planningUniqueCandidateCount:10 } }, { status:201 }); },
  });
  assert.equal((await client.preflight()).ok, true);
  assert.equal((await client.execute()).ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.body, "{}");
  assert.doesNotMatch(calls[1].init.body, /actor|role|token|candidate/iu);
  assert.equal((await client.execute()).requestCount, 0);
});

test("Operator blocks expired Session before fetch", async () => {
  let fetchCount = 0;
  const client = createRecruitingContactBackfillClient({
    globalObject:{ location:{ origin:"https://ideanow-shift.github.io" }, NOV_TALENT_CONFIG:{ runtimeMode:"staging", networkEnabled:true, readonlyApiBaseUrl:"https://staging.example" } },
    hubSessionHelper:{ getSessionToken:async()=>{ throw new Error("expired"); } }, fetchImpl:async()=>{ fetchCount++; },
  });
  assert.equal((await client.preflight()).category, "auth_required");
  assert.equal(fetchCount, 0);
});

test("Operator does not call the Hosted Edge from a loopback preview origin", () => {
  const client = createRecruitingContactBackfillClient({
    globalObject:{ location:{ origin:"http://127.0.0.1:4173" }, NOV_TALENT_CONFIG:{ runtimeMode:"staging", networkEnabled:true, readonlyApiBaseUrl:"https://staging.example" } },
    hubSessionHelper:{ getSessionToken:async()=>"x".repeat(30) }, fetchImpl:async()=>{ throw new Error("request must stay at zero"); },
  });
  assert.equal(client, null);
});

test("Migration candidate is package-bound, atomic, append-only and has no automatic execution", () => {
  const migrationPath = new URL("../supabase/migrations/20260812120633_nov_talent_recruiting_contact_backfill_preparation.sql", import.meta.url);
  const migrationBytes = fs.readFileSync(migrationPath);
  const migration = migrationBytes.toString("utf8");
  assert.equal(createHash("sha256").update(migrationBytes).digest("hex"), "42bd8c50e64120bdd4fa272a0003454c12f8c2eeefe8a9febe624a891d9baf17");
  assert.match(migration, /139d6b1b222cd7a7d820375c08e1b4ace811fc285ed89e27dd924d2bfb8c9125/i);
  assert.match(migration, /725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77/i);
  assert.match(migration, /pg_advisory_xact_lock/iu);
  assert.match(migration, /original_actor_status[^;]+UNAVAILABLE/iu);
  assert.match(migration, /CONTACTS_27_HUMAN_REVIEW_VOID/iu);
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /revoke all on public\.nov_talent_recruiting_actual_backfill_receipts_v1/iu);
  assert.doesNotMatch(migration, /update\s+public\.nov_talent_recruiting_engagement_facts_v1|delete\s+from\s+public\.nov_talent_recruiting_engagement_facts_v1/iu);
  assert.doesNotMatch(migration, /SALON_TOUR_COMPLETED|APPLICATION_RECEIVED|OFFER_ACCEPTED|748000/iu);
});

test("One-Shot UI is isolated in management and names every excluded scope", () => {
  const html = fs.readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  assert.match(html, /id="planning-admin-panel"[\s\S]*id="contact-backfill-operator"/u);
  assert.match(html, /11イベント（Planning Actualはunique Candidate 10名）/u);
  assert.match(html, /Actual 10名 \/ Plan 563名 \/ Remaining 553名 \/ Achievement 約1\.8%/u);
  assert.match(html, /139D6B1B222CD7A7D820375C08E1B4ACE811FC285ED89E27DD924D2BFB8C9125/u);
  assert.match(html, /725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77/u);
  assert.match(html, /元Actorは推測せずUNAVAILABLE/u);
  assert.match(html, /SALON_VISIT・Selection・Spendは対象外/u);
  assert.match(css, /contact-backfill-operator/u);
  assert.match(css, /calc\(100vw - 32px\)/u);
});
