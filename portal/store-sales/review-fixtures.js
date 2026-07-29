const available = (label, displayValue) => ({ label, displayValue, dataState: "available", reason: null });
const preparing = (label, reason = "データソースを準備しています") => ({ label, displayValue: null, dataState: "preparing", reason });
const collecting = (label) => ({ label, displayValue: null, dataState: "collecting", reason: "月次損益を集計しています" });
const validationError = (label) => ({ label, displayValue: null, dataState: "validation_error", reason: "取込データの確認が必要です" });

const storeNames = [
  "所沢店", "新所沢店", "久米川店", "東大和店", "国分寺店",
  "上石神井店", "石神井公園店", "花小金井店", "高田馬場店", "吉祥寺店",
  "保谷店", "鷺ノ宮店", "下井草店", "江古田店", "東久留米店",
  "FC小手指店", "FC入間店", "FC狭山店", "FC川越店", "FCふじみ野店"
];

function metrics(index, mode = "confirmed") {
  const money = (base) => `¥${(base + index * 137_000).toLocaleString("ja-JP")}`;
  const pending = mode === "pending";
  const error = mode === "error";
  return {
    sales: mode === "tax-pending" ? preparing("売上高（税込）", "税込変換ruleが未承認です") : available("売上高（税込）", money(8_450_000)),
    technicalSales: available("技術売上", money(6_480_000)),
    retailSales: available("商品売上", money(1_320_000)),
    ecSales: preparing("EC売上", "店舗配賦データを準備しています"),
    grossProfit: pending ? collecting("売上総利益") : available("売上総利益", money(5_120_000)),
    operatingProfit: pending ? collecting("営業利益") : error ? validationError("営業利益") : available("営業利益", money(1_240_000 - index * 42_000)),
    ordinaryProfit: pending ? collecting("経常利益") : available("経常利益", money(1_090_000 - index * 45_000)),
    cumulative: pending ? collecting("累計") : available("累計", money(48_200_000)),
    grossProfitMargin: pending ? collecting("売上総利益率") : available("売上総利益率", `${(61.8 - index * .2).toFixed(1)}%`),
    operatingProfitMargin: pending ? collecting("営業利益率") : error ? validationError("営業利益率") : available("営業利益率", `${Math.max(8.8, 19.6 - index * .55).toFixed(1)}%`),
    ordinaryProfitMargin: pending ? collecting("経常利益率") : available("経常利益率", `${Math.max(6.1, 17.8 - index * .5).toFixed(1)}%`),
    totalRepeat: available("Total Repeat", `${(73.2 - index * .4).toFixed(1)}%`),
    new: preparing("New"), returning: preparing("Returning"), loyal: preparing("Loyal"),
    customerCount: preparing("客数"), newCustomerCount: preparing("新規客数"), existingCustomerCount: preparing("既存客数"),
    totalTicket: available("Total Ticket", `¥${(12_840 + index * 35).toLocaleString("ja-JP")}`),
    technicalTicket: available("Technical Ticket", `¥${(10_420 + index * 22).toLocaleString("ja-JP")}`),
    retailTicket: preparing("Retail Ticket"), regularRetail: preparing("Regular Retail"), mid: preparing("MID"),
    productivity: preparing("Productivity", "FTEデータを準備しています"),
    staffCount: preparing("スタッフ数", "所定労働時間を基準に換算する準備中です"),
    retailPurchaseRate: preparing("Retail Purchase Rate")
  };
}

function action(storeKey, storeName, status, id, reason, recommendation) {
  return { id: `${storeKey}:${id}`, storeKey, storeName, status, reason, recommendation, ruleId: id };
}

function makeStore(index, mode = "confirmed") {
  const storeKey = `store-${String(index + 1).padStart(2, "0")}`;
  const status = index < 4 ? "Needs Attention" : index < 8 ? "Improving" : index < 15 ? "Stable" : "Good";
  const reason = {
    "Needs Attention": "営業利益率が基準の15.0%を下回っています",
    Improving: "複数の主要指標が前月から改善しています",
    Stable: "確認可能な指標は安定範囲です",
    Good: "利益率と売上達成率が基準を満たしています"
  }[status];
  const actions = status === "Needs Attention" ? [
    action(storeKey, storeNames[index], status, "margin", "営業利益率が15.0%未満です", "人件費・材料費・販促費の推移を確認"),
    action(storeKey, storeNames[index], status, "repeat", "Total Repeatが前月を下回っています", "再来店施策と次回予約率を確認"),
    action(storeKey, storeNames[index], status, "data", "一部KPIが準備中です", "入力データと更新予定日を確認")
  ] : status === "Improving" ? [
    action(storeKey, storeNames[index], status, "improving", reason, "改善要因を確認し、継続施策を決定")
  ] : [];
  return {
    storeKey, storeName: storeNames[index], ownership: index < 15 ? "Direct" : "FC",
    area: index < 10 ? "東京" : "埼玉", corporation: index < 15 ? "株式会社イディア・ノブ" : "FC法人",
    period: "2026-06", accountingState: mode === "pending" ? "collecting" : "confirmed",
    lastUpdatedAt: "2026-07-15T09:30:00+09:00", status, statusReason: reason,
    statusRuleId: `fixture-${status.toLowerCase().replaceAll(" ", "-")}`, metrics: metrics(index, mode), actions
  };
}

function projection(stores, confirmationState = "confirmed", audience = "executive") {
  const first = stores[0];
  return {
    contractVersion: "store-sales-projection-v1-review-fixture",
    audience,
    generatedAt: "2026-07-15T09:30:00+09:00",
    accounting: {
      period: "2026-06", confirmedThroughPeriod: "2026-06", salesPeriod: "2026-07",
      confirmationState, lastUpdatedAt: "2026-07-15T09:30:00+09:00",
      reflectedStoreCount: confirmationState === "confirmed" ? stores.length : 0, totalStoreCount: stores.length
    },
    executiveSummary: {
      metrics: [
        available("全社売上（税込）", "¥182,460,000"), available("営業利益", "¥27,810,000"),
        available("経常利益", "¥24,960,000"), available("売上総利益率", "61.2%"),
        available("営業利益率", "15.2%"), available("経常利益率", "13.7%")
      ],
      needsAttentionStoreCount: stores.filter((store) => store.status === "Needs Attention").length
    },
    priorityActions: stores.flatMap((store) => store.actions).slice(0, 3),
    businessDrivers: stores.length ? {
      results: [{ label: "売上", items: [first?.metrics.sales] }, { label: "利益", items: [first?.metrics.operatingProfit] }],
      customer: [{ label: "Total Repeat", items: [first?.metrics.totalRepeat] }],
      value: ["totalTicket", "technicalTicket", "retailTicket", "regularRetail", "mid"].map((key) => ({ label: first?.metrics[key].label, items: [first?.metrics[key]] })),
      operations: ["totalRepeat", "productivity", "retailPurchaseRate"].map((key) => ({ label: first?.metrics[key].label, items: [first?.metrics[key]] }))
    } : {},
    stores
  };
}

export function getReviewFixture(name) {
  if (name === "manager") return projection([makeStore(0)], "confirmed", "store_manager");
  if (name === "pending") {
    const store = makeStore(0, "pending");
    store.metrics.sales = metrics(0, "tax-pending").sales;
    const result = projection([store], "collecting");
    result.executiveSummary.metrics = result.executiveSummary.metrics.map((item) =>
      ["全社売上（税込）"].includes(item.label) ? preparing(item.label, "税込変換ruleが未承認です") : collecting(item.label));
    return result;
  }
  if (name === "validation") return projection([makeStore(0, "error")]);
  if (name === "empty") return projection([]);
  if (name === "all-preparing") {
    const store = makeStore(0);
    Object.keys(store.metrics).forEach((key) => { store.metrics[key] = preparing(store.metrics[key].label); });
    return projection([store], "preparing");
  }
  return projection(storeNames.map((_, index) => makeStore(index)));
}
