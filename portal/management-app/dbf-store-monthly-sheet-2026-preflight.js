export const STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM = "store_operations_monthly_sheet_2026_v1";

export const STORE_MONTHLY_SHEET_2026_PROFILE = Object.freeze({
  schemaVersion: "store-monthly-sheet-2026-preflight-v1",
  fiscalMonth: "2026-06",
  sheetName: "6月 ",
  gridRows: 101,
  gridColumns: 23,
  headerRowNumber: 1,
  itemColumnNumber: 1,
  directAggregateHeader: "直営店計",
  groupAggregateHeader: "グループ計",
});

const sourceStores = [
  ["所沢", "tokorozawa", "0001"],
  ["アネックス", "annex", "0001"],
  ["野方", "nogata", "0001"],
  ["石神井公園", "shakujiikoen", "0001"],
  ["池袋", "ikebukuro", "0001"],
  ["キャラハーフ", "kyarahalf", "0001"],
  ["保谷", "hoya", "0001"],
  ["高田馬場", "takadanobaba", "0001"],
  ["下井草", "shimoigusa", "0001"],
  ["上石神井", "kamishakujii", "0001"],
  ["東大和", "higashiyamato", "0001"],
  ["立川", "tachikawa", "0001"],
  ["久米川（FC）", "kumegawa", "0003"],
  ["東久留米（FC）", "higashikurume", "0006"],
  ["花小金井（FC）", "hanakoganei", "0005"],
  ["新所沢（FC）", "shintokorozawa", "0002"],
  ["鷺ノ宮（FC）", "saginomiya", "0002"],
  ["ロアネ（FC）", "roane", "0002"],
  ["国分寺（FC）", "kokubunnji", "0004"],
  ["江古田（FC）", "ekoda", "0001"],
];

export const STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS = Object.freeze(sourceStores.map(([sourceHeader, storeKey, companyKey], index) => Object.freeze({
  sourceHeader,
  storeKey,
  companyKey,
  sourceColumnNumber: index + 3,
})));

const sourceCompanyKeys = Object.freeze([...new Set(STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.map((item) => item.companyKey))].sort());
const sourceStoreKeys = Object.freeze(STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.map((item) => item.storeKey));

export const STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS = Object.freeze([
  ...sourceCompanyKeys.map((sourceKey) => Object.freeze({ entityType: "company", sourceKey })),
  ...sourceStoreKeys.map((sourceKey) => Object.freeze({ entityType: "store", sourceKey })),
]);

const ACTUAL_METRICS = Object.freeze([
  Object.freeze({ metricCode: "TOTAL_SALES", metricKind: "amount", sourceLabel: "総売上" }),
  Object.freeze({ metricCode: "TECHNICAL_SALES", metricKind: "amount", sourceLabel: "技術売上" }),
  Object.freeze({ metricCode: "RETAIL_SALES", metricKind: "amount", sourceLabel: "商品売上" }),
  Object.freeze({ metricCode: "TOTAL_UNIT_PRICE", metricKind: "amount", sourceLabel: "総単価" }),
  Object.freeze({ metricCode: "TECHNICAL_UNIT_PRICE", metricKind: "amount", sourceLabel: "技術単価" }),
  Object.freeze({ metricCode: "TOTAL_CUSTOMERS", metricKind: "quantity", sourceLabel: "総客数" }),
  Object.freeze({ metricCode: "RETAIL_PURCHASE_RATE", metricKind: "rate", sourceLabel: "店販購買客比率" }),
  Object.freeze({ metricCode: "TOTAL_PRODUCTIVITY", metricKind: "amount", sourceLabel: "総生産性" }),
  Object.freeze({ metricCode: "TECHNICAL_PRODUCTIVITY", metricKind: "amount", sourceLabel: "技術生産性" }),
  Object.freeze({ metricCode: "NEW_CUSTOMERS", metricKind: "quantity", sourceLabel: "新規客数" }),
  Object.freeze({ metricCode: "NEW_REPEAT_RATE", metricKind: "rate", sourceLabel: "新規リピート" }),
]);

const BUDGET_METRICS = Object.freeze([
  Object.freeze({ metricCode: "TOTAL_SALES", metricKind: "amount", sourceRowNumber: 3, sourceLabel: "予算値" }),
  Object.freeze({ metricCode: "TECHNICAL_SALES", metricKind: "amount", sourceRowNumber: 77, sourceLabel: "技術売上予算" }),
  Object.freeze({ metricCode: "RETAIL_SALES", metricKind: "amount", sourceRowNumber: 78, sourceLabel: "商品売上予算" }),
]);

const ACTUAL_SOURCE_ROW_OFFSETS = Object.freeze([0, 1, 2, 3, 4, 5, 8, 9, 10, 12, 16]);

function actualRowPlan(fiscalMonth, firstSourceRowNumber) {
  return Object.freeze(ACTUAL_METRICS.map((metric, index) => Object.freeze({
    ...metric,
    fiscalMonth,
    sourceRowNumber: firstSourceRowNumber + ACTUAL_SOURCE_ROW_OFFSETS[index],
    factKind: "store_operating_result",
  })));
}

export const STORE_MONTHLY_SHEET_2026_ROW_PLAN = Object.freeze({
  actual2026: actualRowPlan("2026-06", 56),
  actual2025: actualRowPlan("2025-06", 81),
  budget2026: Object.freeze(BUDGET_METRICS.map((metric) => Object.freeze({
    ...metric,
    fiscalMonth: "2026-06",
    factKind: "budget",
  }))),
});

const REQUIRED_SOURCE_LABELS = Object.freeze([
  Object.freeze({ sourceRowNumber: 55, sourceLabel: "2026年 元データ" }),
  Object.freeze({ sourceRowNumber: 80, sourceLabel: "2025年 元データ" }),
  ...STORE_MONTHLY_SHEET_2026_ROW_PLAN.actual2026,
  ...STORE_MONTHLY_SHEET_2026_ROW_PLAN.actual2025,
  ...STORE_MONTHLY_SHEET_2026_ROW_PLAN.budget2026,
]);

const NUMBER_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

function normalizedText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function confirmationStatus(value, field) {
  const status = normalizedText(value);
  if (!new Set(["provisional", "confirmed"]).has(status)) throw new Error(`${field}_INVALID`);
  return status;
}

function normalizeGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== STORE_MONTHLY_SHEET_2026_PROFILE.gridRows) {
    throw new Error("SHEET_GRID_ROW_COUNT_INVALID");
  }
  return Object.freeze(grid.map((sourceRow, index) => {
    if (!Array.isArray(sourceRow) || sourceRow.length > STORE_MONTHLY_SHEET_2026_PROFILE.gridColumns) {
      throw new Error(`SHEET_GRID_COLUMN_COUNT_INVALID:${index + 1}`);
    }
    return Object.freeze([...sourceRow, ...Array(STORE_MONTHLY_SHEET_2026_PROFILE.gridColumns - sourceRow.length).fill("")]);
  }));
}

function assertExactSourceProfile(grid) {
  const header = grid[STORE_MONTHLY_SHEET_2026_PROFILE.headerRowNumber - 1];
  if (normalizedText(header[0]) !== "2026年6月") throw new Error("SHEET_TITLE_INVALID");
  if (normalizedText(header[1]) !== STORE_MONTHLY_SHEET_2026_PROFILE.directAggregateHeader
    || normalizedText(header[header.length - 1]) !== STORE_MONTHLY_SHEET_2026_PROFILE.groupAggregateHeader) {
    throw new Error("SHEET_AGGREGATE_HEADER_INVALID");
  }
  const expectedHeaders = STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS.map((item) => normalizedText(item.sourceHeader));
  const actualHeaders = header.slice(2, header.length - 1).map(normalizedText);
  if (actualHeaders.length !== expectedHeaders.length || actualHeaders.some((value, index) => value !== expectedHeaders[index])) {
    throw new Error("SHEET_STORE_HEADERS_INVALID");
  }
  for (const item of REQUIRED_SOURCE_LABELS) {
    if (normalizedText(grid[item.sourceRowNumber - 1][0]) !== normalizedText(item.sourceLabel)) {
      throw new Error(`SHEET_SOURCE_ROW_LABEL_INVALID:${item.sourceRowNumber}`);
    }
  }
}

function normalizeMetricValue(value, metricKind, sourceRowNumber, sourceColumnNumber) {
  if (value === null || value === undefined || normalizedText(value) === "") return null;
  const raw = typeof value === "number" ? String(value) : normalizedText(value);
  const percentage = metricKind === "rate" && raw.endsWith("%");
  const numericText = (percentage ? raw.slice(0, -1) : raw).replaceAll(",", "").trim();
  if (!NUMBER_RE.test(numericText)) throw new Error(`SHEET_VALUE_INVALID:${sourceRowNumber}:${sourceColumnNumber}`);
  let result = Number(numericText);
  if (!Number.isFinite(result)) throw new Error(`SHEET_VALUE_INVALID:${sourceRowNumber}:${sourceColumnNumber}`);
  if (metricKind === "rate") {
    if (percentage) result /= 100;
    if (result < 0 || result > 1) throw new Error(`SHEET_RATE_VALUE_INVALID:${sourceRowNumber}:${sourceColumnNumber}`);
  }
  if (metricKind === "quantity" && (!Number.isInteger(result) || result < 0)) {
    throw new Error(`SHEET_QUANTITY_VALUE_INVALID:${sourceRowNumber}:${sourceColumnNumber}`);
  }
  return result;
}

function unavailableReceipt(plan, mapping) {
  return Object.freeze({
    factKind: plan.factKind,
    fiscalMonth: plan.fiscalMonth,
    metricCode: plan.metricCode,
    companyKey: mapping.companyKey,
    storeKey: mapping.storeKey,
    sourceRowNumber: plan.sourceRowNumber,
    sourceColumnNumber: mapping.sourceColumnNumber,
    reasonCode: "SOURCE_CELL_BLANK",
  });
}

function normalizePlan(grid, plan, status) {
  const rows = [];
  const unavailable = [];
  for (const metric of plan) {
    for (const mapping of STORE_MONTHLY_SHEET_2026_STORE_MAPPINGS) {
      const value = normalizeMetricValue(
        grid[metric.sourceRowNumber - 1][mapping.sourceColumnNumber - 1],
        metric.metricKind,
        metric.sourceRowNumber,
        mapping.sourceColumnNumber,
      );
      if (value === null) {
        unavailable.push(unavailableReceipt(metric, mapping));
        continue;
      }
      const base = {
        fiscalMonth: metric.fiscalMonth,
        companyKey: mapping.companyKey,
        storeKey: mapping.storeKey,
        metricCode: metric.metricCode,
        sourceRowNumber: metric.sourceRowNumber,
        sourceColumnNumber: mapping.sourceColumnNumber,
      };
      if (metric.factKind === "budget") {
        rows.push(Object.freeze({
          ...base,
          scenarioCode: "BASE",
          accountCode: null,
          amount: value,
          confirmationStatus: status,
        }));
      } else {
        rows.push(Object.freeze({
          ...base,
          value,
          definitionVersion: "v1",
          confirmationStatus: status,
        }));
      }
    }
  }
  return Object.freeze({ rows: Object.freeze(rows), unavailable: Object.freeze(unavailable) });
}

function receiptKey(entityType, sourceKey) {
  return `${entityType}\u0000${sourceKey}`;
}

function mappingReceiptGate(receipts) {
  const receiptCounts = new Map();
  for (const receipt of Array.isArray(receipts) ? receipts : []) {
    if (receipt?.sourceSystem !== STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM
      || receipt?.status !== "active"
      || receipt?.verification !== "server_side"
      || !normalizedText(receipt?.receiptRef)) continue;
    const key = receiptKey(receipt.entityType, receipt.sourceKey);
    receiptCounts.set(key, (receiptCounts.get(key) || 0) + 1);
  }
  const missing = STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.filter((request) => receiptCounts.get(receiptKey(request.entityType, request.sourceKey)) !== 1);
  const duplicate = STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.filter((request) => (receiptCounts.get(receiptKey(request.entityType, request.sourceKey)) || 0) > 1);
  const verifiedCount = STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.filter((request) => receiptCounts.get(receiptKey(request.entityType, request.sourceKey)) === 1).length;
  return Object.freeze({
    requiredCount: STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS.length,
    verifiedCount,
    missing: Object.freeze(missing.map((item) => Object.freeze({ ...item }))),
    duplicate: Object.freeze(duplicate.map((item) => Object.freeze({ ...item }))),
    satisfied: missing.length === 0 && duplicate.length === 0,
  });
}

function historicalOperatorEvidenceGate(evidence) {
  const periods = ["2025-06", "2026-06"];
  const expectedStores = new Set(sourceStoreKeys);
  const records = Array.isArray(evidence?.periods) ? evidence.periods : [];
  const approved = new Map();
  for (const record of records) {
    if (record?.sourceSystem !== STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM
      || record?.status !== "approved"
      || record?.verification !== "server_side"
      || !normalizedText(record?.approvalReference)) continue;
    const storeKeys = Array.isArray(record?.storeKeys) ? record.storeKeys : [];
    const validStores = storeKeys.length === expectedStores.size && storeKeys.every((storeKey) => expectedStores.has(storeKey));
    if (!validStores || approved.has(record.fiscalMonth)) {
      approved.set(record.fiscalMonth, null);
      continue;
    }
    approved.set(record.fiscalMonth, record);
  }
  const missingPeriods = periods.filter((fiscalMonth) => !approved.get(fiscalMonth));
  return Object.freeze({
    requiredPeriods: Object.freeze(periods),
    approvedPeriods: Object.freeze(periods.filter((fiscalMonth) => approved.get(fiscalMonth))),
    missingPeriods: Object.freeze(missingPeriods),
    satisfied: missingPeriods.length === 0,
  });
}

export function prepareStoreMonthlySheet2026Preflight({
  grid,
  sourceSheetName,
  actualConfirmationStatus,
  budgetConfirmationStatus,
  mappingReceipts = [],
  historicalOperatorEvidence = null,
} = {}) {
  if (sourceSheetName !== STORE_MONTHLY_SHEET_2026_PROFILE.sheetName) throw new Error("SOURCE_SHEET_NAME_INVALID");
  const normalizedGrid = normalizeGrid(grid);
  assertExactSourceProfile(normalizedGrid);
  const actualStatus = confirmationStatus(actualConfirmationStatus, "ACTUAL_CONFIRMATION_STATUS");
  const budgetStatus = confirmationStatus(budgetConfirmationStatus, "BUDGET_CONFIRMATION_STATUS");
  const actual2025 = normalizePlan(normalizedGrid, STORE_MONTHLY_SHEET_2026_ROW_PLAN.actual2025, actualStatus);
  const actual2026 = normalizePlan(normalizedGrid, STORE_MONTHLY_SHEET_2026_ROW_PLAN.actual2026, actualStatus);
  const budget2026 = normalizePlan(normalizedGrid, STORE_MONTHLY_SHEET_2026_ROW_PLAN.budget2026, budgetStatus);
  const unavailable = Object.freeze([...actual2025.unavailable, ...actual2026.unavailable, ...budget2026.unavailable]);
  const mappingGate = mappingReceiptGate(mappingReceipts);
  const historicalOperatorGate = historicalOperatorEvidenceGate(historicalOperatorEvidence);
  const state = unavailable.length > 0
    ? "BLOCKED_SOURCE_DATA_MISSING"
    : !mappingGate.satisfied
      ? "BLOCKED_MAPPING_RECEIPTS"
      : !historicalOperatorGate.satisfied
        ? "BLOCKED_HISTORICAL_OPERATOR_EVIDENCE"
        : "READY_FOR_SERVER_VALIDATION";
  return Object.freeze({
    schemaVersion: STORE_MONTHLY_SHEET_2026_PROFILE.schemaVersion,
    sourceSystem: STORE_MONTHLY_SHEET_2026_SOURCE_SYSTEM,
    sourceProfile: STORE_MONTHLY_SHEET_2026_PROFILE,
    mappingRequests: STORE_MONTHLY_SHEET_2026_MAPPING_REQUESTS,
    actual2025Rows: actual2025.rows,
    actual2026Rows: actual2026.rows,
    budget2026Rows: budget2026.rows,
    unavailable,
    mappingGate,
    historicalOperatorGate,
    state,
    databaseAccessed: false,
    promotionAllowed: false,
    nextStep: "SERVER_SIDE_MAPPING_AND_EFFECTIVE_OPERATOR_REVALIDATION_REQUIRED",
  });
}
