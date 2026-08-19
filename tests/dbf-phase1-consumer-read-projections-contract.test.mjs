import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL(
  "../supabase/migrations/20260819012418_dbf_phase1_consumer_read_projections.sql",
  import.meta.url,
), "utf8");
const domain = await readFile(new URL(
  "../supabase/functions/dbf-business-data-api/domain.ts",
  import.meta.url,
), "utf8");
const edge = await readFile(new URL(
  "../supabase/functions/dbf-business-data-api/index.ts",
  import.meta.url,
), "utf8");
const consumer = await readFile(new URL(
  "../supabase/functions/dbf-business-data-api/consumer-read.ts",
  import.meta.url,
), "utf8");

test("corporate read RPC is read-only, scoped, and service-role-only", () => {
  assert.match(migration, /create or replace function public\.dbf_corporate_accounting_actual_read_v1\(/iu);
  assert.match(migration, /security invoker[\s\S]*set search_path = pg_catalog, dbf_ingest/iu);
  assert.match(migration, /fact\.fiscal_month = p_fiscal_month/iu);
  assert.match(migration, /fact\.company_id = p_company_id/iu);
  assert.match(migration, /fact\.store_id is null/iu);
  assert.match(migration, /fact\.status = 'confirmed'/iu);
  assert.match(migration, /fact\.is_active = true/iu);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/iu);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/iu);
  assert.doesNotMatch(migration, /\b(insert|update|delete|merge|truncate)\b/iu);
});
test("staging Edge exposes only server-scoped read actions", () => {
  for (const action of ["storeMonthlyActualProjectionV1", "dbfCorporateAccountingActualProjectionV1"]) {
    assert.match(domain, new RegExp(`"${action}"`, "u"));
    assert.match(edge, new RegExp(`action === "${action}"`, "u"));
  }
  assert.match(edge, /dbfCanonicalMasterOptionsV1/iu);
  assert.match(edge, /storeMonthlyActualProjectionV1[\s\S]*scopeMode: "all"/iu);
  assert.match(edge, /dbf_store_monthly_actual_read_v1/iu);
  assert.match(edge, /dbf_corporate_accounting_actual_read_v1/iu);
  assert.doesNotMatch(consumer, /storeKey:\s*store\.rawId/iu);
  assert.match(consumer, /rawStoreIdsReturned: false/iu);
  assert.match(consumer, /missingDataPolicy: "preparing-not-zero"/iu);
});

test("formal store baseline and DBF responsibility boundaries are fail closed", () => {
  assert.match(consumer, /total: 20, direct: 13, fc: 7/iu);
  assert.match(consumer, /OFFICIAL_STORE_BASELINE_REJECTED/iu);
  assert.match(consumer, /corporateFinancialLineItemsIncluded: false/iu);
  assert.match(consumer, /public\.dbf_store_monthly_metric_facts/iu);
  assert.match(consumer, /public\.dbf_pl_detail_facts/iu);
});
