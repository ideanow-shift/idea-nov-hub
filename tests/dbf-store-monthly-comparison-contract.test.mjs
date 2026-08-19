import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../supabase/migrations/20260819123648_dbf_store_monthly_comparison_read_v1.sql",
  import.meta.url,
), "utf8");
const runtime = readFileSync(new URL(
  "../supabase/functions/nov-hub-api/management_readonly_candidate.ts",
  import.meta.url,
), "utf8");
const adapter = readFileSync(new URL(
  "../portal/store-sales/adapters/dbf-store-monthly.js",
  import.meta.url,
), "utf8");
const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");

test("comparison RPCs are bounded, server-scoped, confirmed read-only projections", () => {
  assert.match(migration, /dbf_store_monthly_actual_range_read_v1/u);
  assert.match(migration, /dbf_store_monthly_budget_range_read_v1/u);
  assert.match(migration, /p_end_month > \(p_start_month \+ interval '23 months'\)::date/gu);
  assert.match(migration, /pg_catalog\.cardinality\(p_store_ids\) > 20/gu);
  assert.match(migration, /fact\.company_id = p_company_id/gu);
  assert.match(migration, /fact\.store_id = any \(p_store_ids\)/gu);
  assert.match(migration, /fact\.status = 'confirmed' and fact\.is_active = true/gu);
  assert.doesNotMatch(migration, /\b(insert|update|delete|merge|truncate)\b/iu);
});

test("comparison RPCs remain service-role-only security invoker functions", () => {
  assert.equal((migration.match(/security invoker/gu) || []).length, 2);
  assert.equal((migration.match(/from public, anon, authenticated/gu) || []).length, 2);
  assert.equal((migration.match(/to service_role/gu) || []).length, 2);
  assert.doesNotMatch(migration, /create policy/iu);
});

test("fiscal YTD uses the canonical corporation fiscal year and never defaults to calendar YTD", () => {
  assert.match(runtime, /corporation_business_profiles/u);
  assert.match(runtime, /fiscal_year_end_month/u);
  assert.match(runtime, /fiscalStartMonth\(fiscalMonth, fiscalYearEnd\)/u);
  assert.equal(runtime.includes("${selectedYear}-01-01"), false);
});

test("missing and zero denominators fail closed while all six formal trends are wired", () => {
  assert.match(runtime, /denominator === null \|\| denominator === 0/u);
  for (const code of ["TOTAL_SALES", "OPERATING_PROFIT", "TOTAL_CUSTOMERS", "TOTAL_UNIT_PRICE", "RETAIL_SALES", "EC_ALLOCATED_SALES"]) {
    assert.match(runtime, new RegExp(`"${code}"`, "u"));
  }
  assert.match(adapter, /\["sales", "operatingProfit", "customerCount", "totalTicket", "retailSales", "ecSales"\]/u);
  assert.match(app, /isDbfProjection = state\.projection\?\.contractVersion === "STORE_MONTHLY_ACTUAL_V1"/u);
  assert.match(app, /state\.runtimeFeatureFlag === "staging" && !isDbfProjection/u);
  assert.match(app, /DBFの確定履歴が2か月以上揃うまで数値は表示しません/u);
});
