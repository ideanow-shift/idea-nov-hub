import { createStoreSalesMockIdentity, createStoreSalesRuntime } from "./runtime/index.js";

const state = {
  projection: null, runtime: null, runtimeStatus: "initializing", selectedStore: null, tab: "summary", audience: "executive",
  statusFilter: "Needs Attention", sort: "status", scope: "All", periodMode: "monthly", listScroll: 0,
  development: { role: "sales_manager", runtimeState: "ready", profitMode: "collecting", missingData: true }
};
const $ = (id) => document.getElementById(id);
const elements = {
  notice: $("notice"), noticeTitle: $("notice-title"), noticeBody: $("notice-body"), retry: $("retry-button"),
  period: $("period"), executive: $("executive-view"), detail: $("detail-view"), summary: $("summary-metrics"),
  actions: $("priority-actions"), drivers: $("business-drivers"), rows: $("store-rows"), cards: $("store-cards"),
  detailPanel: $("detail-panel")
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

initialize();

async function initialize() {
  bindControls();
  const runtimeConfig = globalThis.STORE_SALES_RUNTIME_CONFIG || {};
  state.runtime = createStoreSalesRuntime({
    location, runtimeConfig,
    dependencies: {
      isOnline: () => navigator.onLine,
      getDevelopmentState: () => state.development,
      getMockIdentity: () => createStoreSalesMockIdentity(state.development.role)
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
  if (state.development.role === "sales_manager") state.statusFilter = "Needs Attention";
  if (state.development.role === "representative") state.statusFilter = "All";
}

function reload() {
  if (state.development.runtimeState === "loading") return renderRuntimeSnapshot({ status: "loading", presentation: { title: "読み込んでいます", body: "Mock Runtimeから店舗データを取得しています。" } });
  return state.runtime?.load({ period: elements.period.value });
}

function renderRuntimeSnapshot(snapshot) {
  state.runtimeStatus = snapshot.status;
  const hasProjection = ["ready", "empty"].includes(snapshot.status);
  const isBlocking = Boolean(snapshot.presentation?.blocking);
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
  const role = state.development.role;
  $("direction-message").textContent = projection.directionMessage || "";
  $("meta-sales-period").textContent = formatMonth(elements.period.value);
  $("meta-accounting-period").textContent = formatMonth(projection.accounting?.confirmedThroughPeriod); // 確定値の対象月
  $("meta-state").textContent = stateText(projection.accounting?.confirmationState);
  $("meta-updated").textContent = formatDate(projection.accounting?.lastUpdatedAt);
  $("filter-updated").textContent = `最終更新 ${formatDate(projection.accounting?.lastUpdatedAt)}`;
  if (state.audience === "store_manager" || role === "store_manager") {
    const ownStore = projection.stores?.[0];
    $("sticky-filters").hidden = true;
    if (ownStore) showDetail(ownStore.storeKey, true);
    else renderManagerEmpty();
    return;
  }
  $("sticky-filters").hidden = false;
  elements.executive.hidden = false; elements.detail.hidden = true;
  $("page-title").textContent = role === "area_manager" ? "担当店舗の状況" : "全店の状況";
  const stores = scopedStores();
  const scopeLabel = scopeLabelText(stores);
  $("summary-heading").textContent = role === "area_manager" ? `${projection.scopeLabel || "担当店舗"}の状況` : "全店の状況";
  renderSummary(projection, stores, scopeLabel);
  renderActions((projection.priorityActions || []).filter((action) => stores.some((store) => store.storeKey === action.storeKey)));
  renderDrivers(projection.businessDrivers || {});
  renderStatusFilters(stores);
  renderStores();
}

function scopedStores() {
  const stores = state.projection?.stores || [];
  return stores.filter((store) => state.scope === "All" || store.ownership === state.scope);
}

function scopeLabelText(stores) {
  if (state.scope === "Direct") return `直営${stores.length}店舗`;
  if (state.scope === "FC") return `FC${stores.length}店舗`;
  return state.projection?.scopeLabel || `全${stores.length}店舗`;
}

function renderSummary(projection, stores, scopeLabel) {
  if (!stores.length) {
    elements.summary.replaceChildren(emptyState());
    $("summary-narrative").textContent = `${scopeLabel}に表示できるデータがありません。`;
    $("status-counts").replaceChildren(); return;
  }
  const total = stores.reduce((sum, store) => sum + (store.metrics.sales.rawValue || 0), 0);
  const profit = stores[0].metrics.operatingProfit;
  const attention = stores.filter((store) => store.status === "Needs Attention").length;
  $("summary-narrative").textContent = state.scope === "All" ? (projection.executiveSummary?.narrative || "") :
    `${scopeLabel}の売上状況です。現在、${attention}店舗に対応が必要です。`;
  elements.summary.replaceChildren(
    metricCard({ label: "総売上（税込）", displayValue: formatYen(total), dataState: "available" }),
    metricCard(profit), metricCard({ label: "要対応店舗", displayValue: `${attention}店舗`, dataState: "available" })
  );
  $("status-counts").replaceChildren(...Object.keys(statusOrder).reverse().map((status) => {
    const box = node("span", "status-count");
    box.append(statusBadge(status), node("strong", "", String(stores.filter((store) => store.status === status).length)));
    return box;
  }));
  const accounting = projection.accounting || {};
  $("coverage-note").textContent = accounting.reflectedStoreCount < accounting.totalStoreCount
    ? `${accounting.reflectedStoreCount}店舗のデータで表示しています。${accounting.totalStoreCount - accounting.reflectedStoreCount}店舗は集計中です。` : `${stores.length}店舗のデータを表示しています。`;
}

function renderActions(actions) {
  if (!actions.length) return elements.actions.replaceChildren(empty("現在、優先して確認することはありません"));
  elements.actions.replaceChildren(...actions.slice(0, 3).map((action) => {
    const card = node("article", "action-card"); card.tabIndex = 0;
    card.append(node("h3", "action-theme", action.theme || action.recommendation), node("div", "action-store", action.storeName),
      paragraph(action.reason), node("p", "impact", `期待効果: ${action.impact || "改善の定着"}`));
    const link = node("button", "action-link", "店舗詳細を確認 →"); link.type = "button";
    link.addEventListener("click", () => showDetail(action.storeKey, false, action.targetTab));
    card.addEventListener("keydown", (event) => { if (event.key === "Enter") link.click(); });
    card.append(link); return card;
  }));
}

function renderDrivers(drivers) {
  const groups = [["結果", drivers.results], ["顧客", drivers.customer], ["価値", drivers.value], ["継続・運営", drivers.operations]];
  const hasEntries = groups.some(([, entries]) => entries?.length);
  if (!hasEntries) return elements.drivers.replaceChildren(emptyState());
  elements.drivers.replaceChildren(...groups.map(([name, entries], index) => {
    const group = node("section", "driver-group");
    const title = node("h3", "", name);
    const toggle = node("button", "driver-toggle", `${name} ${index === 0 ? "−" : "＋"}`);
    toggle.type = "button"; toggle.setAttribute("aria-expanded", String(index === 0));
    const content = node("div", "driver-content"); if (index !== 0) content.hidden = matchMedia("(max-width:1023px)").matches;
    (entries || []).forEach((entry) => {
      const value = entry.items?.[0]; const row = node("div", `driver-row${entry.primary ? " primary" : ""}`);
      const shown = node("span", "", metricText(value)); shown.setAttribute("aria-label", metricAriaLabel(entry.label, value));
      row.append(node("span", "", entry.label), shown); content.append(row);
    });
    toggle.addEventListener("click", () => { content.hidden = !content.hidden; toggle.setAttribute("aria-expanded", String(!content.hidden)); toggle.textContent = `${name} ${content.hidden ? "＋" : "−"}`; });
    group.append(title, toggle, content); return group;
  }));
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
  let stores = scopedStores().filter((store) => state.statusFilter === "All" || store.status === state.statusFilter);
  stores = [...stores].sort(storeComparator(state.sort));
  if (!stores.length) {
    const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 9; td.append(emptyState()); tr.append(td);
    elements.rows.replaceChildren(tr); elements.cards.replaceChildren(emptyState()); return;
  }
  elements.rows.replaceChildren(...stores.map((store) => {
    const row = document.createElement("tr"); row.tabIndex = 0; row.setAttribute("aria-label", `${store.storeName}の店舗詳細を開く`);
    row.append(cell(store.storeName), cell(statusBadge(store.status)), metricCell(store, "sales"), metricCell(store, "operatingProfit"),
      cell(store.metrics.customerCount.displayValue, "optional-col"), metricCell(store, "totalRepeat"), metricCell(store, "productivity"), cell(store.focus), cell("›"));
    row.addEventListener("click", () => showDetail(store.storeKey)); row.addEventListener("keydown", (e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); row.click(); } });
    return row;
  }));
  elements.cards.replaceChildren(...stores.map(storeCard));
}

function storeComparator(sort) {
  const value = (store, key) => store.metrics[key]?.rawValue ?? -Infinity;
  if (sort === "sales-desc") return (a, b) => value(b, "sales") - value(a, "sales");
  if (sort === "profit-desc") return (a, b) => value(b, "operatingProfit") - value(a, "operatingProfit");
  if (sort === "repeat-desc") return (a, b) => value(b, "totalRepeat") - value(a, "totalRepeat");
  if (sort === "productivity-desc") return (a, b) => value(b, "productivity") - value(a, "productivity");
  return (a, b) => statusOrder[a.status] - statusOrder[b.status];
}

function showDetail(storeKey, managerHome = false, targetTab = null) {
  state.listScroll = window.scrollY;
  state.selectedStore = state.projection?.stores?.find((store) => store.storeKey === storeKey);
  if (!state.selectedStore) return;
  elements.executive.hidden = true; elements.detail.hidden = false;
  $("back-to-list").hidden = managerHome || state.development.role === "store_manager";
  $("page-title").textContent = "店舗詳細";
  $("detail-name").textContent = state.selectedStore.storeName;
  $("detail-status").replaceChildren(statusBadge(state.selectedStore.status));
  $("detail-conclusion").textContent = state.selectedStore.conclusion;
  const managerFocus = $("manager-focus"); managerFocus.hidden = state.development.role !== "store_manager";
  if (!managerFocus.hidden) {
    $("manager-focus-title").textContent = state.selectedStore.focus;
    $("manager-checks").replaceChildren(heading("その他の確認事項"), orderedList(state.selectedStore.otherChecks.slice(0, 2)), heading("次に確認すること"), paragraph(state.selectedStore.nextCheck));
  }
  setTab(targetTab || state.tab || "summary"); window.scrollTo({ top: 0 });
}

function showList() {
  if (state.development.role === "store_manager") return;
  elements.detail.hidden = true; elements.executive.hidden = false; state.selectedStore = null;
  $("page-title").textContent = state.development.role === "area_manager" ? "担当店舗の状況" : "全店の状況";
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
  const focus = node("p", "", `今月の重点\n${store.focus}`); const button = node("button", "action-link", "店舗を確認 →"); button.type = "button"; button.addEventListener("click", () => showDetail(store.storeKey));
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
function formatYen(value) { return value >= 100_000_000 ? `${(value / 100_000_000).toFixed(2)}億円` : `${Math.round(value / 10_000).toLocaleString()}万円`; }
function setNotice(title, body) { elements.noticeTitle.textContent = title; elements.noticeBody.textContent = body; }
function setPressed(selector, current) { document.querySelectorAll(selector).forEach((button) => button.setAttribute("aria-pressed", String(button === current))); }
function cell(value, className = "") { const td = node("td", className); value instanceof Node ? td.append(value) : td.textContent = String(value ?? "—"); return td; }
function node(tag, className = "", text = "") { const item = document.createElement(tag); if (className) item.className = className; if (text !== "") item.textContent = text; return item; }
function heading(text) { return node("h3", "", text); }
function paragraph(text) { return node("p", "", text); }
function empty(text) { return node("div", "empty", text); }
function emptyState() { const box = empty("表示できる店舗がありません"); box.append(paragraph("権限または対象月をご確認ください")); return box; }
function orderedList(items) { const list = document.createElement("ol"); items.slice(0, 3).forEach((text) => { const li = node("li", "", text); list.append(li); }); return list; }
function renderManagerEmpty() { elements.executive.hidden = false; elements.detail.hidden = true; elements.summary.replaceChildren(emptyState()); }
function handleTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault();
  const tabs = [...document.querySelectorAll("[role=tab]")]; const current = tabs.indexOf(event.currentTarget);
  const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
  tabs[next].focus(); tabs[next].click();
}
