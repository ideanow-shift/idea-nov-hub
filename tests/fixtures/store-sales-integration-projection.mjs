export function wireMetric(label, displayValue = null, dataState = "preparing", unit = "yen") {
  return {
    label,
    value: dataState === "available" ? 1 : null,
    display_value: dataState === "available" ? displayValue : null,
    unit,
    data_state: dataState,
    reason_code: dataState === "available" ? null : "SOURCE_PENDING",
    period: "2026-06",
    period_mode: "monthly",
    confirmed_period_label: "2026年6月確定値"
  };
}

export function wireStore(overrides = {}) {
  return {
    store_id: "store-01",
    store_name: "所沢店",
    ownership_type: "Direct",
    scope_key: "group-01",
    store_status: "Needs Attention",
    store_status_reason: "営業利益率が基準を下回っています",
    sales_gross: wireMetric("売上", "¥8,450,000", "available"),
    operating_profit: wireMetric("営業利益", "¥1,240,000", "available"),
    operating_profit_margin: wireMetric("営業利益率", "14.9%", "available", "percent"),
    ordinary_profit_margin: wireMetric("経常利益率", "13.2%", "available", "percent"),
    total_repeat: wireMetric("Total Repeat", "73.2%", "available", "percent"),
    productivity: wireMetric("Productivity"),
    data_state: "available",
    last_updated_at: "2026-07-15T09:30:00+09:00",
    priority_rank: 1,
    sales_period: "2026-07",
    this_month_actions: [{
      action_id: "action-01",
      title: "費用構成を確認",
      reason: "営業利益率が基準を下回っています",
      severity: "attention",
      related_kpi: "operating_profit_margin",
      detail_link: "#summary",
      store_id: "store-01",
      store_name: "所沢店"
    }],
    detail_metrics: {
      grossProfitMargin: wireMetric("売上総利益率", "61.8%", "available", "percent"),
      ordinaryProfit: wireMetric("経常利益", "¥1,090,000", "available")
    },
    ...overrides
  };
}

export function wireProjection(overrides = {}) {
  const stores = overrides.stores ?? [wireStore()];
  const { meta: metaOverrides = {}, stores: _storesOverride, ...rootOverrides } = overrides;
  return {
    meta: {
      sales_period: "2026-07",
      accounting_confirmed_through_period: "2026-06",
      confirmation_state: "available",
      last_updated_at: "2026-07-15T09:30:00+09:00",
      actor_scope: "all_group",
      actor_scope_key: "group-01",
      actor_role: "representative",
      reflected_store_count: stores.length,
      accounting_version_id: "accounting-version-synthetic-1",
      kpi_definition_set_version: "kpi-definition-synthetic-1",
      projection_version: "store-sales-projection-v1",
      adapter_mode: "integration",
      ...metaOverrides
    },
    executive_summary: {
      metrics: {
        totalSalesGross: wireMetric("全社売上（税込）", "¥8,450,000", "available"),
        operatingProfit: wireMetric("営業利益", "¥1,240,000", "available"),
        ordinaryProfit: wireMetric("経常利益", "¥1,090,000", "available"),
        grossProfitMargin: wireMetric("売上総利益率", "61.8%", "available", "percent"),
        operatingProfitMargin: wireMetric("営業利益率", "14.9%", "available", "percent"),
        ordinaryProfitMargin: wireMetric("経常利益率", "13.2%", "available", "percent")
      },
      needs_attention_store_count: stores.filter((store) => store.store_status === "Needs Attention").length,
      data_state: "available",
      reason_code: null
    },
    priority_actions: stores[0]?.this_month_actions || [],
    business_drivers: {
      results: [{ label: "売上", metric: wireMetric("売上", "¥8,450,000", "available") }],
      customer: [{ label: "Total Repeat", metric: wireMetric("Total Repeat", "73.2%", "available", "percent") }]
    },
    stores,
    selected_store: null,
    ...rootOverrides
  };
}

export const actorScopeFixtures = Object.freeze({
  executive: () => wireProjection(),
  departmentManager: () => wireProjection({ meta: { actor_scope: "department", actor_scope_key: "department-01", actor_role: "area_manager" }, stores: [wireStore({ scope_key: "department-01" })] }),
  storeManager: () => wireProjection({ meta: { actor_scope: "own_store", actor_scope_key: "store-01", actor_role: "store_manager" } }),
  franchiseOwner: () => wireProjection({ meta: { actor_scope: "franchise", actor_scope_key: "franchise-01", actor_role: "representative" }, stores: [wireStore({ ownership_type: "FC", scope_key: "franchise-01" })] }),
  employeeDenied: () => wireProjection({ meta: { actor_scope: "denied", actor_scope_key: null, actor_role: "employee" }, stores: [] })
});
