import assert from "node:assert/strict";
import { parseStoreRepeatSummaryCsvText } from "../portal/management-app/store-repeat-summary-csv.js";

const header = [
  "store_name", "year_month", "再来_売上金額", "固定_売上金額", "新規_売上金額", "準固定_売上金額",
  "再来_来店客数", "固定_来店客数", "新規_来店客数", "準固定_来店客数",
].join(",");
const valid = `${header}\nBASSA 野方店,2025-01,226180,1447754,470952,268670,27,150,51,23\n`;

const receipt = parseStoreRepeatSummaryCsvText(valid, { fileName: "summary.csv", fileBytes: valid.length });
assert.equal(receipt.category, "STORE_REPEAT_LOCAL_READY");
assert.equal(receipt.valid, true);
assert.equal(receipt.rowCount, 1);
assert.equal(receipt.rows[0].totalCustomers, 251);
assert.equal(receipt.rows[0].repeatCustomers, 200);
assert.equal(Math.round(receipt.rows[0].repeatRatePercent * 100) / 100, 79.68);
assert.equal(receipt.mutationCount, 0);
assert.equal(receipt.productionImportEnabled, false);

assert.equal(parseStoreRepeatSummaryCsvText(valid.replace("year_month", "month")).category, "STORE_REPEAT_HEADER_MISMATCH");
assert.equal(parseStoreRepeatSummaryCsvText(`${header}\nBASSA 野方店,2025-01,1,2,3,4,5,6,7,8\nBASSA 野方店,2025-01,1,2,3,4,5,6,7,8\n`).category, "STORE_REPEAT_DUPLICATE");
assert.equal(parseStoreRepeatSummaryCsvText(`${header}\nBASSA 野方店,2025-13,1,2,3,4,5,6,7,8\n`).category, "STORE_REPEAT_VALUE_INVALID");
assert.equal(parseStoreRepeatSummaryCsvText(`${header}\nBASSA 野方店,2025-01,1,2,3,4,5,6,7\n`).category, "STORE_REPEAT_ROW_SHAPE_INVALID");

console.log(JSON.stringify({ passed: true, fixtures: 7, status: receipt.category, rows: receipt.rowCount }));
