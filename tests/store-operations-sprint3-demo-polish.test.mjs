import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectionResponse } from "../portal/store-sales/adapters/contract.js";
import { buildSyntheticProjection } from "../supabase/functions/store-sales-projection/projection.js";
import { SYNTHETIC_STORES } from "../supabase/functions/store-sales-projection/synthetic-data.js";

const projection = () => buildSyntheticProjection({
  stores: SYNTHETIC_STORES,
  scope: { type: "all_group", key: "synthetic-group", role: "representative" },
  period: "2026-06",
  requestId: "synthetic-demo-test"
});

test("demo status distribution is realistic and fixed", () => {
  const counts = Object.fromEntries(["Good", "Stable", "Improving", "Needs Attention"]
    .map((status) => [status, SYNTHETIC_STORES.filter((store) => store.status === status).length]));
  assert.deepEqual(counts, { Good: 3, Stable: 10, Improving: 5, "Needs Attention": 2 });
});

test("demo sales and profit are plausible synthetic group totals", () => {
  const result = projection();
  assert.equal(result.executive_summary.metrics.totalSalesGross.value, 277_800_000);
  assert.equal(result.executive_summary.metrics.operatingProfit.value, 23_640_000);
  assert.ok(SYNTHETIC_STORES.every((store) => store.synthetic && store.sales_gross.value > 0));
});

test("demo profit state is uniformly synthetic-confirmed", () => {
  assert.deepEqual(new Set(SYNTHETIC_STORES.map((store) => store.operating_profit.data_state)), new Set(["available"]));
  assert.equal(projection().meta.confirmation_state, "available");
});

test("attention stores have readable actions driven by existing contract fields", () => {
  const actions = projection().priority_actions;
  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map((action) => action.title), ["新規リピート率の改善", "客単価と再来店率の改善"]);
  assert.ok(actions.every((action) => action.reason.endsWith("。")));
});

test("normalized store detail contains human-readable guidance for monthly focus", () => {
  const normalized = validateProjectionResponse(projection());
  assert.equal(normalized.stores.length, 20);
  assert.ok(normalized.stores.every((store) => store.statusReason.endsWith("。")));
  assert.equal(normalized.stores.find((store) => store.status === "Needs Attention").statusReason, "新規リピート率向上を最優先で取り組みましょう。");
});

test("sales ranking and profit rates vary naturally without negative values", () => {
  assert.ok(SYNTHETIC_STORES.every((store, index) => index === 0 || SYNTHETIC_STORES[index - 1].sales_gross.value > store.sales_gross.value));
  assert.ok(new Set(SYNTHETIC_STORES.map((store) => store.operating_profit.value)).size >= 15);
  assert.ok(SYNTHETIC_STORES.every((store) => store.operating_profit.value > 0));
});
