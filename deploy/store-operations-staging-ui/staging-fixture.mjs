const CONTRACT_VERSION = "STORE_MONTHLY_ACTUAL_V1";
const COMPARISON_CONTRACT_VERSION = "STORE_MONTHLY_COMPARISON_V1";
const PERIODS = new Set(["2026-06", "2026-07"]);
const METRIC_CODES = Object.freeze([
  "TOTAL_SALES", "TECHNICAL_SALES", "RETAIL_SALES", "MID_SALES", "EC_ALLOCATED_SALES",
  "TOTAL_CUSTOMERS", "NEW_CUSTOMERS", "EXISTING_CUSTOMERS", "TOTAL_UNIT_PRICE", "TECHNICAL_UNIT_PRICE",
  "TOTAL_REPEAT_RATE", "NEW_REPEAT_RATE", "SECOND_REPEAT_RATE", "THIRD_REPEAT_RATE", "FIXED_REPEAT_RATE",
  "TOTAL_PRODUCTIVITY", "TECHNICAL_PRODUCTIVITY", "RETAIL_PURCHASE_RATE", "OPERATING_PROFIT"
]);
const TREND_CODES = Object.freeze(["TOTAL_SALES", "OPERATING_PROFIT", "TOTAL_CUSTOMERS", "TOTAL_UNIT_PRICE", "RETAIL_SALES", "EC_ALLOCATED_SALES"]);
const EVIDENCE = Object.freeze({
  sourceType: "staging-fixture",
  sourceFileSha256: "f".repeat(64),
  importedAt: "2026-09-20T00:00:00Z",
  factVersion: 1
});

const stores = Object.freeze(Array.from({ length: 20 }, (_, index) => {
  const direct = index < 13;
  const number = String(direct ? index + 1 : index - 12).padStart(2, "0");
  return Object.freeze({
    storeKey: `fixture-store-${String(index + 1).padStart(2, "0")}`,
    storeName: `架空${direct ? "直営" : "FC"}${number}`,
    corporationName: direct ? "架空直営法人" : `架空FC法人${number}`,
    ownership: direct ? "DIRECT" : "FC"
  });
}));

function valueKind(code) {
  if (code.includes("CUSTOMERS")) return "quantity";
  if (code.includes("RATE")) return "rate";
  return "amount";
}

function metricValue(code, index, period) {
  const monthOffset = period === "2026-07" ? 700 : 600;
  if (code.includes("RATE")) return String((32 + ((index + code.length) % 25)) / 100);
  if (code.includes("CUSTOMERS")) return String(310 + index * 17 + monthOffset / 10);
  if (code.includes("UNIT_PRICE")) return String(8200 + index * 145 + monthOffset);
  if (code.includes("PRODUCTIVITY")) return String(560000 + index * 8700 + monthOffset * 10);
  if (code === "OPERATING_PROFIT") return String(430000 + index * 19000 + monthOffset * 10);
  if (code === "TOTAL_SALES") return String(6100000 + index * 225000 + monthOffset * 100);
  if (code === "TECHNICAL_SALES") return String(5100000 + index * 180000 + monthOffset * 80);
  if (code === "RETAIL_SALES") return String(720000 + index * 31000 + monthOffset * 15);
  if (code === "MID_SALES") return String(170000 + index * 9000 + monthOffset * 5);
  return String(110000 + index * 7000 + monthOffset * 4);
}

function fact(code, index, period) {
  return Object.freeze({
    metricCode: code,
    valueKind: valueKind(code),
    value: metricValue(code, index, period),
    definitionVersion: "fixture-v1",
    displayName: code,
    description: "Staging UAT fixture",
    sourceEvidence: EVIDENCE
  });
}

function trendPoint(month, index, omitProfit = false) {
  const metrics = TREND_CODES
    .filter((code) => !(omitProfit && code === "OPERATING_PROFIT"))
    .map((code) => Object.freeze({ metricCode: code, value: metricValue(code, index, month) }));
  return Object.freeze({ fiscalMonth: month, dataState: "confirmed", metrics: Object.freeze(metrics) });
}

function comparison(period, index) {
  const july = period === "2026-07";
  const priorYear = july ? "2025-07" : "2025-06";
  const priorMonth = july ? "2026-06" : "2026-05";
  return Object.freeze({
    contractVersion: COMPARISON_CONTRACT_VERSION,
    budgetRatio: Object.freeze({ dataState: "confirmed", value: String(98 + (index % 8)) }),
    yearOverYearRatio: Object.freeze({ dataState: "confirmed", value: String(96 + (index % 12)) }),
    customerYearOverYear: Object.freeze({ dataState: "confirmed", value: String(-2 + (index % 8)) }),
    ticketYearOverYear: Object.freeze({ dataState: "confirmed", value: String(-1 + (index % 7)) }),
    retailYearOverYear: Object.freeze({ dataState: "confirmed", value: String(95 + (index % 11)) }),
    retailBudgetRatio: Object.freeze({ dataState: "confirmed", value: String(97 + (index % 9)) }),
    fiscalYear: Object.freeze({
      dataState: "confirmed",
      startMonth: "2026-04",
      endMonth: period,
      metrics: Object.freeze({
        TOTAL_SALES: Object.freeze({ dataState: "confirmed", value: String(Number(metricValue("TOTAL_SALES", index, period)) * (july ? 4 : 3)) }),
        OPERATING_PROFIT: Object.freeze({ dataState: "confirmed", value: String(Number(metricValue("OPERATING_PROFIT", index, "2026-06")) * (july ? 3 : 3)) }),
        TOTAL_CUSTOMERS: Object.freeze({ dataState: "confirmed", value: String(Number(metricValue("TOTAL_CUSTOMERS", index, period)) * (july ? 4 : 3)) })
      }),
      budgetAchievement: Object.freeze({ dataState: "confirmed", value: String(99 + (index % 6)) })
    }),
    monthlyTrend: Object.freeze([
      trendPoint(priorYear, index),
      trendPoint(priorMonth, index),
      trendPoint(period, index, july)
    ])
  });
}

function fixtureError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function createStoreOperationsStagingFixture({ selectedMonth, selectedStoreKey = null } = {}) {
  const fiscalMonth = String(selectedMonth || "");
  if (!PERIODS.has(fiscalMonth)) throw fixtureError("FIXTURE_PERIOD_NOT_AVAILABLE");
  const safeStoreKey = selectedStoreKey === null || selectedStoreKey === undefined || selectedStoreKey === "" ? null : String(selectedStoreKey);
  if (safeStoreKey !== null && !stores.some((store) => store.storeKey === safeStoreKey)) throw fixtureError("FIXTURE_STORE_NOT_AVAILABLE");
  const july = fiscalMonth === "2026-07";
  const visible = safeStoreKey ? stores.filter((store) => store.storeKey === safeStoreKey) : stores;
  const projectedStores = visible.map((store) => {
    const index = stores.findIndex((candidate) => candidate.storeKey === store.storeKey);
    const metrics = METRIC_CODES
      .filter((code) => !(july && code === "OPERATING_PROFIT"))
      .map((code) => fact(code, index, fiscalMonth));
    return Object.freeze({
      ...store,
      operatorDataState: "confirmed",
      fiscalMonth,
      dataState: "confirmed",
      metrics: Object.freeze(metrics),
      comparisons: comparison(fiscalMonth, index),
      status: "Stable",
      statusReason: "架空比較指標は安定範囲です",
      statusRuleId: "staging-fixture-stable"
    });
  });
  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    comparisonContractVersion: COMPARISON_CONTRACT_VERSION,
    fiscalMonth,
    scope: Object.freeze({
      mode: "all",
      serverResolved: true,
      rawStoreIdsReturned: false,
      operatingStoreBaseline: Object.freeze({ total: 20, direct: 13, fc: 7 }),
      authorizedStoreCount: 20,
      selectedStoreKey: safeStoreKey,
      selectableStores: Object.freeze(stores.map(({ storeKey, storeName }) => Object.freeze({ storeKey, storeName }))),
      visibleStoreCount: projectedStores.length
    }),
    readiness: Object.freeze({
      confirmedStoreCount: projectedStores.length,
      missingStoreCount: 0,
      factRowCount: projectedStores.length * (july ? 18 : 19),
      missingDataPolicy: "preparing-not-zero",
      fixtureData: true,
      fixtureLabel: "架空20店舗"
    }),
    stores: Object.freeze(projectedStores)
  });
}
