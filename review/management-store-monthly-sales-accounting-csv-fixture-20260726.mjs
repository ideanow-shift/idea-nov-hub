import assert from "node:assert/strict";
import {
  buildFinancialLocalPreview,
  parseStoreMonthlySalesAccountingCsvText,
} from "../portal/management-app/financial-data-intake.js";

const header = "period,corporation,store,total_sales,technical_sales,product_sales,milbon_id_sales,ec_sales,profit";
const validCsv = [
  header,
  "2025-01,ALBERO,新所沢店,4921600,4488634,173913,12000,,841000",
  "2025-02,ALBERO,新所沢店,5100000,4600000,220000,13000,,860000",
  "2025-01,FILM,花小金井店,9000000,8200000,300000,20000,110000,1493000",
  "2025-02,FILM,花小金井店,9200000,8300000,330000,21000,120000,1510000",
].join("\n");

const parsed = parseStoreMonthlySalesAccountingCsvText(validCsv, {
  fileName: "store_monthly_sales.csv",
  fileBytes: validCsv.length,
  contentIdentity: "local-fixture-store-monthly-sales",
});

assert.equal(parsed.status, "PL_LOCAL_READY");
assert.equal(parsed.statement, "PL");
assert.equal(parsed.normalizedRecordCount, 4);
assert.equal(parsed.entityCandidateCount, 2);
assert.equal(parsed.expectedMonthCount, 12);
assert.equal(parsed.actualMonthCount, 2);
assert.deepEqual(parsed.missingMonthLabels, [
  "2025-03",
  "2025-04",
  "2025-05",
  "2025-06",
  "2025-07",
  "2025-08",
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
]);
assert.equal(parsed.entityPreviewRows[0].localKpiMetrics.milbonIdSalesYen, 25000);
assert.equal(parsed.entityPreviewRows[0].localKpiMetrics.ecSalesYen, 0);

const preview = buildFinancialLocalPreview(parsed);
assert.equal(preview.schemaVersion, "management-financial-local-preview-v1");
assert.equal(preview.status, "PL_LOCAL_READY");
assert.equal(preview.importActionEnabled, false);
assert.equal(preview.sourceMissingMonthCount, 10);
assert.equal(preview.rows.length, 2);
assert.equal(preview.rows[0].technicalSalesManYen, 909);
assert.equal(preview.rows[0].productSalesManYen, 39);
assert.equal(preview.rows[0].ecSalesManYen, 0);
assert.equal(preview.rows[0].storeAnalysisMetricStatus, "SALES_READY_CUSTOMER_REPEAT_MENU_PENDING");
assert.equal(preview.monthlyStoreRows.length, 4);
assert.equal(preview.monthlyStoreRows[0].period, "2025-01");
assert.equal(preview.monthlyStoreRows[0].technicalSalesYen, 4488634);
assert.equal(preview.monthlyStoreRows[0].productSalesYen, 173913);
assert.equal(preview.monthlyStoreRows[0].milbonIdSalesYen, 12000);

const duplicateCsv = [
  header,
  "2025-01,ALBERO,新所沢店,4921600,4488634,173913,12000,,841000",
  "2025-01,ALBERO,新所沢店,5100000,4600000,220000,13000,,860000",
].join("\n");
const duplicate = parseStoreMonthlySalesAccountingCsvText(duplicateCsv, {
  fileName: "store_monthly_sales.csv",
  fileBytes: duplicateCsv.length,
  contentIdentity: "local-fixture-duplicate-store-monthly-sales",
});
assert.equal(duplicate.status, "PL_DUPLICATE_ENTITY_PERIOD_DETECTED");
assert.equal(duplicate.parseFailureCategory, "STORE_MONTHLY_SALES_DUPLICATE_KEY");

const invalidNumberCsv = [
  header,
  "2025-01,ALBERO,新所沢店,4,920,4488634,173913,12000,,841000",
].join("\n");
const invalid = parseStoreMonthlySalesAccountingCsvText(invalidNumberCsv, {
  fileName: "store_monthly_sales.csv",
  fileBytes: invalidNumberCsv.length,
  contentIdentity: "local-fixture-invalid-store-monthly-sales",
});
assert.equal(invalid.status, "PL_FILE_PARSE_FAILED");
assert.equal(invalid.parseFailureCategory, "STORE_MONTHLY_SALES_ROW_INVALID");

console.log(JSON.stringify({
  passed: true,
  status: parsed.status,
  normalizedRecordCount: parsed.normalizedRecordCount,
  entityCandidateCount: parsed.entityCandidateCount,
  missingMonthCount: parsed.missingMonthLabels.length,
  productionImportEnabled: preview.importActionEnabled,
}, null, 2));
