import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS,
  STORE_MONTHLY_SHEET_2026_PROFILE,
  STORE_MONTHLY_SHEET_2026_ROW_PLAN,
  STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM,
  STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS,
  prepareStoreMonthlySheet2026Preflight,
} from "../portal/management-app/dbf-store-monthly-sheet-2026-preflight.js";

function syntheticGrid() {
  const grid = Array.from({ length: STORE_MONTHLY_SHEET_2026_PROFILE.gridRows }, () => Array(STORE_MONTHLY_SHEET_2026_PROFILE.gridColumns).fill(""));
  grid[0] = ["2026年6月", "直営店計", ...STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.map((item) => item.sourceHeader), "グループ計"];
  grid[54][0] = "2026年 元データ";
  grid[79][0] = "2025年 元データ";
  for (const plan of Object.values(STORE_MONTHLY_SHEET_2026_ROW_PLAN)) {
    for (const metric of plan) {
      grid[metric.sourceRowNumber - 1][0] = metric.sourceLabel;
      for (const mapping of STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS) {
        const value = metric.metricKind === "rate" ? "25%" : metric.metricKind === "quantity" ? 12 : 1200;
        grid[metric.sourceRowNumber - 1][mapping.sourceColumnNumber - 1] = value;
      }
      grid[metric.sourceRowNumber - 1][1] = 999999;
      grid[metric.sourceRowNumber - 1][22] = 999999;
    }
  }
  return grid;
}

function serverSideEvidence() {
  return {
    mappingReceipts: STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.map((request, index) => ({
      ...request,
      sourceSystem: STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM,
      status: "active",
      verification: "server_side",
      receiptRef: `synthetic-receipt-${index + 1}`,
    })),
    historicalOperatorEvidence: {
      periods: ["2025-06", "2026-06"].map((fiscalMonth) => ({
        sourceSystem: STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM,
        fiscalMonth,
        status: "approved",
        verification: "server_side",
        approvalReference: `synthetic-operator-evidence-${fiscalMonth}`,
        storeKeys: STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.map((item) => item.storeKey),
      })),
    },
  };
}

function prepare(grid = syntheticGrid(), evidence = serverSideEvidence()) {
  return prepareStoreMonthlySheet2026Preflight({
    grid,
    sourceSheetName: STORE_MONTHLY_SHEET_2026_PROFILE.sheetName,
    actualConfirmationStatus: "confirmed",
    budgetConfirmationStatus: "provisional",
    ...evidence,
  });
}

test("fixed profile has 20 source stores, six company source keys, and no canonical IDs", () => {
  assert.equal(STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.length, 20);
  assert.equal(new Set(STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.map((item) => item.companyKey)).size, 6);
  assert.equal(STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.filter((item) => item.entityType === "company").length, 6);
  assert.equal(STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.filter((item) => item.entityType === "store").length, 20);
  for (const mapping of STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS) assert.equal(Object.hasOwn(mapping, "canonicalId"), false);
  const ekoda = STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.find((item) => item.sourceHeader === "江古田（FC）");
  assert.equal(ekoda.companyKey, "0001");
  assert.equal(Object.hasOwn(ekoda, "operatingModel"), false);
});

test("synthetic source normalizes the approved 11 Actual and three Budget metrics only", () => {
  const result = prepare();
  assert.equal(result.state, "READY_FOR_SERVER_VALIDATION");
  assert.equal(result.actual2025Rows.length, 220);
  assert.equal(result.actual2026Rows.length, 220);
  assert.equal(result.budget2026Rows.length, 60);
  assert.equal(result.unavailable.length, 0);
  assert.equal(result.actual2026Rows.find((row) => row.metricCode === "NEW_REPEAT_RATE").value, 0.25);
  assert.equal(result.actual2026Rows.find((row) => row.metricCode === "TOTAL_CUSTOMERS").value, 12);
  assert.equal(result.actual2026Rows.find((row) => row.metricCode === "TOTAL_SALES").confirmationStatus, "confirmed");
  assert.equal(result.budget2026Rows.find((row) => row.metricCode === "TOTAL_SALES").confirmationStatus, "provisional");
  assert.equal(result.actual2026Rows.some((row) => ["MID_SALES", "EC_ALLOCATED_SALES", "OPERATING_PROFIT"].includes(row.metricCode)), false);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.databaseAccessed, false);
});

test("blank source cells become unavailable receipts and never synthetic zero facts", () => {
  const grid = syntheticGrid();
  const metric = STORE_MONTHLY_SHEET_2026_ROW_PLAN.actual2026.find((item) => item.metricCode === "NEW_REPEAT_RATE");
  const mapping = STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS[0];
  grid[metric.sourceRowNumber - 1][mapping.sourceColumnNumber - 1] = "";
  const result = prepare(grid);
  assert.equal(result.state, "BLOCKED_SOURCE_DATA_MISSING");
  assert.equal(result.unavailable.length, 1);
  assert.deepEqual(result.unavailable[0], {
    factKind: "store_operating_result",
    fiscalMonth: "2026-06",
    metricCode: "NEW_REPEAT_RATE",
    companyKey: mapping.companyKey,
    storeKey: mapping.storeKey,
    sourceRowNumber: metric.sourceRowNumber,
    sourceColumnNumber: mapping.sourceColumnNumber,
    reasonCode: "SOURCE_CELL_BLANK",
  });
  assert.equal(result.actual2026Rows.some((row) => row.storeKey === mapping.storeKey && row.metricCode === metric.metricCode), false);
  assert.equal(result.actual2026Rows.some((row) => row.storeKey === mapping.storeKey && row.metricCode === metric.metricCode && row.value === 0), false);
});

test("header, row-label, value, status, and dimensional failures fail closed", () => {
  const reordered = syntheticGrid();
  [reordered[0][2], reordered[0][3]] = [reordered[0][3], reordered[0][2]];
  assert.throws(() => prepare(reordered), /SHEET_STORE_HEADERS_INVALID/u);
  const invalidAggregate = syntheticGrid();
  invalidAggregate[0][1] = "集計";
  assert.throws(() => prepare(invalidAggregate), /SHEET_AGGREGATE_HEADER_INVALID/u);
  const invalidLabel = syntheticGrid();
  invalidLabel[54][0] = "unknown";
  assert.throws(() => prepare(invalidLabel), /SHEET_SOURCE_ROW_LABEL_INVALID:55/u);
  const invalidRate = syntheticGrid();
  invalidRate[63][2] = "25";
  assert.throws(() => prepare(invalidRate), /SHEET_RATE_VALUE_INVALID:64:3/u);
  assert.throws(() => prepareStoreMonthlySheet2026Preflight({ grid: syntheticGrid(), sourceSheetName: STORE_MONTHLY_SHEET_2026_PROFILE.sheetName, actualConfirmationStatus: "confirmed" }), /BUDGET_CONFIRMATION_STATUS_INVALID/u);
  assert.throws(() => prepareStoreMonthlySheet2026Preflight({ grid: syntheticGrid(), sourceSheetName: "6月", actualConfirmationStatus: "confirmed", budgetConfirmationStatus: "confirmed" }), /SOURCE_SHEET_NAME_INVALID/u);
  assert.throws(() => prepareStoreMonthlySheet2026Preflight({ grid: syntheticGrid().slice(0, 100), sourceSheetName: STORE_MONTHLY_SHEET_2026_PROFILE.sheetName, actualConfirmationStatus: "confirmed", budgetConfirmationStatus: "confirmed" }), /SHEET_GRID_ROW_COUNT_INVALID/u);
});

test("source mappings and historical operator evidence are separate, server-side gates", () => {
  const noEvidence = prepareStoreMonthlySheet2026Preflight({
    grid: syntheticGrid(),
    sourceSheetName: STORE_MONTHLY_SHEET_2026_PROFILE.sheetName,
    actualConfirmationStatus: "confirmed",
    budgetConfirmationStatus: "confirmed",
  });
  assert.equal(noEvidence.state, "BLOCKED_MAPPING_RECEIPTS");
  assert.equal(noEvidence.mappingGate.missing.length, 26);
  const onlyMappings = prepareStoreMonthlySheet2026Preflight({
    grid: syntheticGrid(),
    sourceSheetName: STORE_MONTHLY_SHEET_2026_PROFILE.sheetName,
    actualConfirmationStatus: "confirmed",
    budgetConfirmationStatus: "confirmed",
    mappingReceipts: serverSideEvidence().mappingReceipts,
  });
  assert.equal(onlyMappings.state, "BLOCKED_HISTORICAL_OPERATOR_EVIDENCE");
  assert.deepEqual(onlyMappings.historicalOperatorGate.missingPeriods, ["2025-06", "2026-06"]);
  const duplicated = serverSideEvidence();
  duplicated.mappingReceipts.push({ ...duplicated.mappingReceipts[0], receiptRef: "synthetic-duplicate" });
  const duplicateReceipt = prepare(syntheticGrid(), duplicated);
  assert.equal(duplicateReceipt.state, "BLOCKED_MAPPING_RECEIPTS");
  assert.equal(duplicateReceipt.mappingGate.duplicate.length, 1);
});

test("preflight module is pure and has no database or browser persistence dependency", () => {
  const source = fs.readFileSync(new URL("../portal/management-app/dbf-store-monthly-sheet-2026-preflight.js", import.meta.url), "utf8");
  for (const forbidden of ["fetch(", "supabase", "localStorage", "indexedDB", "DBF_IMPORT_RUNTIME", "XMLHttpRequest"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
