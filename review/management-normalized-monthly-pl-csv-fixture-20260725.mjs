import fs from "node:fs";
import assert from "node:assert/strict";
import { parseNormalizedMonthlyPlCsvText } from "../portal/management-app/financial-data-intake.js";

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
assert.equal(result.entityPreviewRows.every((row) => row.entityCategory === "STORE_CANDIDATE"), true);
assert.equal(result.entityPreviewRows.every((row) => row.mappingStatus === "READY"), true);
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

console.log(JSON.stringify({
  passed: true,
  status: result.status,
  normalizedRecordCount: result.normalizedRecordCount,
  entityCandidateCount: result.entityCandidateCount,
  monthCount: result.entityPreviewRows[0].monthLabels.length,
  productionImportEnabled: false,
}, null, 2));
