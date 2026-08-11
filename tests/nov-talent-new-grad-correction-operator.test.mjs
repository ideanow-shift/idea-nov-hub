import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { newGrad2027CorrectionPreflight } from "../supabase/functions/nov-talent-staging-api/new-grad-2027-correction.ts";
import { createRecruitingPlanningAdminClient } from "../portal/talent/recruiting-planning-admin.mjs";
const rows = [
  ["CONTACT_COUNT", 563, "APPROVED", 2],
  ["SALON_VISIT_COUNT", 112, "APPROVED", 2],
  ["APPLICATION_COUNT", 45, "APPROVED", 2],
  ["OFFERED_COUNT", 37, "DRAFT", 1],
  ["OFFER_ACCEPTED_COUNT", 37, "DRAFT", 1],
].map(([target_metric, target_count, record_state, row_version]) => ({
  recruiting_track: "NEW_GRAD",
  graduation_year: 2027,
  target_metric,
  recruiting_period_code: "GRAD_2027",
  recruiting_period_start: "2025-09-01",
  recruiting_period_end: "2026-08-31",
  target_count,
  version: 1,
  row_version,
  record_state,
}));
const budget = [{
  recruiting_track: "NEW_GRAD",
  graduation_year: 2027,
  recruiting_period_code: "GRAD_2027",
  recruiting_period_start: "2025-09-01",
  recruiting_period_end: "2026-08-31",
  total_budget: 7385350,
  currency: "JPY",
  version: 1,
  row_version: 2,
  record_state: "APPROVED",
}];
test("exact server preflight passes while Edge OFF disables execution", async () => {
  const result = await newGrad2027CorrectionPreflight(
    async (path) => ({
      ok: true,
      rows: path.includes("funnel_targets") ? rows : budget,
    }),
    false,
  );
  assert.equal(result.data.state, "PASS");
  assert.equal(result.data.canExecute, false);
  assert.doesNotMatch(JSON.stringify(result), /target_id|actor|token/iu);
});
test("preflight fails closed on duplicate and unavailable source", async () => {
  const duplicate = await newGrad2027CorrectionPreflight(
    async (path) => ({
      ok: true,
      rows: path.includes("funnel_targets")
        ? [...rows, { ...rows[0] }]
        : budget,
    }),
    true,
  );
  assert.equal(duplicate.data.state, "BLOCKED");
  assert.equal(
    (await newGrad2027CorrectionPreflight(async () => ({ ok: false }), true))
      .data.state,
    "UNAVAILABLE",
  );
});
test("operator POST body is empty and actor data is never accepted from UI", async () => {
  const calls = [];
  const base = "https://staging.example";
  const globalObject = {
    NOV_TALENT_CONFIG: {
      runtimeMode: "staging",
      networkEnabled: true,
      writeEnabled: true,
      readonlyApiBaseUrl: base,
      writeApiBaseUrl: base,
    },
  };
  const preview = {
    recruitingTrack: "NEW_GRAD",
    graduationYear: 2027,
    scope: "COMPANY",
    oldPeriod: { start: "2025-09-01", end: "2026-08-31" },
    newPeriod: { start: "2026-04-01", end: "2027-03-31" },
    targets: {
      CONTACT_COUNT: 563,
      SALON_VISIT_COUNT: 112,
      APPLICATION_COUNT: 45,
      OFFERED_COUNT: 37,
      OFFER_ACCEPTED_COUNT: 37,
    },
    budget: { amount: 7385350, currency: "JPY" },
  };
  const client = createRecruitingPlanningAdminClient({
    globalObject,
    hubSessionHelper: { getSessionToken: async () => "x".repeat(30) },
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/capability")) {
        return Response.json({
          ok: true,
          data: {
            recruiting_planning_capability_contract_version: "1.1.0",
            canWritePlanning: true,
          },
        });
      }
      if (String(url).endsWith("/preflight")) {
        return Response.json({
          ok: true,
          data: {
            recruiting_planning_correction_preflight_contract_version: "1.0.0",
            state: "PASS",
            exactPreflightPassed: true,
            canExecute: true,
            preview,
          },
        });
      }
      return Response.json({ ok: true, data: { state: "COMPLETED" } });
    },
  });
  await client.capability();
  assert.equal((await client.correctionPreflight()).ok, true);
  assert.equal((await client.executeCorrection()).ok, true);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {});
  assert.doesNotMatch(calls.at(-1).init.body, /actor|role|token|uuid/iu);
});
test("one-shot UI is management-only and responsive dialog is present", () => {
  const html = fs.readFileSync(
    new URL("../portal/talent/index.html", import.meta.url),
    "utf8",
  );
  const css = fs.readFileSync(
    new URL("../portal/talent/style.css", import.meta.url),
    "utf8",
  );
  assert.match(html, /planning-correction-operator/u);
  assert.match(html, /planning-correction-dialog/u);
  assert.match(html, /接触 563/u);
  assert.match(css, /calc\(100vw - 32px\)/u);
});
