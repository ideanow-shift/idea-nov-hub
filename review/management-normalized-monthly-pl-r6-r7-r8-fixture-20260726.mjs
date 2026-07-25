import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  buildFinancialLocalPreview,
  combineFinancialWorkbookResults,
  parseNormalizedMonthlyPlCsvText,
} from "../portal/management-app/financial-data-intake.js";

const downloadsDir = "C:\\Users\\bassa\\Downloads";

function parseLocalCsv(prefix) {
  const fileName = fs.readdirSync(downloadsDir).find((name) => name.startsWith(prefix) && name.endsWith(".csv"));
  assert.ok(fileName, `${prefix} source csv is required for this local fixture`);
  const sourcePath = path.join(downloadsDir, fileName);
  const stat = fs.statSync(sourcePath);
  const result = parseNormalizedMonthlyPlCsvText(fs.readFileSync(sourcePath, "utf8"), {
    fileName,
    fileBytes: stat.size,
    contentIdentity: `local-fixture-${prefix}`,
  });
  return { fileName, stat, result };
}

const r6 = parseLocalCsv("BASSA_R6_");
const r7 = parseLocalCsv("BASSA_R7_");
const r8 = parseLocalCsv("BASSA_R8_");

assert.equal(r6.result.status, "PL_LOCAL_READY");
assert.equal(r6.result.normalizedRecordCount, 10088);
assert.equal(r6.result.entityCandidateCount, 21);
assert.equal(r6.result.actualMonthCount, 10);
assert.deepEqual(r6.result.missingMonthLabels, ["2024-10", "2024-11"]);

assert.equal(r7.result.status, "PL_LOCAL_READY");
assert.equal(r7.result.normalizedRecordCount, 12071);
assert.equal(r7.result.entityCandidateCount, 19);
assert.equal(r7.result.actualMonthCount, 12);
assert.deepEqual(r7.result.missingMonthLabels, []);

assert.equal(r8.result.status, "PL_LOCAL_READY");
assert.equal(r8.result.normalizedRecordCount, 6754);
assert.equal(r8.result.entityCandidateCount, 21);
assert.equal(r8.result.expectedMonthCount, 12);
assert.equal(r8.result.actualMonthCount, 6);
assert.deepEqual(r8.result.missingMonthLabels, [
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
]);
assert.deepEqual(r8.result.entityPreviewRows[0].monthLabels, [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
]);

const combined = combineFinancialWorkbookResults([r6.result, r7.result, r8.result], "PL");
assert.equal(combined.status, "PL_LOCAL_READY");
assert.equal(combined.normalizedRecordCount, 28913);
assert.equal(combined.duplicateFileCount, 0);
assert.equal(combined.duplicateEntityPeriodCount, 0);
assert.deepEqual(combined.missingMonthLabels, [
  "2024-10",
  "2024-11",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
]);

const preview = buildFinancialLocalPreview(combined);
assert.equal(preview.schemaVersion, "management-financial-local-preview-v1");
assert.equal(preview.status, "PL_LOCAL_READY");
assert.equal(preview.availablePeriodCount, 3);
assert.equal(preview.sourceMissingMonthCount, 8);
assert.equal(preview.importActionEnabled, false);

console.log(JSON.stringify({
  passed: true,
  periods: 3,
  records: {
    r6: r6.result.normalizedRecordCount,
    r7: r7.result.normalizedRecordCount,
    r8: r8.result.normalizedRecordCount,
    combined: combined.normalizedRecordCount,
  },
  entityCandidates: {
    r6: r6.result.entityCandidateCount,
    r7: r7.result.entityCandidateCount,
    r8: r8.result.entityCandidateCount,
  },
  missingMonthLabels: combined.missingMonthLabels,
  productionImportEnabled: preview.importActionEnabled,
}, null, 2));
