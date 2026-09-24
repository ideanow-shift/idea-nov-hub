import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ddl = readFileSync(
  new URL("../docs/store_operations_management/production_integration/actual-labor-fte-metric-definition-v1.review-only.sql", import.meta.url),
  "utf8"
);
const adapter = readFileSync(
  new URL("../portal/store-sales/adapters/dbf-store-monthly.js", import.meta.url),
  "utf8"
);
const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");

test("review-only metric definition preserves existing codes and always rolls back", () => {
  for (const code of [
    "TOTAL_SALES", "RETAIL_PURCHASE_RATE", "RETAIL_PURCHASE_CUSTOMER_VISITS",
    "OPERATING_PROFIT", "ACTUAL_LABOR_FTE"
  ]) assert.match(ddl, new RegExp(`'${code}'::text`));
  assert.match(ddl, /ACTUAL_LABOR_FTE_173_76_V1/u);
  assert.match(ddl, /'quantity'/u);
  assert.match(ddl, /on conflict \(metric_code, definition_version\) do nothing/iu);
  assert.match(ddl, /rollback;\s*$/iu);
  assert.doesNotMatch(ddl, /commit\s*;/iu);
});

test("read projection distinguishes FTE, formal zero, and missing state", () => {
  assert.match(adapter, /ACTUAL_LABOR_FTE: \["actualLaborFte", "実労働FTE（換算人数）", "fte"\]/u);
  assert.match(adapter, /Number\(value\)\.toFixed\(2\).*人相当/u);
  assert.match(app, /actualLaborFte: "実労働FTE（換算人数）"/u);
  assert.match(app, /実勤怠がない月は準備中/u);
  assert.doesNotMatch(app, /staffCount: "稼働スタッフ数"/u);
});
