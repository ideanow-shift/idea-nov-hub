import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260819224824_dbf_store_monthly_correction_prefill.sql", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../portal/management-app/business-data-management-preview.js", import.meta.url), "utf8");

test("correction prefill is a bounded read extension of the existing preview RPC", () => {
  assert.match(migration, /create or replace function public\.dbf_import_preview_v1\(p_batch_id uuid\)/iu);
  assert.match(migration, /b\.fact_kind = 'store_operating_result' and b\.status in \('promoted', 'superseded'\)/iu);
  assert.match(migration, /s\.batch_id = b\.id/iu);
  assert.match(migration, /'correctionRows'/u);
  assert.doesNotMatch(migration, /\b(insert|update|delete|truncate|alter table|drop table)\b/iu);
  assert.match(migration, /revoke all on function public\.dbf_import_preview_v1\(uuid\) from public, anon, authenticated/iu);
  assert.match(migration, /grant execute on function public\.dbf_import_preview_v1\(uuid\) to service_role/iu);
});

test("history correction reuses preview, master options, and existing lineage without a write", () => {
  assert.match(ui, /訂正として登録/u);
  assert.match(ui, /DBF_IMPORT_RUNTIME\.preview\(item\.batchId\)/u);
  assert.match(ui, /DBF_IMPORT_RUNTIME\.masterOptions\(\)/u);
  assert.match(ui, /manualEditor\.prefillStoreRows\(rows\)/u);
  assert.match(ui, /correctionBatch\.value = item\.batchId/u);
  assert.match(ui, /correctionReady = !correctionToggle\.checked/u);
  assert.match(ui, /confirmationStatus = ""/u);
  assert.match(ui, /「確定値」を選び、訂正理由を入力してください/u);
  assert.doesNotMatch(ui, /beginCorrection[\s\S]{0,2500}DBF_IMPORT_RUNTIME\.(start|validate|approve|promote)/u);
});
