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
  for (const column of [
    "manifest_ref", "selected_row_digest", "mapping_version", "mapping_digest",
    "row_semantics_digest", "control_total_digest", "canonical_baseline",
    "approved_by_employee_id", "request_id", "owner_confirmation", "approved_at",
  ]) assert.match(migration, new RegExp(`\\b${column}\\b`, "u"));
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all).*authenticated/iu);
  assert.match(migration, /revoke all on dbf_ingest\.corporate_accounting_approval_receipts from public,anon,authenticated,service_role/u);
});

test("scope, source and control totals are fixed while canonical baseline is read live", () => {
  for (const evidence of [
    "CORPORATE_ACCOUNTING_ACTUAL_V1", "2026-06-01", "e4059116-bdb3-4e13-9763-bbc77bdfe062",
    "13cb25de-0b76-475a-b718-5f588be447fd", "0ffccfd2-1a39-404a-a41d-b16127ea9008",
    "997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1",
    "f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c",
    "88066258", "72040100", "14776957", "1249201", "5704265",
    "570155249", "213188431", "356966818",
  ]) assert.match(migration, new RegExp(evidence, "u"));
  for (const table of ["dbf_pl_detail_facts", "dbf_pl_aggregate_facts", "dbf_bs_facts", "dbf_budget_facts", "dbf_store_monthly_metric_facts"]) {
    assert.match(migration, new RegExp(`select count\\(\\*\\) from public\\.${table} where fiscal_month=date '2026-06-01' and company_id=`, "u"));
  }
  assert.match(migration, /'canonicalBaseline',v_canonical_baseline/u);
  assert.match(migration, /CANONICAL_BASELINE_NOT_ZERO/u);
  assert.match(migration, /p_expected_canonical_baseline is distinct from v_preflight->'canonicalBaseline'/u);
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

test("approval receipt is minted by a dedicated service-role RPC from current DB truth", () => {
  assert.match(migration, /create function public\.dbf_corporate_accounting_approve_v1\(/u);
  assert.match(migration, /p_actor_employee_id uuid,p_request_id uuid,p_manifest_ref text,p_owner_confirmation boolean/u);
  assert.match(migration, /DBF_OWNER_CONFIRMATION_REQUIRED/u);
  assert.match(migration, /DBF_APPROVAL_REQUEST_REUSED/u);
  assert.match(migration, /v_preflight:=public\.dbf_corporate_accounting_promotion_preflight_v1\(p_manifest_ref\)/u);
  assert.match(migration, /v_preflight->>'approvalScopeDigest'/u);
  assert.match(migration, /revoke all on function public\.dbf_corporate_accounting_approve_v1\(uuid,uuid,text,boolean\) from public,anon,authenticated/u);
  assert.match(migration, /grant execute on function public\.dbf_corporate_accounting_approve_v1\(uuid,uuid,text,boolean\) to service_role/u);
  assert.match(domain, /dbfCorporateAccountingApproveV1/u);
  assert.match(domain, /exactKeys\(payload, \["manifestRef", "requestId", "ownerConfirmation"\]\)/u);
});

test("selected-row digest binds exact corporate row content including amount", () => {
  for (const token of [
    "statement_type", "fiscal_month", "company_id", "source_batch_id", "raw_row_id",
    "payload_sha256", "source_account_code", "source_account_name", "amount::text",
    "bs_classification", "source_row_category", "confirmation_status", "tax_basis",
    "candidate_id", "decision", "canonical_account_id", "canonical_account_version_id",
    "statement_mapping_version_id", "row_semantics", "is_postable", "is_control_total",
  ]) assert.match(migration, new RegExp(token.replace("::", "::"), "u"));
  assert.match(migration, /s\.store_id is null/u);
  assert.match(migration, /s\.source_row_category='aggregate'/u);
  assert.match(migration, /order by statement_type,source_batch_id,source_account_code,candidate_id,raw_row_id/u);
});

test("control totals are exact-scope and ambiguous source rows fail closed", () => {
  assert.match(migration, /CONTROL_TOTAL_SOURCE_AMBIGUOUS/u);
  assert.match(migration, /v_control_total_row_count<>8 or v_control_total_code_count<>8/u);
  assert.match(migration, /c\.source_batch_id='13cb25de-0b76-475a-b718-5f588be447fd'/u);
  assert.match(migration, /s\.source_row_category='aggregate' and s\.store_id is null/u);
  assert.match(migration, /c\.source_batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'/u);
  assert.match(migration, /v_control_total_digest/u);
  assert.match(migration, /'totalSales',v_total_sales/u);
});

test("stale approval is rejected consistently by preflight and promotion", () => {
  assert.match(migration, /APPROVAL_RECEIPT_STALE/u);
  assert.match(migration, /APPROVAL_SCOPE_STALE/u);
  for (const field of [
    "manifest_ref=p_manifest_ref", "selected_row_digest=v_selected_digest",
    "mapping_digest=v_mapping_digest", "row_semantics_digest=v_semantics_digest",
    "control_total_digest=v_control_total_digest", "canonical_baseline=v_canonical_baseline",
    "approval_scope_digest=v_approval_scope_digest",
  ]) assert.match(migration, new RegExp(field, "u"));
});

test("real Staging 71 aggregate plus 781 store-detail plus 67 BS shape is explicit", () => {
  assert.match(migration, /source_row_category='aggregate' and store_id is null\)<>71/u);
  assert.match(migration, /source_row_category='detail' and store_id is not null\)<>781/u);
  assert.match(migration, /batch_id=p_bs_batch_id and store_id is null\)<>67/u);
  assert.match(migration, /\(source_row_category='aggregate' and store_id is not null\)/u);
  assert.match(migration, /\(source_row_category='detail' and store_id is null\)/u);
  assert.match(migration, /coalesce\(normalized_payload->>'taxBasis',''\)<>'TAX_EXCLUSIVE'/u);
});

test("all three fact inserts are pinned to fiscal month, company, batch and selected source shape", () => {
  assert.equal((migration.match(/c\.fiscal_month=p_fiscal_month and c\.company_id=p_company_id and c\.source_batch_id=p_pl_batch_id/gu) || []).length, 2);
  assert.equal((migration.match(/s\.batch_id=p_pl_batch_id and s\.source_row_category='aggregate' and s\.store_id is null/gu) || []).length, 2);
  assert.match(migration, /c\.fiscal_month=p_fiscal_month and c\.company_id=p_company_id and c\.source_batch_id=p_bs_batch_id/u);
  assert.match(migration, /s\.batch_id=p_bs_batch_id and s\.store_id is null/u);
  assert.equal((migration.match(/c\.statement_type='pl'/gu) || []).length >= 2, true);
  assert.match(migration, /c\.statement_type='bs'/u);
});

test("review completion requires latest non-initialize audit decision parity", () => {
  assert.match(migration, /latest\.decision is distinct from c\.decision/u);
  assert.match(migration, /REVIEW_AUDIT_STATE_MISMATCH/u);
  assert.match(migration, /'auditMismatchCount',v_audit_mismatch/u);
});

test("security-definer RPCs exclude public from hardened search_path", () => {
  assert.equal((migration.match(/set search_path = pg_catalog, dbf_ingest, accounting as \$fn\$/gu) || []).length, 3);
  assert.doesNotMatch(migration, /set search_path = [^\n]*public[^\n]*as \$fn\$/u);
  assert.match(migration, /extensions\.digest/u);
});
