import { createStoreSalesMockIdentity, createStoreSalesRuntime } from "./runtime/index.js";
import { allowedScopes, canSelectScope, emptyScopeMessage, normalizeScope, scopeHeading } from "./permission-scope.js";
import { createStoreViewSelector } from "./store-view-selector.js";
import { restoreStoreSalesPreviewContext } from "./preview-context.js";
import { getNovHubSessionStatus } from "../js/nov-hub-session-candidate.js";

const state = {
  projection: null, runtime: null, runtimeStatus: "initializing", runtimeFeatureFlag: null, effectiveRole: "sales_manager", initializedRole: null, selectedStore: null, tab: "summary", audience: "executive",
  statusFilter: "Needs Attention", sort: "status", scope: "All", periodMode: "monthly", listScroll: 0, trendMetric: "sales", trendPeriod: "six_months",
  development: { role: "sales_manager", runtimeState: "ready", profitMode: "collecting", missingData: true }
};
const $ = (id) => document.getElementById(id);
const elements = {
  notice: $("notice"), noticeTitle: $("notice-title"), noticeBody: $("notice-body"), retry: $("retry-button"),
  period: $("period"), executive: $("executive-view"), detail: $("detail-view"), summary: $("summary-metrics"),
  actions: $("priority-actions"), drivers: $("business-drivers"), rows: $("store-rows"), cards: $("store-cards"),
  detailPanel: $("detail-panel"), devControls: $("dev-controls"), executiveSignals: $("executive-signals"), executiveSignalLinks: $("executive-signal-links")
};
const metricLabels = {
  summary: ["sales", "operatingProfit", "customerCount", "totalTicket", "totalRepeat", "productivity"],
  customer: ["totalRepeat", "new", "returning", "loyal", "customerCount", "newCustomerCount", "existingCustomerCount"],
  value: ["totalTicket", "productivity", "technicalTicket", "retailSales", "retailPurchaseRate", "staffCount"]
};
const labels = {
  sales: "総売上（税込）", operatingProfit: "営業利益", customerCount: "総客数", totalTicket: "総単価",
  totalRepeat: "総リピート率", productivity: "総生産性", new: "新規リピート率", returning: "再来リピート率",
  loyal: "固定リピート率", newCustomerCount: "新規客数", existingCustomerCount: "既存客数",
  technicalTicket: "技術単価", retailSales: "店販売上", retailPurchaseRate: "店販購買率", staffCount: "稼働スタッフ数"
};
const statusOrder = { "Needs Attention": 0, Improving: 1, Stable: 2, Good: 3 };
const statusNames = { "Needs Attention": "要対応", Improving: "改善中", Stable: "安定", Good: "好調" };
const selectStoreView = createStoreViewSelector();
const hubLaunchContext = restoreStoreSalesPreviewContext();
const hubLaunchSessionAvailable = getNovHubSessionStatus() === "available";
if (hubLaunchContext?.mockRole) state.development.role = hubLaunchContext.mockRole;

initialize();

async function initialize() {
  bindControls();
  const runtimeConfig = globalThis.STORE_SALES_RUNTIME_CONFIG || {};
  state.runtime = createStoreSalesRuntime({
    location, runtimeConfig,
    dependencies: {
      isOnline: () => navigator.onLine,
      getDevelopmentState: () => state.development,
      getMockIdentity: () => hubLaunchContext?.mockRole && hubLaunchSessionAvailable ? createStoreSalesMockIdentity(state.development.role) : null
    }
  });
  state.runtime.subscribe(renderRuntimeSnapshot);
  await state.runtime.initialize({ period: elements.period.value });
}

function bindControls() {
  elements.period.addEventListener("change", reload);
  elements.retry.addEventListener("click", () => state.runtime?.retry());
  $("back-to-list").addEventListener("click", showList);
  $("store-sort").addEventListener("change", (event) => { state.sort = event.target.value; renderStores(); });
  [["dev-role", "role"], ["dev-runtime", "runtimeState"], ["dev-profit", "profitMode"]].forEach(([id, key]) => {
    $(id).value = state.development[key];
    $(id).addEventListener("change", (event) => {
      state.development[key] = event.target.value;
      applyRoleDefaults();
      if (key === "role") state.runtime?.initialize({ period: elements.period.value });
      else reload();
    });
  });
  $("dev-missing").addEventListener("change", (event) => { state.development.missingData = event.target.value === "true"; reload(); });
  document.querySelectorAll("[data-scope]").forEach((button) => button.addEventListener("click", () => {
    if (!canSelectScope(state.effectiveRole, button.dataset.scope)) return;
    state.scope = button.dataset.scope; setPressed("[data-scope]", button); renderAll();
  }));
  document.querySelectorAll("[data-period-mode]").forEach((button) => button.addEventListener("click", () => {
    state.periodMode = button.dataset.periodMode; setPressed("[data-period-mode]", button); renderAll();
  }));
  document.querySelectorAll("[role=tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
    button.addEventListener("keydown", handleTabKeydown);
  });
}

function applyRoleDefaults() {
  state.scope = allowedScopes(state.development.role)[0] || null;
  if (state.development.role === "sales_manager") state.statusFilter = "Needs Attention";
  if (state.development.role === "representative") state.statusFilter = "All";
}

function reload() {
  if (state.development.runtimeState === "loading") return renderRuntimeSnapshot({ status: "loading", presentation: { title: "読み込んでいます", body: "Mock Runtimeから店舗データを取得しています。" } });
  return state.runtime?.load({ period: elements.period.value });
}

function renderRuntimeSnapshot(snapshot) {
  state.runtimeStatus = snapshot.status;
  state.runtimeFeatureFlag = snapshot.featureFlag;
  const hasProjection = ["ready", "empty"].includes(snapshot.status);
  const isBlocking = Boolean(snapshot.presentation?.blocking);
  const isPreviewMode = ["mock", "preview"].includes(snapshot.featureFlag);
  elements.devControls.hidden = !isPreviewMode;
  elements.retry.hidden = !snapshot.canRetry;
  elements.notice.hidden = hasProjection;
  elements.notice.classList.toggle("is-error", !["initializing", "loading", "ready", "empty"].includes(snapshot.status));
  setNotice(snapshot.presentation?.title || "店舗営業情報を確認しています", snapshot.presentation?.body || "少々お待ちください。");
  if (!hasProjection || isBlocking) {
    document.querySelector("main").hidden = true;
    return;
  }
  state.projection = snapshot.projection;
  $("preview-banner").hidden = !["mock", "preview", "staging"].includes(snapshot.featureFlag);
  renderAll();
  document.querySelector("main").hidden = false;
}

function renderAll() {
  const projection = state.projection || { stores: [], accounting: {}, executiveSummary: {} };
  state.audience = projection.audience || state.development.role;
  if (projection.stores.length === 0) state.audience = projection.audience || "executive";
  const role = ["mock", "preview"].includes(state.runtimeFeatureFlag)
    ? state.development.role
    : (projection.role || state.development.role);
  if (state.initializedRole !== role) {
    state.scope = allowedScopes(role)[0] || null;
    state.statusFilter = role === "representative" ? "All" : "Needs Attention";
    state.initializedRole = role;
  }
  state.effectiveRole = role;
  configureScopeControls(role);
  $("direction-message").textContent = projection.directionMessage || "";
  $("meta-sales-period").textContent = formatMonth(elements.period.value);
  $("meta-accounting-period").textContent = formatMonth(projection.accounting?.confirmedThroughPeriod); // 確定値の対象月
  $("meta-state").textContent = stateText(projection.accounting?.confirmationState);
  $("meta-updated").textContent = formatDate(projection.accounting?.lastUpdatedAt);
  $("filter-updated").textContent = `最終更新 ${formatDate(projection.accounting?.lastUpdatedAt)}`;
  if (state.audience === "store_manager" || role === "store_manager") {
    elements.executiveSignals.hidden = true;
    const ownStore = projection.stores?.[0];
    $("sticky-filters").hidden = true;
    if (ownStore) showDetail(ownStore.storeKey, true);
    else renderManagerEmpty();
    return;
  }
  $("sticky-filters").hidden = false;
  elements.executiveSignals.hidden = false;
  elements.executive.hidden = false; elements.detail.hidden = true;
  const heading = scopeHeading(role, state.scope);
  $("page-title").textContent = heading;
  const stores = scopedStores();
  const scopeLabel = scopeLabelText(stores);
  $("summary-heading").textContent = heading;
  renderSummary(projection, stores, scopeLabel);
  renderActions((projection.priorityActions || []).filter((action) => stores.some((store) => store.storeKey === action.storeKey)));
  renderDecisionSignals(projection, stores);
  renderStatusFilters(stores);
  renderStores();
}

function scopedStores() {
  const stores = state.projection?.stores || [];
  if (!canSelectScope(state.effectiveRole, state.scope)) return [];
  return stores.filter((store) => ["All", "Assigned", "Self"].includes(state.scope) || store.ownership === state.scope);
}

function configureScopeControls(role) {
  state.scope = normalizeScope(role, state.scope);
  document.querySelectorAll("[data-scope]").forEach((button) => {
    const permitted = canSelectScope(role, button.dataset.scope);
    button.hidden = !permitted;
    button.disabled = !permitted;
    button.setAttribute("aria-pressed", String(permitted && button.dataset.scope === state.scope));
  });
}

function scopeLabelText(stores) {
  if (state.scope === "Direct") return `直営${stores.length}店舗`;
  if (state.scope === "FC") return `FC${stores.length}店舗`;
  return state.projection?.scopeLabel || `全${stores.length}店舗`;
}

function renderSummary(projection, stores, scopeLabel) {
  if (!stores.length) {
    const message = emptyScopeMessage({
      permitted: canSelectScope(state.effectiveRole, state.scope),
      collecting: projection.accounting?.confirmationState === "collecting"
    });
    elements.summary.replaceChildren(emptyState(message));
    $("summary-narrative").textContent = message;
    $("status-counts").replaceChildren(); return;
  }
  const total = stores.reduce((sum, store) => sum + metricNumber(store.metrics.sales), 0);
  const profit = projection.executiveSummary?.metrics?.find((metric) => metric.label === "営業利益") || stores[0].metrics.operatingProfit;
  const attention = stores.filter((store) => store.status === "Needs Attention").length;
  const salesPeriodNote = state.periodMode === "cumulative"
    ? `${formatMonth(elements.period.value)}までの累計`
    : formatMonth(elements.period.value);
  $("summary-narrative").textContent = state.runtimeFeatureFlag === "staging" ? "現在は営業部レビュー用のサンプルデータです。実績値ではありません。" :
    state.scope === "All" ? (projection.executiveSummary?.narrative || "") :
    `${scopeLabel}の売上状況です。現在、${attention}店舗に対応が必要です。`;
  elements.summary.replaceChildren(
    metricCard({ label: "総売上（税込）", displayValue: formatYen(total), dataState: "available", reason: salesPeriodNote }),
    metricCard(profit), metricCard({ label: "要対応店舗", displayValue: `${attention}店舗`, dataState: "available" })
  );
  $("status-counts").replaceChildren(...Object.keys(statusOrder).reverse().map((status) => {
    const box = node("span", "status-count");
    box.append(statusBadge(status), node("strong", "", String(stores.filter((store) => store.status === status).length)));
    return box;
  }));
  const accounting = projection.accounting || {};
  $("coverage-note").textContent = state.runtimeFeatureFlag === "staging" ? "すべて画面確認用のSynthetic確定値です。実績値ではありません。" : accounting.reflectedStoreCount < accounting.totalStoreCount
    ? `${accounting.reflectedStoreCount}店舗のデータで表示しています。${accounting.totalStoreCount - accounting.reflectedStoreCount}店舗は集計中です。` : `${stores.length}店舗のデータを表示しています。`;
}

function renderActions(actions) {
  if (!actions.length) return elements.actions.replaceChildren(empty("現在、優先して確認することはありません"));
  elements.actions.replaceChildren(...actions.slice(0, 3).map((action) => {
    const card = node("article", "action-card"); card.tabIndex = 0;
    card.append(node("h3", "action-theme", action.theme || action.recommendation), node("div", "action-store", action.storeName),
      paragraph(action.reason), node("p", "impact", `期待効果: ${action.impact || actionImpact(action.ruleId)}`));
    const link = node("button", "action-link", "店舗詳細を確認 →"); link.type = "button";
    link.addEventListener("click", () => showDetail(action.storeKey, false, action.targetTab));
    card.addEventListener("keydown", (event) => { if (event.key === "Enter") link.click(); });
    card.append(link); return card;
  }));
}

function renderDecisionSignals(projection, stores) {
  if (!stores.length) return elements.drivers.replaceChildren(emptyState());
  const signalValues = buildDecisionSignals(projection, stores);
  const signalGrid = node("div", "decision-signal-grid");
  signalGrid.setAttribute("aria-label", "6つの経営シグナル");
  signalValues.forEach((signal) => {
    const card = node("button", "decision-signal-card"); card.type = "button"; card.dataset.signal = signal.key;
    card.setAttribute("aria-pressed", String(state.trendMetric === signal.key));
    card.setAttribute("aria-label", `${signal.label}、${signal.conclusion}。推移グラフを${signal.label}へ切り替える`);
    const details = document.createElement("dl");
    signal.details.forEach(([label, value]) => { const group = node("div"); group.append(node("dt", "", label), node("dd", "", value)); details.append(group); });
    card.append(node("span", "signal-question", signal.question), node("h3", "", signal.label), node("strong", "signal-conclusion", signal.conclusion), node("p", "signal-lead", signal.lead), details);
    card.addEventListener("click", () => { state.trendMetric = signal.key; renderDecisionSignals(projection, stores); });
    signalGrid.append(card);
  });
  renderExecutiveSignalSummary(signalValues);
  const trend = renderSharedTrend(signalValues);
  elements.drivers.replaceChildren(signalGrid, trend);
}

function buildDecisionSignals(projection, stores) {
  const sum = (key) => {
    const values = stores.map((store) => metricNullableNumber(store.metrics[key])).filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const average = (key) => {
    const values = stores.map((store) => metricNullableNumber(store.metrics[key])).filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  };
  const sales = sum("sales"); const profit = sum("operatingProfit"); const customerCount = sum("customerCount");
  const ticket = average("totalTicket"); const retail = sum("retailSales"); const mid = sum("mid"); const ec = sum("ecSales");
  const salesYoy = ratioDelta(average("yearOverYearRatio")); const budget = average("budgetRatio");
  const profitYoy = average("profitYearOverYear"); const customerYoy = average("customerYearOverYear");
  const ticketYoy = average("ticketYearOverYear"); const retailYoy = average("retailYearOverYear");
  const ecTarget = average("ecTargetRatio"); const ecYoy = average("ecYearOverYear");
  const profitReady = stores.every((store) => store.metrics.operatingProfit?.dataState === "available");
  return [
    signal("sales", "売上", "売上は上がっているか", signedConclusion(salesYoy), `予算比 ${percent(budget)} ／ 前年比 ${signed(salesYoy, "%")}`, [["総売上（税込）", formatYen(sales)], ["予算比", percent(budget)], ["前年比", signed(salesYoy, "%")]], sales, salesYoy),
    signal("profit", "利益", "利益は出ているか", profitReady ? "確定" : "集計中", profitReady ? `営業利益 ${formatYen(profit)} ／ 利益率 ${percent(sales ? profit / sales * 100 : null)}` : "利益データを集計しています", [["営業利益", profitReady ? formatYen(profit) : "集計中"], ["営業利益率", profitReady ? percent(sales ? profit / sales * 100 : null) : "集計中"], ["前年比", profitReady ? signed(profitYoy, "%") : "集計中"]], profitReady ? profit : null, profitYoy),
    signal("customers", "集客", "集客できているか", signedConclusion(customerYoy, "改善", "要確認"), `客数 前年比 ${signed(customerYoy, "%")}`, [["総客数", count(customerCount)], ["新規客数", count(sum("newCustomerCount"))], ["既存客数", count(sum("existingCustomerCount"))], ["前年比", signed(customerYoy, "%")]], customerCount, customerYoy),
    signal("ticket", "単価", "単価は上がっているか", signedConclusion(ticketYoy), `総単価 前年比 ${signed(ticketYoy, "%")}`, [["総単価", yen(ticket)], ["技術単価", yen(average("technicalTicket"))], ["前年比", signed(ticketYoy, "%")]], ticket, ticketYoy),
    signal("retail", "商品", "商品は売れているか", Math.abs(retailYoy || 0) < .5 ? "横ばい" : signedConclusion(retailYoy), `店販購買率 前年比 ${signed(retailYoy, "pt")}`, [["店販売上", formatYen(retail)], ["店販購買率", percent(average("retailPurchaseRate"))], ["MID（参考値）", formatYen(mid)], ["EC売上（参考値）", formatYen(ec)], ["前年比", signed(retailYoy, "pt")]], retail, retailYoy),
    signal("ec", "EC", "ECは動かせているか", ecTarget !== null && ecTarget < 80 ? "要対応" : "順調", `全社EC 目標比 ${percent(ecTarget)}`, [["全社EC売上", formatYen(ec)], ["目標比", percent(ecTarget)], ["前年比", signed(ecYoy, "%")], ["稼働店舗数", `${stores.filter((store) => metricNullableNumber(store.metrics.ecSales) !== null).length}店舗`]], ec, ecYoy)
  ];
}

function signal(key, label, question, conclusion, lead, details, value, comparison) { return { key, label, question, conclusion, lead, details, value, comparison }; }

function renderExecutiveSignalSummary(signals) {
  const labels = { sales: "良好", profit: signals.find((item) => item.key === "profit")?.conclusion === "確定" ? "良好" : "集計中", customers: "改善中", ticket: "良好", retail: "横ばい", ec: "要対応" };
  const levels = { sales: "good", profit: labels.profit === "良好" ? "good" : "watch", customers: "watch", ticket: "good", retail: "watch", ec: "attention" };
  elements.executiveSignalLinks.replaceChildren(...signals.map((signal) => {
    const button = node("button", `executive-signal executive-signal-${levels[signal.key]}`, `${signal.label}　${labels[signal.key]}`); button.type = "button";
    button.addEventListener("click", () => { const target = document.querySelector(`[data-signal="${signal.key}"]`); target?.scrollIntoView({ behavior: "smooth", block: "center" }); target?.focus({ preventScroll: true }); });
    return button;
  }));
}

function renderSharedTrend(signals) {
  const section = node("section", "shared-trend"); section.setAttribute("aria-labelledby", "shared-trend-heading");
  const header = node("div", "shared-trend-header"); const title = node("h3", "", "経営シグナルの推移"); title.id = "shared-trend-heading"; header.append(title, node("p", "", "カードまたは指標を選ぶと、このグラフだけが切り替わります。"));
  const metricControls = segmentedControls("指標", signals.map((item) => [item.key, item.label]), state.trendMetric, (value) => { state.trendMetric = value; renderDecisionSignals(state.projection, scopedStores()); });
  const periodControls = segmentedControls("期間", [["year_compare", "前年対比"], ["six_months", "直近6か月"], ["twelve_months", "12か月"]], state.trendPeriod, (value) => { state.trendPeriod = value; renderDecisionSignals(state.projection, scopedStores()); });
  const selected = signals.find((item) => item.key === state.trendMetric) || signals[0];
  const chart = createTrendChart(selected);
  section.append(header, metricControls, periodControls, chart); return section;
}

function segmentedControls(label, options, selected, onSelect) {
  const fieldset = document.createElement("fieldset"); fieldset.className = "trend-controls"; fieldset.append(node("legend", "", label));
  options.forEach(([value, text]) => { const button = node("button", "", text); button.type = "button"; button.setAttribute("aria-pressed", String(value === selected)); button.addEventListener("click", () => onSelect(value)); fieldset.append(button); });
  return fieldset;
}

function createTrendChart(selected) {
  const wrap = node("div", "trend-chart");
  const isDemo = ["mock", "preview", "staging"].includes(state.runtimeFeatureFlag);
  if (!isDemo || selected.value === null) { wrap.append(empty("推移データを準備しています")); return wrap; }
  const count = state.trendPeriod === "year_compare" ? 2 : state.trendPeriod === "twelve_months" ? 12 : 6;
  const factors = Array.from({ length: count }, (_, index) => .91 + index * (.09 / Math.max(1, count - 1)) + Math.sin(index * 1.7) * .012);
  const currentValues = factors.map((factor) => selected.value * factor);
  const comparisonRate = Number(selected.comparison || 0) / 100;
  const previousValues = currentValues.map((value, index) => value / Math.max(.1, 1 + comparisonRate) * (.995 + Math.cos(index * 1.3) * .008));
  const allValues = [...currentValues, ...previousValues]; const min = Math.min(...allValues) * .98; const max = Math.max(...allValues) * 1.02; const range = Math.max(1, max - min);
  const points = (values) => values.map((value, index) => `${40 + index * (560 / Math.max(1, count - 1))},${145 - (value - min) / range * 105}`).join(" ");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 640 180"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${selected.label}の${state.trendPeriod === "six_months" ? "直近6か月" : state.trendPeriod === "twelve_months" ? "12か月" : "前年対比"}推移`);
  const baseline = document.createElementNS(svg.namespaceURI, "line"); baseline.setAttribute("x1", "40"); baseline.setAttribute("x2", "600"); baseline.setAttribute("y1", "145"); baseline.setAttribute("y2", "145"); baseline.setAttribute("class", "trend-baseline");
  const currentLine = document.createElementNS(svg.namespaceURI, "polyline"); currentLine.setAttribute("points", points(currentValues)); currentLine.setAttribute("class", "trend-line trend-line-current");
  const previousLine = document.createElementNS(svg.namespaceURI, "polyline"); previousLine.setAttribute("points", points(previousValues)); previousLine.setAttribute("class", "trend-line trend-line-previous");
  const legend = node("div", "trend-legend"); legend.append(node("span", "trend-legend-current", "今年"), node("span", "trend-legend-previous", "前年"));
  svg.append(baseline, previousLine, currentLine); wrap.append(legend, svg, node("p", "trend-summary", `${selected.label}: ${formatTrendValue(selected.key, currentValues.at(-1))}（今年） ／ ${formatTrendValue(selected.key, previousValues.at(-1))}（前年）`)); return wrap;
}

function renderStatusFilters(stores) {
  const order = ["Needs Attention", "Improving", "Stable", "Good", "All"];
  $("status-filters").replaceChildren(...order.map((status) => {
    const count = status === "All" ? stores.length : stores.filter((store) => store.status === status).length;
    const button = node("button", "status-filter", `${status === "All" ? "すべて" : statusNames[status]} ${count}`);
    button.type = "button"; button.dataset.status = status; button.setAttribute("aria-pressed", String(state.statusFilter === status));
    button.addEventListener("click", () => { state.statusFilter = status; renderStatusFilters(stores); renderStores(); });
    return button;
  }));
}

function renderStores() {
  const stores = canSelectScope(state.effectiveRole, state.scope)
    ? selectStoreView(state.projection?.stores || [], state.scope, state.statusFilter, state.sort)
    : [];
  if (!stores.length) {
    const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 10; td.append(emptyState()); tr.append(td);
    elements.rows.replaceChildren(tr); elements.cards.replaceChildren(emptyState()); return;
  }
  elements.rows.replaceChildren(...stores.map((store) => {
    const row = document.createElement("tr"); row.tabIndex = 0; row.setAttribute("aria-label", `${store.storeName}の店舗詳細を開く`);
    row.append(cell(store.storeName), cell(statusBadge(store.status)), cell(storeAm(store)), metricCell(store, "sales"), metricCell(store, "operatingProfit"),
      cell(store.metrics.customerCount?.displayValue || "—", "optional-col"), metricCell(store, "totalRepeat"), metricCell(store, "productivity"), cell(storeFocus(store)), cell("›"));
    row.addEventListener("click", () => showDetail(store.storeKey)); row.addEventListener("keydown", (e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); row.click(); } });
    return row;
  }));
  elements.cards.replaceChildren(...stores.map(storeCard));
}

function showDetail(storeKey, managerHome = false, targetTab = null) {
  state.listScroll = window.scrollY;
  state.selectedStore = state.projection?.stores?.find((store) => store.storeKey === storeKey);
  if (!state.selectedStore) return;
  elements.executive.hidden = true; elements.detail.hidden = false;
  $("back-to-list").hidden = managerHome || state.effectiveRole === "store_manager";
  $("page-title").textContent = state.effectiveRole === "store_manager"
    ? scopeHeading("store_manager", "Self", state.selectedStore.storeName)
    : "店舗詳細";
  $("detail-name").textContent = state.selectedStore.storeName;
  $("detail-status").replaceChildren(statusBadge(state.selectedStore.status));
  $("detail-conclusion").textContent = state.selectedStore.conclusion || state.selectedStore.statusReason || "";
  const managerFocus = $("manager-focus"); managerFocus.hidden = state.effectiveRole !== "store_manager";
  if (!managerFocus.hidden) {
    const otherChecks = Array.isArray(state.selectedStore.otherChecks) ? state.selectedStore.otherChecks : (state.selectedStore.actions || []).map((action) => action.reason);
    $("manager-focus-title").textContent = storeFocus(state.selectedStore);
    $("manager-checks").replaceChildren(heading("その他の確認事項"), orderedList(otherChecks.slice(0, 2)), heading("次に確認すること"), paragraph(state.selectedStore.nextCheck || state.selectedStore.actions?.[0]?.recommendation || "最新データをご確認ください"));
  }
  setTab(targetTab || state.tab || "summary"); window.scrollTo({ top: 0 });
}

function showList() {
  if (state.effectiveRole === "store_manager") return;
  elements.detail.hidden = true; elements.executive.hidden = false; state.selectedStore = null;
  $("page-title").textContent = scopeHeading(state.effectiveRole, state.scope);
  requestAnimationFrame(() => window.scrollTo({ top: state.listScroll }));
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[role=tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
  const store = state.selectedStore; if (!store) return;
  if (tab === "sales") return renderSalesDetail(store);
  const grid = node("div", "detail-metrics");
  (metricLabels[tab] || metricLabels.summary).forEach((key) => grid.append(detailMetric(labels[key] || key, store.metrics[key])));
  if (tab === "value") {
    const note = node("p", "accounting-note", "ⓘ 稼働スタッフ数は、勤務日数、勤務比率、月中異動、応援実績を考慮した換算人数です。");
    elements.detailPanel.replaceChildren(grid, note);
  } else elements.detailPanel.replaceChildren(grid);
}

function renderSalesDetail(store) {
  const sales = node("section", "detail-section"); sales.append(heading("売上構成"), detailMetric("総売上（税込）", store.metrics.sales));
  const components = [["店舗売上", "storeSales", 96], ["　技術売上", "technicalSales", 82], ["　通常店販売上", "regularRetail", 10], ["　MID売上", "mid", 5], ["EC按分売上", "ecSales", 4]];
  const chart = node("div", "composition");
  components.forEach(([label, key, width]) => {
    const row = node("div", "composition-row"); const bar = node("div", "bar"); const fill = node("span"); fill.style.width = `${width}%`; bar.append(fill);
    row.append(node("span", "", label), bar, node("strong", "", metricText(store.metrics[key]))); chart.append(row);
  });
  sales.append(chart, paragraph("店舗売上とEC按分売上を分け、総売上との階層関係を表示しています。"));
  const profit = node("section", "detail-section"); profit.append(heading(`${formatMonth(elements.period.value)} 利益`));
  if (store.metrics.operatingProfit.dataState === "available") {
    const grid = node("div", "detail-metrics");
    ["grossProfit", "operatingProfit", "operatingProfitMargin", "ordinaryProfit"].forEach((key) => grid.append(detailMetric(store.metrics[key].label, store.metrics[key])));
    profit.append(grid);
  } else {
    profit.append(node("div", "metric-value", stateText(store.metrics.operatingProfit.dataState)), paragraph(store.metrics.operatingProfit.reason || "7月15日頃確定予定"),
      node("button", "text-button", "前月の確定利益を見る"));
  }
  profit.append(node("p", "accounting-note", "利益は経理確定後の数値です。店舗運営は利益だけでなく、お客様満足、人材育成、組織成長を含めて総合的に判断します。"));
  elements.detailPanel.replaceChildren(sales, profit);
}

function storeCard(store) {
  const article = node("article", "store-card"); const header = node("div", "store-card-header"); header.append(heading(store.storeName), statusBadge(store.status));
  const dl = document.createElement("dl");
  [["総売上（税込）", "sales"], ["利益", "operatingProfit"], ["総リピート率", "totalRepeat"], ["総生産性", "productivity"]].forEach(([label, key]) => {
    const group = node("div"); const dt = node("dt", "", label); const dd = node("dd", "", metricText(store.metrics[key])); group.append(dt, dd); dl.append(group);
  });
  const am = node("div"); am.append(node("dt", "", "担当AM"), node("dd", "", storeAm(store))); dl.append(am);
  const focus = node("p", "", `今月の重点\n${storeFocus(store)}`); const button = node("button", "action-link", "店舗を確認 →"); button.type = "button"; button.addEventListener("click", () => showDetail(store.storeKey));
  // 旧比較名: 売上 / 営業利益率 / 経常利益率 / 主な確認理由（statusReason）
  article.append(header, dl, focus, button); return article;
}

function detailMetric(label, metric) {
  const item = node("article", "detail-metric"); const value = node("div", "metric-value", metricText(metric));
  value.setAttribute("aria-label", metricAriaLabel(label, metric)); item.append(node("div", "metric-label", label), value);
  if (metric?.reason) item.append(node("div", "metric-note", metric.reason)); return item;
}
function metricCard(metric) { const item = node("article", "metric"); item.append(node("div", "metric-label", metric.label), node("div", "metric-value", metricText(metric))); if (metric.reason) item.append(node("div", "metric-note", metric.reason)); return item; }
function metricCell(store, key) { return cell(metricText(store.metrics[key])); }
function metricText(metric) { return metric?.dataState === "available" && metric.displayValue !== null ? String(metric.displayValue) : stateText(metric?.dataState); }
function stateText(value) { return ({ confirmed: "確定", available: "確定", collecting: "集計中", pending: "集計中", preparing: "準備中", unavailable: "取得できません", validation_error: "データ確認が必要です" })[value] || "準備中"; }
function metricAriaLabel(label, metric) { return `${label}、${metricText(metric)}`; }
function statusBadge(status) { const badge = node("span", `status status-${String(status).toLowerCase().replaceAll(" ", "-")}`, statusNames[status] || "安定"); badge.setAttribute("aria-label", `店舗状態: ${badge.textContent}`); return badge; }
function formatMonth(value) { const match = String(value || "").match(/^(\d{4})-(\d{2})$/); return match ? `${match[1]}年${Number(match[2])}月` : "—"; }
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); }
function formatYen(value) { return value === null ? "準備中" : value >= 100_000_000 ? `${(value / 100_000_000).toFixed(2)}億円` : `${Math.round(value / 10_000).toLocaleString()}万円`; }
function metricNumber(metric) { return Number(metric?.rawValue ?? metric?.value ?? 0); }
function metricNullableNumber(metric) { const value = metric?.rawValue ?? metric?.value; return Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null; }
function ratioDelta(value) { return value === null ? null : value - 100; }
function signed(value, suffix) { return value === null ? "準備中" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix}`; }
function percent(value) { return value === null ? "準備中" : `${value.toFixed(1)}%`; }
function yen(value) { return value === null ? "準備中" : `¥${Math.round(value).toLocaleString("ja-JP")}`; }
function count(value) { return value === null ? "準備中" : `${Math.round(value).toLocaleString("ja-JP")}人`; }
function signedConclusion(value, positive = "上昇", negative = "低下") { return value === null ? "準備中" : value >= .5 ? positive : value <= -.5 ? negative : "横ばい"; }
function formatTrendValue(key, value) { return ["sales", "profit", "retail", "ec"].includes(key) ? formatYen(value) : key === "customers" ? count(value) : yen(value); }
function actionImpact(ruleId) { return ruleId === "new_repeat" ? "既存客数の増加" : ruleId === "ticket_and_repeat" ? "売上と利益の安定" : "改善の定着"; }
function storeFocus(store) { return store?.focus || store?.statusReason || "今月の重点をチームで確認しましょう。"; }
function storeAm(store) { if (store?.area) return `${store.area}AM`; const number = Number(String(store?.storeKey || "").match(/(\d{2})$/)?.[1] || 1); return ["西東京AM", "埼玉AM", "都心AM"][(number - 1) % 3]; }
function setNotice(title, body) { elements.noticeTitle.textContent = title; elements.noticeBody.textContent = body; }
function setPressed(selector, current) { document.querySelectorAll(selector).forEach((button) => button.setAttribute("aria-pressed", String(button === current))); }
function cell(value, className = "") { const td = node("td", className); value instanceof Node ? td.append(value) : td.textContent = String(value ?? "—"); return td; }
function node(tag, className = "", text = "") { const item = document.createElement(tag); if (className) item.className = className; if (text !== "") item.textContent = text; return item; }
function heading(text) { return node("h3", "", text); }
function paragraph(text) { return node("p", "", text); }
function empty(text) { return node("div", "empty", text); }
function emptyState(text = "選択した条件に該当するデータは0件です。") { return empty(text); }
function orderedList(items) { const list = document.createElement("ol"); items.slice(0, 3).forEach((text) => { const li = node("li", "", text); list.append(li); }); return list; }
function renderManagerEmpty() { elements.executive.hidden = false; elements.detail.hidden = true; elements.summary.replaceChildren(emptyState()); }
function handleTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault();
  const tabs = [...document.querySelectorAll("[role=tab]")]; const current = tabs.indexOf(event.currentTarget);
  const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
  tabs[next].focus(); tabs[next].click();
}
