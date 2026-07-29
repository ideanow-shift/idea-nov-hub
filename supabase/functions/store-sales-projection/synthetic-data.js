const STATES = ["available", "collecting", "preparing", "unavailable", "validation_error"];
const STATUSES = ["Needs Attention", "Improving", "Stable", "Good"];

const metric = (label, display, state = "available", unit = "yen", period = "2026-07") => ({
  label,
  value: state === "available" ? 1 : null,
  display_value: state === "available" ? display : null,
  unit,
  data_state: state,
  reason_code: state === "available" ? null : `SYNTHETIC_${state.toUpperCase()}`,
  period,
  period_mode: "monthly",
  confirmed_period_label: "2026年6月確定値"
});

export const SYNTHETIC_STORES = Object.freeze(Array.from({ length: 20 }, (_, index) => {
  const number = index + 1;
  const fc = index >= 15;
  const state = STATES[index % STATES.length];
  const status = STATUSES[index % STATUSES.length];
  const storeId = fc ? `synthetic-fc-${String(number - 15).padStart(2, "0")}` : `synthetic-direct-${String(number).padStart(2, "0")}`;
  return Object.freeze({
    store_id: storeId,
    store_name: `Synthetic ${fc ? "FC" : "Direct"} Store ${String(number).padStart(2, "0")}`,
    ownership_type: fc ? "FC" : "Direct",
    operational_state: index === 13 ? "休業" : index === 14 ? "閉店" : "営業中",
    department_id: index < 10 ? "synthetic-dept-sales" : "synthetic-dept-other",
    fc_company_id: fc ? (index < 18 ? "synthetic-fc-company-01" : "synthetic-fc-company-02") : null,
    scope_key: fc ? (index < 18 ? "synthetic-fc-company-01" : "synthetic-fc-company-02") : "synthetic-dept-sales",
    store_status: status,
    store_status_reason: `Synthetic rule result: ${status}`,
    status_rule_id: `synthetic-${status.toLowerCase().replaceAll(" ", "-")}`,
    sales_gross: metric("売上（税込）", `¥${(1_000_000 + number * 10_000).toLocaleString("ja-JP")}`, state),
    operating_profit: metric("営業利益", `¥${(100_000 + number * 1_000).toLocaleString("ja-JP")}`, state),
    operating_profit_margin: metric("営業利益率", `${(10 + number / 10).toFixed(1)}%`, state, "percent"),
    ordinary_profit_margin: metric("経常利益率", `${(8 + number / 10).toFixed(1)}%`, state, "percent"),
    total_repeat: metric("Total Repeat", `${(60 + number / 10).toFixed(1)}%`, "available", "percent"),
    productivity: metric("Productivity", null, "preparing", "yen"),
    data_state: state,
    last_updated_at: "2026-07-20T09:00:00+09:00",
    priority_rank: index,
    sales_period: "2026-07",
    this_month_actions: status === "Needs Attention" ? [{
      action_id: `${storeId}:synthetic-action`,
      title: "Syntheticデータの確認",
      reason: "営業利益率がStaging基準を下回っています",
      severity: "attention",
      related_kpi: "operating_profit_margin",
      detail_link: "#summary",
      store_id: storeId,
      store_name: `Synthetic ${fc ? "FC" : "Direct"} Store ${String(number).padStart(2, "0")}`
    }] : [],
    detail_metrics: {
      grossProfit: metric("売上総利益", `¥${(500_000 + number * 5_000).toLocaleString("ja-JP")}`, state),
      grossProfitMargin: metric("売上総利益率", `${(50 + number / 10).toFixed(1)}%`, state, "percent"),
      ordinaryProfit: metric("経常利益", `¥${(80_000 + number * 800).toLocaleString("ja-JP")}`, state)
    },
    synthetic: true
  });
}));

export const SYNTHETIC_ACTOR_ROLES = Object.freeze([
  "representative_director", "director", "executive_officer", "department_manager",
  "store_manager", "franchise_owner", "employee"
]);
