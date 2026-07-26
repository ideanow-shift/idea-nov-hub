import assert from "node:assert/strict";
import {
  buildFinancialLocalPreview,
  parseStoreMonthlySalesAccountingCsvText,
  validateFinancialLocalCorrectionCsv,
} from "../portal/management-app/financial-data-intake.js";

const sourceHeader = "period,corporation,store,total_sales,technical_sales,product_sales,milbon_id_sales,ec_sales,profit";
const correctionHeader = "period,corporation,store,field,corrected_value,reason";
const sourceCsv = [
  sourceHeader,
  "2025-01,ALBERO,新所沢店,4920448,4488634,173913,12000,,841000",
  "2025-02,ALBERO,新所沢店,5120000,4600000,220000,13000,,920000",
  "2025-01,FILM,花小金井店,6200000,5600000,300000,21000,40000,810000",
].join("\n");

const parsed = parseStoreMonthlySalesAccountingCsvText(sourceCsv, {
  fileName: "accounting.csv",
  fileBytes: sourceCsv.length,
  contentIdentity: "sha256:fixture",
});
assert.equal(parsed.status, "PL_LOCAL_READY");

const validCorrection = [
  correctionHeader,
  "2025-01,ALBERO,新所沢店,total_sales,4930000,経理基準CSV確認後の少額補正",
  "2025-01,FILM,花小金井店,profit,820000,経理確認済み補正",
].join("\n");
const receipt = validateFinancialLocalCorrectionCsv(validCorrection, parsed);
assert.equal(receipt.status, "LOCAL_CORRECTION_READY");
assert.equal(receipt.adjustmentCount, 2);
assert.equal(receipt.targetCount, 2);
assert.equal(receipt.fieldCount, 2);
assert.equal(receipt.productionImportEnabled, false);

const preview = buildFinancialLocalPreview({ ...parsed, localCorrectionReceipt: receipt });
assert.equal(preview.localCorrectionStatus, "LOCAL_CORRECTION_READY");
assert.equal(preview.localCorrectionCount, 2);
assert.equal(preview.importActionEnabled, false);

const missingTarget = validateFinancialLocalCorrectionCsv([
  correctionHeader,
  "2025-03,ALBERO,新所沢店,total_sales,4930000,対象月なし",
].join("\n"), parsed);
assert.equal(missingTarget.status, "LOCAL_CORRECTION_TARGET_NOT_FOUND");

const duplicate = validateFinancialLocalCorrectionCsv([
  correctionHeader,
  "2025-01,ALBERO,新所沢店,total_sales,4930000,補正1",
  "2025-01,ALBERO,新所沢店,total_sales,4940000,補正2",
].join("\n"), parsed);
assert.equal(duplicate.status, "LOCAL_CORRECTION_DUPLICATE_FIELD");

const wrongField = validateFinancialLocalCorrectionCsv([
  correctionHeader,
  "2025-01,ALBERO,新所沢店,employee_salary,4930000,禁止項目",
].join("\n"), parsed);
assert.equal(wrongField.status, "LOCAL_CORRECTION_VALUE_INVALID");

const rawAmount = validateFinancialLocalCorrectionCsv([
  correctionHeader,
  "2025-01,ALBERO,新所沢店,total_sales,\"4,930,000\",カンマ入り金額",
].join("\n"), parsed);
assert.equal(rawAmount.status, "LOCAL_CORRECTION_VALUE_INVALID");

const noBase = validateFinancialLocalCorrectionCsv(validCorrection, null);
assert.equal(noBase.status, "LOCAL_CORRECTION_BASE_DATA_REQUIRED");

console.log(JSON.stringify({
  passed: true,
  correctionStatus: receipt.status,
  adjustmentCount: receipt.adjustmentCount,
  targetCount: receipt.targetCount,
  fieldCount: receipt.fieldCount,
  productionImportEnabled: receipt.productionImportEnabled,
}, null, 2));
