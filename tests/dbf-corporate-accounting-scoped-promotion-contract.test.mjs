import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260818045351_dbf_corporate_accounting_scoped_promotion_v1.sql", import.meta.url), "utf8");
const domain = readFileSync(new URL("../supabase/functions/dbf-business-data-api/domain.ts", import.meta.url), "utf8");

test("migration is additive, transactional, BOM-free, and has no rollback tail", () => {
  assert.equal(migration.charCodeAt(0) === 0xfeff, false);
  assert.match(migration, /^--[\s\S]*\nbegin;/u);
  assert.match(migration, /\ncommit;\s*$/u);
  assert.doesNotMatch(migration, /\b(drop|truncate|delete\s+from|alter\s+column|rename\s+)\b/iu);
  assert.doesNotMatch(migration, /\brollback\b/iu);
});

test("receipt and audit relations are private, forced-RLS, append-only", () => {
  for (const table of ["corporate_accounting_approval_receipts", "corporate_accounting_promotion_receipts", "corporate_accounting_promotion_audit"]) {
    assert.match(migration, new RegExp(`alter table dbf_ingest\\.${table} force row level security`, "u"));
    assert.match(migration, new RegExp(`revoke all on dbf_ingest\\.${table} from public,anon,authenticated,service_role`, "u"));
  }
  assert.match(migration, /DBF_CORPORATE_ACCOUNTING_RECEIPT_APPEND_ONLY/u);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all).*authenticated/iu);
});

test("scope, source, control totals and canonical zero baseline are fixed", () => {
  for (const evidence of [
    "CORPORATE_ACCOUNTING_ACTUAL_V1", "2026-06-01", "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    "13cb25de-0b76-475a-b718-5f588be447fd", "0ffccfd2-1a39-404a-a41d-b16127ea9008",
    "997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1",
    "f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c",
    "88066258", "72040100", "14776957", "1249201", "5704265",
    "570155249", "213188431", "356966818",
  ]) assert.match(migration, new RegExp(evidence, "u"));
  assert.match(migration, /'plDetail',0,'plAggregate',0,'bs',0,'budget',0,'storeMetrics',0/u);
});

test("current incomplete review is fail-close and generic RPC rejects Pilot batches", () => {
  for (const blocker of ["OWNER_REVIEW_INCOMPLETE", "ROW_SEMANTICS_INCOMPLETE", "ACCOUNT_MAPPING_UNAPPROVED"]) {
    assert.match(migration, new RegExp(blocker, "u"));
  }
  assert.match(domain, /CORPORATE_SCOPE_REQUIRES_SCOPED_PROMOTION/u);
  assert.match(migration, /DBF_GENERIC_PROMOTION_CORPORATE_SCOPE_REJECTED/u);
  assert.match(migration, /current_setting\('dbf\.corporate_accounting_scope',true\)/u);
  assert.match(migration, /dbf_import_promote_corporate_accounting_v1/u);
});

test("server-side selection excludes non-approved and non-promotable semantics", () => {
  assert.match(migration, /decision in\('APPROVE','EDIT_AND_APPROVE'\)/u);
  assert.match(migration, /row_semantics='POSTABLE_DETAIL'/u);
  assert.match(migration, /row_semantics='CONTROL_TOTAL'/u);
  assert.match(migration, /row_semantics in\('POSTABLE_DETAIL','CONTROL_TOTAL'\)/u);
  assert.doesNotMatch(migration, /insert into public\.dbf_(budget|store_monthly_metric)_facts/iu);
});
