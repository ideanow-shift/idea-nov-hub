const STATES = ["available", "collecting", "preparing", "unavailable", "validation_error"];
const STATUSES = ["Needs Attention", "Improving", "Stable", "Good"];

export const OFFICIAL_STORE_NAMES = Object.freeze([
  "所沢店", "高田馬場店", "上石神井店", "保谷店", "石神井公園店", "東大和店", "下井草店",
  "江古田店", "ANNEX店", "野方店", "池袋店", "KYARA HALF店", "立川店",
  "新所沢店", "鷺ノ宮店", "Roane by Bassa", "久米川店", "国分寺店", "花小金井店", "東久留米店"
]);

const numericValue = (display) => {
  const normalized = String(display ?? "").replaceAll(",", "").replace(/[^\d.-]/g, "");
  return normalized === "" ? null : Number(normalized);
};

const metric = (label, display, state = "available", unit = "yen", period = "2026-07") => ({
  label, value: state === "available" ? numericValue(display) : null,
  display_value: state === "available" ? display : null, unit, data_state: state,
  reason_code: state === "available" ? null : `SYNTHETIC_${state.toUpperCase()}`,
  period, period_mode: "monthly", confirmed_period_label: "2026年6月確定値"
});

export const SYNTHETIC_STORES = Object.freeze(OFFICIAL_STORE_NAMES.map((storeName, index) => {
  const number = index + 1;
  const fc = index >= 13;
  const state = STATES[index % STATES.length];
  const status = STATUSES[index % STATUSES.length];
  const storeId = fc ? `synthetic-fc-${String(number - 13).padStart(2, "0")}` : `synthetic-direct-${String(number).padStart(2, "0")}`;
  return Object.freeze({
    store_id: storeId, official_name: storeName, display_name: storeName, store_name: storeName,
    ownership_type: fc ? "FC" : "Direct", direct_or_fc: fc ? "FC" : "Direct", operational_state: "営業中",
    department_id: fc ? null : "synthetic-direct-sales", area_id: !fc && index < 5 ? "synthetic-area-01" : null,
    fc_company_id: fc ? "synthetic-fc-company-01" : null,
    scope_key: fc ? "synthetic-fc-company-01" : "synthetic-direct-sales",
    store_status: status, status, store_status_reason: `Synthetic rule result: ${status}`,
    status_rule_id: `synthetic-${status.toLowerCase().replaceAll(" ", "-")}`,
    sales_gross: metric("総売上（税込）", `¥${(1_000_000 + number * 10_000).toLocaleString("ja-JP")}`, "available"),
    operating_profit: metric("営業利益", `¥${(100_000 + number * 1_000).toLocaleString("ja-JP")}`, state),
    operating_profit_margin: metric("営業利益率", `${(10 + number / 10).toFixed(1)}%`, state, "percent"),
    ordinary_profit_margin: metric("経常利益率", `${(8 + number / 10).toFixed(1)}%`, state, "percent"),
    total_repeat: metric("総リピート率", `${(60 + number / 10).toFixed(1)}%`, "available", "percent"),
    productivity: metric("技術生産性", null, "preparing", "yen"), data_state: state,
    last_updated_at: "2026-07-20T09:00:00+09:00", priority_rank: index, sales_period: "2026-07",
    this_month_actions: status === "Needs Attention" ? [{
      action_id: `${storeId}:synthetic-action`, title: "Syntheticデータの確認",
      reason: "営業利益率がStaging基準を下回っています", severity: "attention",
      related_kpi: "operating_profit_margin", detail_link: "#summary", store_id: storeId, store_name: storeName
    }] : [],
    detail_metrics: {
      budgetRatio: metric("予算比", `${(98 + number / 10).toFixed(1)}%`, "available", "percent"),
      yearOverYearRatio: metric("前年同月比", `${(99 + number / 10).toFixed(1)}%`, "available", "percent"),
      technicalSales: metric("技術売上", `¥${(800_000 + number * 8_000).toLocaleString("ja-JP")}`, "available"),
      retailSales: metric("商品売上", `¥${(120_000 + number * 1_000).toLocaleString("ja-JP")}`, "available"),
      mid: metric("MID売上", `¥${(40_000 + number * 500).toLocaleString("ja-JP")}`, "available"),
      ecSales: metric("EC按分売上", `¥${(40_000 + number * 500).toLocaleString("ja-JP")}`, "available"),
      grossProfit: metric("売上総利益", `¥${(500_000 + number * 5_000).toLocaleString("ja-JP")}`, state),
      ordinaryProfit: metric("経常利益", `¥${(80_000 + number * 800).toLocaleString("ja-JP")}`, state),
      customerCount: metric("総客数", String(100 + number), "available", "count"),
      newCustomerCount: metric("新規客数", String(20 + number), "available", "count"),
      existingCustomerCount: metric("既存客数", "80", "available", "count"),
      new: metric("新規リピート率", "40.0%", "available", "percent"),
      returning: metric("再来リピート率", "55.0%", "available", "percent"),
      loyal: metric("固定リピート率", "70.0%", "available", "percent"),
      totalTicket: metric("総単価", "¥12,000", "available"),
      technicalTicket: metric("技術単価", "¥10,000", "available"),
      retailPurchaseRate: metric("商品購買率", "15.0%", "available", "percent"),
      staffCount: metric("FTE換算", "8.0", "available", "count")
    }, synthetic: true
  });
}));

export const SYNTHETIC_ACTOR_ROLES = Object.freeze([
  "representative", "sales_manager", "area_manager", "store_manager", "employee"
]);
