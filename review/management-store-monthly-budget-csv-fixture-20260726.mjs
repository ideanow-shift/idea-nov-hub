import assert from "node:assert/strict";
import { parseStoreMonthlyBudgetCsvText } from "../portal/management-app/store-monthly-budget-csv.js";

const header = "period,corporation,store,total_sales_plan,profit_plan";
const valid = [
  header,
  "2026-06,ALBERO,BASSA新所沢店,5000000,NOT_IN_SOURCE",
  "2026-06,FILM,BASSA久米川店,6200000,850000",
].join("\n");
const parsed = parseStoreMonthlyBudgetCsvText(valid, { fileName: "store-monthly-budget.csv", fileBytes: valid.length });
assert.equal(parsed.category, "STORE_MONTHLY_BUDGET_LOCAL_READY");
assert.equal(parsed.valid, true);
assert.equal(parsed.rowCount, 2);
assert.equal(parsed.rows[0].salesPlanYen, 5000000);
assert.equal(parsed.rows[0].profitPlanYen, null);

const duplicate = parseStoreMonthlyBudgetCsvText([header, "2026-06,ALBERO,BASSA新所沢店,5000000,NOT_IN_SOURCE", "2026-06,ALBERO,BASSA新所沢店,5100000,NOT_IN_SOURCE"].join("\n"));
assert.equal(duplicate.category, "STORE_MONTHLY_BUDGET_DUPLICATE");

const invalidPlan = parseStoreMonthlyBudgetCsvText([header, "2026-06,ALBERO,BASSA新所沢店,0,NOT_IN_SOURCE"].join("\n"));
assert.equal(invalidPlan.category, "STORE_MONTHLY_BUDGET_VALUE_INVALID");

const invalidHeader = parseStoreMonthlyBudgetCsvText("period,corporation,store,total_sales_plan\n2026-06,ALBERO,BASSA新所沢店,5000000");
assert.equal(invalidHeader.category, "STORE_MONTHLY_BUDGET_HEADER_MISMATCH");

console.log(JSON.stringify({ passed: true, fixtures: 4, category: parsed.category, productionImportEnabled: parsed.productionImportEnabled }));
