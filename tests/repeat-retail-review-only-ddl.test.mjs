import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ddl = readFileSync(new URL("../docs/store_operations_management/production_integration/repeat-retail-core-db-v1.review-only.sql", import.meta.url), "utf8");
const proposedTables = [
  "dbf_ingest.company_repeat_rate_staging_rows",
  "public.dbf_company_monthly_repeat_rate_facts",
  "public.dbf_company_monthly_retail_purchase_facts",
];

test("review-only DDL fails before its first schema mutation", () => {
  const guard = ddl.indexOf("REVIEW_ONLY_REPEAT_RETAIL_CORE_DB_V1_EXECUTION_NOT_AUTHORIZED");
  const firstMutation = ddl.search(/\b(?:alter|create|insert|update|delete)\b/iu);
  assert.ok(guard >= 0);
  assert.ok(firstMutation > guard);
});

test("all proposed tables force RLS and revoke every default API role", () => {
  for (const table of proposedTables) {
    assert.match(ddl, new RegExp(`alter table ${table.replaceAll(".", "\\.")} enable row level security`, "u"));
    assert.match(ddl, new RegExp(`alter table ${table.replaceAll(".", "\\.")} force row level security`, "u"));
    assert.match(ddl, new RegExp(`revoke all on ${table.replaceAll(".", "\\.")} from public, anon, authenticated, service_role`, "u"));
  }
  assert.doesNotMatch(ddl, /^\s*grant\b[^\n]*(?:anon|authenticated)/imu);
  assert.doesNotMatch(ddl, /security\s+definer/iu);
});

test("company repeat contract is segment keyed and contains no legacy metric mapping column", () => {
  const companyRepeatSection = ddl.slice(
    ddl.indexOf("create table public.dbf_company_monthly_repeat_rate_facts"),
    ddl.indexOf("create unique index dbf_company_repeat_active_grain_idx"),
  );
  assert.match(companyRepeatSection, /customer_segment text not null/iu);
  assert.doesNotMatch(companyRepeatSection, /\b(?:canonical_)?metric_code\b/iu);
  assert.match(ddl, /Never map RETURNING to SECOND_REPEAT_RATE or SEMI_FIXED to THIRD_REPEAT_RATE/u);
});

test("review-only DDL contains no fact update or delete", () => {
  assert.doesNotMatch(ddl, /\bupdate\s+(?:public\.)?dbf_\w+_facts\b/iu);
  assert.doesNotMatch(ddl, /\bdelete\s+from\s+(?:public\.)?dbf_\w+_facts\b/iu);
});
