import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../supabase/migrations/20260819002309_dbf_store_monthly_actual_backend_contract_v1.sql",
  import.meta.url,
), "utf8");
const candidate = readFileSync(new URL(
  "../supabase/functions/nov-hub-api/management_readonly_candidate.ts",
  import.meta.url,
), "utf8");
const edge = readFileSync(new URL(
  "../supabase/functions/nov-hub-api/index.ts",
  import.meta.url,
), "utf8");

function edgeFunctionBody(name, nextName) {
  const start = edge.indexOf(`async function ${name}`);
  const end = edge.indexOf(`function ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist after ${name}`);
  return edge.slice(start, end);
}

test("store monthly actual RPC is confirmed, active, company/store/month scoped", () => {
  assert.match(migration, /fact\.fiscal_month = p_fiscal_month/u);
  assert.match(migration, /fact\.company_id = p_company_id/u);
  assert.match(migration, /fact\.store_id = any \(p_store_ids\)/u);
  assert.match(migration, /fact\.status = 'confirmed'/u);
  assert.match(migration, /fact\.is_active = true/u);
  assert.match(migration, /order by fact\.store_id, fact\.metric_code/u);
});

test("RPC is service-role only and retains forced-RLS fact ownership", () => {
  assert.match(migration, /security invoker/u);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/u);
  assert.doesNotMatch(migration, /grant .*authenticated/u);
  assert.doesNotMatch(migration, /create policy/u);
});

test("projection reuses operating facts without mixing corporate P\/L", () => {
  const queryBody = migration.slice(migration.indexOf("return query"), migration.indexOf("end;\n$$"));
  assert.match(queryBody, /public\.dbf_store_monthly_metric_facts/u);
  assert.doesNotMatch(queryBody, /dbf_pl_detail_facts/u);
  assert.match(candidate, /corporateFinancialLineItemsIncluded: false/u);
  assert.match(candidate, /missingDataPolicy: "preparing-not-zero"/u);
  assert.doesNotMatch(candidate, /value:\s*0[,}]/u);
});

test("HUB Edge exposes only server-resolved monthly projection action", () => {
  assert.match(edge, /"storeMonthlyActualProjectionV1"/u);
  assert.match(candidate, /serverResolved: true/u);
  assert.match(candidate, /rawStoreIdsReturned: false/u);
  assert.match(candidate, /OFFICIAL_OPERATING_STORE_BASELINE = Object\.freeze\(\{ total: 20, direct: 13, fc: 7 \}\)/u);
  assert.match(candidate, /dbf_store_monthly_actual_read_v1/u);
});

test("Store Operations enables assigned scope while DBF admin handoff remains disabled", () => {
  const managementRuntime = edgeFunctionBody("handleManagementFromDeployedBaseline", "resolveDbfHandoffBusinessDataAdmin");
  const adminHandoff = edgeFunctionBody("resolveDbfHandoffBusinessDataAdmin", "createDbfHandoffDependencies");
  assert.match(managementRuntime, /assignedScopeEnabled:\s*true/u);
  assert.doesNotMatch(managementRuntime, /assignedScopeEnabled:\s*false/u);
  assert.match(adminHandoff, /assignedScopeEnabled:\s*false/u);
  assert.doesNotMatch(adminHandoff, /assignedScopeEnabled:\s*true/u);
  assert.equal((edge.match(/assignedScopeEnabled:\s*true/gu) || []).length, 1);
  assert.equal((edge.match(/assignedScopeEnabled:\s*false/gu) || []).length, 1);
});

test("migration contains no business data population or write projection", () => {
  assert.doesNotMatch(migration, /insert\s+into\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(migration, /update\s+public\.dbf_store_monthly_metric_facts/iu);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.dbf_store_monthly_metric_facts/iu);
});
