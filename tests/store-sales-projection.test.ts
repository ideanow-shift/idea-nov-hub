import {
  buildStoreSalesProjection,
  evaluateStoreStatus,
  type StoreSalesProjectionInput,
} from "../supabase/functions/nov-hub-api/store_sales_projection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function input(overrides: Partial<StoreSalesProjectionInput> = {}): StoreSalesProjectionInput {
  return {
    storeKey: "store-a",
    storeName: "所沢店",
    ownership: "Direct",
    period: "2026-06",
    accountingState: "confirmed",
    lastUpdatedAt: "2026-07-15T09:00:00+09:00",
    metrics: {},
    signals: {},
    ...overrides,
  };
}

Deno.test("operating margin below 15 percent is Needs Attention", () => {
  const result = evaluateStoreStatus(input({ signals: { operatingProfitMarginDisplay: 14.9 } }));
  assert(result.status === "Needs Attention", "status must be decided by the engine");
  assert(result.ruleId === "operating-margin-below-15", "rule registry id must be exposed");
});

Deno.test("store list follows CTO status order", () => {
  const projection = buildStoreSalesProjection([
    input({ storeKey: "good", storeName: "Good", signals: { operatingProfitMarginDisplay: 22, salesTargetAchievementDisplay: 110 } }),
    input({ storeKey: "stable", storeName: "Stable" }),
    input({ storeKey: "attention", storeName: "Attention", signals: { ordinaryProfitNegative: true } }),
    input({ storeKey: "improving", storeName: "Improving", signals: { improvingMetricCount: 2 } }),
  ]);
  assert(
    projection.stores.map((store) => store.status).join(",") === "Needs Attention,Improving,Stable,Good",
    "projection must return the required order",
  );
});

Deno.test("priority actions and store actions are capped at three", () => {
  const projection = buildStoreSalesProjection([
    input({
      signals: {
        ordinaryProfitNegative: true,
        operatingProfitMarginDisplay: 10,
        validationErrorCount: 2,
        overdueDataDays: 8,
      },
    }),
  ]);
  assert(projection.priorityActions.length === 3, "executive actions must be capped");
  assert(projection.stores[0].actions.length === 3, "this-month actions must be capped");
});

Deno.test("missing metrics remain preparing and are never converted to zero", () => {
  const projection = buildStoreSalesProjection([input()]);
  const customer = projection.businessDrivers.customer[0].items[0];
  assert(customer.displayValue === null, "missing display value must stay null");
  assert(customer.dataState === "preparing", "missing metric must be preparing");
});

Deno.test("executive total sales uses the frozen net-of-tax label", () => {
  const projection = buildStoreSalesProjection([input()]);
  const sales = projection.executiveSummary.metrics[0];
  assert(sales.label === "全社売上（税抜）", "TOTAL_SALES must be labeled net of tax");
  assert(sales.displayValue === null, "the label corrective must not synthesize a value");
});
