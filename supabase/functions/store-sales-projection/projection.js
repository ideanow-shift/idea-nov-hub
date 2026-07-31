import { StagingApiError } from "./errors.js";
import { assertStoreScope, scopeStores } from "./scope.js";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const STORE_ID = /^synthetic-(direct|fc)-\d{2}$/;

export function validatePeriod(value) {
  if (!PERIOD.test(String(value || ""))) throw new StagingApiError("INVALID_PERIOD", "period must be YYYY-MM.", 422);
  return String(value);
}

export function validateStoreId(value) {
  if (!STORE_ID.test(String(value || ""))) throw new StagingApiError("INVALID_STORE_ID", "storeId is invalid.", 422);
  return String(value);
}

const driver = (label, metric) => ({ label, metric });
const aggregateMetric = (label, stores, field, period) => {
  const value = stores.reduce((sum, store) => sum + Number(store[field]?.value || 0), 0);
  return {
    label, value, display_value: `¥${value.toLocaleString("ja-JP")}`, unit: "yen", data_state: "available",
    reason_code: null, period, period_mode: "monthly", confirmed_period_label: "2026年6月Synthetic確定値"
  };
};

export function buildSyntheticProjection({ stores, scope, period, storeId = null, requestId }) {
  const scoped = scopeStores(scope, stores).filter((store) => store.operational_state !== "閉店");
  let selected = null;
  if (storeId) {
    selected = stores.find((store) => store.store_id === storeId);
    if (!selected) throw new StagingApiError("NOT_FOUND", "Store was not found.", 404);
    assertStoreScope(scope, selected);
  }
  const visible = (storeId ? [selected] : scoped).map((store) => ({ ...store, scope_key: scope.key }));
  const available = visible.filter((store) => store.operating_profit?.data_state === "available");
  const actions = visible.flatMap((store) => store.this_month_actions).slice(0, 3);
  const first = visible[0];
  const totalSales = aggregateMetric("総売上（税込）", visible, "sales_gross", period);
  const totalOperatingProfit = aggregateMetric("営業利益", visible, "operating_profit", period);
  const fallbackMetric = {
    label: "準備中",
    value: null,
    display_value: null,
    unit: "yen",
    data_state: "preparing",
    reason_code: "SYNTHETIC_EMPTY",
    period,
    period_mode: "monthly",
    confirmed_period_label: "2026年6月確定値"
  };
  return Object.freeze({
    meta: {
      request_id: requestId,
      contract_version: "store-sales-projection-v1",
      sales_period: period,
      accounting_confirmed_through_period: "2026-06",
      confirmation_state: available.length === visible.length && visible.length ? "available" : "collecting",
      last_updated_at: "2026-07-20T09:00:00+09:00",
      actor_scope: scope.type,
      actor_scope_key: scope.key,
      actor_role: scope.role,
      reflected_store_count: available.length,
      accounting_version_id: "synthetic-accounting-published-v1",
      kpi_definition_set_version: "synthetic-kpi-active-v1",
      projection_version: "store-sales-projection-v1",
      adapter_mode: "staging",
      synthetic: true,
      provenance: {
        directory: "synthetic-directory-v1",
        accounting: "synthetic-accounting-published-v1",
        kpi: "synthetic-kpi-active-v1",
        rules: "store-status-rule-registry-v1"
      }
    },
    executive_summary: {
      metrics: {
        totalSalesGross: visible.length ? totalSales : fallbackMetric,
        operatingProfit: visible.length ? totalOperatingProfit : fallbackMetric,
        operatingProfitMargin: first?.operating_profit_margin || fallbackMetric
      },
      needs_attention_store_count: visible.filter((store) => store.store_status === "Needs Attention").length,
      data_state: visible.length ? "available" : "preparing",
      reason_code: visible.length ? null : "SYNTHETIC_EMPTY"
    },
    priority_actions: actions,
    business_drivers: {
      results: [driver("売上", first?.sales_gross || fallbackMetric), driver("営業利益", first?.operating_profit || fallbackMetric)],
      customer: [driver("Total Repeat", first?.total_repeat || fallbackMetric)],
      value: []
    },
    stores: visible,
    selected_store: selected,
    synthetic: true
  });
}

export const PROJECTION_QUERY_PLAN = Object.freeze({
  directoryQueries: 1,
  accountingQueries: 1,
  kpiQueries: 1,
  perStoreQueries: 0,
  nPlusOne: false
});
