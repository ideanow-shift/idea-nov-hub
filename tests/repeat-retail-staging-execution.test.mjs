import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveStore, STAGING_PROFILE } from "../tools/store_repeat_retail_handoff/generate_staging_sql.mjs";

const ddl = readFileSync(new URL(
  "../docs/store_operations_management/production_integration/repeat-retail-core-db-staging-v1.sql",
  import.meta.url,
), "utf8");

const protectedTables = [
  "dbf_ingest.company_repeat_rate_staging_rows",
  "public.dbf_company_monthly_repeat_rate_facts",
  "public.dbf_company_monthly_retail_purchase_facts",
];

test("staging DDL uses the actual core corporation identity key", () => {
  assert.match(ddl, /references core\.corporation_identities\(corporation_id\)/u);
  assert.doesNotMatch(ddl, /references public\.corporations/u);
});

test("every new table forces RLS and revokes API roles", () => {
  for (const table of protectedTables) {
    const escaped = table.replaceAll(".", "\\.");
    assert.match(ddl, new RegExp("alter table " + escaped + " force row level security", "u"));
    assert.match(ddl, new RegExp("revoke all on " + escaped + " from public,anon,authenticated,service_role", "u"));
  }
  assert.doesNotMatch(ddl, /security\s+definer/iu);
  assert.doesNotMatch(ddl, /^\s*create\s+policy/imu);
});

test("staging DDL is transaction bounded and does not mutate existing facts", () => {
  assert.match(ddl, /^-- STAGING ONLY/iu);
  assert.match(ddl, /begin;[\s\S]*commit;/iu);
  assert.doesNotMatch(ddl, /\b(?:update|delete\s+from)\s+(?:public\.)?dbf_\w+_facts\b/iu);
});

test("fixed mapping keeps KYARAHALF history split", () => {
  assert.equal(resolveStore("SALON:KYARAHALF", "2024-01")[0], "a1997308-a402-4ddb-a3f7-8b70a75b054c");
  assert.equal(resolveStore("SALON:KYARAHALF", "2024-02")[0], "ac20934d-ef15-4363-8c2f-759193c7fcc7");
  assert.equal(STAGING_PROFILE.projectRef, "zgkoofphhivesclehrom");
});

test("unmapped store identifiers fail closed", () => {
  assert.throws(() => resolveStore("SALON:unknown", "2026-01"), /STORE_MAPPING_MISSING/u);
});
