import assert from "node:assert/strict";
import { buildStoreWorkforceMonthlySummaryCsvTemplate, parseStoreWorkforceMonthlySummaryCsvText } from "../portal/management-app/store-workforce-monthly-summary-csv.js";

const header = "store_name,year_month,resident_headcount,working_headcount";
const validCsv = [
  header,
  "store-a,2026-06,8,7",
  "store-b,2026-06,4,4",
].join("\n");

const parsed = parseStoreWorkforceMonthlySummaryCsvText(validCsv, { fileName: "store-workforce.csv", fileBytes: validCsv.length });
assert.equal(parsed.category, "STORE_WORKFORCE_MONTHLY_LOCAL_READY");
assert.equal(parsed.valid, true);
assert.equal(parsed.rowCount, 2);
assert.deepEqual(parsed.rows[0], { storeName: "store-a", period: "2026-06", residentHeadcount: 8, workingHeadcount: 7 });

const duplicate = parseStoreWorkforceMonthlySummaryCsvText([header, "store-a,2026-06,8,7", "store-a,2026-06,8,7"].join("\n"));
assert.equal(duplicate.category, "STORE_WORKFORCE_MONTHLY_DUPLICATE");

const mismatch = parseStoreWorkforceMonthlySummaryCsvText([header, "store-a,2026-06,7,8"].join("\n"));
assert.equal(mismatch.category, "STORE_WORKFORCE_MONTHLY_COUNT_MISMATCH");

const invalid = parseStoreWorkforceMonthlySummaryCsvText([header, "store-a,2026-13,8,7"].join("\n"));
assert.equal(invalid.category, "STORE_WORKFORCE_MONTHLY_VALUE_INVALID");

const wrongHeader = parseStoreWorkforceMonthlySummaryCsvText("store_name,year_month,working_headcount\nstore-a,2026-06,7");
assert.equal(wrongHeader.category, "STORE_WORKFORCE_MONTHLY_HEADER_MISMATCH");

const template = buildStoreWorkforceMonthlySummaryCsvTemplate([
  { storeName: "store-b", period: "2026-06" },
  { storeName: "store-a", period: "2026-05" },
  { storeName: "store-b", period: "2026-06" },
]);
assert.equal(template, `\uFEFF${header}\r\nstore-a,2026-05,,\r\nstore-b,2026-06,,\r\n`);
assert.equal(buildStoreWorkforceMonthlySummaryCsvTemplate([]).includes("store-example,2026-06,,"), true);

console.log(JSON.stringify({ passed: true, fixtures: 7, category: parsed.category, productionImportEnabled: parsed.productionImportEnabled }, null, 2));
