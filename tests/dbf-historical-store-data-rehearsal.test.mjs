import assert from "node:assert/strict";
import test from "node:test";
import { HISTORICAL_HEADER, prepareHistoricalStoreData } from "../scripts/dbf-historical-store-data-rehearsal.mjs";

const stores = Array.from({ length: 20 }, (_, index) => `store-${index + 1}`);
const csv = (...rows) => [HISTORICAL_HEADER.join(","), ...rows].join("\n");
const row = (month, store, metric, value, status = "confirmed") => `${month},company-1,${store},${metric},${value},v1,${status}`;

test("splits a valid historical source into the fixed 24 monthly batches", () => {
  const result = prepareHistoricalStoreData({ csvText: csv(row("2024-07", stores[0], "TOTAL_SALES", 100)), officialStores: stores });
  assert.equal(result.ready, true);
  assert.equal(result.monthlyFiles.length, 24);
  assert.equal(result.matrix.length, 480);
  assert.deepEqual(result.matrix[0].missingMetricCodes.includes("TECHNICAL_SALES"), true);
  assert.equal(result.matrix[0].confirmedCount, 1);
  assert.equal(result.matrix[0].provisionalCount, 0);
  assert.equal(result.matrix[0].missingCount, 18);
  assert.equal(result.matrix[0].budgetAvailable, false);
  assert.equal(result.matrix[0].yoyReady, false);
  assert.equal(result.matrix[0].ytdReady, false);
  assert.equal(result.matrix[0].trendReady, false);
});

test("reports budget availability without treating it as an actual metric", () => {
  const result = prepareHistoricalStoreData({ csvText: csv(row("2024-07", stores[0], "TOTAL_SALES", 100)), officialStores: stores, budgetScopes: [`2024-07\u0000${stores[0]}`] });
  assert.equal(result.matrix[0].budgetAvailable, true);
  assert.equal(result.matrix[0].presentMetricCount, 1);
});

test("never fills missing metrics with zero", () => {
  const result = prepareHistoricalStoreData({ csvText: csv(row("2024-07", stores[0], "TOTAL_SALES", 100)), officialStores: stores });
  assert.equal(result.monthlyFiles[0].content.includes("TECHNICAL_SALES,0"), false);
  assert.equal(result.rows, 1);
});

test("blocks duplicate source grain and protected active fact collisions", () => {
  const source = row("2026-06", stores[0], "TOTAL_SALES", 100);
  const result = prepareHistoricalStoreData({ csvText: csv(source, source), officialStores: stores, protectedGrains: [`2026-06\u0000company-1\u0000${stores[0]}\u0000TOTAL_SALES`] });
  assert.equal(result.ready, false);
  assert.equal(result.monthlyFiles.length, 0);
  assert.ok(result.issues.some((item) => item.code === "DUPLICATE_GRAIN_IN_SOURCE"));
  assert.ok(result.issues.some((item) => item.code === "ACTIVE_FACT_COLLISION_CORRECTION_REQUIRED"));
});

test("rejects unknown stores, invalid metrics, rates and confirmation status", () => {
  const result = prepareHistoricalStoreData({ csvText: csv(
    row("2024-07", "unknown", "TOTAL_SALES", 1),
    row("2024-07", stores[0], "UNKNOWN", 1),
    row("2024-07", stores[0], "TOTAL_REPEAT_RATE", 80),
    row("2024-07", stores[0], "TOTAL_SALES", 1, "draft"),
  ), officialStores: stores });
  assert.equal(result.ready, false);
  assert.deepEqual(new Set(result.issues.map((item) => item.code)), new Set(["STORE_MAPPING_UNRESOLVED", "METRIC_CODE_INVALID", "RATE_OUT_OF_RANGE_0_TO_1", "CONFIRMATION_STATUS_INVALID"]));
});

test("reports consistency warnings without inventing or correcting values", () => {
  const result = prepareHistoricalStoreData({ csvText: csv(
    row("2024-07", stores[0], "TOTAL_SALES", 100), row("2024-07", stores[0], "TECHNICAL_SALES", 50),
    row("2024-07", stores[0], "RETAIL_SALES", 20), row("2024-07", stores[0], "MID_SALES", 10), row("2024-07", stores[0], "EC_ALLOCATED_SALES", 5),
    row("2024-07", stores[0], "TOTAL_CUSTOMERS", 10), row("2024-07", stores[0], "NEW_CUSTOMERS", 3), row("2024-07", stores[0], "EXISTING_CUSTOMERS", 6),
  ), officialStores: stores });
  assert.equal(result.ready, true);
  assert.ok(result.issues.some((item) => item.code === "TOTAL_SALES_COMPONENT_MISMATCH"));
  assert.ok(result.issues.some((item) => item.code === "TOTAL_CUSTOMERS_COMPONENT_MISMATCH"));
});
