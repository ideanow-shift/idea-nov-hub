import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const promotion = fs.readFileSync(new URL("../supabase/migrations/20260814213224_dbf_business_data_phase_c_runtime.sql", import.meta.url), "utf8");
const readRpc = fs.readFileSync(new URL("../supabase/migrations/20260819123648_dbf_store_monthly_comparison_read_v1.sql", import.meta.url), "utf8");
const adapter = fs.readFileSync(new URL("../portal/store-sales/adapters/dbf-store-monthly.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../portal/management-app/business-data-management-preview.js", import.meta.url), "utf8");

test("promotion preserves row confirmation status without implicit confirmation", () => {
  assert.match(promotion, /s\.normalized_payload->>'confirmationStatus'/u);
  assert.doesNotMatch(promotion, /coalesce\(s\.normalized_payload->>'confirmationStatus',\s*'confirmed'\)/u);
});

test("formal Store Operations reads confirmed active facts only", () => {
  assert.match(readRpc, /fact\.status = 'confirmed' and fact\.is_active = true/u);
});

test("missing formal actual remains preparing rather than zero or synthetic", () => {
  assert.match(adapter, /preparingMetric/u);
  assert.match(adapter, /missingDataPolicy !== "preparing-not-zero"/u);
  assert.match(adapter, /value: null/u);
});

test("manual confirmation is explicit before import and provisional is explained again before promotion", () => {
  assert.match(ui, /confirmationStatus\(\)/u);
  assert.match(ui, /確定値または暫定値を明示的に選択してください/u);
  assert.match(ui, /Store Operationsの正式実績には表示されません/u);
  assert.match(ui, /correctionOfBatchId/u);
  assert.match(ui, /correctionReason/u);
});
