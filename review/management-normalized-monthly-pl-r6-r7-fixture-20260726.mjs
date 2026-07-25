import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  buildFinancialLocalPreview,
  combineFinancialWorkbookResults,
  parseNormalizedMonthlyPlCsvText,
} from "../portal/management-app/financial-data-intake.js";

const downloadsDir = "C:\\Users\\bassa\\Downloads";

function findSourceFile(prefix) {
  const fileName = fs.readdirSync(downloadsDir).find((name) => name.startsWith(prefix) && name.endsWith(".csv"));
  assert.ok(fileName, `${prefix} source csv is required for this local fixture`);
  return path.join(downloadsDir, fileName);
}

function parseLocalCsv(prefix) {
  const sourcePath = findSourceFile(prefix);
  const fileName = path.basename(sourcePath);
  const stat = fs.statSync(sourcePath);
  const result = parseNormalizedMonthlyPlCsvText(fs.readFileSync(sourcePath, "utf8"), {
    fileName,
    fileBytes: stat.size,
    contentIdentity: `local-fixture-${prefix}`,
  });
  return { sourcePath, fileName, stat, result };
}

const r6 = parseLocalCsv("BASSA_R6_");
const r7 = parseLocalCsv("BASSA_R7_");

assert.equal(r6.result.status, "PL_LOCAL_READY");
assert.equal(r6.result.normalizedRecordCount, 10088);
assert.equal(r6.result.entityCandidateCount, 21);
assert.equal(r6.result.expectedMonthCount, 12);
assert.equal(r6.result.actualMonthCount, 10);
assert.deepEqual(r6.result.missingMonthLabels, ["2024-10", "2024-11"]);

assert.equal(r7.result.status, "PL_LOCAL_READY");
assert.equal(r7.result.normalizedRecordCount, 12071);
assert.equal(r7.result.entityCandidateCount, 19);
assert.equal(r7.result.expectedMonthCount, 12);
assert.equal(r7.result.actualMonthCount, 12);
assert.deepEqual(r7.result.missingMonthLabels, []);
assert.deepEqual(r7.result.entityPreviewRows[0].monthLabels, [
  "2025-01",
  "2025-02",
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

const combined = combineFinancialWorkbookResults([r6.result, r7.result], "PL");
assert.equal(combined.status, "PL_LOCAL_READY");
assert.equal(combined.normalizedRecordCount, 22159);
assert.equal(combined.duplicateFileCount, 0);
assert.equal(combined.duplicateEntityPeriodCount, 0);
assert.deepEqual(combined.missingMonthLabels, ["2024-10", "2024-11"]);

const preview = buildFinancialLocalPreview(combined);
assert.equal(preview.schemaVersion, "management-financial-local-preview-v1");
assert.equal(preview.status, "PL_LOCAL_READY");
assert.equal(preview.availablePeriodCount, 2);
assert.equal(preview.sourceMissingMonthCount, 2);
assert.deepEqual(preview.missingMonthLabels, ["2024-10", "2024-11"]);
assert.equal(preview.importActionEnabled, false);

console.log(JSON.stringify({
  passed: true,
  r6: {
    normalizedRecordCount: r6.result.normalizedRecordCount,
    entityCandidateCount: r6.result.entityCandidateCount,
    missingMonthLabels: r6.result.missingMonthLabels,
  },
  r7: {
    normalizedRecordCount: r7.result.normalizedRecordCount,
    entityCandidateCount: r7.result.entityCandidateCount,
    missingMonthLabels: r7.result.missingMonthLabels,
  },
  combined: {
    availablePeriodCount: preview.availablePeriodCount,
    normalizedRecordCount: combined.normalizedRecordCount,
    importActionEnabled: preview.importActionEnabled,
  },
}, null, 2));
