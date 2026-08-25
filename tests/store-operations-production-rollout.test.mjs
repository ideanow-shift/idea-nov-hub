import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateStoreOperationsProductionRollout,
  projectRefFromSupabaseUrl,
  STORE_OPERATIONS_PRODUCTION_PROJECT_REF,
} from "../supabase/functions/nov-hub-api/store_operations_production_rollout.mjs";

const owner = "10000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const evaluate = (override = {}) => evaluateStoreOperationsProductionRollout({
  projectRef: STORE_OPERATIONS_PRODUCTION_PROJECT_REF,
  state: "DISABLED",
  employeeId: owner,
  ownerEmployeeId: owner,
  session: { authType: "hub_session" },
  ...override,
});

test("Production project reference is exact and parsed without browser input", () => {
  assert.equal(projectRefFromSupabaseUrl(`https://${STORE_OPERATIONS_PRODUCTION_PROJECT_REF}.supabase.co`), STORE_OPERATIONS_PRODUCTION_PROJECT_REF);
  assert.equal(projectRefFromSupabaseUrl("https://zgkoofphhivesclehrom.supabase.co"), "zgkoofphhivesclehrom");
});

test("missing, unknown, disabled and Staging project rollout fail closed", () => {
  for (const state of ["", "UNKNOWN", "DISABLED"]) assert.equal(evaluate({ state }).allowed, false);
  assert.equal(evaluate({ state: "GENERAL", projectRef: "zgkoofphhivesclehrom" }).allowed, false);
});

test("OWNER_PILOT permits only the server-configured canonical employee", () => {
  assert.equal(evaluate({ state: "OWNER_PILOT" }).allowed, true);
  assert.equal(evaluate({ state: "OWNER_PILOT", employeeId: other }).allowed, false);
  assert.equal(evaluate({ state: "OWNER_PILOT", ownerEmployeeId: "" }).allowed, false);
  assert.equal(evaluate({ state: "OWNER_PILOT", employeeId: "browser-value" }).allowed, false);
});

test("GENERAL permits a resolved canonical employee and never accepts UAT markers", () => {
  assert.equal(evaluate({ state: "GENERAL", employeeId: other }).allowed, true);
  for (const session of [
    { authType: "store_operations_staging_session" },
    { authType: "hub_session", uat_actor: "owner_controlled_technical_principal" },
    { authType: "hub_session", uat_scenario: "area_manager" },
    { authType: "hub_session", technical_assumption: true },
  ]) assert.equal(evaluate({ state: "GENERAL", session }).allowed, false);
});

test("Production management wiring reads rollout authority from server env only", () => {
  const edge = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
  assert.match(edge, /Deno\.env\.get\("STORE_OPERATIONS_PRODUCTION_ROLLOUT_STATE"\)/u);
  assert.match(edge, /Deno\.env\.get\("STORE_OPERATIONS_OWNER_PILOT_EMPLOYEE_ID"\)/u);
  assert.doesNotMatch(edge, /payload\.(?:rolloutState|ownerEmployeeId|targetEmployeeId)/u);
  assert.match(edge, /requestedAuthType !== "hub_session"/u);
  assert.match(edge, /STORE_OPERATIONS_STAGING_ONLY_ACTIONS\.has\(action\)/u);
  assert.match(edge, /PRODUCTION_UAT_RUNTIME_DENIED/u);
});

test("Production frontend and release workflow exclude Staging entry assets", () => {
  const config = readFileSync(new URL("../portal/store-sales/runtime-config.production.js", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.doesNotMatch(config, /zgkoofphhivesclehrom|staging|uat-|technical.assumption/iu);
  for (const file of ["staging.html", "staging-config.js", "staging-session-bootstrap.js"]) {
    assert.match(workflow, new RegExp(`rm -f portal/store-sales/${file.replaceAll(".", "\\.")}`, "u"));
  }
});
