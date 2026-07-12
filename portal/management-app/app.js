import { callApiAction, setHubSessionAuth } from "../js/api.js";
import {
  clearNovHubSession,
  handleNovHubSessionAuthFailure,
  restoreNovHubSession
} from "../js/nov-hub-session-candidate.js";

const state = { view: "finance", finance: null, stores: null, dataops: null };
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ja-JP");

const elements = {
  connection: document.getElementById("connection-state"),
  notice: document.getElementById("notice"),
  noticeTitle: document.getElementById("notice-title"),
  noticeBody: document.getElementById("notice-body"),
  month: document.getElementById("finance-month"),
  financeKpis: document.getElementById("finance-kpis"),
  financeRows: document.getElementById("finance-rows"),
  financeStatus: document.getElementById("finance-status"),
  storeScope: document.getElementById("store-scope"),
  storeKpis: document.getElementById("store-kpis"),
  storeRows: document.getElementById("store-rows"),
  csvRequirements: document.getElementById("csv-requirements"),
  dataopsKpis: document.getElementById("dataops-kpis"),
  workflow: document.getElementById("workflow"),
  stoppedItems: document.getElementById("stopped-items")
};

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => selectView(button.dataset.view)));
document.getElementById("reload-button").addEventListener("click", () => loadCurrentView(true));
elements.month.addEventListener("change", () => { state.finance = null; loadFinance(); });

initialize();

function initialize() {
  const session = restoreNovHubSession();
  if (!session?.sessionToken) {
    renderAuthRequired();
    return;
  }
  setHubSessionAuth(session.sessionToken);
  elements.connection.textContent = "HUB接続済み";
  selectView(readHashView());
  window.addEventListener("hashchange", () => selectView(readHashView(), false));
}

function readHashView() {
  const value = location.hash.replace(/^#\/?/, "");
  return ["finance", "stores", "dataops"].includes(value) ? value : "finance";
}

function selectView(view, updateHash = true) {
  state.view = ["finance", "stores", "dataops"].includes(view) ? view : "finance";
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.view));
  document.querySelectorAll(".view-panel").forEach((panel) => { panel.hidden = panel.id !== `${state.view}-view`; });
  if (updateHash && location.hash !== `#${state.view}`) history.replaceState(null, "", `#${state.view}`);
  loadCurrentView(false);
}

function loadCurrentView(force) {
  if (force) state[state.view] = null;
  if (state.view === "finance") loadFinance();
  if (state.view === "stores") loadStores();
  if (state.view === "dataops") loadDataops();
}

async function loadFinance() {
  if (state.finance) return renderFinance(state.finance);
  setLoading("法人管理データを確認しています");
  try {
    const payload = elements.month.value ? { selectedMonth: elements.month.value } : {};
    const response = await callApiAction("managementFinanceSummary", payload);
    state.finance = response.data || {};
    renderFinance(state.finance);
    setReady("法人管理を表示しています");
  } catch (error) { renderError(error); }
}

async function loadStores() {
  if (state.stores) return renderStores(state.stores);
  setLoading("店舗scopeと店舗データを確認しています");
  try {
    const response = await callApiAction("managementStoresSummary", {});
    state.stores = response.data || {};
    renderStores(state.stores);
    setReady("権限に応じた店舗を表示しています");
  } catch (error) { renderError(error); }
}

async function loadDataops() {
  if (state.dataops) return renderDataops(state.dataops);
  setLoading("データ取込状況を確認しています");
  try {
    const response = await callApiAction("managementDataopsStatus", {});
    state.dataops = response.data || {};
    renderDataops(state.dataops);
    setReady("状態表示のみです。取込・承認は実行しません");
  } catch (error) { renderError(error); }
}

function renderFinance(data) {
  if (data.latestClosedMonth && !elements.month.value) elements.month.value = data.latestClosedMonth;
  renderMetrics(elements.financeKpis, [
    ["対象月", data.latestClosedMonth || "未設定"],
    ["売上合計", formatYen(data.salesTotalYen)],
    ["現預金", formatYen(data.cashBalanceYen)],
    ["要確認法人", `${number.format(Number(data.alertCorporationCount || 0))}社`]
  ]);
  const rows = Array.isArray(data.corporations) ? data.corporations : [];
  elements.financeRows.replaceChildren(...(rows.length ? rows.map((row) => tableRow([
    row.name,
    `${number.format(Number(row.salesManYen || 0))}万円`,
    `${number.format(Number(row.profitRatePercent || 0))}%`,
    `${number.format(Number(row.equityRatioPercent || 0))}%`,
    `${number.format(Number(row.cashManYen || 0))}万円`,
    statusCell(row.status)
  ])) : [emptyRow(6, "表示できる法人集計がありません") ]));
  const rule = data.classificationRuleStatus || {};
  elements.financeStatus.replaceChildren(heading("科目分類ルール"), paragraph(`下書き ${number.format(rule.draft || 0)}件 / 確認中 ${number.format(rule.review || 0)}件 / 承認済み ${number.format(rule.approved || 0)}件。状態表示のみで、本番再計算は行いません。`));
}

function renderStores(data) {
  const stores = Array.isArray(data.stores) ? data.stores : [];
  elements.storeScope.textContent = scopeLabel(data.phase0Scope);
  renderMetrics(elements.storeKpis, [
    ["表示店舗", `${number.format(data.storeCount || 0)}店舗`],
    ["スタッフ", `${number.format(data.staffCount || 0)}人`],
    ["売上データ", stores.some((row) => row.dataReadiness !== "salonanswer_csv_waiting") ? "接続済み" : "CSV待ち"],
    ["scope", scopeLabel(data.phase0Scope)]
  ]);
  elements.storeRows.replaceChildren(...(stores.length ? stores.map((row) => tableRow([
    row.name,
    row.corporationName,
    number.format(row.staffCount || 0),
    row.dataReadiness === "salonanswer_csv_waiting" ? "未接続" : `${number.format(row.salesManYen || 0)}万円`,
    row.dataReadiness === "salonanswer_csv_waiting" ? "未接続" : `${number.format(row.targetAchievementPercent || 0)}%`,
    row.dataReadiness === "salonanswer_csv_waiting" ? "SalonAnswer CSV待ち" : "接続済み"
  ])) : [emptyRow(6, "表示できる店舗がありません") ]));
  const required = Array.isArray(data.requiredCsvFiles) ? data.requiredCsvFiles : [];
  elements.csvRequirements.replaceChildren(heading("Data Operations Hubへ渡すデータ"), list(required.map((item) => `${item.name}: ${item.purpose}`)));
}

function renderDataops(data) {
  const counts = data.statusCounts || {};
  renderMetrics(elements.dataopsKpis, [
    ["原本", `${number.format(counts.sourceDocuments || 0)}件`],
    ["raw行", `${number.format(counts.accountingRawRows || 0)}行`],
    ["分類下書き", `${number.format(counts.classificationDraft || 0)}件`],
    ["分類確認中", `${number.format(counts.classificationReview || 0)}件`]
  ]);
  const workflow = Array.isArray(data.workflow) ? data.workflow : [];
  elements.workflow.replaceChildren(...workflow.map((step) => {
    const item = document.createElement("article");
    item.className = "workflow-step";
    item.append(heading(`${step.step}. ${step.title}`), paragraph(`${step.owner} / ${step.status}`));
    return item;
  }));
  elements.stoppedItems.replaceChildren(heading("この画面から実行しない処理"), list(Array.isArray(data.stoppedItems) ? data.stoppedItems : []));
}

function renderMetrics(container, entries) {
  container.replaceChildren(...entries.map(([label, value]) => {
    const item = document.createElement("div"); item.className = "metric";
    const l = document.createElement("div"); l.className = "metric-label"; l.textContent = label;
    const v = document.createElement("div"); v.className = "metric-value"; v.textContent = value;
    item.append(l, v); return item;
  }));
}

function tableRow(values) {
  const row = document.createElement("tr");
  values.forEach((value, index) => {
    const cell = document.createElement("td");
    if (index > 0 && typeof value !== "object") cell.className = "numeric";
    if (value instanceof Node) cell.append(value); else cell.textContent = String(value ?? "");
    row.append(cell);
  });
  return row;
}

function statusCell(value) { const span = document.createElement("span"); span.className = `status ${value || "warning"}`; span.textContent = ({ safe: "安定", warning: "確認", danger: "注意" })[value] || "確認"; return span; }
function emptyRow(columns, message) { const row = document.createElement("tr"); row.className = "empty-row"; const cell = document.createElement("td"); cell.colSpan = columns; cell.textContent = message; row.append(cell); return row; }
function heading(value) { const node = document.createElement("h3"); node.textContent = value; return node; }
function paragraph(value) { const node = document.createElement("p"); node.textContent = value; return node; }
function list(items) { const node = document.createElement("ul"); (items.length ? items : ["現在、追加の確認項目はありません"]).forEach((value) => { const li = document.createElement("li"); li.textContent = value; node.append(li); }); return node; }
function formatYen(value) { return yen.format(Number(value || 0)); }
function scopeLabel(value) { return ({ all_stores: "全店舗", assigned_stores: "担当店舗", own_store: "自店舗" })[value] || "権限確認済み"; }

function setLoading(message) { elements.connection.textContent = "読込中"; elements.notice.classList.remove("is-error"); elements.noticeTitle.textContent = message; elements.noticeBody.textContent = "Backendで社員状態・権限・scopeを再確認しています。"; }
function setReady(message) { elements.connection.textContent = "接続済み"; elements.notice.classList.remove("is-error"); elements.noticeTitle.textContent = message; elements.noticeBody.textContent = "表示内容は読み取り専用です。"; }
function renderAuthRequired() { elements.connection.textContent = "未接続"; elements.notice.classList.add("is-error"); elements.noticeTitle.textContent = "HUBログインが必要です"; elements.noticeBody.textContent = "NOV HUBへ戻り、経営管理システムを開き直してください。"; }
function renderError(error) {
  const code = String(error?.code || "");
  if (["UNAUTHORIZED", "TOKEN_MISSING", "TOKEN_VERIFICATION_FAILED"].includes(code) || Number(error?.status) === 401) {
    handleNovHubSessionAuthFailure(401); clearNovHubSession(); renderAuthRequired(); return;
  }
  elements.connection.textContent = "確認が必要";
  elements.notice.classList.add("is-error");
  elements.noticeTitle.textContent = code === "FORBIDDEN" || code === "SCOPE_DENIED" ? "表示権限がありません" : code === "DATA_NOT_READY" ? "集計データが準備中です" : "データを読み込めませんでした";
  elements.noticeBody.textContent = "HUBへ戻るか、時間をおいて再読み込みしてください。";
}
