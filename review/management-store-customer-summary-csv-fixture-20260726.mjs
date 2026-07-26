import assert from "node:assert/strict";
import { parseStoreCustomerSummaryCsvText } from "../portal/management-app/store-customer-summary-csv.js";

const header = "店舗,年月,来店件数,総合計売上,技術売上,店販売上,平均客単価";
const validRow = "BASSA ANNEX店,2026年01月,280,2928101,3218515,49492,10458";

const cases = [
  ["valid", `${header}\n${validRow}`, "STORE_CUSTOMER_LOCAL_READY"],
  ["header", `店舗,年月,来店件数\nBASSA ANNEX店,2026年01月,280`, "STORE_CUSTOMER_HEADER_MISMATCH"],
  ["duplicate", `${header}\n${validRow}\n${validRow}`, "STORE_CUSTOMER_DUPLICATE"],
  ["period", `${header}\nBASSA ANNEX店,2026-01,280,2928101,3218515,49492,10458`, "STORE_CUSTOMER_VALUE_INVALID"],
  ["negative", `${header}\nBASSA ANNEX店,2026年01月,-1,2928101,3218515,49492,10458`, "STORE_CUSTOMER_VALUE_INVALID"],
  ["decimal", `${header}\nBASSA ANNEX店,2026年01月,280.5,2928101,3218515,49492,10458`, "STORE_CUSTOMER_VALUE_INVALID"],
  ["shape", `${header}\nBASSA ANNEX店,2026年01月,280,2928101,3218515,49492`, "STORE_CUSTOMER_ROW_SHAPE_INVALID"],
];

for (const [name, source, category] of cases) {
  const result = parseStoreCustomerSummaryCsvText(source, { fileName: `${name}.csv`, fileBytes: source.length });
  assert.equal(result.category, category, name);
  assert.equal(result.mutationCount, 0, name);
  assert.equal(result.productionImportEnabled, false, name);
}

const ready = parseStoreCustomerSummaryCsvText(`${header}\n${validRow}`);
assert.equal(ready.rows[0].period, "2026-01");
assert.equal(ready.rows[0].visitCount, 280);
assert.deepEqual(Object.keys(ready.rows[0]).sort(), ["period", "storeName", "visitCount"]);
console.log(JSON.stringify({ passed: true, fixtures: cases.length, status: ready.category, rows: ready.rowCount }));
