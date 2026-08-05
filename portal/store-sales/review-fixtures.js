const metric = (label, displayValue, dataState = "available", reason = null, rawValue = null) =>
  ({ label, displayValue: dataState === "available" ? displayValue : null, dataState, reason, rawValue });
const available = (label, displayValue, rawValue = null) => metric(label, displayValue, "available", null, rawValue);
const collecting = (label) => metric(label, null, "collecting", "7月15日頃確定予定");
const preparing = (label, reason = "データソースを準備しています") => metric(label, null, "preparing", reason);
const validationError = (label) => metric(label, null, "validation_error", "取込データの確認が必要です");

export const STORE_NAMES = Object.freeze([
  "所沢店", "高田馬場店", "上石神井店", "保谷店", "石神井公園店", "東大和店", "下井草店",
  "江古田店", "ANNEX店", "野方店", "池袋店", "KYARA HALF店", "立川店",
  "新所沢店", "鷺ノ宮店", "Roane by Bassa", "久米川店", "国分寺店", "花小金井店", "東久留米店"
]);
const storeNames = STORE_NAMES;

const statuses = [
  "Good", "Stable", "Stable", "Good", "Improving", "Stable", "Good", "Stable", "Good", "Improving",
  "Stable", "Improving", "Needs Attention", "Stable", "Good", "Improving", "Stable", "Needs Attention", "Stable", "Good"
];

function metrics(index, profitMode = "collecting") {
  const sales = 10_650_000 + ((index * 791_000) % 8_300_000);
  const customers = 780 + ((index * 47) % 510);
  const repeat = 38.6 + ((index * 17) % 280) / 10;
  const productivity = 518_000 + ((index * 13_700) % 164_000);
  const profitValue = Math.round(sales * (.08 + (index % 7) * .012));
  const profitMetric = profitMode === "confirmed"
    ? available("営業利益", yen(profitValue), profitValue)
    : profitMode === "preparing" ? preparing("営業利益", "Accounting Core連携を準備しています") : collecting("営業利益");
  const profitRate = profitMode === "confirmed"
    ? available("営業利益率", `${(profitValue / sales * 100).toFixed(1)}%`, profitValue / sales * 100)
    : profitMode === "preparing" ? preparing("営業利益率") : collecting("営業利益率");
  return {
    sales: available("総売上（税抜）", yen(sales), sales),
    storeSales: available("店舗売上", yen(sales - 380_000), sales - 380_000),
    technicalSales: available("技術売上", yen(Math.round(sales * .82)), Math.round(sales * .82)),
    retailSales: available("店販売上合計", yen(Math.round(sales * .15)), Math.round(sales * .15)),
    regularRetail: available("通常店販売上", yen(Math.round(sales * .1)), Math.round(sales * .1)),
    mid: available("MID売上", yen(Math.round(sales * .05)), Math.round(sales * .05)),
    ecSales: available("EC按分売上", "38万円", 380_000),
    grossProfit: profitMode === "confirmed" ? available("粗利益", yen(Math.round(sales * .61))) : profitMetric,
    operatingProfit: profitMetric,
    ordinaryProfit: profitMode === "confirmed" ? available("経常利益", yen(Math.round(profitValue * .91))) : profitMetric,
    cumulative: profitMetric,
    grossProfitMargin: profitMode === "confirmed" ? available("粗利益率", "61.0%") : profitRate,
    operatingProfitMargin: profitRate,
    ordinaryProfitMargin: profitMode === "confirmed" ? available("経常利益率", `${(profitValue / sales * 91).toFixed(1)}%`) : profitRate,
    totalRepeat: available("総リピート率", `${repeat.toFixed(1)}%`, repeat),
    new: available("新規リピート率", `${Math.max(22, repeat - 18.4).toFixed(1)}%`, repeat - 18.4),
    returning: available("再来リピート率", `${Math.min(82, repeat + 7.2).toFixed(1)}%`, repeat + 7.2),
    loyal: available("固定リピート率", `${Math.min(91, repeat + 20.1).toFixed(1)}%`, repeat + 20.1),
    customerCount: available("総客数", `${customers.toLocaleString("ja-JP")}人`, customers),
    newCustomerCount: available("新規客数", `${Math.round(customers * .24)}人`, Math.round(customers * .24)),
    existingCustomerCount: available("既存客数", `${Math.round(customers * .76)}人`, Math.round(customers * .76)),
    totalTicket: available("総単価（税抜）", `${Math.round(sales / customers).toLocaleString("ja-JP")}円`, Math.round(sales / customers)),
    technicalTicket: available("技術単価（税抜）", `${Math.round(sales * .82 / customers).toLocaleString("ja-JP")}円`),
    retailTicket: available("店販単価（税抜）", `${Math.round(sales * .15 / customers).toLocaleString("ja-JP")}円`),
    productivity: available("総生産性", `${(productivity / 10_000).toFixed(1)}万円`, productivity),
    staffCount: available("稼働スタッフ数", `${(12.4 + (index % 6) * .6).toFixed(1)}人相当`),
    retailPurchaseRate: available("店販購買率", `${(16.8 + index % 8).toFixed(1)}%`)
  };
}

function yen(value) {
  return value >= 100_000_000 ? `${(value / 100_000_000).toFixed(2)}億円` : `${Math.round(value / 10_000).toLocaleString("ja-JP")}万円`;
}

function makeStore(index, profitMode = "collecting") {
  const status = statuses[index];
  const storeKey = `mock-store-${String(index + 1).padStart(2, "0")}`;
  const focus = status === "Needs Attention" ? "新規リピート率改善"
    : status === "Improving" ? "次回予約率の定着" : status === "Good" ? "好調要因の共有" : "お客様満足の安定";
  const conclusion = status === "Needs Attention"
    ? "新規リピート率が前年同月から6.8ポイント低下しています。集客より、次回予約プロセスの確認を優先してください。"
    : status === "Improving" ? "主要指標は改善しています。今月は改善した接客プロセスの定着を確認してください。"
      : "主要指標は安定しています。お客様満足を保ちながら好調要因を継続してください。";
  const action = {
    id: `${storeKey}:focus`, storeKey, storeName: STORE_NAMES[index], status,
    theme: focus, reason: status === "Needs Attention" ? "前年同月より6.8ポイント低下しています。" : "前月から改善傾向です。",
    impact: status === "Needs Attention" ? "既存客数の増加" : "再来店の安定", recommendation: focus,
    targetTab: status === "Needs Attention" ? "customer" : "summary", ruleId: `mock-${status}`
  };
  return {
    storeKey, storeName: STORE_NAMES[index], ownership: index < 13 ? "Direct" : "FC",
    area: index % 3 === 0 ? "西東京" : index % 3 === 1 ? "埼玉" : "都心",
    corporation: index < 13 ? "株式会社イディア・ノブ" : "FC法人", period: "2026-06",
    accountingState: profitMode === "confirmed" ? "confirmed" : profitMode,
    lastUpdatedAt: "2026-07-10T09:30:00+09:00", status, statusReason: conclusion, conclusion,
    focus, metrics: metrics(index, profitMode), actions: [action],
    otherChecks: ["次回予約の声かけ実施状況", "店販提案の振り返り"],
    nextCheck: "顧客・リピートで新規リピート率を確認"
  };
}

function projection(stores, { profitMode = "collecting", audience = "executive", scopeLabel = "全20店舗", reflected = 18 } = {}) {
  const attention = stores.filter((store) => store.status === "Needs Attention").length;
  const totalSales = stores.reduce((sum, store) => sum + (store.metrics.sales.rawValue || 0), 0);
  const profit = profitMode === "confirmed" ? available("利益", yen(Math.round(totalSales * .126))) :
    profitMode === "preparing" ? preparing("利益", "Accounting Core連携を準備しています") : collecting("利益");
  return {
    contractVersion: "store-operations-v1.1-preview", taxBasis: "net", audience, role: audience, scopeLabel,
    generatedAt: "2026-07-10T09:30:00+09:00", directionMessage: "お客様満足を高める店舗づくり",
    accounting: { period: "2026-06", confirmedThroughPeriod: profitMode === "confirmed" ? "2026-06" : "2026-05",
      salesPeriod: "2026-06", confirmationState: profitMode, lastUpdatedAt: "2026-07-10T09:30:00+09:00",
      reflectedStoreCount: Math.min(reflected, stores.length), totalStoreCount: stores.length },
    executiveSummary: {
      narrative: scopeLabel === "全20店舗" ? `全社売上は計画を上回っています。利益は${profitMode === "confirmed" ? "確定しています" : "集計中です"}。現在、${attention}店舗に対応が必要です。`
        : `${scopeLabel}の売上状況です。現在、${attention}店舗に対応が必要です。`,
      metrics: [available("総売上（税抜）", yen(totalSales), totalSales), profit],
      needsAttentionStoreCount: attention
    },
    priorityActions: stores.filter((store) => store.status === "Needs Attention").flatMap((store) => store.actions).slice(0, 3),
    businessDrivers: stores.length ? {
      results: [{ label: "総売上（税抜）", primary: true, items: [available("総売上（税抜）", yen(totalSales))] }, { label: "利益", primary: true, items: [profit] }, { label: "予算比", items: [available("予算比", "+3.8%")] }, { label: "前年同月比", items: [available("前年同月比", "+5.2%")] }],
      customer: [{ label: "総客数", primary: true, items: [available("総客数", `${stores.reduce((s, x) => s + x.metrics.customerCount.rawValue, 0).toLocaleString()}人`)] }, { label: "新規", items: [stores[0].metrics.newCustomerCount] }, { label: "既存", items: [stores[0].metrics.existingCustomerCount] }],
      value: [{ label: "総単価", primary: true, items: [stores[0].metrics.totalTicket] }, { label: "技術単価", items: [stores[0].metrics.technicalTicket] }, { label: "店販売上合計", items: [stores[0].metrics.retailSales] }, { label: "EC按分売上", items: [stores[0].metrics.ecSales] }],
      operations: [{ label: "総リピート率", primary: true, items: [stores[0].metrics.totalRepeat] }, { label: "総生産性", primary: true, items: [stores[0].metrics.productivity] }, { label: "店販購買率", items: [stores[0].metrics.retailPurchaseRate] }]
    } : {}, stores
  };
}

export function getReviewFixture(name, options = {}) {
  const profitMode = options.profitMode || (name === "pending" ? "collecting" : name === "all-preparing" ? "preparing" : "collecting");
  const all = storeNames.map((_, index) => makeStore(index, profitMode));
  if (name === "manager" || name === "store_manager") return projection([all[12]], { profitMode, audience: "store_manager", scopeLabel: "立川店", reflected: 1 });
  if (name === "area_manager") return projection(all.slice(12, 17), { profitMode, audience: "area_manager", scopeLabel: "担当5店舗", reflected: 5 });
  if (name === "department-manager") return projection(all.slice(0, 6), { profitMode, audience: "department_manager", scopeLabel: "担当6店舗", reflected: 6 });
  if (name === "sales_manager") return projection(all.slice(0, 13), { profitMode, audience: "sales_manager", scopeLabel: "直営13店舗", reflected: 11 });
  if (name === "franchise-owner") return projection(all.slice(13, 18), { profitMode, audience: "franchise_owner", scopeLabel: "自法人5店舗", reflected: 5 });
  if (name === "empty") return projection([], { profitMode, reflected: 0 });
  if (name === "validation") {
    const result = projection([makeStore(12, "confirmed")], { profitMode: "confirmed" });
    result.stores[0].metrics.operatingProfit = validationError("営業利益");
    return result;
  }
  if (name === "all-preparing") return projection([makeStore(12, "preparing")], { profitMode: "preparing", reflected: 0 });
  return projection(all, { profitMode, audience: "representative", reflected: options.missingData === false ? 20 : 18 });
}
