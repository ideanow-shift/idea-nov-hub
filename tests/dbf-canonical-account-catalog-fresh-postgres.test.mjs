import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = fs.readFileSync(new URL("../.github/workflows/dbf-phase-c-import-runtime-validation.yml", import.meta.url), "utf8");
const corrective = fs.readFileSync(new URL("../supabase/migrations/20260815123655_dbf_account_review_contract_corrective.sql", import.meta.url), "utf8");
const postgres17 = fs.readFileSync(new URL("./dbf-canonical-account-catalog-postgres17.sql", import.meta.url), "utf8");
const correctiveBytes = fs.readFileSync(new URL("../supabase/migrations/20260815123655_dbf_account_review_contract_corrective.sql", import.meta.url));

test("account review validation is self-contained in a clean checkout", () => {
  assert.doesNotMatch(workflow + corrective + postgres17, /tmp\/dbf-pglite-fixture|@electric-sql\/pglite/u);
  assert.match(workflow, /image: postgres:17\.6-bookworm/u);
  assert.match(workflow, /20260815090000_dbf_canonical_account_catalog_owner_review\.sql/u);
  assert.match(workflow, /20260815123655_dbf_account_review_contract_corrective\.sql/u);
  assert.match(workflow, /dbf-canonical-account-catalog-postgres17\.sql/u);
});

test("corrective rejects duplicate finalization and inconsistent row semantics", () => {
  assert.match(corrective, /DBF_ACCOUNT_REVIEW_ALREADY_FINAL/u);
  assert.match(corrective, /DBF_ROW_SEMANTICS_FLAGS_MISMATCH/u);
  assert.match(corrective, /dbf_account_review_approved_semantics_consistency/u);
  assert.match(corrective, /p_row_semantics='POSTABLE_DETAIL' then 'add' else 'display_only'/u);
  assert.doesNotMatch(corrective, /p_row_semantics in \('POSTABLE_DETAIL','DERIVED_SUBTOTAL'\) then 'add'/u);
});

test("corrective migration bytes are UTF-8 LF with no BOM, NUL or rollback", () => {
  assert.equal(correctiveBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false);
  assert.equal(correctiveBytes.includes(0), false);
  assert.equal(correctiveBytes.at(-1), 0x0a);
  assert.doesNotMatch(corrective, /\r/u);
  assert.match(corrective, /^--[\s\S]*\nbegin;/u);
  assert.match(corrective, /commit;\s*$/u);
  assert.doesNotMatch(corrective, /\brollback\b|\btruncate\b|\bdrop\s+(table|schema)\b|\bdelete\s+from\b/iu);
  assert.doesNotMatch(corrective, /(?:insert\s+into|update|delete\s+from)\s+public\.dbf_[a-z_]+_facts\b/iu);
  assert.doesNotMatch(corrective, /select\s+public\.dbf_account_review_decide_v1/iu);
});

test("PostgreSQL 17 fixture proves RLS, idempotency, semantics and zero fact writes", () => {
  for (const marker of [
    "DBF_ACCOUNT_REVIEW_RLS_NOT_FORCED",
    "DBF_POSTGRESQL_17_REQUIRED",
    "DBF_ACCOUNT_REVIEW_RPC_MISSING",
    "DBF_ACCOUNT_REVIEW_SEMANTICS_CONSTRAINT_MISSING",
    "DBF_DUPLICATE_CANONICAL_ACCOUNT_CREATED",
    "DBF_INVALID_SEMANTICS_PARTIAL_UPDATE",
    "DBF_DERIVED_SUBTOTAL_DOUBLE_COUNT_RISK",
    "DBF_FACT_WRITE_DETECTED",
    "DBF_ACCOUNT_REVIEW_AUDIT_APPEND_ONLY",
    "DBF_ACCOUNT_REVIEW_ROLLBACK_FIXTURE_FAILED",
  ]) assert.ok(postgres17.includes(marker), `missing ${marker}`);
  assert.match(postgres17, /\nrollback;\n/u);
  assert.match(postgres17, /\$test\$;\s*$/u);
});
