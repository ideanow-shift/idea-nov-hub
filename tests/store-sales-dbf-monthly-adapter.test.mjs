import assert from "node:assert/strict";
import test from "node:test";
import {
  createDbfStoreMonthlyAdapter,
  DBF_STORE_MONTHLY_COMPARISON_CONTRACT,
  DBF_STORE_MONTHLY_CONTRACT,
  validateDbfStoreMonthlyProjection
} from "../portal/store-sales/adapters/dbf-store-monthly.js";

const codes = [
  "TOTAL_SALES", "TECHNICAL_SALES", "RETAIL_SALES", "MID_SALES", "EC_ALLOCATED_SALES",
  "TOTAL_CUSTOMERS", "NEW_CUSTOMERS", "EXISTING_CUSTOMERS", "TOTAL_UNIT_PRICE", "TECHNICAL_UNIT_PRICE",
  "TOTAL_REPEAT_RATE", "NEW_REPEAT_RATE", "SECOND_REPEAT_RATE", "THIRD_REPEAT_RATE", "FIXED_REPEAT_RATE",
  "TOTAL_PRODUCTIVITY", "TECHNICAL_PRODUCTIVITY", "RETAIL_PURCHASE_RATE", "OPERATING_PROFIT"
];

const fact = (metricCode, value = "100") => ({
  metricCode, valueKind: metricCode.includes("CUSTOMERS") ? "quantity" : metricCode.includes("RATE") ? "rate" : "amount",
  value, definitionVersion: "v1.1", displayName: metricCode, description: "canonical",
  sourceEvidence: { sourceType: "dbf", sourceFileSha256: "a".repeat(64), importedAt: "2026-08-19T00:00:00Z", factVersion: 1 }
});

function payload({ facts = false, comparisons = false, count = 20 } = {}) {
  const stores = Array.from({ length: count }, (_, index) => ({
    storeKey: `store-${String(index + 1).padStart(2, "0")}`,
    storeName: `正式店舗${index + 1}`,
    corporationName: index < 13 ? "株式会社BASSA" : "FC法人",
    ownership: index < 13 ? "DIRECT" : "FC",
    fiscalMonth: "2026-07",
    dataState: facts ? "confirmed" : "preparing",
    metrics: facts ? codes.map((code) => fact(code)) : [],
    ...(comparisons ? { comparisons: {
      contractVersion: DBF_STORE_MONTHLY_COMPARISON_CONTRACT,
      budgetRatio: { dataState: "confirmed", value: "104" },
      yearOverYearRatio: { dataState: "confirmed", value: "106.8" },
      fiscalYear: {
        dataState: "confirmed", startMonth: "2026-04", endMonth: "2026-07",
        metrics: {
          TOTAL_SALES: { dataState: "confirmed", value: "400" },
          OPERATING_PROFIT: { dataState: "confirmed", value: "40" },
          TOTAL_CUSTOMERS: { dataState: "confirmed", value: "80" }
        },
        budgetAchievement: { dataState: "confirmed", value: "102" }
      },
      monthlyTrend: ["2025-07", "2026-06", "2026-07"].map((month, monthIndex) => ({
        fiscalMonth: month, dataState: "confirmed",
        metrics: [
          ["TOTAL_SALES", 100 + monthIndex], ["OPERATING_PROFIT", 10 + monthIndex],
          ["TOTAL_CUSTOMERS", 20 + monthIndex], ["TOTAL_UNIT_PRICE", 5 + monthIndex],
          ["RETAIL_SALES", 8 + monthIndex], ["EC_ALLOCATED_SALES", 3 + monthIndex]
        ].map(([metricCode, value]) => ({ metricCode, value: String(value) }))
      }))
    }} : {})
  }));
  return {
    contractVersion: DBF_STORE_MONTHLY_CONTRACT,
    ...(comparisons ? { comparisonContractVersion: DBF_STORE_MONTHLY_COMPARISON_CONTRACT } : {}),
    fiscalMonth: "2026-07",
    scope: { mode: "all", serverResolved: true, rawStoreIdsReturned: false, operatingStoreBaseline: { total: 20, direct: 13, fc: 7 }, visibleStoreCount: stores.length },
    readiness: { confirmedStoreCount: facts ? count : 0, missingStoreCount: facts ? 0 : count, factRowCount: facts ? count * 19 : 0, missingDataPolicy: "preparing-not-zero" },
    stores
  };
}

test("STORE_MONTHLY_ACTUAL_V1 validates formal 20-store baseline", () => {
  const result = validateDbfStoreMonthlyProjection(payload());
  assert.equal(result.contractVersion, DBF_STORE_MONTHLY_CONTRACT);
  assert.equal(result.stores.length, 20);
  assert.equal(result.stores.filter((store) => store.ownership === "Direct").length, 13);
  assert.equal(result.stores.filter((store) => store.ownership === "FC").length, 7);
  assert.equal(result.stores.some((store) => /HQ|本部/u.test(store.storeName)), false);
});

test("fact zero keeps 20 stores and every metric preparing, never zero", () => {
  const result = validateDbfStoreMonthlyProjection(payload());
  assert.equal(result.accounting.reflectedStoreCount, 0);
  assert.ok(result.stores.every((store) => store.status === "Preparing"));
  assert.ok(result.stores.every((store) => Object.values(store.metrics).every((metric) => metric.dataState === "preparing" && metric.value === null && metric.displayValue === null)));
  assert.deepEqual(result.priorityActions, []);
});

test("19 canonical metrics map to UI metrics without inventing comparison values", () => {
  const result = validateDbfStoreMonthlyProjection(payload({ facts: true }));
  const store = result.stores[0];
  assert.equal(store.metrics.sales.rawValue, 100);
  assert.equal(store.metrics.operatingProfit.rawValue, 100);
  assert.equal(store.metrics.budgetRatio.dataState, "preparing");
  assert.equal(store.metrics.yearOverYearRatio.dataState, "preparing");
  assert.equal(store.status, "Preparing");
  assert.equal(result.priorityActions.length, 0);
});

test("formal comparison contract maps budget, prior year, fiscal YTD and all six trends", () => {
  const result = validateDbfStoreMonthlyProjection(payload({ facts: true, comparisons: true }));
  const store = result.stores[0];
  assert.equal(store.metrics.budgetRatio.rawValue, 104);
  assert.equal(store.metrics.yearOverYearRatio.rawValue, 106.8);
  assert.equal(store.yearly.startMonth, "2026-04");
  assert.equal(store.yearly.metrics.sales.rawValue, 400);
  assert.deepEqual(Object.keys(result.monthlyTrend).sort(), ["customers", "ec", "profit", "retail", "sales", "ticket"]);
  assert.equal(result.monthlyTrend.sales.at(-1).value, 2040);
  assert.equal(result.monthlyTrend.ticket.at(-1).value, 7);
});

test("missing and zero comparison denominators remain preparing rather than fabricated zero", () => {
  const source = payload({ facts: true, comparisons: true });
  source.stores[0].comparisons.budgetRatio = { dataState: "preparing", value: null };
  source.stores[0].comparisons.yearOverYearRatio = { dataState: "preparing", value: null };
  source.stores[0].comparisons.fiscalYear.metrics.TOTAL_SALES = { dataState: "preparing", value: null };
  const result = validateDbfStoreMonthlyProjection(source);
  assert.equal(result.stores[0].metrics.budgetRatio.value, null);
  assert.equal(result.stores[0].metrics.yearOverYearRatio.value, null);
  assert.equal(result.stores[0].yearly.metrics.sales.value, null);
});

test("unsafe scope, raw UUID, duplicate and unofficial metric are rejected", () => {
  const unsafe = payload(); unsafe.scope.serverResolved = false;
  assert.throws(() => validateDbfStoreMonthlyProjection(unsafe), (error) => error.code === "VALIDATION_ERROR");
  const uuid = payload(); uuid.stores[0].storeKey = "d9428888-122b-11e1-b85c-61cd3cbb3210";
  assert.throws(() => validateDbfStoreMonthlyProjection(uuid), (error) => error.code === "VALIDATION_ERROR");
  const unknown = payload({ facts: true }); unknown.stores[0].metrics.push(fact("FAKE_METRIC"));
  assert.throws(() => validateDbfStoreMonthlyProjection(unknown), (error) => error.code === "VALIDATION_ERROR");
  const rawIdentifier = payload(); rawIdentifier.stores[0].rawStoreId = "internal";
  assert.throws(() => validateDbfStoreMonthlyProjection(rawIdentifier), (error) => error.code === "VALIDATION_ERROR");
  const wrongOwnership = payload(); wrongOwnership.stores[0].ownership = "FC";
  assert.throws(() => validateDbfStoreMonthlyProjection(wrongOwnership), (error) => error.code === "VALIDATION_ERROR");
});

test("adapter sends only action and selected month with HUB bearer session", async () => {
  let request;
  const adapter = createDbfStoreMonthlyAdapter({ mode: "integration", endpoint: "https://staging.invalid/nov-hub-api", timeoutMs: 1000 }, {
    getSessionToken: () => "hub-session",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true, data: payload() }) };
    }
  });
  const result = await adapter.loadDashboard({ period: "2026-07", role: "executive", storeId: "spoof" });
  assert.equal(result.stores.length, 20);
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer hub-session");
  assert.deepEqual(JSON.parse(request.options.body), { action: "storeMonthlyActualProjectionV1", payload: { selectedMonth: "2026-07" } });
  assert.doesNotMatch(request.options.body, /role|scope|storeId|uuid|service/iu);
});

test("missing HUB session rejects before network access", async () => {
  let called = false;
  const adapter = createDbfStoreMonthlyAdapter({ mode: "integration", endpoint: "https://staging.invalid", timeoutMs: 1000 }, {
    getSessionToken: () => "", fetchImpl: async () => { called = true; }
  });
  await assert.rejects(() => adapter.loadDashboard({ period: "2026-07" }), (error) => error.code === "UNAUTHORIZED");
  assert.equal(called, false);
});

test("production not-approved response is a closed forbidden gate", async () => {
  const adapter = createDbfStoreMonthlyAdapter({ mode: "integration", endpoint: "https://staging.invalid", timeoutMs: 1000 }, {
    getSessionToken: () => "session",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error: { code: "NOT_APPROVED" } }) })
  });
  await assert.rejects(() => adapter.loadDashboard({ period: "2026-07" }), (error) => error.code === "FORBIDDEN");
});
