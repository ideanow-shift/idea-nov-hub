import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const workflow = fs.readFileSync(
  path.join(root, ".github", "workflows", "dbf-phase-c-import-runtime-validation.yml"),
  "utf8",
);

test("Phase C validation runs against PostgreSQL 17.6 with no write-capable workflow token", () => {
  assert.match(workflow, /image: postgres:17\.6-bookworm/u);
  assert.match(workflow, /permissions:\s+contents: read/u);
  assert.doesNotMatch(workflow, /permissions:[\s\S]{0,120}\bwrite\b/u);
  assert.doesNotMatch(workflow, /supabase db push|functions deploy|apply_migration/iu);
});

test("Phase C validation applies the exact local migration chain and exercises authorization boundaries", () => {
  assert.match(workflow, /20260814140109_dbf_business_data_phase1_foundation\.sql/u);
  assert.match(workflow, /20260814204346_dbf_business_data_phase1_service_role_acl_corrective\.sql/u);
  assert.match(workflow, /20260814213224_dbf_business_data_phase_c_runtime\.sql/u);
  assert.match(workflow, /20260815090000_dbf_canonical_account_catalog_owner_review\.sql/u);
  assert.match(workflow, /20260815123655_dbf_account_review_contract_corrective\.sql/u);
  assert.match(workflow, /dbf-business-data-phase-c-postgres17\.sql/u);
  assert.match(workflow, /dbf-canonical-account-catalog-postgres17\.sql/u);
  assert.match(workflow, /dbf-business-data-phase-c-edge\.test\.ts/u);
  assert.match(workflow, /deno check supabase\/functions\/dbf-business-data-api\/index\.ts/u);
});

test("Phase C validation rejects Production references and browser secrets", () => {
  assert.match(workflow, /nkmxevmioczcmnldreyo/u);
  assert.match(workflow, /idea-nov-core/u);
  assert.match(workflow, /service_role/u);
  assert.match(workflow, /PRIVATE KEY/u);
  assert.match(workflow, /github_token/u);
});
