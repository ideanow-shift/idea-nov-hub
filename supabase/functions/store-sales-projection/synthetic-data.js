const STATUSES = Object.freeze([
  "Good", "Stable", "Stable", "Improving", "Stable",
  "Good", "Stable", "Improving", "Needs Attention", "Stable",
  "Good", "Stable", "Improving", "Stable", "Stable",
  "Improving", "Needs Attention", "Stable", "Improving", "Stable"
]);
const STORE_DATA_STATES = Object.freeze(["available", "collecting", "preparing", "unavailable", "validation_error"]);
const SALES = Object.freeze([
  18_600_000, 17_900_000, 17_200_000, 16_800_000, 16_100_000,
  15_500_000, 15_000_000, 14_600_000, 14_200_000, 13_800_000,
  13_400_000, 13_000_000, 12_600_000, 12_200_000, 11_900_000,
  11_600_000, 11_300_000, 11_000_000, 10_700_000, 10_400_000
]);
const PROFIT_RATES = Object.freeze([
  0.124, 0.108, 0.102, 0.071, 0.096, 0.119, 0.094, 0.069, 0.031, 0.091,
  0.116, 0.089, 0.064, 0.087, 0.084, 0.061, 0.028, 0.082, 0.058, 0.079
]);
const FOCUS_BY_STATUS = Object.freeze({
  Good: "好調要因をチームで共有し、再現できる状態をつくりましょう。",
  Stable: "次回予約のご案内を丁寧に行い、安定した来店につなげましょう。",
  Improving: "新規リピート率の改善を継続し、再来店につなげましょう。",
  "Needs Attention": "新規リピート率向上を最優先で取り組みましょう。"
});

export const OFFICIAL_STORE_NAMES = Object.freeze([
  "所沢店", "高田馬場店", "上石神井店", "保谷店", "石神井公園店", "東大和店", "下井草店",
  "江古田店", "ANNEX店", "野方店", "池袋店", "KYARA HALF店", "立川店",
  "新所沢店", "鷺ノ宮店", "Roane by Bassa", "久米川店", "国分寺店", "花小金井店", "東久留米店"
]);

const numericValue = (display) => {
  const normalized = String(display ?? "").replaceAll(",", "").replace(/[^\d.-]/g, "");
  return normalized === "" ? null : Number(normalized);
};
const yen = (value) => `¥${Number(value).toLocaleString("ja-JP")}`;

const metric = (label, display, state = "available", unit = "yen", period = "2026-06") => ({
  label, value: state === "available" ? numericValue(display) : null,
  display_value: state === "available" ? display : null, unit, data_state: state,
  reason_code: state === "available" ? null : `SYNTHETIC_${state.toUpperCase()}`,
  period, period_mode: "monthly", confirmed_period_label: "2026年6月確定値"
});

export const SYNTHETIC_STORES = Object.freeze(OFFICIAL_STORE_NAMES.map((storeName, index) => {
  const number = index + 1;
  const fc = index >= 13;
  const state = STORE_DATA_STATES[index % STORE_DATA_STATES.length];
  const status = STATUSES[index];
  const sales = SALES[index];
  const profit = Math.round(sales * PROFIT_RATES[index] / 10_000) * 10_000;
  const actionTheme = index === 8 ? "新規リピート率の改善" : "客単価と再来店率の改善";
  const actionReason = index === 8 ? "新規のお客様の次回予約率が目安を下回っています。" : "客単価と再来店率がともに改善余地のある状態です。";
  const actionKpi = index === 8 ? "new_repeat" : "ticket_and_repeat";
  const storeId = fc ? `synthetic-fc-${String(number - 13).padStart(2, "0")}` : `synthetic-direct-${String(number).padStart(2, "0")}`;
  return Object.freeze({
    store_id: storeId, official_name: storeName, display_name: storeName, store_name: storeName,
    ownership_type: fc ? "FC" : "Direct", direct_or_fc: fc ? "FC" : "Direct", operational_state: "営業中",
    department_id: fc ? null : "synthetic-direct-sales", area_id: !fc && index < 5 ? "synthetic-area-01" : null,
    fc_company_id: fc ? "synthetic-fc-company-01" : null,
    scope_key: fc ? "synthetic-fc-company-01" : "synthetic-direct-sales",
    store_status: status, status, store_status_reason: FOCUS_BY_STATUS[status],
    status_rule_id: `synthetic-${status.toLowerCase().replaceAll(" ", "-")}`,
    sales_gross: metric("総売上（税込）", yen(sales), "available"),
    operating_profit: metric("営業利益", yen(profit), "available"),
    operating_profit_margin: metric("営業利益率", `${(PROFIT_RATES[index] * 100).toFixed(1)}%`, "available", "percent"),
    ordinary_profit_margin: metric("経常利益率", `${Math.max(1.2, PROFIT_RATES[index] * 100 - 1.4).toFixed(1)}%`, "available", "percent"),
    total_repeat: metric("総リピート率", `${(72 - index * 0.55 + (status === "Good" ? 2.5 : status === "Needs Attention" ? -3.0 : 0)).toFixed(1)}%`, "available", "percent"),
    productivity: metric("技術生産性", yen(Math.round((690_000 - index * 8_000) / 1_000) * 1_000), "available", "yen"), data_state: state,
    last_updated_at: "2026-07-20T09:00:00+09:00", priority_rank: index, sales_period: "2026-06",
    this_month_actions: status === "Needs Attention" ? [{
      action_id: `${storeId}:synthetic-action`, title: actionTheme,
      reason: actionReason, severity: "attention",
      related_kpi: actionKpi, detail_link: "#summary", store_id: storeId, store_name: storeName
    }] : [],
    detail_metrics: {
      budgetRatio: metric("予算比", `${(105.2 - index * 0.18).toFixed(1)}%`, "available", "percent"),
      yearOverYearRatio: metric("前年同月比", `${(108.1 - index * 0.14).toFixed(1)}%`, "available", "percent"),
      profitYearOverYear: metric("利益前年同月比", `${(5.8 - index * 0.12).toFixed(1)}%`, "available", "percent"),
      customerYearOverYear: metric("客数前年同月比", `${(4.2 - index * 0.11).toFixed(1)}%`, "available", "percent"),
      ticketYearOverYear: metric("単価前年同月比", `${(3.1 - index * 0.07).toFixed(1)}%`, "available", "percent"),
      retailYearOverYear: metric("店販購買率前年同月差", `${(-0.2 + index * 0.01).toFixed(1)}pt`, "available", "point"),
      ecTargetRatio: metric("EC目標比", `${(76 - index * 0.4).toFixed(1)}%`, "available", "percent"),
      ecYearOverYear: metric("EC前年同月比", `${(10.2 - index * 0.18).toFixed(1)}%`, "available", "percent"),
      technicalSales: metric("技術売上", yen(Math.round(sales * 0.82 / 10_000) * 10_000), "available"),
      retailSales: metric("商品売上", yen(Math.round(sales * 0.10 / 10_000) * 10_000), "available"),
      mid: metric("MID売上", yen(Math.round(sales * 0.04 / 10_000) * 10_000), "available"),
      ecSales: metric("EC按分売上", yen(Math.round(sales * 0.04 / 10_000) * 10_000), "available"),
      grossProfit: metric("売上総利益", yen(Math.round(sales * 0.44 / 10_000) * 10_000), "available"),
      ordinaryProfit: metric("経常利益", yen(Math.round(profit * 0.86 / 10_000) * 10_000), "available"),
      customerCount: metric("総客数", String(1_180 - index * 24), "available", "count"),
      newCustomerCount: metric("新規客数", String(210 - index * 4), "available", "count"),
      existingCustomerCount: metric("既存客数", String(970 - index * 20), "available", "count"),
      new: metric("新規リピート率", `${(48 - index * 0.45).toFixed(1)}%`, "available", "percent"),
      returning: metric("再来リピート率", `${(64 - index * 0.35).toFixed(1)}%`, "available", "percent"),
      loyal: metric("固定リピート率", `${(79 - index * 0.25).toFixed(1)}%`, "available", "percent"),
      totalTicket: metric("総単価", `¥${(15_800 - index * 120).toLocaleString("ja-JP")}`, "available"),
      technicalTicket: metric("技術単価", `¥${(13_400 - index * 100).toLocaleString("ja-JP")}`, "available"),
      retailPurchaseRate: metric("商品購買率", "15.0%", "available", "percent"),
      staffCount: metric("FTE換算", "8.0", "available", "count")
    }, synthetic: true
  });
}));

export const SYNTHETIC_ACTOR_ROLES = Object.freeze([
  "representative", "sales_manager", "area_manager", "store_manager", "employee"
]);
