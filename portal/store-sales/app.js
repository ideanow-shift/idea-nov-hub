import { createStoreSalesMockIdentity, createStoreSalesRuntime } from "./runtime/index.js";
import { allowedScopes, canSelectScope, emptyScopeMessage, normalizeScope, scopeHeading } from "./permission-scope.js";
import { createStoreViewSelector } from "./store-view-selector.js";
import { restoreStoreSalesPreviewContext } from "./preview-context.js";
import { getNovHubSessionStatus } from "../js/nov-hub-session-candidate.js";

const SAFE_STORE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/iu;
const state = {
  projection: null, runtime: null, runtimeStatus: "initializing", runtimeFeatureFlag: null, effectiveRole: "sales_manager", initializedRole: null, selectedStore: null, tab: "summary", audience: "executive",
  statusFilter: "Needs Attention", sort: "status", scope: "All", periodMode: "monthly", listScroll: 0, trendMetric: "sales", trendPeriod: "six_months", selectedStoreKey: null,
  development: { role: "sales_manager", runtimeState: "ready", profitMode: "collecting", missingData: true }
};
const $ = (id) => document.getElementById(id);
const elements = {
  notice: $("notice"), noticeTitle: $("notice-title"), noticeBody: $("notice-body"), retry: $("retry-button"),
  period: $("period"), storeSelector: $("store-selector"), executive: $("executive-view"), detail: $("detail-view"), summary: $("summary-metrics"),
  actions: $("priority-actions"), drivers: $("business-drivers"), rows: $("store-rows"), cards: $("store-cards"),
  detailPanel: $("detail-panel"), devControls: $("dev-controls"), executiveSignals: $("executive-signals"), executiveSignalLinks: $("executive-signal-links")
};
const metricLabels = {
  summary: ["sales", "budgetRatio", "yearOverYearRatio", "operatingProfit", "customerCount", "totalTicket", "totalRepeat", "productivity"],
  customer: ["totalRepeat", "new", "returning", "loyal", "customerCount", "newCustomerCount", "existingCustomerCount"],
  value: ["totalTicket", "productivity", "technicalTicket", "technicalProductivity", "retailSales", "retailPurchaseCustomerVisits", "retailPurchaseRate", "actualLaborFte"]
};
const labels = {
  sales: "総売上（税抜）", operatingProfit: "営業利益", customerCount: "総客数", totalTicket: "総単価（税抜）",
  budgetRatio: "予算比", yearOverYearRatio: "前年同月比",
  totalRepeat: "総リピート率", productivity: "総生産性", new: "新規リピート率", returning: "再来リピート率",
  loyal: "固定リピート率", newCustomerCount: "新規客数", existingCustomerCount: "既存客数",
  technicalTicket: "技術単価", technicalProductivity: "技術生産性", retailSales: "店販売上", retailPurchaseCustomerVisits: "店販購買客数", retailPurchaseRate: "店販購買率", actualLaborFte: "実労働FTE（換算人数）"
};
const statusOrder = { "Needs Attention": 0, Preparing: 1, Improving: 2, Stable: 3, Good: 4 };
const statusNames = { "Needs Attention": "要対応", Preparing: "準備中", Improving: "改善中", Stable: "安定", Good: "好調" };
const selectStoreView = createStoreViewSelector();
const hubLaunchContext = restoreStoreSalesPreviewContext();
const hubLaunchSessionAvailable = getNovHubSessionStatus() === "available";
if (hubLaunchContext?.mockRole) state.development.role = hubLaunchContext.mockRole;

initialize();

async function initialize() {
  bindControls();
  installViewHistory();
  const runtimeConfig = globalThis.STORE_SALES_RUNTIME_CONFIG || {};
  state.runtime = createStoreSalesRuntime({
    location, runtimeConfig,
    dependencies: {
      isOnline: () => navigator.onLine,
      refreshSession: typeof globalThis.STORE_SALES_SESSION_REFRESHER === "function"
        ? globalThis.STORE_SALES_SESSION_REFRESHER
        : undefined,
      getDevelopmentState: () => state.development,
      getMockIdentity: () => hubLaunchContext?.mockRole && hubLaunchSessionAvailable ? createStoreSalesMockIdentity(state.development.role) : null
    }
  });
  state.runtime.subscribe(renderRuntimeSnapshot);
  await state.runtime.initialize({ period: elements.period.value, storeKey: state.selectedStoreKey });
}

function installViewHistory() {
  window.history.replaceState({ ...(window.history.state || {}), storeSalesView: "list" }, document.title);
  window.addEventListener("popstate", (event) => {
    const view = event.state?.storeSalesView;
    const storeKey = String(event.state?.storeKey || "");
    if (view === "detail" && storeKey && state.projection?.stores?.some((store) => store.storeKey === storeKey)) {
      showDetail(storeKey, false, null, { fromHistory: true });
      return;
    }
    showList({ fromHistory: true });
  });
}

function bindControls() {
  elements.period.addEventListener("change", () => reload());
  elements.storeSelector.addEventListener("change", () => {
    const candidate = elements.storeSelector.value;
    state.selectedStoreKey = candidate && SAFE_STORE_KEY.test(candidate) ? candidate : null;
    reload();
  });
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
  return state.runtime?.load({ period: elements.period.value, storeKey: state.selectedStoreKey });
}

function configureStoreSwitcher(projection, role) {
  const label = $("store-switcher-label");
  if (role === "store_manager") {
    label.hidden = true;
    return;
  }
  const source = Array.isArray(projection.storeOptions) ? projection.storeOptions : projection.stores || [];
  const options = source.filter((store) => SAFE_STORE_KEY.test(String(store?.storeKey || "")) && String(store?.storeName || ""));
  const aggregate = document.createElement("option");
  aggregate.value = "";
  aggregate.textContent = role === "representative" ? "全店舗" : "担当店舗全体";
  const nodes = [aggregate, ...options.map((store) => {
    const option = document.createElement("option");
    option.value = store.storeKey;
    option.textContent = store.storeName;
    return option;
  })];
  elements.storeSelector.replaceChildren(...nodes);
  state.selectedStoreKey = projection.selectedStoreKey || null;
  elements.storeSelector.value = state.selectedStoreKey || "";
  label.hidden = options.length === 0;
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
  elements.notice.classList.toggle("is-blocking", !hasProjection || isBlocking);
  elements.notice.classList.toggle("is-error", !["initializing", "loading", "ready", "empty"].includes(snapshot.status));
  setNotice(snapshot.presentation?.title || "店舗営業情報を確認しています", snapshot.presentation?.body || "少々お待ちください。");
  if (!hasProjection || isBlocking) {
    document.querySelector("main").hidden = true;
    return;
  }
  state.projection = snapshot.projection;
  state.selectedStoreKey = snapshot.projection?.selectedStoreKey || null;
  if (state.projection?.stores?.length && state.projection.stores.every((store) => store.status === "Preparing")) state.statusFilter = "All";
  const syntheticProjection = ["mock", "preview"].includes(snapshot.featureFlag) || (snapshot.featureFlag === "staging" && (snapshot.projection?.contractVersion !== "STORE_MONTHLY_ACTUAL_V1" || snapshot.projection?.readiness?.fixtureData === true));
  $("preview-banner").hidden = !syntheticProjection;
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
  if (projection.stores.length && projection.stores.every((store) => store.status === "Preparing")) state.statusFilter = "All";
  state.effectiveRole = role;
  configureScopeControls(role);
  configureStoreSwitcher(projection, role);
  $("direction-message").textContent = projection.directionMessage || "";
  $("meta-sales-period").textContent = formatMonth(elements.period.value);
  $("meta-accounting-period").textContent = formatMonth(projection.accounting?.confirmedThroughPeriod); // 確定値の対象月
  $("meta-state").textContent = stateText(projection.accounting?.confirmationState);
  $("meta-updated").textContent = formatDate(projection.accounting?.lastUpdatedAt);
  $("meta-tax-basis").textContent = projection.taxBasis === "net" ? "税抜" : "確認不可";
  $("filter-updated").textContent = `最終更新 ${formatDate(projection.accounting?.lastUpdatedAt)}`;
  if (state.audience === "store_manager" || role === "store_manager") {
    elements.executiveSignals.hidden = true;
    const ownStore = projection.stores?.[0];
    $("sticky-filters").hidden = true;
    if (ownStore) showDetail(ownStore.storeKey, true);
    else renderManagerEmpty();
    return;
  }
  if (state.selectedStoreKey && projection.stores.length === 1) {
    elements.executiveSignals.hidden = true;
    $("sticky-filters").hidden = false;
    showDetail(state.selectedStoreKey, false);
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
  const salesMetric = (store) => state.periodMode === "cumulative" ? store.yearly?.metrics?.sales : store.metrics.sales;
  const salesReady = stores.every((store) => salesMetric(store)?.dataState === "available");
  const total = salesReady ? stores.reduce((sum, store) => sum + metricNumber(salesMetric(store)), 0) : null;
  const profit = summaryProfitMetric(stores, state.scope);
  const preparingStatusCount = stores.filter((store) => store.status === "Preparing").length;
  const evaluatedStatusCount = stores.length - preparingStatusCount;
  const statusReady = evaluatedStatusCount > 0;
  const attention = stores.filter((store) => store.status === "Needs Attention").length;
  const fiscalStart = stores.map((store) => store.yearly?.startMonth).filter(Boolean);
  const salesPeriodNote = state.periodMode === "cumulative"
    ? fiscalStart.length ? `${formatMonth(fiscalStart.sort()[0])}〜${formatMonth(elements.period.value)}の累計` : `${formatMonth(elements.period.value)}までの累計`
    : formatMonth(elements.period.value);
  const salesSummaryMetric = {
    label: `総売上（税抜・${state.periodMode === "cumulative" ? "累計" : "月次"}）`,
    displayValue: formatYen(total), dataState: "available", reason: salesPeriodNote
  };
  if (!salesReady) Object.assign(salesSummaryMetric, { displayValue: null, dataState: "preparing", reason: "未登録値をゼロとして表示しません" });
  const stagingFixture = state.runtimeFeatureFlag === "staging" && (projection.contractVersion !== "STORE_MONTHLY_ACTUAL_V1" || projection.readiness?.fixtureData === true);
  $("summary-narrative").textContent = stagingFixture ? "現在は営業部レビュー用の架空20店舗サンプルです。実績値ではありません。" :
    state.scope === "All" ? (projection.executiveSummary?.narrative || "") :
    statusReady ? `${scopeLabel}の売上状況です。現在、判定済み${evaluatedStatusCount}店舗のうち${attention}店舗に対応が必要です。` : `${scopeLabel}の店舗状態を準備しています。`;
  elements.summary.replaceChildren(
    metricCard(salesSummaryMetric),
    metricCard(profit), metricCard({
      label: "要対応店舗", displayValue: statusReady ? `${attention}店舗` : null,
      dataState: statusReady ? "available" : "preparing",
      reason: !statusReady ? "比較指標の接続後に判定します" : preparingStatusCount ? `${preparingStatusCount}店舗は判定準備中です` : ""
    })
  );
  $("status-counts").replaceChildren(...Object.keys(statusOrder).reverse().map((status) => {
    const box = node("span", "status-count");
    box.append(statusBadge(status), node("strong", "", String(stores.filter((store) => store.status === status).length)));
    return box;
  }));
  const accounting = projection.accounting || {};
  $("coverage-note").textContent = stagingFixture ? "すべて画面確認用の架空20店舗fixtureです。実績値ではありません。" : accounting.reflectedStoreCount < accounting.totalStoreCount
    ? `${accounting.reflectedStoreCount}店舗のデータで表示しています。${accounting.totalStoreCount - accounting.reflectedStoreCount}店舗は集計中です。` : `${stores.length}店舗のデータを表示しています。`;
}

function renderActions(actions) {
  if (!actions.length) {
    const preparing = (state.projection?.stores || []).some((store) => store.status === "Preparing");
    return elements.actions.replaceChildren(empty(preparing ? "店舗月次実績または比較指標を準備しています。データが揃うまで優先順位は生成しません。" : "現在、優先して確認することはありません"));
  }
  elements.actions.replaceChildren(...actions.slice(0, 3).map((action) => {
    const card = node("article", "action-card"); card.tabIndex = 0;
    card.append(node("h3", "action-theme", action.theme || action.recommendation), node("div", "action-store", action.storeName),
      paragraph(action.reason), node("p", "action-advice", `次に確認: ${actionAdvice(action)}`),
      node("p", "impact", `期待効果: ${action.impact || actionImpact(action.ruleId)}`));
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
  signalGrid.setAttribute("aria-label", "7つの経営シグナル");
  signalValues.forEach((signal) => {
    const card = node("button", "decision-signal-card"); card.type = "button"; card.dataset.signal = signal.key;
    card.setAttribute("aria-pressed", String(state.trendMetric === signal.key));
    card.setAttribute("aria-label", `${signal.label}、${signal.conclusion}。${signal.label}の詳細分析を開く`);
    const details = document.createElement("dl");
    signal.details.forEach(([label, value]) => { const group = node("div"); group.append(node("dt", "", label), node("dd", "", value)); details.append(group); });
    card.append(node("span", "signal-question", signal.question), node("h3", "", signal.label), node("strong", "signal-conclusion", signal.conclusion), node("p", "signal-lead", signal.lead), details);
    card.addEventListener("click", () => {
      state.trendMetric = signal.key;
      renderDecisionSignals(projection, stores);
      requestAnimationFrame(() => {
        const target = document.querySelector(`[data-analysis-signal="${signal.key}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        target?.focus({ preventScroll: true });
      });
    });
    signalGrid.append(card);
  });
  renderExecutiveSignalSummary(signalValues);
  const trend = renderSharedTrend(signalValues);
  const selected = signalValues.find((item) => item.key === state.trendMetric) || signalValues[0];
  const analysis = renderSignalAnalysis(selected, stores);
  elements.drivers.replaceChildren(signalGrid, trend, analysis);
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
  const sales = sum("sales"); const profitStores = stores.filter((store) => store.ownership !== "FC");
  const profitValues = profitStores.map((store) => metricNullableNumber(store.metrics.operatingProfit)).filter((value) => value !== null);
  const profit = profitValues.length ? profitValues.reduce((total, value) => total + value, 0) : null;
  const customerCount = sum("customerCount");
  const ticket = average("totalTicket"); const productivity = average("productivity"); const technicalProductivity = average("technicalProductivity");
  const laborFte = sum("actualLaborFte"); const retail = sum("retailSales"); const mid = sum("mid"); const ec = sum("ecSales");
  const salesYoy = ratioDelta(average("yearOverYearRatio")); const budget = average("budgetRatio");
  const profitYoy = average("profitYearOverYear"); const customerYoy = average("customerYearOverYear");
  const ticketYoy = average("ticketYearOverYear"); const retailYoy = average("retailYearOverYear"); const retailBudget = average("retailBudgetRatio");
  const ecTarget = average("ecTargetRatio"); const ecYoy = average("ecYearOverYear");
  const profitOutOfScope = profitStores.length === 0;
  const profitReady = !profitOutOfScope && profitStores.every((store) => store.metrics.operatingProfit?.dataState === "available");
  return [
    signal("sales", "売上", "売上は上がっているか", signedConclusion(salesYoy), `予算比 ${percent(budget)} ／ 前年比 ${signed(salesYoy, "%")}`, [["総売上（税抜）", formatYen(sales)], ["予算比", percent(budget)], ["前年比", signed(salesYoy, "%")]], sales, salesYoy),
    signal("profit", "利益", "利益は出ているか", profitOutOfScope ? "V1対象外" : profitReady ? "確定" : "集計中", profitOutOfScope ? "FC利益はV1では表示しません" : profitReady ? `営業利益 ${formatYen(profit)} ／ 利益率 ${percent(sales ? profit / sales * 100 : null)}` : "利益データを集計しています", [["営業利益", profitOutOfScope ? "V1対象外" : profitReady ? formatYen(profit) : "集計中"], ["営業利益率", profitOutOfScope ? "V1対象外" : profitReady ? percent(sales ? profit / sales * 100 : null) : "集計中"], ["前年比", profitOutOfScope ? "V1対象外" : profitReady ? signed(profitYoy, "%") : "集計中"]], profitReady ? profit : null, profitYoy),
    signal("customers", "集客", "集客できているか", signedConclusion(customerYoy, "改善", "要確認"), `客数 前年比 ${signed(customerYoy, "%")}`, [["総客数", count(customerCount)], ["新規客数", count(sum("newCustomerCount"))], ["既存客数", count(sum("existingCustomerCount"))], ["前年比", signed(customerYoy, "%")]], customerCount, customerYoy),
    signal("ticket", "単価", "単価は上がっているか", signedConclusion(ticketYoy), `総単価 前年比 ${signed(ticketYoy, "%")}`, [["総単価", yen(ticket)], ["技術単価", yen(average("technicalTicket"))], ["前年比", signed(ticketYoy, "%")]], ticket, ticketYoy),
    signal("productivity", "生産性", "人と時間を活かせているか", productivity === null ? "準備中" : "分析可能", `総生産性 ${yen(productivity)} ／ 技術生産性 ${yen(technicalProductivity)}`, [["総生産性", yen(productivity)], ["技術生産性", yen(technicalProductivity)], ["実労働FTE", fte(laborFte)], ["FTE当たり売上", laborFte ? yen(sales / laborFte) : "準備中"]], productivity, null),
    signal("retail", "商品", "商品は売れているか", Math.abs(retailYoy || 0) < .5 ? "横ばい" : signedConclusion(retailYoy), `店販売上 予算比 ${percent(retailBudget)} ／ 前年比 ${signed(retailYoy, "%")}`, [["店販売上", formatYen(retail)], ["店販売上予算比", percent(retailBudget)], ["店販購買率", percent(average("retailPurchaseRate"))], ["MID（参考値）", formatYen(mid)], ["EC売上（参考値）", formatYen(ec)], ["店販売上前年比", signed(retailYoy, "%")]], retail, retailYoy),
    signal("ec", "EC", "ECは動かせているか", ecTarget !== null && ecTarget < 80 ? "要対応" : "順調", `全社EC 目標比 ${percent(ecTarget)}`, [["全社EC売上", formatYen(ec)], ["目標比", percent(ecTarget)], ["前年比", signed(ecYoy, "%")], ["稼働店舗数", `${stores.filter((store) => metricNullableNumber(store.metrics.ecSales) !== null).length}店舗`]], ec, ecYoy)
  ];
}

function signal(key, label, question, conclusion, lead, details, value, comparison) { return { key, label, question, conclusion, lead, details, value, comparison }; }

function renderSignalAnalysis(selected, stores) {
  const model = buildSignalAnalysis(selected, stores);
  const section = node("section", "signal-analysis");
  section.dataset.analysisSignal = selected.key; section.tabIndex = -1;
  section.setAttribute("aria-labelledby", "signal-analysis-heading");
  const header = node("div", "signal-analysis-header");
  const headingGroup = node("div");
  const badge = node("span", "signal-analysis-badge", `${selected.label}・詳細`);
  const title = node("h3", "", `${selected.label}の詳細分析`); title.id = "signal-analysis-heading";
  headingGroup.append(badge, title, node("p", "", model.description));
  header.append(headingGroup, node("strong", "signal-analysis-status", selected.conclusion));

  const kpis = node("div", "signal-analysis-kpis");
  model.kpis.forEach(([label, value, note]) => {
    const item = node("article", "signal-analysis-kpi");
    item.append(node("span", "", label), node("strong", "", value));
    if (note) item.append(node("small", "", note));
    kpis.append(item);
  });

  const body = node("div", "signal-analysis-body");
  const checks = node("section", "signal-analysis-checks");
  checks.append(node("h4", "", "分解して確認するポイント"));
  const checkList = node("dl");
  model.checks.forEach(([label, value]) => { const row = node("div"); row.append(node("dt", "", label), node("dd", "", value)); checkList.append(row); });
  checks.append(checkList);

  const ranking = node("section", "signal-analysis-ranking");
  ranking.append(node("h4", "", `${model.rankLabel}の店舗比較`));
  if (!model.rankedStores.length) {
    ranking.append(empty("比較できる確定データを準備しています"));
  } else {
    const comparison = node("div", "signal-ranking-columns");
    if (model.rankedStores.length <= 3) comparison.append(renderSignalRanking("対象店舗", model.rankedStores, model));
    else comparison.append(
      renderSignalRanking("上位店舗", model.rankedStores.slice(0, 3), model),
      renderSignalRanking("要確認店舗", [...model.rankedStores].reverse().slice(0, 3), model)
    );
    ranking.append(comparison);
  }
  body.append(checks, ranking);
  section.append(header, kpis, body);
  return section;
}

function renderSignalRanking(title, stores, model) {
  const group = node("div", "signal-ranking-group"); group.append(node("h5", "", title));
  const list = node("ol", "signal-ranking-list");
  stores.forEach((store) => {
    const item = node("li");
    const button = node("button", "signal-ranking-link"); button.type = "button";
    button.setAttribute("aria-label", `${store.storeName}の${model.rankLabel}詳細を開く`);
    button.append(node("span", "", store.storeName), node("strong", "", formatAnalysisValue(model.rankKey, metricNullableNumber(store.metrics[model.rankKey]))));
    button.addEventListener("click", () => showDetail(store.storeKey, false, model.targetTab));
    item.append(button); list.append(item);
  });
  group.append(list); return group;
}

function buildSignalAnalysis(selected, stores) {
  const directStores = stores.filter((store) => store.ownership !== "FC");
  const values = (scope, key) => scope.map((store) => metricNullableNumber(store.metrics[key])).filter((value) => value !== null);
  const sum = (key, scope = stores) => { const found = values(scope, key); return found.length ? found.reduce((total, value) => total + value, 0) : null; };
  const average = (key, scope = stores) => { const found = values(scope, key); return found.length ? found.reduce((total, value) => total + value, 0) / found.length : null; };
  const available = (key, scope = stores) => values(scope, key).length;
  const sales = sum("sales"); const directSales = sum("sales", directStores); const directProfit = sum("operatingProfit", directStores);
  const totalTicket = average("totalTicket"); const technicalTicket = average("technicalTicket"); const laborFte = sum("actualLaborFte");
  const models = {
    sales: {
      description: "総売上を技術・商品・MID・ECに分け、店舗差と予算／前年の弱点を確認します。",
      kpis: [["総売上（税抜）", formatYen(sales)], ["技術売上", formatYen(sum("technicalSales"))], ["店販売上", formatYen(sum("retailSales"))], ["EC按分売上", formatYen(sum("ecSales"))]],
      checks: [["予算未達店舗", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.budgetRatio); return value !== null && value < 100; }).length}店舗`], ["前年割れ店舗", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.yearOverYearRatio); return value !== null && value < 100; }).length}店舗`], ["MID売上", formatYen(sum("mid"))], ["確定店舗", `${available("sales")}/${stores.length}店舗`]],
      rankKey: "sales", rankLabel: "総売上", targetTab: "sales", rankScope: stores
    },
    profit: {
      description: "直営店の確定利益だけを使い、利益額・利益率・店舗差を確認します。FC利益はV1対象外です。",
      kpis: [["営業利益", formatYen(directProfit)], ["売上総利益", formatYen(sum("grossProfit", directStores))], ["経常利益", formatYen(sum("ordinaryProfit", directStores))], ["営業利益率", percent(directSales && directProfit !== null ? directProfit / directSales * 100 : null)]],
      checks: [["直営店", `${directStores.length}店舗`], ["利益確定店舗", `${available("operatingProfit", directStores)}/${directStores.length}店舗`], ["FC対象外", `${stores.length - directStores.length}店舗`], ["利益前年割れ", `${directStores.filter((store) => { const value = metricNullableNumber(store.metrics.profitYearOverYear); return value !== null && value < 0; }).length}店舗`]],
      rankKey: "operatingProfit", rankLabel: "営業利益", targetTab: "sales", rankScope: directStores
    },
    customers: {
      description: "総客数を新規・既存・リピートに分け、どの顧客層が店舗差を生んでいるか確認します。",
      kpis: [["総客数", count(sum("customerCount"))], ["新規客数", count(sum("newCustomerCount"))], ["既存客数", count(sum("existingCustomerCount"))], ["総リピート率", percent(average("totalRepeat"))]],
      checks: [["新規リピート率", percent(average("new"))], ["再来リピート率", percent(average("returning"))], ["固定リピート率", percent(average("loyal"))], ["客数前年割れ", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.customerYearOverYear); return value !== null && value < 0; }).length}店舗`]],
      rankKey: "customerCount", rankLabel: "総客数", targetTab: "customer", rankScope: stores
    },
    ticket: {
      description: "総単価を技術単価と商品購買に分け、単価差の要因を店舗ごとに確認します。",
      kpis: [["総単価", yen(totalTicket)], ["技術単価", yen(technicalTicket)], ["店販購買率", percent(average("retailPurchaseRate"))], ["店販購買客数", count(sum("retailPurchaseCustomerVisits"))]],
      checks: [["総単価と技術単価の差", yen(totalTicket !== null && technicalTicket !== null ? totalTicket - technicalTicket : null)], ["単価前年割れ", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.ticketYearOverYear); return value !== null && value < 0; }).length}店舗`], ["総単価確定店舗", `${available("totalTicket")}/${stores.length}店舗`], ["購買率確定店舗", `${available("retailPurchaseRate")}/${stores.length}店舗`]],
      rankKey: "totalTicket", rankLabel: "総単価", targetTab: "value", rankScope: stores
    },
    productivity: {
      description: "生産性を売上・技術生産性・実労働FTEへ分解し、人数だけでは見えない時間当たりの成果を確認します。",
      kpis: [["総生産性（店舗平均）", yen(average("productivity"))], ["技術生産性（店舗平均）", yen(average("technicalProductivity"))], ["実労働FTE合計", fte(laborFte)], ["FTE当たり売上", laborFte && sales !== null ? yen(sales / laborFte) : "準備中"]],
      checks: [["総生産性確定店舗", `${available("productivity")}/${stores.length}店舗`], ["技術生産性確定店舗", `${available("technicalProductivity")}/${stores.length}店舗`], ["FTE反映店舗", `${available("actualLaborFte")}/${stores.length}店舗`], ["FTE未反映店舗", `${stores.length - available("actualLaborFte")}店舗`]],
      rankKey: "productivity", rankLabel: "総生産性", targetTab: "value", rankScope: stores
    },
    retail: {
      description: "店販売上を購買客数・購買率・MIDに分け、商品提案が成果につながっている店舗を比較します。",
      kpis: [["店販売上", formatYen(sum("retailSales"))], ["店販購買率", percent(average("retailPurchaseRate"))], ["店販購買客数", count(sum("retailPurchaseCustomerVisits"))], ["MID売上", formatYen(sum("mid"))]],
      checks: [["店販予算未達", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.retailBudgetRatio); return value !== null && value < 100; }).length}店舗`], ["店販前年割れ", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.retailYearOverYear); return value !== null && value < 0; }).length}店舗`], ["購買率確定店舗", `${available("retailPurchaseRate")}/${stores.length}店舗`], ["売上確定店舗", `${available("retailSales")}/${stores.length}店舗`]],
      rankKey: "retailSales", rankLabel: "店販売上", targetTab: "value", rankScope: stores
    },
    ec: {
      description: "全社EC売上を目標比・前年比・店舗按分で確認します。ECは選択店舗の単純合計ではなく全社判断の補助指標です。",
      kpis: [["全社EC売上", formatYen(sum("ecSales"))], ["目標比（店舗平均）", percent(average("ecTargetRatio"))], ["前年比（店舗平均）", signed(average("ecYearOverYear"), "%")], ["稼働店舗", `${available("ecSales")}/${stores.length}店舗`]],
      checks: [["目標比80%未満", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.ecTargetRatio); return value !== null && value < 80; }).length}店舗`], ["前年割れ店舗", `${stores.filter((store) => { const value = metricNullableNumber(store.metrics.ecYearOverYear); return value !== null && value < 0; }).length}店舗`], ["EC未反映店舗", `${stores.length - available("ecSales")}店舗`], ["確認単位", "全社＋店舗按分"]],
      rankKey: "ecSales", rankLabel: "EC按分売上", targetTab: "sales", rankScope: stores
    }
  };
  const model = models[selected.key] || models.sales;
  model.rankedStores = model.rankScope
    .filter((store) => metricNullableNumber(store.metrics[model.rankKey]) !== null)
    .sort((left, right) => metricNullableNumber(right.metrics[model.rankKey]) - metricNullableNumber(left.metrics[model.rankKey]));
  return model;
}

function formatAnalysisValue(key, value) {
  if (["sales", "operatingProfit", "retailSales", "ecSales"].includes(key)) return formatYen(value);
  if (key === "customerCount") return count(value);
  return yen(value);
}

function renderExecutiveSignalSummary(signals) {
  const profitConclusion = signals.find((item) => item.key === "profit")?.conclusion;
  const profitLabel = profitConclusion === "確定" ? "良好" : profitConclusion === "V1対象外" ? "V1対象外" : "集計中";
  const productivityConclusion = signals.find((item) => item.key === "productivity")?.conclusion;
  const labels = { sales: "良好", profit: profitLabel, customers: "改善中", ticket: "良好", productivity: productivityConclusion || "準備中", retail: "横ばい", ec: "要対応" };
  const levels = { sales: "good", profit: labels.profit === "良好" ? "good" : "watch", customers: "watch", ticket: "good", productivity: labels.productivity === "分析可能" ? "good" : "watch", retail: "watch", ec: "attention" };
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
  const isDbfProjection = state.projection?.contractVersion === "STORE_MONTHLY_ACTUAL_V1";
  const isDemo = ["mock", "preview"].includes(state.runtimeFeatureFlag)
    || (state.runtimeFeatureFlag === "staging" && !isDbfProjection);
  const count = state.trendPeriod === "year_compare" ? 2 : state.trendPeriod === "twelve_months" ? 12 : 6;
  const formal = state.projection?.monthlyTrend?.[selected.key] || [];
  let currentValues; let previousValues; let currentLabels;
  if (formal.length >= 2) {
    const selectedMonth = String(elements.period.value || "");
    const eligible = formal.filter((point) => point.fiscalMonth <= selectedMonth);
    const currentPoints = state.trendPeriod === "year_compare" ? eligible.slice(-1) : eligible.slice(-count);
    const byMonth = new Map(formal.map((point) => [point.fiscalMonth, point.value]));
    const priorFor = (month) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`;
    const prior = currentPoints.map((point) => byMonth.get(priorFor(point.fiscalMonth)));
    if (currentPoints.length < (state.trendPeriod === "year_compare" ? 1 : 2)) { wrap.append(empty("推移データを準備しています")); return wrap; }
    currentValues = currentPoints.map((point) => point.value);
    currentLabels = currentPoints.map((point) => formatTrendMonthLabel(point.fiscalMonth));
    previousValues = prior.every((value) => Number.isFinite(value)) ? prior : [];
    if (state.trendPeriod === "year_compare" && previousValues.length) {
      currentValues = [previousValues[0], currentValues[0]];
      currentLabels = [`前年${currentLabels[0]}`, `当年${currentLabels[0]}`];
      previousValues = [];
    }
  } else if (isDemo && selected.value !== null) {
    const comparisonRate = Number(selected.comparison || 0) / 100;
    if (state.trendPeriod === "year_compare") {
      currentValues = [selected.value / Math.max(.1, 1 + comparisonRate), selected.value];
      previousValues = []; currentLabels = ["前年", "当年"];
    } else {
      const factors = Array.from({ length: count }, (_, index) => .91 + index * (.09 / Math.max(1, count - 1)) + Math.sin(index * 1.7) * .012);
      currentValues = factors.map((factor) => selected.value * factor);
      previousValues = currentValues.map((value, index) => value / Math.max(.1, 1 + comparisonRate) * (.995 + Math.cos(index * 1.3) * .008));
      currentLabels = trendMonthLabels(count, elements.period.value);
    }
  } else { wrap.append(empty("DBFの確定履歴が2か月以上揃うまで数値は表示しません")); return wrap; }
  const allValues = [...currentValues, ...previousValues];
  const rawMin = Math.min(...allValues); const rawMax = Math.max(...allValues);
  const padding = Math.max(1, (rawMax - rawMin) * .12, Math.abs(rawMax) * .02);
  const min = rawMin - padding; const max = rawMax + padding; const range = Math.max(1, max - min);
  const left = 82; const right = 620; const top = 20; const bottom = 168;
  const xAt = (index, length) => left + index * ((right - left) / Math.max(1, length - 1));
  const yAt = (value) => bottom - (value - min) / range * (bottom - top);
  const points = (values) => values.map((value, index) => `${xAt(index, values.length)},${yAt(value)}`).join(" ");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 660 220"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${selected.label}の${state.trendPeriod === "six_months" ? "直近6か月" : state.trendPeriod === "twelve_months" ? "12か月" : "前年対比"}推移。縦軸は${trendAxisUnit(selected.key)}、横軸は期間`);
  const axisLayer = document.createElementNS(svg.namespaceURI, "g"); axisLayer.setAttribute("class", "trend-axes");
  Array.from({ length: 5 }, (_, index) => max - range * (index / 4)).forEach((value) => {
    const y = yAt(value);
    const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("x1", String(left)); line.setAttribute("x2", String(right)); line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y)); line.setAttribute("class", "trend-gridline");
    const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", String(left - 10)); label.setAttribute("y", String(y + 4)); label.setAttribute("text-anchor", "end"); label.setAttribute("class", "trend-axis-label trend-axis-label-y"); label.textContent = formatTrendAxisTick(selected.key, value);
    axisLayer.append(line, label);
  });
  currentLabels.forEach((labelText, index) => {
    if (currentLabels.length > 7 && index % 2 !== 0 && index !== currentLabels.length - 1) return;
    const x = xAt(index, currentLabels.length);
    const tick = document.createElementNS(svg.namespaceURI, "line"); tick.setAttribute("x1", String(x)); tick.setAttribute("x2", String(x)); tick.setAttribute("y1", String(bottom)); tick.setAttribute("y2", String(bottom + 5)); tick.setAttribute("class", "trend-axis-tick");
    const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", String(x)); label.setAttribute("y", String(bottom + 22)); label.setAttribute("text-anchor", "middle"); label.setAttribute("class", "trend-axis-label trend-axis-label-x"); label.textContent = labelText;
    axisLayer.append(tick, label);
  });
  const unit = document.createElementNS(svg.namespaceURI, "text"); unit.setAttribute("x", String(left)); unit.setAttribute("y", "12"); unit.setAttribute("class", "trend-axis-title"); unit.textContent = trendAxisUnit(selected.key); axisLayer.append(unit);
  const baseline = document.createElementNS(svg.namespaceURI, "line"); baseline.setAttribute("x1", String(left)); baseline.setAttribute("x2", String(right)); baseline.setAttribute("y1", String(bottom)); baseline.setAttribute("y2", String(bottom)); baseline.setAttribute("class", "trend-baseline");
  const currentLine = document.createElementNS(svg.namespaceURI, "polyline"); currentLine.setAttribute("points", points(currentValues)); currentLine.setAttribute("class", "trend-line trend-line-current");
  const previousLine = document.createElementNS(svg.namespaceURI, "polyline"); previousLine.setAttribute("points", points(previousValues)); previousLine.setAttribute("class", "trend-line trend-line-previous");
  const legend = node("div", "trend-legend"); legend.append(node("span", "trend-legend-current", state.trendPeriod === "year_compare" ? "実績" : "今年")); if (previousValues.length) legend.append(node("span", "trend-legend-previous", "前年"));
  svg.append(axisLayer, baseline); if (previousValues.length) svg.append(previousLine); svg.append(currentLine);
  const priorText = previousValues.length ? ` ／ ${formatTrendValue(selected.key, previousValues.at(-1))}（前年）` : "";
  wrap.append(legend, svg, node("p", "trend-summary", `${selected.label}: ${formatTrendValue(selected.key, currentValues.at(-1))}${priorText}`)); return wrap;
}

function trendMonthLabels(count, selectedMonth) {
  const matched = String(selectedMonth || "").match(/^(\d{4})-(\d{2})$/u);
  const end = matched ? new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, 1)) : new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (count - 1 - index), 1));
    return `${date.getUTCMonth() + 1}月`;
  });
}

function formatTrendMonthLabel(value) {
  const digits = String(value || "").replace(/[^\d]/gu, "");
  return digits.length >= 6 ? `${Number(digits.slice(4, 6))}月` : String(value || "—");
}

function trendAxisUnit(key) { return key === "customers" ? "人" : "円"; }
function formatTrendAxisTick(key, value) {
  if (key === "customers") return Math.round(value).toLocaleString("ja-JP");
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}億`;
  if (absolute >= 10_000) return `${Math.round(value / 10_000).toLocaleString("ja-JP")}万`;
  return Math.round(value).toLocaleString("ja-JP");
}

function renderStatusFilters(stores) {
  const order = ["Needs Attention", "Preparing", "Improving", "Stable", "Good", "All"];
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
    row.append(cell(store.storeName), cell(statusBadge(store.status)), cell(storeAm(store)), metricCell(store, "sales"), cell(profitText(store)),
      cell(store.metrics.customerCount?.displayValue || "—", "optional-col"), metricCell(store, "totalRepeat"), metricCell(store, "productivity"), cell(storeFocus(store)), cell("›"));
    row.addEventListener("click", () => showDetail(store.storeKey)); row.addEventListener("keydown", (e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); row.click(); } });
    return row;
  }));
  elements.cards.replaceChildren(...stores.map(storeCard));
}

function showDetail(storeKey, managerHome = false, targetTab = null, { fromHistory = false } = {}) {
  state.listScroll = window.scrollY;
  state.selectedStore = state.projection?.stores?.find((store) => store.storeKey === storeKey);
  if (!state.selectedStore) return;
  if (!managerHome && !fromHistory && (window.history.state?.storeSalesView !== "detail" || window.history.state?.storeKey !== storeKey)) {
    window.history.pushState({ ...(window.history.state || {}), storeSalesView: "detail", storeKey }, document.title);
  }
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

function showList({ fromHistory = false } = {}) {
  if (state.effectiveRole === "store_manager") return;
  if (!fromHistory && window.history.state?.storeSalesView === "detail") {
    window.history.back();
    return;
  }
  if (state.selectedStoreKey) {
    state.selectedStoreKey = null;
    reload();
    return;
  }
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
    const note = node("p", "accounting-note", "ⓘ 実労働FTEは、タイムカード実労働時間を同月の正式な店舗配置FTE比率で配賦し、173.76時間を1.0FTEとして算出します。実際の打刻店舗・応援先を示す値ではなく、実勤怠がない月は準備中です。");
    elements.detailPanel.replaceChildren(grid, note);
  } else elements.detailPanel.replaceChildren(grid);
}

function renderSalesDetail(store) {
  const sales = node("section", "detail-section"); sales.append(heading("売上構成（税抜）"), detailMetric("総売上（税抜）", store.metrics.sales));
  const components = [["店舗売上", "storeSales", 96], ["　技術売上", "technicalSales", 82], ["　通常店販売上", "regularRetail", 10], ["　MID売上", "mid", 5], ["EC按分売上", "ecSales", 4]];
  const chart = node("div", "composition");
  components.forEach(([label, key, width]) => {
    const row = node("div", "composition-row"); const bar = node("div", "bar"); const fill = node("span"); fill.style.width = `${width}%`; bar.append(fill);
    row.append(node("span", "", label), bar, node("strong", "", metricText(store.metrics[key]))); chart.append(row);
  });
  sales.append(chart, paragraph("店舗売上とEC按分売上を分け、総売上との階層関係を表示しています。"));
  const profit = node("section", "detail-section"); profit.append(heading(`${formatMonth(elements.period.value)} 利益`));
  if (store.ownership === "FC") {
    profit.append(node("div", "metric-value", "V1対象外"), paragraph("FC店舗の利益はStore Operations V1の表示対象外です。"));
  } else if (store.metrics.operatingProfit.dataState === "available") {
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
  [["総売上（税抜）", "sales"], ["利益", "operatingProfit"], ["総リピート率", "totalRepeat"], ["総生産性", "productivity"]].forEach(([label, key]) => {
    const group = node("div"); const dt = node("dt", "", label); const dd = node("dd", "", key === "operatingProfit" ? profitText(store) : metricText(store.metrics[key])); group.append(dt, dd); dl.append(group);
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
function profitText(store) { return store?.ownership === "FC" ? "V1対象外" : metricText(store?.metrics?.operatingProfit); }
function summaryProfitMetric(stores, scope) {
  const directStores = stores.filter((store) => store.ownership !== "FC");
  if (!directStores.length) return { label: "利益", displayValue: null, dataState: "out_of_scope_v1", reason: "FC利益はV1対象外" };
  const confirmed = directStores.every((store) => store.metrics.operatingProfit?.dataState === "available");
  const fcCount = stores.length - directStores.length;
  const label = scope === "All" ? `利益（直営${directStores.length}店舗のみ）` : "直営店利益";
  const reason = fcCount ? `FC${fcCount}店舗の利益はV1対象外です` : "税抜売上を基礎とした店舗営業利益";
  if (!confirmed) return { label, displayValue: null, dataState: directStores.some((store) => store.metrics.operatingProfit?.dataState === "preparing") ? "preparing" : "collecting", reason: "未確定利益は表示しません" };
  return { label, displayValue: formatYen(directStores.reduce((sum, store) => sum + metricNumber(store.metrics.operatingProfit), 0)), dataState: "available", reason };
}
function metricText(metric) { return metric?.dataState === "available" && metric.displayValue !== null ? String(metric.displayValue) : stateText(metric?.dataState); }
function stateText(value) { return ({ confirmed: "確定", available: "確定", collecting: "集計中", pending: "集計中", preparing: "準備中", unavailable: "取得できません", validation_error: "データ確認が必要です", out_of_scope_v1: "V1対象外" })[value] || "準備中"; }
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
function fte(value) { return value === null ? "準備中" : `${value.toFixed(2)} FTE`; }
function signedConclusion(value, positive = "上昇", negative = "低下") { return value === null ? "準備中" : value >= .5 ? positive : value <= -.5 ? negative : "横ばい"; }
function formatTrendValue(key, value) { return ["sales", "profit", "retail", "ec"].includes(key) ? formatYen(value) : key === "customers" ? count(value) : yen(value); }
function actionImpact(ruleId) { return ruleId === "new_repeat" ? "既存客数の増加" : ruleId === "ticket_and_repeat" ? "売上と利益の安定" : "改善の定着"; }
function actionAdvice(action) {
  if (action?.recommendation) return String(action.recommendation);
  const reason = String(action?.reason || "");
  if (/営業利益率/u.test(reason)) return "店舗詳細で売上・客数・単価を確認し、人件費・材料費・販促費の前年差を確認する";
  if (/予算/u.test(reason)) return "予算差を売上・客数・単価に分け、差が大きい項目から確認する";
  if (/前年/u.test(reason)) return "前年同月との差を客数と単価に分け、変化した要因を店舗へ確認する";
  if (/準備|未確定|データ/u.test(reason)) return "未提出・未承認のデータと確定予定日を確認する";
  return "店舗詳細で関連指標と前月・前年の変化を確認し、担当者と次の対応を決める";
}
function storeFocus(store) { return store?.focus || store?.statusReason || "今月の重点をチームで確認しましょう。"; }
function storeAm(store) {
  const assigned = String(store?.assignedAm || store?.areaManager || store?.area || "").trim();
  if (!assigned) return "準備中";
  return /AM$/u.test(assigned) ? assigned : `${assigned}AM`;
}
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
