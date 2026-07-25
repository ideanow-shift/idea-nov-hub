import fs from "node:fs";
import assert from "node:assert/strict";
import { buildFinancialLocalPreview, parseNormalizedMonthlyPlCsvText } from "../portal/management-app/financial-data-intake.js";

const sourcePath = "C:\\Users\\bassa\\Downloads\\BASSA_R6_店舗別月次PL.csv";
const text = fs.readFileSync(sourcePath, "utf8");
const result = parseNormalizedMonthlyPlCsvText(text, {
  fileName: "BASSA_R6_店舗別月次PL.csv",
  fileBytes: fs.statSync(sourcePath).size,
  contentIdentity: "local-fixture-not-runtime-identity",
});

assert.equal(result.status, "PL_LOCAL_READY");
assert.equal(result.statement, "PL");
assert.equal(result.normalizedRecordCount, 10088);
assert.equal(result.entityCandidateCount, 21);
assert.equal(result.aggregateSheetCount, 0);
assert.equal(result.entityPreviewRows.length, 21);
assert.equal(result.expectedMonthCount, 12);
assert.equal(result.actualMonthCount, 10);
assert.deepEqual(result.missingMonthLabels, ["2024-10", "2024-11"]);
assert.equal(result.entityPreviewRows.every((row) => row.entityCategory === "STORE_CANDIDATE"), true);
assert.equal(result.entityPreviewRows.every((row) => row.mappingStatus === "READY"), true);
assert.equal(result.entityPreviewRows.every((row) => row.missingMonthLabels.join(",") === "2024-10,2024-11"), true);
assert.deepEqual(result.entityPreviewRows[0].monthLabels, [
  "2024-01",
  "2024-02",
  "2024-03",
  "2024-04",
  "2024-05",
  "2024-06",
  "2024-07",
  "2024-08",
  "2024-09",
  "2024-12",
]);
assert.equal(result.entityPreviewRows.some((row) => row.entityName === "新所沢店"), true);
assert.equal(result.entityPreviewRows.some((row) => row.entityName === "東久留米店"), true);
assert.equal(result.entityPreviewRows.some((row) => row.recordCount > 0), true);

const preview = buildFinancialLocalPreview(result);
assert.equal(preview.schemaVersion, "management-financial-local-preview-v1");
assert.equal(preview.sourceMissingMonthCount, 2);
assert.deepEqual(preview.missingMonthLabels, ["2024-10", "2024-11"]);
assert.equal(preview.expectedMonthCount, 12);
assert.equal(preview.actualMonthCount, 10);
assert.equal(preview.importActionEnabled, false);

console.log(JSON.stringify({
  passed: true,
  status: result.status,
  normalizedRecordCount: result.normalizedRecordCount,
  entityCandidateCount: result.entityCandidateCount,
  monthCount: result.entityPreviewRows[0].monthLabels.length,
  missingMonthLabels: result.missingMonthLabels,
  productionImportEnabled: false,
}, null, 2));
