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
  "TOTAL_PRODUCTIVITY", "TECHNICAL_PRODUCTIVITY", "RETAIL_PURCHASE_CUSTOMER_VISITS", "RETAIL_PURCHASE_RATE", "OPERATING_PROFIT"
];

const fact = (metricCode, value = metricCode.includes("RATE") ? "0.5" : "100") => ({
  metricCode, valueKind: metricCode.includes("CUSTOMERS") || metricCode.endsWith("_VISITS") ? "quantity" : metricCode.includes("RATE") ? "rate" : "amount",
  value, definitionVersion: "v1.1", displayName: metricCode, description: "canonical",
  sourceEvidence: { sourceType: "dbf", sourceFileSha256: "a".repeat(64), importedAt: "2026-08-19T00:00:00Z", factVersion: 1 }
});

function payload({ facts = false, comparisons = false, count = 20, selectedStoreKey = null } = {}) {
  const stores = Array.from({ length: count }, (_, index) => ({
    storeKey: `store-${String(index + 1).padStart(2, "0")}`,
    storeName: `正式店舗${index + 1}`,
    corporationName: index < 13 ? "株式会社BASSA" : "FC法人",
    ownership: index < 13 ? "DIRECT" : "FC",
    operatorDataState: "confirmed",
    fiscalMonth: "2026-07",
    dataState: facts ? "confirmed" : "preparing",
    metrics: facts ? codes.map((code) => fact(code)) : [],
    ...(comparisons ? { comparisons: {
      contractVersion: DBF_STORE_MONTHLY_COMPARISON_CONTRACT,
      budgetRatio: { dataState: "confirmed", value: "104" },
      yearOverYearRatio: { dataState: "confirmed", value: "106.8" },
      customerYearOverYear: { dataState: "confirmed", value: "4.2" },
      ticketYearOverYear: { dataState: "confirmed", value: "3.1" },
      retailYearOverYear: { dataState: "confirmed", value: "2.5" },
      retailBudgetRatio: { dataState: "confirmed", value: "101.4" },
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
  if (comparisons) {
    stores.forEach((store) => Object.assign(store, {
      status: "Stable",
      statusReason: "確認可能な指標は安定範囲です",
      statusRuleId: "stable-default"
    }));
  }
  const visibleStores = selectedStoreKey ? stores.filter((store) => store.storeKey === selectedStoreKey) : stores;
  return {
    contractVersion: DBF_STORE_MONTHLY_CONTRACT,
    ...(comparisons ? { comparisonContractVersion: DBF_STORE_MONTHLY_COMPARISON_CONTRACT } : {}),
    fiscalMonth: "2026-07",
    scope: {
      mode: "all", serverResolved: true, rawStoreIdsReturned: false,
      operatingStoreBaseline: { total: 20, direct: 13, fc: 7 },
      authorizedStoreCount: stores.length,
      selectedStoreKey,
      selectableStores: stores.map(({ storeKey, storeName }) => ({ storeKey, storeName })),
      visibleStoreCount: visibleStores.length
    },
    readiness: { confirmedStoreCount: facts ? count : 0, missingStoreCount: facts ? 0 : count, factRowCount: facts ? count * 20 : 0, missingDataPolicy: "preparing-not-zero" },
    stores: visibleStores
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

test("20 canonical metrics map to UI metrics without inventing comparison values", () => {
  const source = payload({ facts: true });
  for (const store of source.stores) {
    for (const metric of store.metrics) {
      if (metric.valueKind === "rate") metric.value = "0.35";
    }
  }
  const result = validateDbfStoreMonthlyProjection(source);
  const store = result.stores[0];
  assert.equal(store.metrics.sales.rawValue, 100);
  assert.equal(store.metrics.operatingProfit.rawValue, 100);
  assert.equal(store.metrics.new.rawValue, 35);
  assert.equal(store.metrics.new.displayValue, "35.0%");
  assert.equal(store.metrics.retailPurchaseRate.rawValue, 35);
  assert.equal(store.metrics.retailPurchaseCustomerVisits.rawValue, 100);
  assert.equal(store.metrics.retailPurchaseCustomerVisits.displayValue, "100人");
  assert.equal(store.metrics.budgetRatio.dataState, "preparing");
  assert.equal(store.metrics.yearOverYearRatio.dataState, "preparing");
  assert.equal(store.status, "Preparing");
  assert.equal(result.priorityActions.length, 0);
});

test("retail purchase reconciliation keeps the existing rate and reports the candidate difference", () => {
  const source = payload({ facts: true });
  const store = source.stores[0];
  store.metrics.find((metric) => metric.metricCode === "RETAIL_PURCHASE_RATE").value = "0.25";
  store.metrics.find((metric) => metric.metricCode === "RETAIL_PURCHASE_CUSTOMER_VISITS").value = "20";
  store.metrics.find((metric) => metric.metricCode === "TOTAL_CUSTOMERS").value = "100";
  store.retailPurchaseRateReconciliation = {
    dataState: "confirmed",
    policy: "retain-existing-rate-no-overwrite",
    existingMetricCode: "RETAIL_PURCHASE_RATE",
    candidateNumeratorMetricCode: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    denominatorMetricCode: "TOTAL_CUSTOMERS",
    existingRate: "0.25",
    derivedRate: "0.2",
    difference: "0.05",
    matches: false
  };
  const result = validateDbfStoreMonthlyProjection(source);
  const projected = result.stores[0];
  assert.equal(projected.metrics.retailPurchaseRate.rawValue, 25);
  assert.match(projected.metrics.retailPurchaseRate.reason, /既存率を維持/u);
  assert.equal(projected.retailPurchaseRateReconciliation.derivedRate, 20);
  assert.equal(projected.retailPurchaseRateReconciliation.difference, 5);
  assert.equal(projected.retailPurchaseRateReconciliation.matches, false);
});

test("canonical rates outside the 0..1 DBF contract fail closed", () => {
  const source = payload({ facts: true });
  source.stores[0].metrics.find((metric) => metric.metricCode === "NEW_REPEAT_RATE").value = "35";
  assert.throws(
    () => validateDbfStoreMonthlyProjection(source),
    (error) => error.code === "VALIDATION_ERROR" && error.message === "INVALID_CANONICAL_RATE"
  );
});

test("Saginomiya pilot maps only three confirmed Revision 2 metrics and keeps all missing values preparing", () => {
  const source = payload({ count: 20 });
  const saginomiya = source.stores[13];
  saginomiya.storeName = "鷺ノ宮店";
  saginomiya.dataState = "confirmed";
  saginomiya.metrics = [
    fact("TOTAL_SALES", "5499278"),
    fact("TECHNICAL_SALES", "4484581"),
    fact("RETAIL_SALES", "1023792")
  ].map((metric) => ({ ...metric, sourceEvidence: { ...metric.sourceEvidence, factVersion: 2 } }));
  source.readiness = { confirmedStoreCount: 1, missingStoreCount: 19, factRowCount: 3, budgetFactRowCount: 0, missingDataPolicy: "preparing-not-zero" };

  const result = validateDbfStoreMonthlyProjection(source);
  const store = result.stores.find((item) => item.storeName === "鷺ノ宮店");
  assert.equal(store.metrics.sales.rawValue, 5499278);
  assert.equal(store.metrics.technicalSales.rawValue, 4484581);
  assert.equal(store.metrics.retailSales.rawValue, 1023792);
  assert.equal(store.metrics.sales.displayValue, "¥5,499,278");
  for (const key of ["customerCount", "totalTicket", "totalRepeat", "productivity", "operatingProfit"]) {
    assert.equal(store.metrics[key].dataState, "preparing");
    assert.equal(store.metrics[key].rawValue, null);
    assert.equal(store.metrics[key].displayValue, null);
  }
  assert.deepEqual(result.priorityActions, []);
  assert.equal(result.readiness.factRowCount, 3);
});

test("formal comparison contract maps budget, prior year, fiscal YTD and all six trends", () => {
  const result = validateDbfStoreMonthlyProjection(payload({ facts: true, comparisons: true }));
  const store = result.stores[0];
  assert.equal(result.accounting.confirmationState, "confirmed");
  assert.equal(result.accounting.confirmedThroughPeriod, "2026-07");
  assert.equal(store.metrics.budgetRatio.rawValue, 104);
  assert.equal(store.metrics.yearOverYearRatio.rawValue, 106.8);
  assert.equal(store.metrics.customerYearOverYear.rawValue, 4.2);
  assert.equal(store.metrics.ticketYearOverYear.rawValue, 3.1);
  assert.equal(store.metrics.retailYearOverYear.rawValue, 2.5);
  assert.equal(store.metrics.retailBudgetRatio.rawValue, 101.4);
  assert.equal(store.status, "Stable");
  assert.equal(store.statusReason, "確認可能な指標は安定範囲です");
  assert.equal(store.yearly.startMonth, "2026-04");
  assert.equal(store.yearly.metrics.sales.rawValue, 400);
  assert.deepEqual(Object.keys(result.monthlyTrend).sort(), ["customers", "ec", "profit", "retail", "sales", "ticket"]);
  assert.equal(result.monthlyTrend.sales.at(-1).value, 2040);
  assert.equal(result.monthlyTrend.ticket.at(-1).value, 7);
});

test("profit accounting state stays preparing when current sales exist but direct-store profit is not confirmed", () => {
  const source = payload({ facts: true, comparisons: true });
  source.stores.forEach((store) => {
    store.metrics = store.metrics.filter((metric) => metric.metricCode !== "OPERATING_PROFIT");
    const selectedTrend = store.comparisons.monthlyTrend.find((point) => point.fiscalMonth === "2026-07");
    selectedTrend.metrics = selectedTrend.metrics.filter((metric) => metric.metricCode !== "OPERATING_PROFIT");
  });

  const result = validateDbfStoreMonthlyProjection(source);

  assert.equal(result.accounting.reflectedStoreCount, 20);
  assert.equal(result.accounting.confirmationState, "preparing");
  assert.equal(result.accounting.confirmedThroughPeriod, "2026-06");
  assert.equal(result.stores.filter((store) => store.ownership === "Direct").length, 13);
  assert.ok(result.stores.filter((store) => store.ownership === "Direct")
    .every((store) => store.metrics.operatingProfit.dataState === "preparing"));
});

test("confirmed needs-attention stores produce at most three evidence-backed priority actions", () => {
  const source = payload({ facts: true, comparisons: true });
  source.stores.slice(0, 5).forEach((store, index) => Object.assign(store, {
    status: "Needs Attention",
    statusReason: `比較指標で要確認${index + 1}`,
    statusRuleId: "sales-comparison-attention"
  }));
  const result = validateDbfStoreMonthlyProjection(source);
  assert.equal(result.priorityActions.length, 3);
  assert.deepEqual(result.priorityActions.map((action) => action.storeKey), ["store-01", "store-02", "store-03"]);
  assert.equal(result.priorityActions[0].reason, "比較指標で要確認1");
  assert.equal(result.priorityActions[0].targetTab, "summary");
  assert.equal(result.priorityActions[0].ruleId, "confirmed_store_status");
});

test("missing and zero comparison denominators remain preparing rather than fabricated zero", () => {
  const source = payload({ facts: true, comparisons: true });
  source.stores[0].comparisons.budgetRatio = { dataState: "preparing", value: null };
  source.stores[0].comparisons.yearOverYearRatio = { dataState: "preparing", value: null };
  source.stores[0].comparisons.fiscalYear.metrics.TOTAL_SALES = { dataState: "preparing", value: null };
  source.stores[0].status = "Preparing";
  source.stores[0].statusReason = "予算比または前年同月比を準備しています";
  source.stores[0].statusRuleId = "comparison-data-preparing";
  const result = validateDbfStoreMonthlyProjection(source);
  assert.equal(result.stores[0].metrics.budgetRatio.value, null);
  assert.equal(result.stores[0].metrics.yearOverYearRatio.value, null);
  assert.equal(result.stores[0].yearly.metrics.sales.value, null);
  assert.equal(result.stores[0].status, "Preparing");
});

test("server status fails closed without both formal comparisons", () => {
  const source = payload({ facts: true, comparisons: true });
  source.stores[0].comparisons.budgetRatio = { dataState: "preparing", value: null };
  assert.throws(
    () => validateDbfStoreMonthlyProjection(source),
    (error) => error.code === "VALIDATION_ERROR" && error.message === "STATUS_REQUIRES_COMPARISONS"
  );
});


test("unsafe scope, raw UUID, duplicate, invalid operator and unofficial metric are rejected", () => {
  const unsafe = payload(); unsafe.scope.serverResolved = false;
  assert.throws(() => validateDbfStoreMonthlyProjection(unsafe), (error) => error.code === "VALIDATION_ERROR");
  const uuid = payload(); uuid.stores[0].storeKey = "d9428888-122b-11e1-b85c-61cd3cbb3210";
  assert.throws(() => validateDbfStoreMonthlyProjection(uuid), (error) => error.code === "VALIDATION_ERROR");
  const unknown = payload({ facts: true }); unknown.stores[0].metrics.push(fact("FAKE_METRIC"));
  assert.throws(() => validateDbfStoreMonthlyProjection(unknown), (error) => error.code === "VALIDATION_ERROR");
  const rawIdentifier = payload(); rawIdentifier.stores[0].rawStoreId = "internal";
  assert.throws(() => validateDbfStoreMonthlyProjection(rawIdentifier), (error) => error.code === "VALIDATION_ERROR");
  const wrongOwnership = payload(); wrongOwnership.stores[0].ownership = "UNKNOWN";
  assert.throws(() => validateDbfStoreMonthlyProjection(wrongOwnership), (error) => error.code === "VALIDATION_ERROR");
});

test("unresolved effective operator remains preparing without current ownership backcast", () => {
  const source = payload();
  source.stores[0].corporationName = "未確定";
  source.stores[0].ownership = null;
  source.stores[0].operatorDataState = "unresolved";
  const result = validateDbfStoreMonthlyProjection(source);
  assert.equal(result.stores[0].ownership, null);
  assert.equal(result.stores[0].status, "Preparing");

  source.stores[0].metrics = [fact("TOTAL_SALES")];
  assert.throws(() => validateDbfStoreMonthlyProjection(source), (error) => error.code === "VALIDATION_ERROR");
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
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.headers.Authorization, "Bearer hub-session");
  assert.deepEqual(JSON.parse(request.options.body), { action: "storeMonthlyActualProjectionV1", payload: { selectedMonth: "2026-07" } });
  assert.doesNotMatch(request.options.body, /role|scope|storeId|uuid|service/iu);
});

test("adapter sends a safe public store key and validates the selected single-store projection", async () => {
  let request;
  const selectedStoreKey = "store-03";
  const adapter = createDbfStoreMonthlyAdapter({ mode: "integration", endpoint: "https://staging.invalid/nov-hub-api", timeoutMs: 1000 }, {
    getSessionToken: () => "hub-session",
    fetchImpl: async (_url, options) => {
      request = options;
      return { ok: true, status: 200, json: async () => ({ ok: true, data: payload({ selectedStoreKey }) }) };
    }
  });
  const result = await adapter.loadDashboard({ period: "2026-07", storeKey: selectedStoreKey });
  assert.equal(result.selectedStoreKey, selectedStoreKey);
  assert.equal(result.stores.length, 1);
  assert.equal(result.storeOptions.length, 20);
  assert.deepEqual(JSON.parse(request.body), {
    action: "storeMonthlyActualProjectionV1",
    payload: { selectedMonth: "2026-07", selectedStoreKey }
  });
});

test("same-origin staging BFF receives its HttpOnly session cookie", async () => {
  let credentials;
  const adapter = createDbfStoreMonthlyAdapter({ mode: "integration", endpoint: "/api/store-operations", timeoutMs: 1000 }, {
    getSessionToken: () => "server-managed-store-operations-session",
    fetchImpl: async (_url, options) => {
      credentials = options.credentials;
      return { ok: true, status: 200, json: async () => ({ ok: true, data: payload() }) };
    }
  });
  await adapter.loadDashboard({ period: "2026-07" });
  assert.equal(credentials, "same-origin");
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
