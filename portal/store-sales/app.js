import {
  clearNovHubSession,
  handleNovHubSessionAuthFailure,
  restoreNovHubSession
} from "../js/nov-hub-session-candidate.js";
import { createStoreSalesAdapter } from "./adapters/index.js";

const state = { projection: null, filter: "All", selectedStore: null, tab: "summary", audience: "executive", adapter: null, adapterMode: null };
const metricLabels = {
  summary: ["sales", "operatingProfit", "ordinaryProfit", "grossProfitMargin", "operatingProfitMargin", "ordinaryProfitMargin"],
  sales: ["sales", "technicalSales", "retailSales", "ecSales", "grossProfit", "operatingProfit", "ordinaryProfit", "cumulative"],
  customer: ["totalRepeat", "new", "returning", "loyal", "customerCount", "newCustomerCount", "existingCustomerCount"],
  value: ["totalTicket", "technicalTicket", "retailTicket", "regularRetail", "mid", "productivity", "staffCount", "retailPurchaseRate"]
};
const labels = {
  sales: "売上高（税込）", technicalSales: "技術売上", retailSales: "商品売上", ecSales: "EC売上",
  grossProfit: "売上総利益", operatingProfit: "営業利益", ordinaryProfit: "経常利益",
  cumulative: "累計", grossProfitMargin: "売上総利益率", operatingProfitMargin: "営業利益率",
  ordinaryProfitMargin: "経常利益率", totalRepeat: "Total Repeat", new: "New",
  returning: "Returning", loyal: "Loyal", customerCount: "客数", newCustomerCount: "新規客数",
  existingCustomerCount: "既存客数", totalTicket: "Total Ticket", technicalTicket: "Technical Ticket",
  retailTicket: "Retail Ticket", regularRetail: "Regular Retail", mid: "MID", productivity: "Productivity",
  staffCount: "スタッフ数", retailPurchaseRate: "Retail Purchase Rate"
};

const $ = (id) => document.getElementById(id);
const elements = {
  notice: $("notice"), noticeTitle: $("notice-title"), noticeBody: $("notice-body"),
  period: $("period"), summary: $("summary-metrics"), actions: $("priority-actions"),
  drivers: $("business-drivers"), rows: $("store-rows"), cards: $("store-cards"), executive: $("executive-view"),
  detail: $("detail-view"), detailName: $("detail-name"), detailReason: $("detail-reason"),
  detailStatus: $("detail-status"), monthlyActions: $("monthly-actions"), detailPanel: $("detail-panel")
};

initialize();

async function initialize() {
  elements.period.value = new Date().toISOString().slice(0, 7);
  elements.period.addEventListener("change", loadProjection);
  $("back-to-list").addEventListener("click", showList);
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter)));
  document.querySelectorAll("[role=tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
    button.addEventListener("keydown", handleTabKeydown);
  });
  let session = null;
  try {
    const runtimeConfig = globalThis.STORE_SALES_ADAPTER_CONFIG || {};
    if (runtimeConfig.mode === "integration") session = restoreNovHubSession();
    const created = createStoreSalesAdapter({
      location,
      runtimeConfig,
      dependencies: { getSessionToken: () => session?.sessionToken || "" }
    });
    state.adapter = created.adapter;
    state.adapterMode = created.config.mode;
    if (state.adapterMode === "integration" && !session?.sessionToken) return renderAuthRequired();
    await loadProjection();
  } catch (error) {
    renderAdapterError(error);
  }
}

async function loadProjection() {
  if (!state.adapter) return;
  setNotice("店舗営業Projectionを読み込んでいます", "読み取り専用Projectionとactor scopeを確認しています。");
  try {
    state.projection = await state.adapter.loadDashboard({ period: elements.period.value });
    renderAll();
    setModeBanner();
  } catch (error) {
    if (Number(error?.status) === 401 || error?.code === "UNAUTHORIZED") {
      state.adapter?.clear();
      handleNovHubSessionAuthFailure(401);
      clearNovHubSession();
      return renderAuthRequired();
    }
    renderAdapterError(error);
  }
}

function setModeBanner() {
  elements.notice.classList.remove("is-error");
  if (state.adapterMode === "mock") {
    setNotice("Mock Projectionを表示しています", "synthetic fixtureのみを使用し、外部APIには接続していません。");
    return;
  }
  setNotice("Read-only Integrationを表示しています", "隔離Projection endpointの検証用responseです。");
}

function renderAdapterError(error) {
  const code = String(error?.code || "");
  const mapping = {
    FORBIDDEN: ["アクセス権限がありません", "NOV HUBへ戻って権限をご確認ください。"],
    ACTOR_SCOPE_DENIED: ["アクセス権限がありません", "NOV HUBへ戻って権限をご確認ください。"],
    ACTOR_SCOPE_MISMATCH: ["データ確認が必要です", "actor scopeと店舗データが一致しません。"],
    NOT_FOUND: ["対象店舗または対象月が見つかりません", "営業対象月をご確認ください。"],
    VERSION_CONFLICT: ["データ更新中です", "時間をおいて再読み込みしてください。"],
    VALIDATION_ERROR: ["データ確認が必要です", "公開データの検証完了までお待ちください。"],
    SCHEMA_MISMATCH: ["データ確認が必要です", "Projection契約を確認しています。"],
    MALFORMED_JSON: ["データ確認が必要です", "Projection応答を確認しています。"],
    TIMEOUT: ["通信に時間がかかっています", "時間をおいて再読み込みしてください。"],
    SERVER_ERROR: ["一時的に取得できません", "時間をおいて再読み込みしてください。"],
    PRODUCTION_NOT_APPROVED: ["本番接続は利用できません", "Phase 5-2はreview-onlyです。"],
    MOCK_NOT_ALLOWED: ["Mockを起動できません", "Mockはローカル確認専用です。"]
  };
  const [title, body] = mapping[code] || ["店舗状況を読み込めませんでした", "時間をおいて再読み込みしてください。"];
  elements.notice.classList.add("is-error");
  setNotice(title, body);
}

function renderAll() {
  const projection = state.projection || {};
  const accounting = projection.accounting || {};
  state.audience = projection.audience === "store_manager" ? "store_manager" : "executive";
  $("meta-sales-period").textContent = formatMonth(elements.period.value);
  $("meta-accounting-period").textContent = formatMonth(accounting.confirmedThroughPeriod || accounting.period);
  $("meta-state").textContent = stateText(accounting.confirmationState);
  $("meta-updated").textContent = formatDate(accounting.lastUpdatedAt);
  if (state.audience === "store_manager") {
    const ownStore = projection.stores?.[0];
    if (ownStore) showDetail(ownStore.storeKey, true);
    else renderManagerEmpty();
    return;
  }
  renderSummary(projection);
  renderActions(projection.priorityActions || []);
  renderDrivers(projection.businessDrivers || {});
  renderStores();
}

function renderSummary(projection) {
  if (!Array.isArray(projection.stores) || projection.stores.length === 0) {
    elements.summary.replaceChildren(emptyState());
    return;
  }
  const summary = projection.executiveSummary || {};
  const metrics = (summary.metrics || []).map((entry) => metricCard(entry));
  metrics.push(metricCard("要確認店舗", String(summary.needsAttentionStoreCount ?? 0), "Store Status Engine判定"));
  elements.summary.replaceChildren(...metrics);
}

function renderActions(actions) {
  if (!actions.length) return elements.actions.replaceChildren(empty("現在、優先確認事項はありません"));
  elements.actions.replaceChildren(...actions.slice(0, 3).map((action) => {
    const card = node("article", "action-card");
    card.append(statusBadge(action.status), heading(action.storeName), paragraph(action.reason), paragraph(`推奨: ${action.recommendation}`));
    const button = node("button", "action-link", "店舗詳細を確認");
    button.type = "button";
    button.addEventListener("click", () => showDetail(action.storeKey));
    card.append(button);
    return card;
  }));
}

function renderDrivers(drivers) {
  const groups = [["Results", drivers.results], ["Customer", drivers.customer], ["Value", drivers.value], ["Operations", drivers.operations]];
  const hasEntries = groups.some(([, entries]) => Array.isArray(entries) && entries.length);
  if (!hasEntries) {
    elements.drivers.replaceChildren(emptyState());
    return;
  }
  elements.drivers.replaceChildren(...groups.map(([name, entries]) => {
    const group = node("section", "driver-group");
    group.append(heading(name));
    (entries || []).forEach((entry) => {
      const items = Array.isArray(entry?.items) ? entry.items.filter(Boolean) : [];
      const first = items.find((item) => item.dataState === "available") || items[0];
      const row = node("div", "driver-row");
      const stateValue = node("span", "", metricText(first));
      stateValue.setAttribute("aria-label", metricAriaLabel(entry?.label || "指標", first));
      row.append(node("span", "", entry?.label || "指標"), stateValue);
      group.append(row);
    });
    return group;
  }));
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll("[data-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
  renderStores();
}

function renderStores() {
  const stores = (state.projection?.stores || []).filter((store) => state.filter === "All" || store.ownership === state.filter);
  if (!stores.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 11;
    cell.append(emptyState());
    row.append(cell);
    elements.rows.replaceChildren(row);
    elements.cards.replaceChildren(emptyState());
    return;
  }
  elements.rows.replaceChildren(...stores.map((store) => {
    const row = document.createElement("tr");
    const storeCell = document.createElement("td");
    const link = node("button", "store-link", store.storeName);
    link.type = "button";
    link.addEventListener("click", () => showDetail(store.storeKey));
    storeCell.append(link);
    row.append(
      storeCell, cell(store.ownership || "準備中"), metricCell(store, "sales"), metricCell(store, "operatingProfit"),
      metricCell(store, "operatingProfitMargin"), metricCell(store, "ordinaryProfitMargin"),
      metricCell(store, "totalRepeat"), metricCell(store, "productivity"),
      cell(stateText(store.accountingState)), cell(statusBadge(store.status)), cell(formatDate(store.lastUpdatedAt))
    );
    return row;
  }));
  elements.cards.replaceChildren(...stores.map(storeCard));
}

function showDetail(storeKey, managerHome = false) {
  state.selectedStore = state.projection?.stores?.find((store) => store.storeKey === storeKey) || null;
  if (!state.selectedStore) return;
  elements.executive.hidden = true;
  elements.detail.hidden = false;
  $("back-to-list").hidden = managerHome || state.audience === "store_manager";
  elements.detailName.textContent = `${state.selectedStore.storeName}${state.audience === "store_manager" ? "の状況" : ""}`;
  elements.detailReason.textContent = state.selectedStore.statusReason || "";
  elements.detailStatus.replaceChildren(statusBadge(state.selectedStore.status));
  const actions = state.selectedStore.actions || [];
  elements.monthlyActions.replaceChildren(actions.length
    ? orderedList(actions.map((action) => `${action.recommendation} — ${action.reason}`))
    : empty("今月の追加対応はありません"));
  setTab("summary");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showList() {
  if (state.audience === "store_manager") return;
  elements.detail.hidden = true;
  elements.executive.hidden = false;
  state.selectedStore = null;
}

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll("[role=tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
  const store = state.selectedStore;
  if (!store) return;
  const grid = node("div", "detail-metrics");
  (metricLabels[tab] || []).forEach((key) => {
    const value = store.metrics?.[key] || { dataState: "preparing", displayValue: null, reason: "データソースを準備しています" };
    const item = node("article", "detail-metric");
    const metricValue = node("div", "metric-value", metricText(value));
    metricValue.setAttribute("aria-label", metricAriaLabel(labels[key] || key, value));
    item.append(node("div", "metric-label", labels[key] || key), metricValue);
    const accountingNote = isAccountingMetric(key) && value.dataState === "available"
      ? `${formatMonth(state.projection?.accounting?.confirmedThroughPeriod || state.projection?.accounting?.period)}確定値`
      : value.reason;
    if (accountingNote) item.append(node("div", "metric-note", accountingNote));
    grid.append(item);
  });
  elements.detailPanel.replaceChildren(grid);
}

function metricCard(metricOrLabel, value, note) {
  const metric = typeof metricOrLabel === "object"
    ? metricOrLabel
    : { label: metricOrLabel, displayValue: value, dataState: value === null ? "preparing" : "available", reason: note };
  const item = node("article", "metric");
  const metricValue = node("div", "metric-value", metricText(metric));
  metricValue.setAttribute("aria-label", metricAriaLabel(metric.label, metric));
  item.append(node("div", "metric-label", metric.label), metricValue);
  if (metric.dataState !== "available" && metric.reason) item.append(node("div", "metric-note", metric.reason));
  return item;
}
function metricCell(store, key) { return cell(metricText(store.metrics?.[key])); }
function metricText(metric) { return metric?.dataState === "available" && metric.displayValue !== null ? String(metric.displayValue) : stateText(metric?.dataState); }
function stateText(value) { return ({ confirmed: "確定", collecting: "集計中", preparing: "準備中", available: "確定", unavailable: "取得できません", validation_error: "データ確認が必要" })[value] || "準備中"; }
function metricAriaLabel(label, metric) { return `${label}、${metric?.dataState === "available" && metric?.displayValue !== null ? metric.displayValue : stateText(metric?.dataState)}`; }
function formatMonth(value) { const match = String(value || "").match(/^(\d{4})-(\d{2})$/); return match ? `${match[1]}年${Number(match[2])}月` : "—"; }
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short" }).format(date); }
function statusLabel(status) { return ({ "Needs Attention": "要確認", Improving: "改善中", Stable: "安定", Good: "好調" })[status] || "安定"; }
function statusBadge(status) { const badge = node("span", `status status-${String(status || "Stable").toLowerCase().replaceAll(" ", "-")}`, statusLabel(status)); badge.setAttribute("aria-label", `店舗状態: ${statusLabel(status)}`); return badge; }
function cell(value) { const item = document.createElement("td"); value instanceof Node ? item.append(value) : item.textContent = String(value ?? "—"); return item; }
function node(tag, className = "", text = "") { const item = document.createElement(tag); if (className) item.className = className; if (text) item.textContent = text; return item; }
function heading(text) { return node("h3", "", text); }
function paragraph(text) { return node("p", "", text); }
function empty(text) { return node("div", "empty", text); }
function emptyState() { const box = empty("表示できる店舗がありません"); box.append(node("p", "", "権限または対象月をご確認ください")); return box; }
function orderedList(items) { const list = document.createElement("ol"); items.slice(0, 3).forEach((text) => { const item = document.createElement("li"); item.textContent = text; list.append(item); }); return list; }
function setNotice(title, body) { elements.noticeTitle.textContent = title; elements.noticeBody.textContent = body; }
function renderAuthRequired() { elements.notice.classList.add("is-error"); setNotice("HUBログインが必要です", "NOV HUBへ戻り、店舗営業管理を開き直してください。"); }

function storeCard(store) {
  const article = node("article", "store-card");
  const header = node("div", "store-card-header");
  header.append(heading(store.storeName), statusBadge(store.status));
  const meta = node("p", "store-card-meta", store.ownership || "準備中");
  const values = document.createElement("dl");
  values.className = "store-card-metrics";
  [["売上", "sales"], ["営業利益率", "operatingProfitMargin"], ["経常利益率", "ordinaryProfitMargin"]].forEach(([label, key]) => {
    const group = document.createElement("div");
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = metricText(store.metrics?.[key]);
    dd.setAttribute("aria-label", metricAriaLabel(label, store.metrics?.[key]));
    group.append(dt, dd); values.append(group);
  });
  const reason = node("p", "store-card-reason", `主な確認理由: ${store.statusReason || "追加の確認事項はありません"}`);
  const link = node("button", "action-link", "店舗詳細を確認");
  link.type = "button";
  link.addEventListener("click", () => showDetail(store.storeKey));
  article.append(header, meta, values, reason, link);
  return article;
}

function renderManagerEmpty() {
  elements.executive.hidden = false;
  elements.detail.hidden = true;
  $("summary-heading").textContent = "店舗の状況";
  elements.summary.replaceChildren(emptyState());
  $("executive-actions-section").hidden = true;
  $("business-drivers-section").hidden = true;
  $("store-list-section").hidden = true;
}

function isAccountingMetric(key) {
  return ["grossProfit", "operatingProfit", "ordinaryProfit", "grossProfitMargin", "operatingProfitMargin", "ordinaryProfitMargin", "cumulative"].includes(key);
}

function handleTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll("[role=tab]")];
  const current = tabs.indexOf(event.currentTarget);
  const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
