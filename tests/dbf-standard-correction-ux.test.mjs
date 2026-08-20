import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260820000048_dbf_standard_correction_prefill.sql", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../portal/management-app/business-data-management-preview.js", import.meta.url), "utf8");
const adapter = fs.readFileSync(new URL("../portal/management-app/dbf-business-data-input-adapter.js", import.meta.url), "utf8");

test("all four DBF fact kinds expose bounded correction prefill", () => {
  assert.match(migration, /b\.fact_kind in \('pl','bs','budget','store_operating_result'\)/u);
  assert.match(migration, /b\.status in \('promoted','superseded'\)/u);
  assert.match(migration, /from dbf_ingest\.staging_rows s where s\.batch_id = b\.id/u);
  for (const field of ["scenarioCode", "classification", "sourceRowCategory", "aggregateScope", "definitionVersion", "confirmationStatus"]) assert.match(migration, new RegExp(`'${field}'`, "u"));
  assert.doesNotMatch(migration, /\b(insert into|delete from|truncate|alter table|drop table)\b/iu);
  assert.doesNotMatch(migration, /update\s+(?:public\.)?dbf_(?:pl|bs|store|budget)/iu);
});

test("preview remains service-role-only", () => {
  assert.match(migration, /revoke all on function public\.dbf_import_preview_v1\(uuid\) from public, anon, authenticated/iu);
  assert.match(migration, /grant execute on function public\.dbf_import_preview_v1\(uuid\) to service_role/iu);
});

test("history offers common correction action only for promoted supported facts", () => {
  assert.match(ui, /内容を見る/u);
  assert.match(ui, /訂正として登録/u);
  assert.match(ui, /item\.status === "promoted" && FACTS\.some/u);
  assert.doesNotMatch(ui, /item\.factKind === "store_operating_result"\) \{/u);
});

test("manual correction inherits rows and requires a reason", () => {
  assert.match(ui, /manualEditor\.prefillRows\(rows\)/u);
  assert.match(ui, /manualEditor\.prefillStoreRows\(rows\)/u);
  assert.match(ui, /訂正理由を選択/u);
  assert.match(ui, /correctionReasonType\.value !== "その他"/u);
  assert.match(ui, /元Revision:/u);
});

test("no-change correction is rejected while status-only changes remain valid", () => {
  assert.match(ui, /correctionSignature\(prepared\.normalizedRows\) === correctionSignature\(correctionBaseline\)/u);
  assert.match(ui, /CORRECTION_NO_CHANGES/u);
  assert.match(ui, /変更内容を確認/u);
  assert.match(ui, /confirmationStatus/u);
  assert.match(adapter, /\["provisional", "confirmed"\]/u);
  assert.match(migration, /DBF_CORRECTION_NO_CHANGES/u);
  assert.match(migration, /except all/gu);
  assert.match(migration, /s\.normalized_payload/u);
});

test("existing validation contracts remain fail-closed", () => {
  assert.match(adapter, /BUDGET_MEASURE_AMBIGUOUS/u);
  assert.match(adapter, /BS_BALANCE_CHECK_FAILED/u);
  assert.match(adapter, /STORE_METRIC_RATE_INVALID/u);
  assert.match(ui, /correctionOfBatchId/u);
  assert.match(ui, /correctionReason: requestedCorrectionReason/u);
  assert.doesNotMatch(ui, /beginCorrection[\s\S]{0,4500}DBF_IMPORT_RUNTIME\.(start|validate|approve|promote)/u);
});
