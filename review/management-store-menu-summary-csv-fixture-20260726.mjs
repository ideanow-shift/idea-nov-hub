import assert from "node:assert/strict";
import { parseStoreMenuSummaryCsvText } from "../portal/management-app/store-menu-summary-csv.js";

const header = "store_name,year_month,menu_category,menu_name,service_count,sales_yen";
const cases = [
  ["accepts aggregate menu rows", `${header}\n店舗A,2026-06,カット,カット,12,66000`, "STORE_MENU_LOCAL_READY"],
  ["rejects bad header", "store,month\nA,2026-06", "STORE_MENU_HEADER_MISMATCH"],
  ["rejects duplicate aggregate rows", `${header}\n店舗A,2026-06,カット,カット,1,5000\n店舗A,2026-06,カット,カット,1,5000`, "STORE_MENU_DUPLICATE"],
  ["rejects invalid amount", `${header}\n店舗A,2026-06,カット,カット,1,-1`, "STORE_MENU_VALUE_INVALID"],
  ["rejects personal-data header", "store_name,year_month,customer_name,menu_name,service_count,sales_yen\n店舗A,2026-06,氏名,カット,1,5000", "STORE_MENU_HEADER_MISMATCH"],
];
for (const [name, csv, category] of cases) assert.equal(parseStoreMenuSummaryCsvText(csv).category, category, name);
console.log(JSON.stringify({ passed: true, fixtures: cases.length }));
