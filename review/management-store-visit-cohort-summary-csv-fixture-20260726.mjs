import assert from "node:assert/strict";
import { parseStoreVisitCohortSummaryCsvText } from "../portal/management-app/store-visit-cohort-summary-csv.js";

const header = "store_name,year_month,technical_customer_count,total_visit_count,new_visit_count,second_visit_count,third_visit_count,fixed_visit_count";
const parse = (row) => parseStoreVisitCohortSummaryCsvText(`${header}\n${row}\n`, { fileName: "fixture.csv", fileBytes: 100 });

const cases = [
  ["valid aggregate-only row", () => {
    const result = parse("BASSA Sample,2026-06,80,100,20,15,10,55");
    assert.equal(result.category, "STORE_VISIT_COHORT_LOCAL_READY");
    assert.equal(result.rowCount, 1);
    assert.equal(result.rows[0].technicalCustomerCount, 80);
    assert.equal(result.mutationCount, 0);
    assert.equal(result.productionImportEnabled, false);
  }],
  ["header mismatch", () => assert.equal(parseStoreVisitCohortSummaryCsvText("store,period\nA,2026-06\n").category, "STORE_VISIT_COHORT_HEADER_MISMATCH")],
  ["duplicate store period", () => assert.equal(parseStoreVisitCohortSummaryCsvText(`${header}\nA,2026-06,1,1,1,0,0,0\nA,2026-06,1,1,1,0,0,0\n`).category, "STORE_VISIT_COHORT_DUPLICATE")],
  ["technical count cannot exceed total", () => assert.equal(parse("A,2026-06,101,100,20,15,10,55").category, "STORE_VISIT_COHORT_TOTAL_MISMATCH")],
  ["cohort total must match visits", () => assert.equal(parse("A,2026-06,80,100,20,15,10,54").category, "STORE_VISIT_COHORT_TOTAL_MISMATCH")],
  ["invalid month rejected", () => assert.equal(parse("A,2026-13,1,1,1,0,0,0").category, "STORE_VISIT_COHORT_VALUE_INVALID")],
  ["negative and decimal counts rejected", () => {
    assert.equal(parse("A,2026-06,-1,1,1,0,0,0").category, "STORE_VISIT_COHORT_VALUE_INVALID");
    assert.equal(parse("A,2026-06,1.5,2,1,1,0,0").category, "STORE_VISIT_COHORT_VALUE_INVALID");
  }],
];

let passed = 0;
for (const [name, run] of cases) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`management store visit cohort summary fixtures: ${passed}/${cases.length} passed`);
