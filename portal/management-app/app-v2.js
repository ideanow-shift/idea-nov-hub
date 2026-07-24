import { callApiAction, setHubSessionAuth } from "../js/api.js";
import { mountManagementProductionReadiness } from "../js/management-production-readiness-status.js?v=2770deca730444a2";
import { clearNovHubSession, handleNovHubSessionAuthFailure, restoreNovHubSession } from "../js/nov-hub-session-candidate.js";
import { canDisplayWorkforceAggregates, mountWorkforceEvidenceStatus } from "../js/management-workforce-evidence-status.js?v=8f1a70d88732633e";
import { buildFinancialCompletionItems, renderFinancialDataIntake } from "./financial-data-intake.js?v=326143584102463E";
import { renderCsvRequirements } from "./store-csv-requirements.js?v=9d6bb401afd343fb";

const FINANCE_VIEWS = new Set(["overview", "four-axis", "departments", "method"]);
const CORPORATE_VIEWS = new Set([...FINANCE_VIEWS, "dataops"]);
const VIEWS = new Set([...CORPORATE_VIEWS, "stores"]);
const state = { view: "overview", corporation: "", department: "", finance: null, stores: null, dataops: null, financialPreviews: { PL: null, BS: null, BUDGET: null }, localEvidence: { storeCsvReceipt: null, storeNameReceipt: null }, charts: {} };
const number = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const colors = ["#b23a48", "#17324d", "#27795f", "#a36410", "#765487", "#337d8e", "#737b83"];
const WORKFORCE_DEPENDENT_METRICS = new Set(["salesPerStaffManYen", "profitPerStaffManYen", "staffCount", "laborCostRatePercent"]);
const workforceAggregatesVisible = canDisplayWorkforceAggregates();
const IDEA_NOV_PLACEHOLDER = { id: "IDEA_NOV", name: "イディア・ノブ", dataAvailable: false, salesManYen: null, profitRatePercent: null, equityRatioPercent: null, cashManYen: null, survivalMonths: null, status: "missing" };

const byId = (id) => document.getElementById(id);
const elements = {
  connection: byId("connection-state"), notice: byId("notice"), noticeTitle: byId("notice-title"), noticeBody: byId("notice-body"),
  monthBadge: byId("target-month"), month: byId("finance-month"), corporateViewTabs: byId("corporate-view-tabs"), corporationTabs: byId("corporation-tabs"),
  overviewKpis: byId("overview-kpis"), financialPreviewOverview: byId("financial-local-preview-overview"), financeRows: byId("finance-rows"), financeStatus: byId("finance-status"),
  latestAdvice: byId("latest-advice"), expertComments: byId("expert-comments"), methodDiagnosis: byId("method-diagnosis"),
  profitability: byId("profitability-rows"), productivity: byId("productivity-rows"), safety: byId("safety-rows"), efficiency: byId("efficiency-rows"),
  financialPreviewFourAxis: byId("financial-local-preview-four-axis"), financialPreviewDepartments: byId("financial-local-preview-departments"),
  departmentTabs: byId("department-tabs"), departmentKpis: byId("department-kpis"), departmentRows: byId("department-rows"), departmentInsight: byId("department-insight"),
  storeScope: byId("store-scope"), workforceEvidence: byId("workforce-evidence-status"), storeKpis: byId("store-kpis"), financialPreviewStores: byId("financial-local-preview-stores"), storeRows: byId("store-rows"), csvRequirements: byId("csv-requirements"),
  dataopsKpis: byId("dataops-kpis"), productionReadiness: byId("production-readiness-status"), financialDataIntake: byId("financial-data-intake"), workflow: byId("workflow"), stoppedItems: byId("stopped-items")
};

document.querySelectorAll(".tab, .section-tab").forEach((button) => button.addEventListener("click", () => selectView(button.dataset.view)));
byId("reload-button").addEventListener("click", () => loadCurrentView(true));
elements.month.addEventListener("change", () => { state.finance = null; loadFinance(); });
window.addEventListener("management-financial-local-preview", (event) => {
  const preview = sanitizeFinancialPreview(event.detail);
  if (!preview) return;
  state.financialPreviews[preview.statement] = preview;
  updateSectionDataBadges();
  renderFinancialPreviewOverview();
  renderFinancialPreviewFourAxis();
  renderFinancialPreviewDepartments();
  renderFinancialPreviewStores();
});
initialize();

function initialize() {
  removeLegacyHubContextFromUrl();
  const session = restoreNovHubSession();
  if (!session?.sessionToken) return renderAuthRequired();
  setHubSessionAuth(session.sessionToken);
  elements.connection.textContent = "接続済み";
  selectView(readHashView());
  window.addEventListener("hashchange", () => selectView(readHashView(), false));
}

function removeLegacyHubContextFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has("hub_context")) return;
  url.searchParams.delete("hub_context");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function readHashView() { const value = location.hash.replace(/^#\/?/, ""); return VIEWS.has(value) ? value : "overview"; }
function viewSection(view) { return view === "stores" ? "stores" : "corporate"; }
function selectView(view, updateHash = true) {
  state.view = VIEWS.has(view) ? view : "overview";
  document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === state.view));
  document.querySelectorAll(".section-tab").forEach((button) => {
    const active = button.dataset.section === viewSection(state.view);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".view-panel").forEach((panel) => { panel.hidden = panel.id !== `${state.view}-view`; });
  elements.corporateViewTabs.hidden = !CORPORATE_VIEWS.has(state.view);
  elements.corporationTabs.hidden = !FINANCE_VIEWS.has(state.view) || state.view === "method";
  if (updateHash && location.hash !== `#${state.view}`) history.replaceState(null, "", `#${state.view}`);
  updateSectionDataBadges();
  loadCurrentView(false);
}

function updateSectionDataBadges() {
  const plReady = Boolean(state.financialPreviews.PL);
  const bsReady = Boolean(state.financialPreviews.BS);
  const pendingCount = financialPendingCount();
  const corporate = document.querySelector('[data-section-status="corporate"]');
  const stores = document.querySelector('[data-section-status="stores"]');
  if (corporate) {
    const label = plReady || bsReady ? `ローカル反映 / 残${number.format(pendingCount)}` : "未反映";
    corporate.textContent = label;
    corporate.dataset.sectionStatusCategory = plReady || bsReady ? "LOCAL_PREVIEW_ACTIVE" : "LOCAL_PREVIEW_EMPTY";
    corporate.title = plReady || bsReady ? "確認表示だけです。本番投入はdisabledです。" : "財務データ未選択";
  }
  if (stores) {
    stores.textContent = plReady ? `ローカル反映 / 残${number.format(pendingCount)}` : "未反映";
    stores.dataset.sectionStatusCategory = plReady ? "LOCAL_PREVIEW_ACTIVE" : "LOCAL_PREVIEW_EMPTY";
    stores.title = plReady ? "店舗候補P/Lの確認表示だけです。本番投入はdisabledです。" : "店舗P/L未選択";
  }
}

function financialPendingCount() {
  return financialReadinessItems().filter((item) => !item.ready).length;
}

function loadCurrentView(force) {
  if (FINANCE_VIEWS.has(state.view)) { if (force) state.finance = null; loadFinance(); return; }
  if (state.view === "stores") { if (force) state.stores = null; loadStores(); return; }
  if (force) state.dataops = null; loadDataops();
}

async function loadFinance() {
  if (state.finance) return renderFinance();
  setLoading("経営データを確認しています");
  try {
    const response = await callApiAction("managementFinanceSummary", elements.month.value ? { selectedMonth: elements.month.value } : {});
    state.finance = response.data || {};
    if (state.finance.latestClosedMonth) { elements.month.value = state.finance.latestClosedMonth; elements.monthBadge.textContent = state.finance.latestClosedMonth; }
    renderCorporationTabs(); renderFinance(); setReady("経営管理ダッシュボードを表示しています");
  } catch (error) { renderError(error); }
}

function renderFinance() {
  renderOverview(); renderFourAxis(); renderDepartments();
}

function withIdeaNov(rows) { const normalized = rows.map((row) => row.id === "IDEA_NOV" || row.name === "IDEA NOV" ? { ...row, name: "イディア・ノブ" } : row); return normalized.some((row) => row.id === "IDEA_NOV" || row.name === "イディア・ノブ") ? normalized : [...normalized, { ...IDEA_NOV_PLACEHOLDER }]; }
function financeCorporations() { return withIdeaNov(Array.isArray(state.finance?.corporations) ? state.finance.corporations : []); }
function fourAxisRows() { return withIdeaNov(Array.isArray(state.finance?.fourAxis) ? state.finance.fourAxis : []); }
function selectedCorporation() { return financeCorporations().find((row) => row.id === state.corporation) || null; }

function renderCorporationTabs() {
  const entries = [{ id: "", name: "グループ全体" }, ...financeCorporations().map((row) => ({ id: row.id, name: row.name }))];
  elements.corporationTabs.replaceChildren(label("法人別"), ...entries.map((entry) => {
    const button = document.createElement("button"); button.type = "button"; button.className = `corp-tab${state.corporation === entry.id ? " is-active" : ""}`; button.textContent = entry.name;
    button.addEventListener("click", () => { state.corporation = entry.id; renderCorporationTabs(); renderOverview(); renderFourAxis(); }); return button;
  }));
}

function renderOverview() {
  const data = state.finance || {}; const selected = selectedCorporation(); const corporations = financeCorporations();
  const quality = data.dataQuality || { activeCorporationCount: corporations.length, currentMonthCorporationCount: corporations.filter((row) => row.dataAvailable !== false).length, missingCorporations: corporations.filter((row) => row.dataAvailable === false).map((row) => row.name), complete: false }; const selectedAvailable = !selected || selected.dataAvailable !== false;
  const coverage = `${quality.currentMonthCorporationCount || corporations.filter((row) => row.dataAvailable !== false).length}/${quality.activeCorporationCount || corporations.length}法人`;
  const cashMan = selected ? Number(selected.cashManYen || 0) : Number(data.cashBalanceYen || 0) / 10000;
  const salesMan = selected ? Number(selected.salesManYen || 0) : Number(data.salesTotalYen || 0) / 10000;
  const survival = selected?.survivalMonths ?? aggregateSurvival(corporations);
  const status = selected?.status || (!quality.complete ? "warning" : corporations.some((row) => row.status === "danger") ? "danger" : corporations.some((row) => row.status === "warning") ? "warning" : "safe");
  renderMetrics(elements.overviewKpis, [[selected ? "現預金残高" : `現預金残高（${coverage}）`, selectedAvailable ? `${number.format(Math.round(cashMan))}万円` : "データ待ち"], ["生存可能月数", selectedAvailable && survival != null ? `${number.format(survival)}ヶ月` : "未算定"], [selected ? "売上高" : `グループ売上合計（${coverage}）`, selectedAvailable ? `${number.format(Math.round(salesMan))}万円` : "データ待ち"], ["キャッシュ状態判定", statusText(status), status]]);
  renderFinancialPreviewOverview();
  const visible = selected ? corporations.filter((row) => row.id === selected.id) : corporations;
  elements.financeRows.replaceChildren(...(visible.length ? visible.map((row) => tableRow([row.name, metricText(row.salesManYen, "万円"), metricText(row.profitRatePercent, "%"), metricText(row.equityRatioPercent, "%"), metricText(row.cashManYen, "万円"), statusNode(row.status)])) : [emptyRow(6, "表示できる法人データがありません")]));
  renderCashChart(data.cashTrend || []);
  const adviceVisible = data.aiAdviceReadiness === "aggregate-input-provenance-ready";
  const advice = adviceVisible ? data.latestAdvice : null;
  elements.latestAdvice.replaceChildren(advice?.body ? paragraph(advice.body) : muted(adviceVisible ? "保存済みのAIアドバイスはありません。" : "集計入力の安全確認が完了するまでAIアドバイスは表示しません。"));
  const commentsVisible = data.expertCommentReadiness === "aggregate-content-provenance-ready";
  const comments = commentsVisible && Array.isArray(data.expertComments) ? data.expertComments : [];
  elements.expertComments.replaceChildren(...(comments.length ? comments.map((item) => comment(item)) : [muted(commentsVisible ? "対象月の専門家コメントはありません。" : "集計内容の安全確認が完了するまで専門家コメントは表示しません。") ]));
  const rules = data.classificationRuleStatus || {};
  const missing = Array.isArray(quality.missingCorporations) && quality.missingCorporations.length ? quality.missingCorporations : corporations.filter((row) => row.dataAvailable === false).map((row) => row.name);
  elements.financeStatus.replaceChildren(heading("データ充足状況"), paragraph(`対象月は${coverage}を集計。${missing.length ? `未取込: ${missing.join("、")}。` : "全法人取込済み。"} 防衛ライン ${quality.defenseLineCorporationCount || 0}法人 / 生存可能月数 ${quality.survivalMonthsCorporationCount || 0}法人。`), heading("科目分類ルール"), paragraph(`下書き ${rules.draft || 0}件 / 確認中 ${rules.review || 0}件 / 承認済み ${rules.approved || 0}件。状態表示のみです。`));
}

function renderFourAxis() {
  const all = fourAxisRows(); const rows = state.corporation ? all.filter((row) => row.id === state.corporation) : all;
  renderFinancialPreviewFourAxis();
  elements.profitability.replaceChildren(...axisMatrix(rows, [["経常利益率", "ordinaryProfitRatePercent", "%", "目標: 10%以上"], ["損益分岐点比率", "breakEvenRatioPercent", "%", "目標: 80%以下"], ["売上高", "salesManYen", "万円", "参考"]]));
  elements.productivity.replaceChildren(...axisMatrix(rows, [["一人当たり売上高", "salesPerStaffManYen", "万円", "目標: 430万円以上"], ["一人当たり経常利益", "profitPerStaffManYen", "万円", ""], ["社員数", "staffCount", "人", ""]]));
  elements.safety.replaceChildren(...axisMatrix(rows, [["自己資本比率", "equityRatioPercent", "%", "目標: 30%以上"], ["流動比率", "currentRatioPercent", "%", "目標: 120%以上"]]));
  elements.efficiency.replaceChildren(...axisMatrix(rows, [["総資本回転率", "totalAssetTurnover", "回", "目標: 1.0回以上"], ["人件費率", "laborCostRatePercent", "%", ""], ["材料費率", "materialCostRatePercent", "%", ""]]));
  const alerts = rows.filter((row) => row.dataAvailable !== false).flatMap((row) => [row.ordinaryProfitRatePercent < 5 ? `${row.name}: 経常利益率` : "", row.equityRatioPercent < 20 ? `${row.name}: 自己資本比率` : ""].filter(Boolean));
  elements.methodDiagnosis.replaceChildren(heading("高畑メソッド診断 4軸＋キャッシュ・組織視点"), alerts.length ? list(alerts.map((value) => `${value}を優先確認`)) : paragraph("主要4軸に重大な警告はありません。数値の推移と現場状況を併せて確認してください。"));
  renderProfitChart(state.finance?.profitTrend || [], rows.map((row) => row.id));
}

function axisMatrix(rows, metrics) {
  if (!rows.length) return [emptyRow(2, "表示できるデータがありません")];
  const header = tableRow(["指標", ...rows.map((row) => row.name)], true);
  return [header, ...metrics.map(([name, key, unit, benchmark]) => tableRow([`${name}${benchmark ? ` / ${benchmark}` : ""}`, ...rows.map((row) => WORKFORCE_DEPENDENT_METRICS.has(key) ? workforceMetric(row[key], unit) : row[key] == null ? "未算定" : `${number.format(row[key])}${unit}`)]))];
}

function renderDepartments() {
  renderFinancialPreviewDepartments();
  const departments = Array.isArray(state.finance?.departments) ? state.finance.departments : [];
  if (state.department && !departments.some((row) => row.id === state.department)) state.department = "";
  const entries = [{ id: "", name: "全部門" }, ...departments.map((row) => ({ id: row.id, name: row.name }))];
  elements.departmentTabs.replaceChildren(...entries.map((entry) => {
    const button = document.createElement("button"); button.type = "button"; button.className = `dept-tab${state.department === entry.id ? " is-active" : ""}`; button.textContent = entry.name;
    button.addEventListener("click", () => { state.department = entry.id; renderDepartments(); }); return button;
  }));
  const visible = state.department ? departments.filter((row) => row.id === state.department) : departments;
  const total = visible.reduce((sum, row) => sum + Number(row.profitManYen || 0), 0);
  renderMetrics(elements.departmentKpis, [["表示部門", `${visible.length}部門`], ["部門売上", `${number.format(visible.reduce((s, r) => s + Number(r.salesManYen || 0), 0))}万円`], ["部門利益", `${number.format(total)}万円`, total < 0 ? "danger" : "safe"], ["人件費", `${number.format(visible.reduce((s, r) => s + Number(r.laborCostManYen || 0), 0))}万円`]]);
  elements.departmentRows.replaceChildren(...(visible.length ? visible.map((row) => tableRow([row.name, `${number.format(row.salesManYen || 0)}万円`, `${number.format(row.laborCostManYen || 0)}万円`, `${number.format((row.materialCostManYen || 0) + (row.otherCostManYen || 0))}万円`, `${number.format(row.profitManYen || 0)}万円`, `${number.format(row.profitRatePercent || 0)}%`])) : [emptyRow(6, "部門データがありません")]));
  const selected = visible.length === 1 ? visible[0] : null;
  elements.departmentInsight.replaceChildren(heading(selected ? `${selected.name} ドリルダウン診断` : "部門別の課題と優先アクション"), paragraph(selected ? `${selected.name}は、部門利益・人件費・主要KPIを月次で確認し、未来利益への貢献と費用対効果を判断します。` : "部門を選択すると、対象部門の指標と確認ポイントを表示します。"));
  renderDepartmentChart(visible);
}

async function loadStores() {
  if (state.stores) return renderStores(); setLoading("店舗データを確認しています");
  try { const response = await callApiAction("managementStoresSummary", {}); state.stores = response.data || {}; renderStores(); setReady("権限に応じた店舗を表示しています"); } catch (error) { renderError(error); }
}
function renderStores() {
  const data = state.stores || {}; const stores = Array.isArray(data.stores) ? data.stores : [];
  const localPl = localPlStoreSummary();
  const localPlRowsByStore = localPlStoreRowsByNormalizedName();
  const localPlMatch = localPlStoreMatchSummary(stores, localPlRowsByStore);
  elements.storeScope.textContent = scopeLabel(data.phase0Scope);
  mountWorkforceEvidenceStatus(elements.workforceEvidence);
  renderMetrics(elements.storeKpis, [
    ["表示店舗", `${data.storeCount || 0}店舗`],
    ["スタッフ", workforceMetric(data.staffCount, "人")],
    ["売上データ", localPl ? `P/L ${number.format(localPl.storeCandidateCount)}候補` : stores.some((row) => row.dataReadiness !== "salonanswer_csv_waiting") ? "接続済み" : "CSV待ち"],
    ["P/L損益", localPl ? `${number.format(Math.round(localPl.ordinaryProfitManYen))}万円` : "未反映"],
    ["P/L照合", localPl ? `一致${number.format(localPlMatch.matched)} / 未照合${number.format(localPlMatch.unmatched)}` : "未反映"],
    ["scope", scopeLabel(data.phase0Scope)],
  ]);
  renderFinancialPreviewStores(localPlMatch);
  elements.storeRows.replaceChildren(...(stores.length ? stores.map((row) => {
    const localRow = localPlRowForStore(row, localPlRowsByStore);
    const evidenceStatus = localPlStoreEvidenceStatus(row, localPlRowsByStore);
    const salesText = localRow ? `P/L ${number.format(Math.round(localRow.salesManYen || 0))}万円` : row.dataReadiness === "salonanswer_csv_waiting" ? "未接続" : `${number.format(row.salesManYen || 0)}万円`;
    const targetText = localRow ? `損益 ${number.format(Math.round(localRow.ordinaryProfitManYen || 0))}万円` : row.dataReadiness === "salonanswer_csv_waiting" ? "未接続" : `${number.format(row.targetAchievementPercent || 0)}%`;
    const statusText = localRow ? localPlStoreEvidenceLabel(evidenceStatus) : storeNameExcluded(row) ? "店舗候補から除外（ローカル確認）" : localPl ? "P/L候補未照合" : row.dataReadiness === "salonanswer_csv_waiting" ? "SalonAnswer CSV待ち" : "接続済み";
    return tableRow([row.name, row.corporationName, workforceMetric(row.staffCount), salesText, targetText, statusText]);
  }) : [emptyRow(6, "表示できる店舗がありません")]));
  renderCsvRequirements(elements.csvRequirements, data.requiredCsvFiles, {
    onReceipt: (receipt) => {
      state.localEvidence.storeCsvReceipt = receipt || null;
      applyFinancialExternalEvidence();
    },
  });
}

function localPlStoreMatchSummary(stores, localPlRowsByStore) {
  const rows = Array.isArray(stores) ? stores : [];
  const matched = rows.filter((row) => localPlRowForStore(row, localPlRowsByStore)).length;
  const unmatchedRows = rows
    .filter((row) => !localPlRowForStore(row, localPlRowsByStore) && !storeNameExcluded(row))
    .map((row) => ({
      storeName: String(row.name || "未判定").slice(0, 40),
      corporationName: String(row.corporationName || "未判定").slice(0, 40),
      currentStatus: row.dataReadiness === "salonanswer_csv_waiting" ? "SalonAnswer CSV待ち" : "P/L候補未照合",
    }));
  const unmatchedNames = unmatchedRows
    .map((row) => row.storeName)
    .slice(0, 5);
  return { matched, unmatched: unmatchedRows.length, unmatchedNames, unmatchedRows };
}

function localPlRowForStore(store, localPlRowsByStore) {
  const key = normalizeStoreCandidateName(store?.name);
  if (!key) return null;
  const direct = localPlRowsByStore.get(key);
  if (direct) return direct;
  const aliasKey = state.localEvidence.storeNameReceipt?.aliases?.[key];
  return aliasKey ? localPlRowsByStore.get(aliasKey) || null : null;
}

function storeNameExcluded(store) {
  const key = normalizeStoreCandidateName(store?.name);
  return Boolean(key && state.localEvidence.storeNameReceipt?.excluded?.[key]);
}

function localPlStoreEvidenceStatus(store, localPlRowsByStore) {
  const key = normalizeStoreCandidateName(store?.name);
  if (!key) return "STORE_MATCH_UNMATCHED";
  if (localPlRowsByStore.has(key)) return "STORE_MATCH_DIRECT";
  if (state.localEvidence.storeNameReceipt?.aliases?.[key]) return "STORE_MATCH_ALIAS_LOCAL";
  if (state.localEvidence.storeNameReceipt?.excluded?.[key]) return "STORE_MATCH_EXCLUDED_LOCAL";
  return "STORE_MATCH_UNMATCHED";
}

function localPlStoreEvidenceLabel(status) {
  return {
    STORE_MATCH_DIRECT: "ローカルP/L直接一致（本番未投入）",
    STORE_MATCH_ALIAS_LOCAL: "ローカルP/L別名対応（本番未投入）",
    STORE_MATCH_EXCLUDED_LOCAL: "店舗候補から除外（ローカル確認）",
    STORE_MATCH_UNMATCHED: "P/L候補未照合",
  }[status] || "P/L候補未照合";
}

function localPlStoreSummary() {
  const preview = state.financialPreviews.PL;
  if (!preview || !Array.isArray(preview.rows) || !preview.rows.length) return null;
  const rows = preview.rows.filter((row) => row.entityCategory === "STORE_CANDIDATE");
  if (!rows.length) return null;
  return {
    storeCandidateCount: rows.length,
    salesManYen: rows.reduce((sum, row) => sum + (Number.isFinite(Number(row.salesManYen)) ? Number(row.salesManYen) : 0), 0),
    ordinaryProfitManYen: rows.reduce((sum, row) => sum + (Number.isFinite(Number(row.ordinaryProfitManYen)) ? Number(row.ordinaryProfitManYen) : 0), 0),
  };
}

function localPlStoreRowsByNormalizedName() {
  const preview = state.financialPreviews.PL;
  const rows = Array.isArray(preview?.rows) ? preview.rows : [];
  return new Map(rows
    .filter((row) => row.entityCategory === "STORE_CANDIDATE")
    .map((row) => [normalizeStoreCandidateName(row.entityName), row])
    .filter(([key]) => key));
}

function normalizeStoreCandidateName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/^損[･・\s]*/u, "")
    .replace(/[･・]/gu, "")
    .replace(/\s+/gu, "")
    .toLowerCase()
    .trim();
}

async function loadDataops() {
  if (state.dataops) return renderDataops(); setLoading("データ取込状況を確認しています");
  try { const response = await callApiAction("managementDataopsStatus", {}); state.dataops = response.data || {}; renderDataops(); setReady("状態表示のみです。取込・承認は実行しません"); } catch (error) { renderError(error); }
}
function renderDataops() {
  const data = state.dataops || {}; const counts = data.statusCounts || {};
  renderMetrics(elements.dataopsKpis, [["原本", `${counts.sourceDocuments || 0}件`], ["raw行", `${number.format(counts.accountingRawRows || 0)}行`], ["分類下書き", `${counts.classificationDraft || 0}件`], ["分類確認中", `${counts.classificationReview || 0}件`]]);
  mountManagementProductionReadiness(elements.productionReadiness);
  renderFinancialDataIntake(elements.financialDataIntake, { externalEvidence: financialExternalEvidence() });
  elements.workflow.replaceChildren(...(data.workflow || []).map((step) => { const item = document.createElement("article"); item.className = "workflow-step"; item.append(heading(`${step.step}. ${step.title}`), paragraph(`${step.owner} / ${step.status}`)); return item; }));
  elements.stoppedItems.replaceChildren(heading("この画面から実行しない処理"), list(data.stoppedItems || []));
}

function financialExternalEvidence() {
  return state.localEvidence.storeCsvReceipt ? { localStoreCsvReceipt: state.localEvidence.storeCsvReceipt } : {};
}

function applyFinancialExternalEvidence() {
  if (typeof elements.financialDataIntake?.managementApplyFinancialExternalEvidence === "function") {
    elements.financialDataIntake.managementApplyFinancialExternalEvidence(financialExternalEvidence());
  }
}

function sanitizeFinancialPreview(value) {
  if (!value || value.schemaVersion !== "management-financial-local-preview-v1" || !["PL", "BS", "BUDGET"].includes(value.statement)) return null;
  if (value.statement === "BUDGET") return sanitizeBudgetPreview(value);
  if (value.statement === "BS") return sanitizeBalanceSheetPreview(value);
  const amount = (input) => input !== null && input !== undefined && Number.isFinite(Number(input)) ? Number(input) : null;
  const mappingStatus = (status) => ["READY", "LOCAL_CANDIDATE_APPLIED", "LOCAL_EVIDENCE_RECEIVED"].includes(status) ? status : "MAPPING_REQUIRED";
  const rows = Array.isArray(value.rows) ? value.rows.slice(0, 80).map((row) => ({
    entityName: String(row.entityName || "未判定").slice(0, 80),
    salesManYen: amount(row.salesManYen),
    ordinaryProfitManYen: amount(row.ordinaryProfitManYen),
    dataThroughMonthLabel: String(row.dataThroughMonthLabel || "確認待ち").slice(0, 24),
    activeMonthCount: Number.isInteger(Number(row.activeMonthCount)) ? Math.max(0, Math.min(12, Number(row.activeMonthCount))) : 0,
    mappingStatus: mappingStatus(row.mappingStatus),
    mappingCandidateCount: Number.isInteger(Number(row.mappingCandidateCount)) ? Math.max(0, Number(row.mappingCandidateCount)) : 0,
    recordCount: Number.isFinite(Number(row.recordCount)) ? Number(row.recordCount) : 0,
    entityCategory: row.entityCategory === "STORE_CANDIDATE" ? "STORE_CANDIDATE" : "ENTITY_REVIEW_REQUIRED",
    entityCategoryLabel: String(row.entityCategoryLabel || "店舗候補").slice(0, 24),
  })) : [];
  const reviewRows = Array.isArray(value.reviewRows) ? value.reviewRows.slice(0, 20).map((row) => ({
    entityName: String(row.entityName || "未判定").slice(0, 80),
    entityCategory: String(row.entityCategory || "ENTITY_REVIEW_REQUIRED").slice(0, 48),
    entityCategoryLabel: String(row.entityCategoryLabel || "mapping確認").slice(0, 24),
    mappingStatus: mappingStatus(row.mappingStatus),
    mappingCandidateCount: Number.isInteger(Number(row.mappingCandidateCount)) ? Math.max(0, Number(row.mappingCandidateCount)) : 0,
    recordCount: Number.isFinite(Number(row.recordCount)) ? Number(row.recordCount) : 0,
  })) : [];
  const periodComparisonRows = Array.isArray(value.periodComparisonRows) ? value.periodComparisonRows.slice(0, 8).map((row) => ({
    periodLabel: String(row.periodLabel || "対象期確認待ち").slice(0, 40),
    comparisonRangeLabel: String(row.comparisonRangeLabel || "データ月確認待ち").slice(0, 64),
    comparisonMonthCount: Number.isInteger(Number(row.comparisonMonthCount)) ? Math.max(0, Math.min(12, Number(row.comparisonMonthCount))) : 0,
    storeCandidateCount: Number.isInteger(Number(row.storeCandidateCount)) ? Math.max(0, Number(row.storeCandidateCount)) : 0,
    reviewCandidateCount: Number.isInteger(Number(row.reviewCandidateCount)) ? Math.max(0, Number(row.reviewCandidateCount)) : 0,
    dataMonthShortfallCount: Number.isInteger(Number(row.dataMonthShortfallCount)) ? Math.max(0, Number(row.dataMonthShortfallCount)) : 0,
    salesManYen: amount(row.salesManYen),
    ordinaryProfitManYen: amount(row.ordinaryProfitManYen),
    mappingStatus: mappingStatus(row.mappingStatus),
  })) : [];
  const allowedStatuses = new Set([
    "PL_LOCAL_READY",
    "PL_LOCAL_VALIDATED_PENDING_MAPPING",
    "PL_DUPLICATE_FILE_DETECTED",
    "PL_DUPLICATE_ENTITY_PERIOD_DETECTED",
  ]);
  return {
    schemaVersion: "management-financial-local-preview-v1",
    statement: "PL",
    status: allowedStatuses.has(value.status) ? value.status : "PL_NOT_READY",
    rows,
    reviewRows,
    periodComparisonRows,
    entityCandidateCount: rows.length,
    reviewCandidateCount: reviewRows.length,
    selectedPeriodLabel: String(value.selectedPeriodLabel || "対象期確認待ち").slice(0, 40),
    availablePeriodCount: Number.isInteger(Number(value.availablePeriodCount)) ? Math.max(1, Number(value.availablePeriodCount)) : 1,
    selectedPeriodSheetCount: Number.isInteger(Number(value.selectedPeriodSheetCount)) ? Math.max(0, Number(value.selectedPeriodSheetCount)) : rows.length + reviewRows.length,
    historicalPeriodExcludedSheetCount: Number.isInteger(Number(value.historicalPeriodExcludedSheetCount)) ? Math.max(0, Number(value.historicalPeriodExcludedSheetCount)) : 0,
    normalizedRecordCount: Number.isInteger(Number(value.normalizedRecordCount)) ? Math.max(0, Number(value.normalizedRecordCount)) : 0,
    totalNormalizedRecordCount: Number.isInteger(Number(value.totalNormalizedRecordCount)) ? Math.max(0, Number(value.totalNormalizedRecordCount)) : 0,
    completionPendingCount: Number.isInteger(Number(value.completionPendingCount)) ? Math.max(0, Number(value.completionPendingCount)) : 0,
    aggregateExcludedSheetCount: Number.isInteger(Number(value.aggregateExcludedSheetCount)) ? Math.max(0, Number(value.aggregateExcludedSheetCount)) : 0,
    mappingRequiredAccountCount: Number.isInteger(Number(value.mappingRequiredAccountCount)) ? Math.max(0, Number(value.mappingRequiredAccountCount)) : 0,
    mappingCandidateAccountCount: Number.isInteger(Number(value.mappingCandidateAccountCount)) ? Math.max(0, Number(value.mappingCandidateAccountCount)) : 0,
    mappingConfirmationStatus: value.mappingConfirmationStatus === "LOCAL_EVIDENCE_RECEIVED" ? "LOCAL_EVIDENCE_RECEIVED" : "PENDING",
    duplicateFileCount: Number.isInteger(Number(value.duplicateFileCount)) ? Math.max(0, Number(value.duplicateFileCount)) : 0,
    duplicateEntityPeriodCount: Number.isInteger(Number(value.duplicateEntityPeriodCount)) ? Math.max(0, Number(value.duplicateEntityPeriodCount)) : 0,
    comparisonRangeLabel: String(value.comparisonRangeLabel || "データ月確認待ち").slice(0, 64),
    comparisonMonthCount: Number.isInteger(Number(value.comparisonMonthCount)) ? Math.max(0, Math.min(12, Number(value.comparisonMonthCount))) : 0,
    dataMonthShortfallCount: Number.isInteger(Number(value.dataMonthShortfallCount)) ? Math.max(0, Number(value.dataMonthShortfallCount)) : 0,
    salesManYen: amount(value.salesManYen),
    ordinaryProfitManYen: amount(value.ordinaryProfitManYen),
    importActionEnabled: false,
  };
}

function sanitizeBudgetPreview(value) {
  const amount = (input) => input !== null && input !== undefined && Number.isFinite(Number(input)) ? Number(input) : null;
  const rows = Array.isArray(value.rows) ? value.rows.slice(0, 80).map((row) => ({
    entityName: String(row.entityName || "未判定").slice(0, 80),
    entityCategory: row.entityCategory === "STORE_CANDIDATE" ? "STORE_CANDIDATE" : "ENTITY_REVIEW_REQUIRED",
    entityCategoryLabel: String(row.entityCategoryLabel || "候補").slice(0, 24),
    budgetSalesManYen: amount(row.budgetSalesManYen),
    actualSalesManYen: amount(row.actualSalesManYen),
    budgetProfitManYen: amount(row.budgetProfitManYen),
    actualProfitManYen: amount(row.actualProfitManYen),
    varianceSalesManYen: amount(row.varianceSalesManYen),
    varianceProfitManYen: amount(row.varianceProfitManYen),
    activeMonthCount: Number.isInteger(Number(row.activeMonthCount)) ? Math.max(0, Math.min(12, Number(row.activeMonthCount))) : 0,
    mappingStatus: row.mappingStatus === "READY" ? "READY" : "MAPPING_REQUIRED",
    recordCount: Number.isFinite(Number(row.recordCount)) ? Number(row.recordCount) : 0,
  })) : [];
  const reviewRows = Array.isArray(value.reviewRows) ? value.reviewRows.slice(0, 20).map((row) => ({
    entityName: String(row.entityName || "未判定").slice(0, 80),
    entityCategory: String(row.entityCategory || "ENTITY_REVIEW_REQUIRED").slice(0, 48),
    entityCategoryLabel: String(row.entityCategoryLabel || "確認").slice(0, 24),
    activeMonthCount: Number.isInteger(Number(row.activeMonthCount)) ? Math.max(0, Math.min(12, Number(row.activeMonthCount))) : 0,
    mappingStatus: row.mappingStatus === "READY" ? "READY" : "MAPPING_REQUIRED",
    recordCount: Number.isFinite(Number(row.recordCount)) ? Number(row.recordCount) : 0,
  })) : [];
  return {
    schemaVersion: "management-financial-local-preview-v1",
    statement: "BUDGET",
    status: value.status === "BUDGET_LOCAL_READY" ? "BUDGET_LOCAL_READY" : "BUDGET_NOT_READY",
    selectedPeriodLabel: String(value.selectedPeriodLabel || "予実表").slice(0, 40),
    comparisonRangeLabel: String(value.comparisonRangeLabel || "12か月").slice(0, 64),
    comparisonMonthCount: Number.isInteger(Number(value.comparisonMonthCount)) ? Math.max(0, Math.min(12, Number(value.comparisonMonthCount))) : 0,
    entityCandidateCount: rows.length,
    reviewCandidateCount: reviewRows.length,
    aggregateExcludedSheetCount: Number.isInteger(Number(value.aggregateExcludedSheetCount)) ? Math.max(0, Number(value.aggregateExcludedSheetCount)) : 0,
    normalizedRecordCount: Number.isInteger(Number(value.normalizedRecordCount)) ? Math.max(0, Number(value.normalizedRecordCount)) : 0,
    dataMonthShortfallCount: Number.isInteger(Number(value.dataMonthShortfallCount)) ? Math.max(0, Number(value.dataMonthShortfallCount)) : 0,
    budgetSalesManYen: amount(value.budgetSalesManYen),
    actualSalesManYen: amount(value.actualSalesManYen),
    budgetProfitManYen: amount(value.budgetProfitManYen),
    actualProfitManYen: amount(value.actualProfitManYen),
    rows,
    reviewRows,
    importActionEnabled: false,
  };
}

function sanitizeBalanceSheetPreview(value) {
  const amount = (input) => input !== null && input !== undefined && Number.isFinite(Number(input)) ? Number(input) : null;
  const rows = Array.isArray(value.rows) ? value.rows.slice(0, 80).map((row) => ({
    entityName: String(row.entityName || "未判定").slice(0, 80),
    assetsManYen: amount(row.assetsManYen),
    liabilitiesManYen: amount(row.liabilitiesManYen),
    equityManYen: amount(row.equityManYen),
    balanceDeltaManYen: amount(row.balanceDeltaManYen),
    balanceStatus: row.balanceStatus === "BALANCED" ? "BALANCED" : "NOT_READY",
    closingMonthLabel: String(row.closingMonthLabel || "確認待ち").slice(0, 24),
    recordCount: Number.isInteger(Number(row.recordCount)) ? Math.max(0, Number(row.recordCount)) : 0,
  })) : [];
  return {
    schemaVersion: value.schemaVersion,
    statement: "BS",
    status: ["BS_LOCAL_READY", "BS_DUPLICATE_FILE_DETECTED", "BS_DUPLICATE_ENTITY_PERIOD_DETECTED"].includes(value.status) ? value.status : "BS_NOT_READY",
    selectedPeriodLabel: String(value.selectedPeriodLabel || "対象期確認待ち").slice(0, 40),
    availablePeriodCount: Number.isInteger(Number(value.availablePeriodCount)) ? Math.max(1, Number(value.availablePeriodCount)) : 1,
    selectedPeriodSheetCount: Number.isInteger(Number(value.selectedPeriodSheetCount)) ? Math.max(0, Number(value.selectedPeriodSheetCount)) : rows.length,
    historicalPeriodExcludedSheetCount: Number.isInteger(Number(value.historicalPeriodExcludedSheetCount)) ? Math.max(0, Number(value.historicalPeriodExcludedSheetCount)) : 0,
    aggregateExcludedSheetCount: Number.isInteger(Number(value.aggregateExcludedSheetCount)) ? Math.max(0, Number(value.aggregateExcludedSheetCount)) : 0,
    entityCandidateCount: rows.length,
    balancedEntityCount: rows.filter((row) => row.balanceStatus === "BALANCED").length,
    balanceReviewRequiredCount: Number.isInteger(Number(value.balanceReviewRequiredCount)) ? Math.max(0, Number(value.balanceReviewRequiredCount)) : rows.filter((row) => row.balanceStatus !== "BALANCED").length,
    maxAbsBalanceDeltaManYen: amount(value.maxAbsBalanceDeltaManYen),
    balanceReadinessCategory: value.balanceReadinessCategory === "BS_BALANCE_READY" ? "BS_BALANCE_READY" : rows.length ? "BS_BALANCE_REVIEW_REQUIRED" : "BS_BALANCE_NOT_READY",
    normalizedRecordCount: Number.isInteger(Number(value.normalizedRecordCount)) ? Math.max(0, Number(value.normalizedRecordCount)) : 0,
    totalNormalizedRecordCount: Number.isInteger(Number(value.totalNormalizedRecordCount)) ? Math.max(0, Number(value.totalNormalizedRecordCount)) : 0,
    duplicateFileCount: Number.isInteger(Number(value.duplicateFileCount)) ? Math.max(0, Number(value.duplicateFileCount)) : 0,
    duplicateEntityPeriodCount: Number.isInteger(Number(value.duplicateEntityPeriodCount)) ? Math.max(0, Number(value.duplicateEntityPeriodCount)) : 0,
    balanceCheck: value.balanceCheck === "BALANCED" ? "BALANCED" : "NOT_READY",
    importActionEnabled: false,
    rows,
  };
}

function financialDuplicateMessage(preview) {
  const fileCount = Number(preview?.duplicateFileCount || 0);
  const entityPeriodCount = Number(preview?.duplicateEntityPeriodCount || 0);
  if (fileCount <= 0 && entityPeriodCount <= 0) return "";
  return `重複ファイル ${number.format(fileCount)}件 / 同一期・同一候補 ${number.format(entityPeriodCount)}件を検出したため、金額表示を停止しています。`;
}

function buildFinancialLocalReflectionStatus(preview, labelText) {
  const status = document.createElement("div");
  status.className = "financial-local-reflection-status";
  const statement = preview.statement === "BS" ? "B/S" : preview.statement === "BUDGET" ? "予実" : "P/L";
  const recordCount = number.format(preview.normalizedRecordCount || 0);
  status.append(
    label("ローカル反映済み"),
    document.createTextNode(`${labelText}へ${statement}候補 ${recordCount}件を画面確認用に反映中。本番DB保存・本番投入・承認操作は無効です。`)
  );
  return status;
}

function buildFinancialVisibleScope(preview) {
  const box = document.createElement("div");
  box.className = "financial-visible-scope";
  const shown = document.createElement("p");
  shown.append(
    label("表示中"),
    document.createTextNode(`${preview.selectedPeriodLabel} / 店舗・法人候補 ${number.format(preview.entityCandidateCount || 0)}件 / 対象レコード ${number.format(preview.normalizedRecordCount || 0)}件`)
  );
  const pending = document.createElement("p");
  const pendingParts = [
    `mapping確認 ${number.format(preview.mappingCandidateAccountCount || preview.mappingRequiredAccountCount || 0)}件`,
    `除外・要確認 ${number.format(preview.reviewCandidateCount || 0)}件`,
    `過年度除外 ${number.format(preview.historicalPeriodExcludedSheetCount || 0)}シート`,
  ];
  pending.append(label("未反映"), document.createTextNode(pendingParts.join(" / ")));
  box.append(shown, pending);
  return box;
}

function renderFinancialPreviewOverview() {
  if (!elements.financialPreviewOverview) return;
  const previews = [];
  if (state.financialPreviews.PL) previews.push(buildPlOverviewPreview(state.financialPreviews.PL));
  if (state.financialPreviews.BS) previews.push(buildBsOverviewPreview(state.financialPreviews.BS));
  if (state.financialPreviews.BUDGET) previews.push(buildBudgetPreviewCard(state.financialPreviews.BUDGET, "法人経営管理のローカル予実プレビュー"));
  if (!previews.length) { renderFinancialPreviewEmpty(elements.financialPreviewOverview, "法人経営管理", "P/L・B/S"); return; }
  elements.financialPreviewOverview.replaceChildren(...previews);
}

function buildBudgetPreviewCard(preview, titleText = "店舗営業管理のローカル予実プレビュー") {
  const card = document.createElement("section");
  card.className = "financial-local-preview-card";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap embedded local-preview-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.append(tableRow(["候補", "分類", "月数", "計画売上", "当期売上", "売上差異", "計画損益", "当期損益", "損益差異"], true));
  const tbody = document.createElement("tbody");
  tbody.replaceChildren(...(preview.rows.length ? preview.rows.map((row) => tableRow([
    row.entityName,
    row.entityCategoryLabel,
    `${number.format(row.activeMonthCount)}か月`,
    row.budgetSalesManYen == null ? "未算定" : `${number.format(row.budgetSalesManYen)}万円`,
    row.actualSalesManYen == null ? "未算定" : `${number.format(row.actualSalesManYen)}万円`,
    row.varianceSalesManYen == null ? "未算定" : `${number.format(row.varianceSalesManYen)}万円`,
    row.budgetProfitManYen == null ? "未算定" : `${number.format(row.budgetProfitManYen)}万円`,
    row.actualProfitManYen == null ? "未算定" : `${number.format(row.actualProfitManYen)}万円`,
    row.varianceProfitManYen == null ? "未算定" : `${number.format(row.varianceProfitManYen)}万円`,
  ])) : [emptyRow(9, "表示できる予実候補はまだありません")]));
  table.append(thead, tbody);
  wrap.append(table);
  card.append(
    heading(titleText),
    buildFinancialLocalReflectionStatus(preview, "店舗営業管理"),
    paragraph(`${preview.selectedPeriodLabel} をローカル確認用に表示しています。DB保存・本番投入・個人情報表示はありません。店舗候補 ${number.format(preview.entityCandidateCount)}件 / 確認候補 ${number.format(preview.reviewCandidateCount)}件 / 除外集計 ${number.format(preview.aggregateExcludedSheetCount)}件。`),
    previewMetricGrid([
      ["計画売上", preview.budgetSalesManYen == null ? "未算定" : `${number.format(preview.budgetSalesManYen)}万円`],
      ["当期売上", preview.actualSalesManYen == null ? "未算定" : `${number.format(preview.actualSalesManYen)}万円`],
      ["計画損益", preview.budgetProfitManYen == null ? "未算定" : `${number.format(preview.budgetProfitManYen)}万円`],
      ["本番投入", "disabled"],
    ]),
    wrap
  );
  return card;
}

function buildPlOverviewPreview(preview) {
  const card = document.createElement("section");
  card.className = "financial-local-preview-card";
  const duplicateMessage = financialDuplicateMessage(preview);
  const mapping = preview.mappingConfirmationStatus === "LOCAL_EVIDENCE_RECEIVED"
    ? "候補mappingのローカル回答確認済み（本番未承認）"
    : preview.mappingCandidateAccountCount > 0
    ? `候補mapping ${number.format(preview.mappingCandidateAccountCount)}件を仮対応（経理確認前）`
    : preview.mappingRequiredAccountCount > 0 ? "mapping確認あり" : "mapping確認OK";
  card.append(
    heading("ローカルP/Lプレビュー（本番未投入）"),
    buildFinancialLocalReflectionStatus(preview, "法人経営管理"),
    buildFinancialVisibleScope(preview),
    paragraph(duplicateMessage || `${preview.selectedPeriodLabel}を画面確認用に仮反映中。比較範囲 ${preview.comparisonRangeLabel}。店舗候補 ${number.format(preview.entityCandidateCount)}件 / 除外集計 ${number.format(preview.aggregateExcludedSheetCount || 0)}件 / ${mapping}。過年度 ${number.format(preview.historicalPeriodExcludedSheetCount || 0)}シートは合算していません。`),
    buildFinancialProductionHoldSummary("PL", preview),
    previewMetricGrid([
      ["店舗候補売上合計", preview.salesManYen == null ? "未算定" : `${number.format(preview.salesManYen)}万円`],
      ["店舗候補経常損益", preview.ordinaryProfitManYen == null ? "未算定" : `${number.format(preview.ordinaryProfitManYen)}万円`],
      ["対象期レコード", `${number.format(preview.normalizedRecordCount || 0)}件`],
      ["本番投入", "disabled"],
    ])
  );
  const comparison = buildPlPeriodComparison(preview, "年度別P/L比較（店舗候補のみ）");
  if (comparison) card.append(comparison);
  card.append(buildFinancialMissingDataSummary("法人経営管理"));
  return card;
}

function buildBsOverviewPreview(preview) {
  const card = document.createElement("section");
  card.className = "financial-local-preview-card";
  const duplicateMessage = financialDuplicateMessage(preview);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap embedded local-preview-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.append(tableRow(["法人候補", "最終月", "資産", "負債", "純資産", "貸借差額", "貸借"], true));
  const tbody = document.createElement("tbody");
  tbody.replaceChildren(...(preview.rows.length ? preview.rows.map((row) => tableRow([
    row.entityName,
    row.closingMonthLabel,
    row.assetsManYen == null ? "未算定" : `${number.format(row.assetsManYen)}万円`,
    row.liabilitiesManYen == null ? "未算定" : `${number.format(row.liabilitiesManYen)}万円`,
    row.equityManYen == null ? "未算定" : `${number.format(row.equityManYen)}万円`,
    bsBalanceDeltaText(row),
    row.balanceStatus === "BALANCED" ? "一致" : "確認待ち",
  ])) : [emptyRow(7, "表示できるB/S候補はまだありません")]));
  table.append(thead, tbody);
  wrap.append(table);
  card.append(
    heading("ローカルB/Sプレビュー（本番未投入）"),
    buildFinancialLocalReflectionStatus(preview, "法人経営管理"),
    paragraph(duplicateMessage || `${preview.selectedPeriodLabel}の最終月残高だけを表示しています。貸借一致 ${number.format(preview.balancedEntityCount)}/${number.format(preview.entityCandidateCount)}候補、確認待ち ${number.format(preview.balanceReviewRequiredCount || 0)}件。部門・共通などの確認用候補 ${number.format(preview.reviewCandidateCount || 0)}件は本番投入対象に含めません。過年度 ${number.format(preview.historicalPeriodExcludedSheetCount || 0)}シートは合算していません。`),
    buildFinancialProductionHoldSummary("BS", preview),
    previewMetricGrid([
      ["法人候補", `${number.format(preview.entityCandidateCount)}件`],
      ["貸借一致", `${number.format(preview.balancedEntityCount)}件`],
      ["最大貸借差額", preview.maxAbsBalanceDeltaManYen == null ? "未算定" : `${number.format(preview.maxAbsBalanceDeltaManYen)}万円`],
      ["本番投入", "disabled"],
    ]),
    wrap
  );
  card.append(buildFinancialMissingDataSummary("法人経営管理"));
  return card;
}

function buildFinancialProductionHoldSummary(statement, preview) {
  const summary = document.createElement("div");
  summary.className = "financial-production-hold-summary";
  const rows = statement === "BS"
    ? [
      ["ローカル検証", preview.balanceReadinessCategory === "BS_BALANCE_READY" ? "PASS" : "貸借確認待ち"],
      ["本番catalog", "PENDING"],
      ["provider identity", "NOT_READY"],
      ["本番投入", "DISABLED"],
    ]
    : [
      ["ローカル検証", preview.status === "PL_LOCAL_READY" ? "PASS" : "確認待ち"],
      ["科目mapping", preview.mappingConfirmationStatus === "LOCAL_EVIDENCE_RECEIVED" || preview.mappingRequiredAccountCount === 0 ? "LOCAL_OK" : "経理確認待ち"],
      ["本番catalog", "PENDING"],
      ["本番投入", "DISABLED"],
    ];
  rows.forEach(([name, value]) => {
    const item = document.createElement("p");
    item.append(label(name), document.createTextNode(value));
    summary.append(item);
  });
  return summary;
}

function bsBalanceDeltaText(row) {
  if (row.balanceDeltaManYen != null) return `${number.format(Math.round(Number(row.balanceDeltaManYen)))}万円`;
  if (row.assetsManYen == null || row.liabilitiesManYen == null || row.equityManYen == null) return "未算定";
  const delta = Number(row.assetsManYen) - Number(row.liabilitiesManYen) - Number(row.equityManYen);
  if (!Number.isFinite(delta)) return "未算定";
  return `${number.format(Math.round(delta))}万円`;
}

function renderFinancialPreviewStores(localPlMatch = { matched: 0, unmatched: 0 }) {
  if (!elements.financialPreviewStores) return;
  const preview = state.financialPreviews.PL;
  const budgetPreview = state.financialPreviews.BUDGET;
  if (!preview && budgetPreview) { elements.financialPreviewStores.replaceChildren(buildBudgetPreviewCard(budgetPreview)); return; }
  if (!preview) { renderFinancialPreviewEmpty(elements.financialPreviewStores, "店舗営業管理"); return; }
  const section = document.createElement("section");
  section.className = "financial-local-preview-card";
  const duplicateMessage = financialDuplicateMessage(preview);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap embedded local-preview-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.append(tableRow(["店舗候補", "分類", "データ月候補", "売上", "経常損益", "mapping", "レコード"], true));
  const tbody = document.createElement("tbody");
  tbody.replaceChildren(...(preview.rows.length ? preview.rows.map((row) => tableRow([
    row.entityName,
    row.entityCategoryLabel || "店舗候補",
    row.dataThroughMonthLabel,
    row.salesManYen == null ? "未算定" : `${number.format(row.salesManYen)}万円`,
    row.ordinaryProfitManYen == null ? "未算定" : `${number.format(row.ordinaryProfitManYen)}万円`,
    financialMappingLabel(row.mappingStatus),
    `${number.format(row.recordCount)}件`,
  ])) : [emptyRow(7, "店舗候補として表示できるP/Lシートはまだありません")]));
  table.append(thead, tbody);
  wrap.append(table);
  section.append(
    heading("店舗営業管理へのローカルP/L反映（本番未投入）"),
    buildFinancialLocalReflectionStatus(preview, "店舗営業管理"),
    buildFinancialVisibleScope(preview),
    paragraph(duplicateMessage || `${preview.selectedPeriodLabel}の店舗候補だけを仮表示しています。店舗候補 ${number.format(preview.entityCandidateCount || 0)}件 / 除外・要確認 ${number.format(preview.reviewCandidateCount || 0)}件。候補mappingは${preview.mappingConfirmationStatus === "LOCAL_EVIDENCE_RECEIVED" ? "ローカル回答確認済み（本番未承認）" : "経理確認前"}で、DB保存・本番投入・個人情報表示はありません。`),
    wrap
  );
  if (localPlMatch.unmatched > 0) section.append(buildFinancialStoreMatchAction(localPlMatch));
  const comparison = buildPlPeriodComparison(preview, "年度別 店舗候補合計");
  if (comparison) section.append(comparison);
  section.append(buildFinancialMissingDataSummary("店舗営業管理"));
  elements.financialPreviewStores.replaceChildren(...(budgetPreview ? [section, buildBudgetPreviewCard(budgetPreview)] : [section]));
}

function buildFinancialStoreMatchAction(localPlMatch) {
  const action = document.createElement("div");
  action.className = "financial-store-match-action";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "店舗名対応表を確認";
  button.addEventListener("click", () => selectView("dataops"));
  const csv = buildFinancialStoreMatchCsv(localPlMatch);
  const download = document.createElement("a");
  download.className = "financial-store-match-download";
  download.href = csv.href;
  download.download = csv.fileName;
  download.textContent = `未照合店舗CSVを保存（${number.format(csv.rowCount)}件）`;
  const reviewLabel = document.createElement("label");
  reviewLabel.className = "financial-store-match-review";
  reviewLabel.textContent = "返却CSVを検証";
  const reviewInput = document.createElement("input");
  reviewInput.type = "file";
  reviewInput.accept = ".csv,text/csv";
  reviewInput.addEventListener("change", async () => {
    reviewInput.disabled = true;
    try {
      const receipt = await validateFinancialStoreMatchReviewFile(reviewInput.files?.[0], localPlMatch);
      state.localEvidence.storeNameReceipt = receipt.status === "STORE_MATCH_LOCAL_EVIDENCE" ? receipt : null;
      setStoreMatchReviewStatus(action, receipt);
      renderStores();
    } finally {
      reviewInput.value = "";
      reviewInput.disabled = false;
    }
  });
  reviewLabel.append(reviewInput);
  const reviewStatus = document.createElement("p");
  reviewStatus.className = "financial-store-match-review-status";
  reviewStatus.dataset.financialStoreMatchReviewStatus = state.localEvidence.storeNameReceipt ? "STORE_MATCH_LOCAL_EVIDENCE" : "PENDING";
  reviewStatus.textContent = state.localEvidence.storeNameReceipt
    ? `ローカル返却CSV確認済み: 別名 ${number.format(state.localEvidence.storeNameReceipt.aliasCount)}件 / 除外 ${number.format(state.localEvidence.storeNameReceipt.excludedCount)}件`
    : "返却CSVはこの端末だけで検証します。本番投入には使用しません。";
  action.append(
    label("次に必要"),
    paragraph(`P/L候補のうち一致 ${number.format(localPlMatch.matched)}件 / 未照合 ${number.format(localPlMatch.unmatched)}件。店舗名対応表を確認するまで、本番投入は無効です。`),
    buildFinancialStoreMatchEvidenceSummary(localPlMatch),
    buildFinancialStoreMatchReturnRule(),
    download,
    reviewLabel,
    reviewStatus,
    button
  );
  if (localPlMatch.unmatchedNames?.length) {
    const list = document.createElement("ul");
    list.className = "financial-store-match-unmatched";
    list.replaceChildren(...localPlMatch.unmatchedNames.map((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      return item;
    }));
    action.append(list);
  }
  return action;
}

function buildFinancialStoreMatchEvidenceSummary(localPlMatch) {
  const summary = document.createElement("div");
  summary.className = "financial-store-match-evidence-summary";
  const receipt = state.localEvidence.storeNameReceipt;
  [
    ["直接一致", localPlMatch.matched],
    ["別名対応", receipt?.aliasCount || 0],
    ["除外", receipt?.excludedCount || 0],
    ["未照合", localPlMatch.unmatched],
  ].forEach(([name, value]) => {
    const item = document.createElement("span");
    item.textContent = `${name} ${number.format(value)}件`;
    summary.append(item);
  });
  return summary;
}

function setStoreMatchReviewStatus(container, receipt) {
  const status = container.querySelector(".financial-store-match-review-status");
  if (!status) return;
  const labels = {
    STORE_MATCH_LOCAL_EVIDENCE: `ローカル返却CSV確認済み: 別名 ${number.format(receipt.aliasCount)}件 / 除外 ${number.format(receipt.excludedCount)}件`,
    STORE_MATCH_FORMAT_INVALID: "返却CSVの列・行数・形式が一致しません。",
    STORE_MATCH_MISMATCH: "店舗候補・法人・状態・正しい店舗名が現在のP/L候補と一致しません。",
    STORE_MATCH_FILE_INVALID: "UTF-8 CSV、64KB以下の返却CSVを選択してください。",
  };
  status.dataset.financialStoreMatchReviewStatus = receipt.status;
  status.textContent = labels[receipt.status] || "返却CSVを検証できませんでした。";
}

function buildFinancialStoreMatchReturnRule() {
  const rule = document.createElement("ul");
  rule.className = "financial-store-match-return-rule";
  ["確認済み: 店舗マスター名と同一", "別名: 正しい店舗マスター名を補記", "除外: 店舗ではない候補"].forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    rule.append(item);
  });
  return rule;
}

function buildFinancialStoreMatchCsv(localPlMatch) {
  const header = ["店舗候補", "法人", "現在状態", "確認依頼", "確認結果", "正しい店舗名", "本番投入"];
  const rows = (localPlMatch.unmatchedRows || []).map((row) => [
    row.storeName,
    row.corporationName,
    row.currentStatus,
    "弥生P/Lシート名と店舗マスター名の対応を確認",
    "確認済み/別名/除外",
    "",
    "disabled",
  ]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(localCsvCell).join(",")).join("\r\n")}\r\n`;
  return {
    fileName: "management-pl-store-name-review.csv",
    rowCount: rows.length,
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
  };
}

async function validateFinancialStoreMatchReviewFile(file, localPlMatch) {
  if (!file || !/\.csv$/iu.test(String(file.name || "")) || Number(file.size) <= 0 || Number(file.size) > 64 * 1024) {
    return { status: "STORE_MATCH_FILE_INVALID", aliasCount: 0, excludedCount: 0 };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    return validateFinancialStoreMatchReviewCsv(text, localPlMatch, localPlStoreRowsByNormalizedName());
  } catch {
    return { status: "STORE_MATCH_FILE_INVALID", aliasCount: 0, excludedCount: 0 };
  }
}

function validateFinancialStoreMatchReviewCsv(text, localPlMatch, localPlRowsByStore) {
  const rows = parseLocalCsvRows(text);
  const header = ["店舗候補", "法人", "現在状態", "確認依頼", "確認結果", "正しい店舗名", "本番投入"];
  if (!rows.length || rows[0].length !== header.length || !rows[0].every((value, index) => value === header[index])) {
    return { status: "STORE_MATCH_FORMAT_INVALID", aliasCount: 0, excludedCount: 0 };
  }
  const expectedRows = localPlMatch?.unmatchedRows || [];
  const body = rows.slice(1);
  if (body.length !== expectedRows.length) return { status: "STORE_MATCH_FORMAT_INVALID", aliasCount: 0, excludedCount: 0 };
  const expected = new Map(expectedRows.map((row) => [`${row.storeName}\u0000${row.corporationName}\u0000${row.currentStatus}`, row]));
  const aliases = {};
  const excluded = {};
  let aliasCount = 0;
  let excludedCount = 0;
  for (const values of body) {
    if (values.length !== header.length || values[3] !== "弥生P/Lシート名と店舗マスター名の対応を確認" || values[6] !== "disabled") {
      return { status: "STORE_MATCH_FORMAT_INVALID", aliasCount: 0, excludedCount: 0 };
    }
    const rowKey = `${values[0]}\u0000${values[1]}\u0000${values[2]}`;
    if (!expected.delete(rowKey)) return { status: "STORE_MATCH_MISMATCH", aliasCount: 0, excludedCount: 0 };
    const storeKey = normalizeStoreCandidateName(values[0]);
    const reviewStatus = values[4];
    const correctName = values[5];
    if (reviewStatus === "別名") {
      const aliasKey = normalizeStoreCandidateName(correctName);
      if (!aliasKey || !localPlRowsByStore.has(aliasKey)) return { status: "STORE_MATCH_MISMATCH", aliasCount: 0, excludedCount: 0 };
      aliases[storeKey] = aliasKey;
      aliasCount += 1;
    } else if (reviewStatus === "除外") {
      if (correctName) return { status: "STORE_MATCH_MISMATCH", aliasCount: 0, excludedCount: 0 };
      excluded[storeKey] = true;
      excludedCount += 1;
    } else if (reviewStatus !== "確認済み" || correctName) {
      return { status: "STORE_MATCH_MISMATCH", aliasCount: 0, excludedCount: 0 };
    }
  }
  if (expected.size) return { status: "STORE_MATCH_MISMATCH", aliasCount: 0, excludedCount: 0 };
  return { status: "STORE_MATCH_LOCAL_EVIDENCE", aliasCount, excludedCount, aliases, excluded };
}

function parseLocalCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/u, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell.replace(/\r$/u, "")); rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (quoted) return [];
  if (cell || row.length) { row.push(cell.replace(/\r$/u, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => value !== ""));
}

function localCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function renderFinancialPreviewFourAxis() {
  if (!elements.financialPreviewFourAxis) return;
  const preview = state.financialPreviews.PL;
  if (!preview) { elements.financialPreviewFourAxis.replaceChildren(); return; }
  const section = document.createElement("section");
  section.className = "financial-local-preview-card";
  section.append(
    heading("4軸分析へのローカルP/L補助値（本番未投入）"),
    buildFinancialLocalReflectionStatus(preview, "4軸分析"),
    paragraph(`${preview.selectedPeriodLabel}の店舗候補P/Lから、収益性の確認用合計だけを表示しています。人員・B/S・本番分類は未反映です。`),
    previewMetricGrid([
      ["店舗候補売上", preview.salesManYen == null ? "未算定" : `${number.format(preview.salesManYen)}万円`],
      ["店舗候補経常損益", preview.ordinaryProfitManYen == null ? "未算定" : `${number.format(preview.ordinaryProfitManYen)}万円`],
      ["比較月", `${number.format(preview.comparisonMonthCount || 0)}ヶ月`],
      ["本番投入", "disabled"],
    ])
  );
  elements.financialPreviewFourAxis.replaceChildren(section);
}

function renderFinancialPreviewDepartments() {
  if (!elements.financialPreviewDepartments) return;
  const preview = state.financialPreviews.PL;
  if (!preview) { elements.financialPreviewDepartments.replaceChildren(); return; }
  const candidates = [...preview.reviewRows, ...preview.rows].slice(0, 24);
  const wrap = document.createElement("div");
  wrap.className = "table-wrap embedded local-preview-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.append(tableRow(["部門/店舗候補", "分類", "mapping", "レコード"], true));
  const tbody = document.createElement("tbody");
  tbody.replaceChildren(...(candidates.length ? candidates.map((row) => tableRow([
    row.entityName,
    row.entityCategoryLabel || "候補",
    financialMappingLabel(row.mappingStatus),
    `${number.format(row.recordCount || 0)}件`,
  ])) : [emptyRow(4, "部門候補として確認できるP/Lシートはまだありません")]));
  table.append(thead, tbody);
  wrap.append(table);
  const section = document.createElement("section");
  section.className = "financial-local-preview-card";
  section.append(
    heading("部門別分析へのローカルP/L候補（本番未投入）"),
    buildFinancialLocalReflectionStatus(preview, "部門別分析"),
    paragraph("弥生Excelのシート候補を確認用に表示しています。合計・共通・FC合計の二重計上は除外し、DB保存・本番投入は無効です。"),
    wrap
  );
  elements.financialPreviewDepartments.replaceChildren(section);
}

function buildFinancialMissingDataSummary(scopeLabelText) {
  const items = financialReadinessItems();
  const readyItems = items.filter((item) => item.ready);
  const pendingItems = items.filter((item) => !item.ready);
  const section = document.createElement("section");
  section.className = "financial-missing-data-summary";
  const listNode = document.createElement("ul");
  listNode.className = "financial-missing-data-list";
  listNode.replaceChildren(...pendingItems.slice(0, 5).map((item) => {
    const li = document.createElement("li");
    li.append(label(item.statusLabel), document.createTextNode(item.label));
    return li;
  }));
  section.append(
    heading(`${scopeLabelText} 本番反映までの不足データ`),
    paragraph(`${readyItems.length}/${items.length}項目をローカル確認済み。本番DBへの保存・承認・再計算は、provider identityとproduction catalog証跡が揃うまで無効です。`),
    buildFinancialMissingDataDownload(scopeLabelText, pendingItems),
    previewMetricGrid([
      ["ローカル確認済み", `${readyItems.length}項目`],
      ["確認待ち", `${pendingItems.length}項目`],
      ["本番投入", "disabled"],
    ]),
    buildFinancialProductionBlockers(),
    buildFinancialMissingDataPriority(pendingItems),
    buildFinancialNextStep(pendingItems),
    listNode
  );
  return section;
}

function buildFinancialProductionBlockers() {
  const blockers = [
    ["PRODUCTION_CATALOG_EVIDENCE", "本番catalog証跡"],
    ["PROVIDER_RUNTIME_IDENTITY", "provider identity"],
    ["STAGED_IMPORT_CONTRACT", "staging/import契約"],
  ];
  const listNode = document.createElement("ul");
  listNode.className = "financial-production-blocker-list";
  listNode.replaceChildren(...blockers.map(([category, text]) => {
    const item = document.createElement("li");
    item.dataset.financialProductionBlocker = category;
    item.append(label("PENDING"), document.createTextNode(text));
    return item;
  }));
  const panel = document.createElement("div");
  panel.className = "financial-production-blockers";
  panel.append(
    label("本番投入を止めている条件"),
    listNode
  );
  return panel;
}

function buildFinancialMissingDataPriority(pendingItems) {
  const priority = document.createElement("ol");
  priority.className = "financial-missing-data-priority";
  const top = pendingItems.slice(0, 3);
  if (!top.length) {
    const item = document.createElement("li");
    item.textContent = "production catalog証跡とprovider runtime identityを確認";
    priority.append(item);
    return priority;
  }
  top.forEach((entry) => {
    const item = document.createElement("li");
    item.append(label(entry.statusLabel), document.createTextNode(entry.label));
    priority.append(item);
  });
  return priority;
}

function buildFinancialMissingDataDownload(scopeLabelText, pendingItems) {
  const link = document.createElement("a");
  link.className = "financial-missing-data-download";
  const csv = buildFinancialMissingDataCsv(scopeLabelText, pendingItems);
  link.href = csv.href;
  link.download = csv.fileName;
  link.textContent = `不足項目CSVを保存（${number.format(csv.rowCount)}件）`;
  return link;
}

function buildFinancialMissingDataCsv(scopeLabelText, pendingItems) {
  const header = ["画面", "不足項目", "状態", "次の準備", "本番投入"];
  const rows = pendingItems.map((item) => [
    scopeLabelText,
    item.label,
    item.statusLabel,
    item.detail || "production catalog証跡 / provider runtime identity確認",
    "disabled",
  ]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(localCsvCell).join(",")).join("\r\n")}\r\n`;
  return {
    fileName: "management-financial-visible-missing-data.csv",
    rowCount: rows.length,
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
  };
}

function buildFinancialNextStep(pendingItems) {
  const next = pendingItems[0] || { label: "本番catalog証跡 / provider runtime identity", statusLabel: "本番証跡待ち" };
  const action = document.createElement("div");
  action.className = "financial-missing-data-next";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "財務データ取込へ";
  button.addEventListener("click", () => selectView("dataops"));
  action.append(
    label("次に必要"),
    heading(next.label),
    paragraph(`${next.statusLabel}。この画面では確認表示だけを行い、本番投入は無効です。`),
    buildFinancialAccountingRequestNote(next),
    button
  );
  return action;
}

function buildFinancialAccountingRequestNote(item) {
  const note = document.createElement("p");
  note.className = "financial-missing-data-request-note";
  const detail = item.detail ? ` / ${item.detail}` : "";
  note.textContent = `経理確認: ${item.label}${detail}`;
  return note;
}

function financialReadinessItems() {
  const pl = state.financialPreviews.PL;
  const bs = state.financialPreviews.BS;
  const budget = state.financialPreviews.BUDGET;
  const storeCsvReady = Boolean(state.localEvidence.storeCsvReceipt);
  const helperItems = buildFinancialCompletionItems({
    statement: "",
    status: "LOCAL_SCREEN_SUMMARY",
    sheetCount: 0,
    missingByAccount: {},
    mappingCandidatesByAccount: {},
    localStoreCsvReceipt: state.localEvidence.storeCsvReceipt,
  });
  const itemLabel = (key, fallback) => helperItems.find((item) => item.key === key)?.label || fallback;
  return [
    {
      key: "PL_ANNUAL_REPORT",
      label: itemLabel("PL_ANNUAL_REPORT", "部門別年間P/L"),
      statusLabel: pl ? "ローカル確認済み" : "資料待ち",
      ready: Boolean(pl && !String(pl.status || "").includes("DUPLICATE")),
    },
    {
      key: "PL_ACCOUNT_MAPPING",
      label: itemLabel("PL_ACCOUNT_MAPPING", "P/L勘定科目対応表"),
      statusLabel: !pl ? "資料待ち" : pl.mappingConfirmationStatus === "LOCAL_EVIDENCE_RECEIVED" || pl.mappingRequiredAccountCount === 0 ? "ローカル確認済み" : "経理確認待ち",
      ready: Boolean(pl && (pl.mappingConfirmationStatus === "LOCAL_EVIDENCE_RECEIVED" || pl.mappingRequiredAccountCount === 0)),
    },
    {
      key: "BALANCE_SHEET",
      label: itemLabel("BALANCE_SHEET", "B/S年間データ"),
      statusLabel: !bs ? "資料待ち" : bs.balanceReadinessCategory === "BS_BALANCE_READY" ? "ローカル確認済み" : "貸借確認待ち",
      ready: Boolean(bs && bs.balanceReadinessCategory === "BS_BALANCE_READY"),
    },
    {
      key: "SALES_SUBLEDGER",
      label: itemLabel("SALES_SUBLEDGER", "売上高の補助残高一覧表"),
      statusLabel: storeCsvReady ? "ローカル回答確認済み" : "資料待ち",
      ready: storeCsvReady,
    },
    { key: "UTILITY_SUBLEDGER", label: itemLabel("UTILITY_SUBLEDGER", "水道光熱費の補助残高一覧表"), statusLabel: "資料待ち", ready: false },
    { key: "COUPON_USAGE", label: itemLabel("COUPON_USAGE", "クーポン利用額"), statusLabel: "資料待ち", ready: false },
    { key: "BUDGET_PLAN", label: itemLabel("BUDGET_PLAN", "予算・計画データ"), statusLabel: "資料待ち", ready: false },
    { key: "FC_RULE", label: itemLabel("FC_RULE", "FC店舗の変換ルール"), statusLabel: "運用ルール待ち", ready: false },
    { key: "PRODUCTION_EVIDENCE", label: "production catalog証跡 / provider runtime identity", statusLabel: "本番証跡待ち", ready: false },
  ].map((item) => item.key === "BUDGET_PLAN"
    ? { ...item, statusLabel: budget ? "ローカル確認済み" : item.statusLabel, ready: Boolean(budget) }
    : item);
}

function buildPlPeriodComparison(preview, titleText) {
  if (!Array.isArray(preview.periodComparisonRows) || !preview.periodComparisonRows.length) return null;
  const section = document.createElement("section");
  section.className = "financial-period-comparison";
  const title = document.createElement("h3");
  title.textContent = titleText;
  const note = paragraph("各期を独立集計し、店舗候補だけを比較しています。合計・本部・FC・共通シートは含みません。");
  const wrap = document.createElement("div");
  wrap.className = "table-wrap embedded local-preview-table";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.append(tableRow(["対象期", "比較範囲", "店舗候補", "売上", "経常損益", "月不足", "要確認", "mapping"], true));
  const tbody = document.createElement("tbody");
  tbody.replaceChildren(...preview.periodComparisonRows.map((row) => tableRow([
    row.periodLabel,
    row.comparisonRangeLabel,
    `${number.format(row.storeCandidateCount)}件`,
    row.salesManYen == null ? "未算定" : `${number.format(row.salesManYen)}万円`,
    row.ordinaryProfitManYen == null ? "未算定" : `${number.format(row.ordinaryProfitManYen)}万円`,
    `${number.format(row.dataMonthShortfallCount)}件`,
    `${number.format(row.reviewCandidateCount)}件`,
    financialMappingLabel(row.mappingStatus),
  ])));
  table.append(thead, tbody);
  wrap.append(table);
  section.append(title, note, wrap);
  return section;
}

function financialMappingLabel(status) {
  if (status === "READY") return "確認OK";
  if (status === "LOCAL_EVIDENCE_RECEIVED") return "ローカル回答確認済み";
  if (status === "LOCAL_CANDIDATE_APPLIED") return "仮対応・経理確認前";
  return "mapping確認";
}

function renderFinancialPreviewEmpty(container, labelText, statementLabel = "P/L") {
  const section = document.createElement("section");
  section.className = "financial-local-preview-card is-empty";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "財務データ取込へ";
  button.addEventListener("click", () => selectView("dataops"));
  section.append(
    heading(`${labelText}のローカル${statementLabel}プレビュー`),
    paragraph("弥生Excelを選択すると、この画面に確認用の財務数値が表示されます。ファイル内容は送信されず、本番投入も無効です。"),
    button
  );
  container.replaceChildren(section);
}

function previewMetricGrid(entries) {
  const grid = document.createElement("div");
  grid.className = "metric-grid financial-local-preview-metrics";
  grid.replaceChildren(...entries.map(([name, value]) => {
    const item = document.createElement("div");
    item.className = "metric";
    item.append(label(name), valueNode(value));
    return item;
  }));
  return grid;
}

function renderCashChart(rows) { renderChart("cash", "cash-chart", { type: "line", data: { labels: rows.map((row) => row.month), datasets: [{ label: "現預金残高（万円）", data: rows.map((row) => row.actualManYen), borderColor: colors[1], backgroundColor: "rgba(23,50,77,.12)", fill: true, tension: .25 }, { label: "絶対防衛ライン（万円）", data: rows.map((row) => row.defenseManYen), borderColor: colors[0], borderDash: [7, 5], tension: .2 }] }, options: chartOptions() }); }
function renderProfitChart(rows, allowed) {
  const filtered = rows.filter((row) => !allowed.length || allowed.includes(row.corporation)); const months = [...new Set(filtered.map((row) => row.month))]; const corporations = [...new Set(filtered.map((row) => row.corporation))];
  renderChart("profit", "profit-chart", { type: "line", data: { labels: months, datasets: corporations.map((corp, index) => ({ label: corp, data: months.map((month) => filtered.find((row) => row.month === month && row.corporation === corp)?.ordinaryProfitRatePercent ?? null), borderColor: colors[index % colors.length], tension: .25 })) }, options: chartOptions() });
}
function renderDepartmentChart(rows) { renderChart("department", "department-chart", { type: "bar", data: { labels: rows.map((row) => row.name), datasets: [{ label: "部門利益（万円）", data: rows.map((row) => row.profitManYen), backgroundColor: rows.map((row) => Number(row.profitManYen) < 0 ? "#b23a48" : "#17324d") }] }, options: chartOptions() }); }
function renderChart(key, canvasId, config) { state.charts[key]?.destroy(); const canvas = byId(canvasId); if (!canvas || !window.Chart) return; state.charts[key] = new window.Chart(canvas, config); }
function chartOptions() { return { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: false, grid: { color: "#e5e9ec" } }, x: { grid: { display: false } } } }; }

function renderMetrics(container, entries) { container.replaceChildren(...entries.map(([name, value, status]) => { const item = document.createElement("div"); item.className = `metric${status ? ` ${status}` : ""}`; item.append(label(name), valueNode(value)); return item; })); }
function tableRow(values, header = false) { const row = document.createElement("tr"); values.forEach((value) => { const cell = document.createElement(header ? "th" : "td"); if (value instanceof Node) cell.append(value); else cell.textContent = String(value ?? ""); row.append(cell); }); return row; }
function emptyRow(columns, message) { const row = document.createElement("tr"); row.className = "empty-row"; const cell = document.createElement("td"); cell.colSpan = columns; cell.textContent = message; row.append(cell); return row; }
function label(value) { const node = document.createElement("span"); node.className = "metric-label"; node.textContent = value; return node; }
function valueNode(value) { const node = document.createElement("div"); node.className = "metric-value"; node.textContent = value; return node; }
function heading(value) { const node = document.createElement("h3"); node.textContent = value; return node; }
function paragraph(value) { const node = document.createElement("p"); node.textContent = value; return node; }
function muted(value) { const node = paragraph(value); node.className = "muted"; return node; }
function list(items) { const node = document.createElement("ul"); (items.length ? items : ["確認項目はありません"]).forEach((value) => { const li = document.createElement("li"); li.textContent = value; node.append(li); }); return node; }
function statusNode(status) { const node = document.createElement("span"); node.className = `status ${status || "warning"}`; node.textContent = statusText(status); return node; }
function statusText(value) { return ({ safe: "安定", warning: "確認", danger: "注意", missing: "データ待ち" })[value] || "確認"; }
function metricText(value, unit) { return value === null || value === undefined ? "データ待ち" : `${number.format(value)}${unit}`; }
function workforceMetric(value, unit = "") { return workforceAggregatesVisible && value !== null && value !== undefined && Number.isFinite(Number(value)) ? `${number.format(Number(value))}${unit}` : "算定待ち"; }
function aggregateSurvival(rows) { const values = rows.map((row) => Number(row.survivalMonths)).filter(Number.isFinite); return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null; }
function scopeLabel(value) { return ({ all_stores: "全店舗", assigned_stores: "担当店舗", own_store: "自店舗" })[value] || "権限確認済み"; }
function comment(item) { const article = document.createElement("article"); article.className = "expert-comment"; const head = document.createElement("strong"); head.textContent = [item.author, item.organization].filter(Boolean).join(" / "); article.append(head, paragraph(item.body || item.title || "")); return article; }

function setLoading(message) { elements.notice.hidden = false; elements.connection.textContent = "読込中"; elements.notice.classList.remove("is-error"); elements.noticeTitle.textContent = message; elements.noticeBody.textContent = "Backendで社員状態・権限・scopeを再確認しています。"; }
function setReady() { elements.connection.textContent = "接続済み"; elements.notice.classList.remove("is-error"); elements.notice.hidden = true; }
function renderAuthRequired() { elements.notice.hidden = false; elements.connection.textContent = "未接続"; elements.notice.classList.add("is-error"); elements.noticeTitle.textContent = "HUBログインが必要です"; elements.noticeBody.textContent = "NOV HUBへ戻り、経営管理システムを開き直してください。"; }
function renderError(error) {
  elements.notice.hidden = false;
  const code = String(error?.code || "");
  if (["UNAUTHORIZED", "TOKEN_MISSING", "TOKEN_VERIFICATION_FAILED"].includes(code) || Number(error?.status) === 401) { handleNovHubSessionAuthFailure(401); clearNovHubSession(); renderAuthRequired(); return; }
  elements.connection.textContent = "確認が必要"; elements.notice.classList.add("is-error"); elements.noticeTitle.textContent = ["FORBIDDEN", "SCOPE_DENIED"].includes(code) ? "表示権限がありません" : code === "DATA_NOT_READY" ? "集計データが準備中です" : "データを読み込めませんでした"; elements.noticeBody.textContent = "HUBへ戻るか、時間をおいて再読み込みしてください。";
}
