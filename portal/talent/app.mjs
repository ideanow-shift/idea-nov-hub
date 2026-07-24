import { NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";
import {
  buildDashboardSummaryViewModel,
  createDashboardSummaryExact1Executor,
  createTalentWorkspaceExact1Executor
} from "./exact1.mjs";
import { initializeTalentOperatorPanel } from "./operator.mjs?v=20260725-student-workspace-1";

let summaryConsumed = false;
let summaryGeneration = 0;
let activeSummaryController = null;
let activeSummaryButton = null;
let studentWorkspaceData = null;
let studentWorkspaceGeneration = 0;
let activeStudentWorkspaceController = null;
let selectedStudentRecordId = null;

const PRIMARY_TABS = Object.freeze(["recruitment", "workforce"]);
const RECRUITMENT_TABS = Object.freeze(["summary", "students", "fairs", "schools"]);
const WORKFORCE_TABS = Object.freeze(["onboarding", "transfer", "leave", "retirement"]);

export async function startTalentDashboardSummary({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = globalObject.NOV_HUB_SESSION_CONTRACT || NOV_HUB_SESSION_CONTRACT,
  fiscalYear = "current",
  abortSignal = null,
  runGeneration = summaryGeneration,
  isCurrentGeneration = (generation) => generation === summaryGeneration
} = {}) {
  if (summaryConsumed) return renderSafeStop(documentObject, "duplicate_control_prevented");
  summaryConsumed = true;

  setStatus(documentObject, "loading", "集計を確認しています");
  const guardedFetch = typeof fetchImpl === "function"
    ? (url, options = {}) => fetchImpl(url, { ...options, signal: abortSignal || options.signal })
    : fetchImpl;
  const executor = createDashboardSummaryExact1Executor({
    globalObject,
    fetchImpl: guardedFetch,
    hubSessionHelper,
    hubContract,
    fiscalYear
  });
  if (!executor) return renderSafeStop(documentObject, "runtime_config_unavailable");

  const result = await executor.run();
  if (abortSignal?.aborted || !isCurrentGeneration(runGeneration)) {
    return staleRunResult(result);
  }
  if (result?.okBoolean !== true) return renderSafeStop(documentObject, result);
  const viewModel = result.viewModel || buildDashboardSummaryViewModel(result.data);
  renderMetrics(documentObject, viewModel);
  setStatus(documentObject, "ready", "集計を表示しました");
  return Object.freeze({
    executed: true,
    httpRequestSent: result.httpRequestSent === true,
    metricCount: viewModel.length,
    requestCount: result.requestCount,
    retryCount: result.retryCount,
    duplicatePrevented: false,
    rawResponseReturned: false,
    tokenValueReturned: false,
    authorizationHeaderReturned: false,
    rawClaimsReturned: false,
    employeeIdentityReturned: false,
    studentRowsReturned: false,
    forbiddenExposureDetected: false
  });
}

export function resetTalentDashboardSummaryStartupForFixture() {
  activeSummaryController?.abort?.();
  summaryConsumed = false;
  summaryGeneration = 0;
  activeSummaryController = null;
  if (activeSummaryButton?.dataset) delete activeSummaryButton.dataset.summaryControlBound;
  activeSummaryButton = null;
}

export function initializeTalentSummaryControl({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch,
  fiscalYear = "current"
} = {}) {
  const button = documentObject?.getElementById?.("summary-load-button");
  if (!button?.addEventListener) return Object.freeze({ initialized: false });
  if (button.dataset?.summaryControlBound === "true") {
    return Object.freeze({ initialized: true, duplicateBindingPrevented: true });
  }

  button.dataset.summaryControlBound = "true";
  activeSummaryButton = button;
  const formalHelperAvailable = typeof globalObject?.NovHubSession?.getSessionToken === "function";
  if (!formalHelperAvailable) {
    button.disabled = true;
    const safeStop = renderSafeStop(documentObject, {
      stopCategory: "auth_required",
      requestCount: 0,
      retryCount: 0,
      httpStatus: 0
    });
    return Object.freeze({
      ...safeStop,
      initialized: true,
      helperAvailable: false
    });
  }

  button.disabled = false;
  setStatus(documentObject, "idle", "ボタンを押すと最新の集計を表示します");

  const run = async (event) => {
    if (event?.repeat || button.disabled || summaryConsumed) {
      return renderSafeStop(documentObject, "duplicate_control_prevented");
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const runGeneration = ++summaryGeneration;
    const AbortControllerClass = globalObject.AbortController || globalThis.AbortController;
    const controller = new AbortControllerClass();
    activeSummaryController?.abort?.();
    activeSummaryController = controller;

    const result = await startTalentDashboardSummary({
      globalObject,
      documentObject,
      fetchImpl,
      fiscalYear,
      abortSignal: controller.signal,
      runGeneration,
      isCurrentGeneration: (generation) => generation === summaryGeneration
    });

    if (runGeneration === summaryGeneration && !controller.signal.aborted) {
      activeSummaryController = null;
      button.setAttribute("aria-busy", "false");
      button.textContent = result?.executed
        ? "集計を表示済み"
        : "集計を再取得するには再読み込みしてください";
      documentObject?.getElementById?.("summary-status")?.focus?.();
    }
    return result;
  };

  const invalidate = () => invalidateTalentDashboardSummaryRun({ documentObject });
  button.addEventListener("click", run);
  globalObject?.addEventListener?.("pagehide", invalidate, { once: true });
  globalObject?.addEventListener?.("beforeunload", invalidate, { once: true });
  globalObject?.addEventListener?.("novhub:logout", invalidate);
  return Object.freeze({ initialized: true, helperAvailable: true, run, invalidate });
}

export function invalidateTalentDashboardSummaryRun({
  documentObject = globalThis.document
} = {}) {
  summaryGeneration += 1;
  activeSummaryController?.abort?.();
  activeSummaryController = null;
  if (activeSummaryButton) {
    activeSummaryButton.disabled = true;
    activeSummaryButton.setAttribute?.("aria-busy", "false");
  }
  setStatus(documentObject, "stopped", "集計表示を中止しました");
  return Object.freeze({ invalidated: true, requestRetried: false });
}

export function initializeTalentNavigation({
  globalObject = globalThis,
  documentObject = globalObject.document
} = {}) {
  if (!documentObject?.querySelectorAll) return Object.freeze({ initialized: false });

  const primaryButtons = [...documentObject.querySelectorAll("[data-primary-tab]")];
  const secondaryButtons = [...documentObject.querySelectorAll("[data-secondary-tab]")];
  const workforceButtons = [...documentObject.querySelectorAll("[data-workforce-tab]")];
  bindTabGroup({
    buttons: primaryButtons,
    validKeys: PRIMARY_TABS,
    panelFor: (key) => documentObject.getElementById(`panel-${key}`),
    onSelect: (key) => {
      updateLocationHash(globalObject, key);
      if (key === "workforce" && activeSummaryController) {
        invalidateTalentDashboardSummaryRun({ documentObject });
      }
    }
  });
  bindTabGroup({
    buttons: secondaryButtons,
    validKeys: RECRUITMENT_TABS,
    panelFor: (key) => documentObject.getElementById(`recruitment-${key}`),
    onSelect: (key) => {
      if (key === "students" && !studentWorkspaceData) {
        loadTalentStudentWorkspace({ globalObject, documentObject });
      }
    }
  });
  bindTabGroup({
    buttons: workforceButtons,
    validKeys: WORKFORCE_TABS,
    panelFor: (key) => documentObject.getElementById(`workforce-${key}`)
  });

  const initialPrimary = normalizeHash(globalObject?.location?.hash);
  if (initialPrimary) selectTab(primaryButtons, initialPrimary, (key) => documentObject.getElementById(`panel-${key}`), false);
  return Object.freeze({
    initialized: primaryButtons.length === 2,
    primaryTabCount: primaryButtons.length,
    workforceTabCount: workforceButtons.length
  });
}

export function initializeTalentStudentWorkspace({
  globalObject = globalThis,
  documentObject = globalObject.document
} = {}) {
  const list = documentObject?.getElementById?.("student-list");
  if (!list || list.dataset?.workspaceBound === "true") {
    return Object.freeze({ initialized: Boolean(list), duplicateBindingPrevented: Boolean(list) });
  }
  list.dataset.workspaceBound = "true";
  const refresh = () => renderStudentWorkspace(documentObject);
  documentObject.getElementById("student-search")?.addEventListener("input", refresh);
  documentObject.getElementById("student-source-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-state-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-reload")?.addEventListener("click", () => {
    loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
  });
  documentObject.getElementById("summary-load-button")?.addEventListener("click", () => {
    loadTalentStudentWorkspace({ globalObject, documentObject });
  });
  globalObject?.addEventListener?.("pagehide", () => activeStudentWorkspaceController?.abort?.(), { once: true });
  globalObject?.addEventListener?.("novhub:logout", () => {
    activeStudentWorkspaceController?.abort?.();
    studentWorkspaceData = null;
    selectedStudentRecordId = null;
  });
  return Object.freeze({ initialized: true });
}

export async function loadTalentStudentWorkspace({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch,
  force = false
} = {}) {
  if (studentWorkspaceData && !force) {
    renderStudentWorkspace(documentObject);
    return Object.freeze({ executed: false, cached: true, studentRowsReturned: true });
  }
  const status = documentObject?.getElementById?.("student-status");
  const reload = documentObject?.getElementById?.("student-reload");
  if (status) {
    status.dataset.state = "loading";
    status.textContent = "27卒データを読み込んでいます";
  }
  if (reload) {
    reload.disabled = true;
    reload.setAttribute("aria-busy", "true");
  }

  const generation = ++studentWorkspaceGeneration;
  const AbortControllerClass = globalObject.AbortController || globalThis.AbortController;
  const controller = new AbortControllerClass();
  activeStudentWorkspaceController?.abort?.();
  activeStudentWorkspaceController = controller;
  const guardedFetch = typeof fetchImpl === "function"
    ? (url, options = {}) => fetchImpl(url, { ...options, signal: controller.signal })
    : fetchImpl;
  const executor = createTalentWorkspaceExact1Executor({
    globalObject,
    hubSessionHelper: globalObject.NovHubSession,
    hubContract: globalObject.NOV_HUB_SESSION_CONTRACT || NOV_HUB_SESSION_CONTRACT,
    fetchImpl: guardedFetch,
    fiscalYear: "2027"
  });
  const result = executor ? await executor.run() : null;
  if (generation !== studentWorkspaceGeneration || controller.signal.aborted) {
    return Object.freeze({ executed: false, staleCompletionSuppressed: true });
  }
  activeStudentWorkspaceController = null;
  if (reload) {
    reload.disabled = false;
    reload.setAttribute("aria-busy", "false");
  }
  if (result?.okBoolean !== true) {
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = result?.stopCategory === "auth_required"
        ? "HUBへ再ログインしてください"
        : "学生データを取得できません";
    }
    return Object.freeze({
      executed: false,
      studentRowsReturned: false,
      stopCategory: result?.stopCategory || "runtime_config_unavailable"
    });
  }

  studentWorkspaceData = result.data;
  const first = result.data.students[0];
  if (!result.data.students.some((student) => student.recordId === selectedStudentRecordId)) {
    selectedStudentRecordId = first?.recordId || null;
  }
  renderStudentWorkspace(documentObject);
  renderImportOverview(documentObject, result.data.overview);
  if (status) {
    status.dataset.state = "ready";
    status.textContent = `${result.data.students.length}件を表示`;
  }
  return Object.freeze({
    executed: true,
    studentRowsReturned: true,
    studentCount: result.data.students.length,
    requestCount: result.requestCount,
    retryCount: result.retryCount
  });
}

export function resetTalentStudentWorkspaceForFixture() {
  activeStudentWorkspaceController?.abort?.();
  studentWorkspaceData = null;
  studentWorkspaceGeneration = 0;
  activeStudentWorkspaceController = null;
  selectedStudentRecordId = null;
}

function renderImportOverview(documentObject, overview) {
  const values = {
    "import-total": overview.total,
    "import-review": overview.ownerReview,
    "import-quarantine": overview.quarantined,
    "import-mapped": overview.mapped,
    "student-total": overview.total,
    "student-contacts": overview.contacts,
    "student-entries": overview.entries,
    "student-offers": overview.offers,
    "student-needs-review": overview.ownerReview + overview.quarantined
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = documentObject?.getElementById?.(id);
    if (element) element.textContent = String(value);
  });
  const status = documentObject?.getElementById?.("import-overview-status");
  if (status) status.textContent = "本番stagingに取り込まれた27卒データ";
}

function renderStudentWorkspace(documentObject) {
  if (!studentWorkspaceData) return;
  const query = normalizeSearch(documentObject.getElementById("student-search")?.value);
  const source = documentObject.getElementById("student-source-filter")?.value || "ALL";
  const state = documentObject.getElementById("student-state-filter")?.value || "ALL";
  const visible = studentWorkspaceData.students.filter((student) => {
    if (source !== "ALL" && student.sourceCode !== source) return false;
    if (state !== "ALL" && student.classification !== state) return false;
    if (!query) return true;
    return [
      student.displayName, student.kana, student.school, student.status,
      student.preferredStore, student.sourceLabel
    ].some((value) => normalizeSearch(value).includes(query));
  });
  const list = documentObject.getElementById("student-list");
  const empty = documentObject.getElementById("student-empty");
  const count = documentObject.getElementById("student-result-count");
  if (count) count.textContent = `${visible.length}件`;
  if (empty) empty.hidden = visible.length !== 0;
  if (list) {
    list.replaceChildren(...visible.map((student) => createStudentListItem(documentObject, student)));
  }
  if (!visible.some((student) => student.recordId === selectedStudentRecordId)) {
    selectedStudentRecordId = visible[0]?.recordId || null;
  }
  renderStudentDetail(
    documentObject,
    studentWorkspaceData.students.find((student) => student.recordId === selectedStudentRecordId) || null
  );
}

function createStudentListItem(documentObject, student) {
  const button = documentObject.createElement("button");
  button.type = "button";
  button.className = "student-list-item";
  button.dataset.state = student.classification;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(student.recordId === selectedStudentRecordId));

  const top = documentObject.createElement("span");
  top.className = "student-list-top";
  const name = documentObject.createElement("strong");
  name.textContent = student.displayName;
  const badge = documentObject.createElement("span");
  badge.className = "state-badge";
  badge.textContent = student.classificationLabel;
  top.append(name, badge);

  const meta = documentObject.createElement("span");
  meta.className = "student-list-meta";
  meta.textContent = [student.school, student.sourceLabel, student.businessDate].filter(Boolean).join(" · ");
  const status = documentObject.createElement("span");
  status.className = "student-list-status";
  status.textContent = student.status;
  button.append(top, meta, status);
  button.addEventListener("click", () => {
    selectedStudentRecordId = student.recordId;
    renderStudentWorkspace(documentObject);
  });
  return button;
}

function renderStudentDetail(documentObject, student) {
  const placeholder = documentObject.getElementById("student-detail-placeholder");
  const detail = documentObject.getElementById("student-detail");
  if (!student) {
    if (placeholder) placeholder.hidden = false;
    if (detail) detail.hidden = true;
    return;
  }
  if (placeholder) placeholder.hidden = true;
  if (detail) detail.hidden = false;
  setText(documentObject, "student-detail-source", student.sourceLabel);
  setText(documentObject, "student-detail-title", student.displayName);
  setText(documentObject, "student-detail-kana", student.kana || "");
  setText(documentObject, "student-detail-state", student.classificationLabel);
  const state = documentObject.getElementById("student-detail-state");
  if (state) state.dataset.state = student.classification;
  setText(documentObject, "student-detail-school", student.school || "未登録");
  setText(documentObject, "student-detail-status", student.status || "未登録");
  setText(documentObject, "student-detail-phone", student.phone || "未登録");
  setText(documentObject, "student-detail-email", student.email || "未登録");
  setText(documentObject, "student-detail-store", student.preferredStore || "未登録");
  setText(
    documentObject,
    "student-detail-date",
    student.businessDate || student.lineRegistrationDate || "未登録"
  );
  const reasons = documentObject.getElementById("student-detail-reasons");
  if (reasons) {
    const labels = student.reasonLabels.length ? student.reasonLabels : ["確認事項はありません"];
    reasons.replaceChildren(...labels.map((label) => {
      const item = documentObject.createElement("li");
      item.textContent = label;
      return item;
    }));
  }
}

function setText(documentObject, id, text) {
  const element = documentObject?.getElementById?.(id);
  if (element) element.textContent = text;
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
}

function renderMetrics(documentObject, viewModel) {
  const container = documentObject?.getElementById?.("summary-metrics");
  if (!container) return;
  container.replaceChildren(...viewModel.map((metric) => createMetricCard(documentObject, metric)));
}

function createMetricCard(documentObject, metric) {
  const card = documentObject.createElement("article");
  card.className = "metric";
  card.dataset.metric = metric.key;

  const name = documentObject.createElement("p");
  name.className = "metric-name";
  name.textContent = metric.label;

  const value = documentObject.createElement("p");
  value.className = "metric-value";
  value.textContent = String(metric.value);

  card.append(name, value);
  return card;
}

function renderSafeStop(documentObject, safeInput) {
  const source = safeInput && typeof safeInput === "object"
    ? safeInput
    : { stopCategory: safeInput };
  const normalized = sanitizeCategory(source.stopCategory);
  const requestCount = normalizeSafeCount(source.requestCount, 1);
  const retryCount = normalizeSafeCount(source.retryCount, 0);
  const httpStatusCategory = normalizeHttpStatusCategory(source.httpStatus);
  setStatus(documentObject, "stopped", safeMessage(normalized, requestCount));
  setSafeDiagnosticState(documentObject, {
    stopCategory: normalized,
    requestCount,
    retryCount,
    httpStatusCategory
  });
  return Object.freeze({
    executed: false,
    httpRequestSent: requestCount === 1,
    stopCategory: normalized,
    requestCount,
    retryCount,
    httpStatusCategory,
    duplicatePrevented: normalized === "duplicate_control_prevented",
    rawResponseReturned: false,
    tokenValueReturned: false,
    authorizationHeaderReturned: false,
    rawClaimsReturned: false,
    employeeIdentityReturned: false,
    studentRowsReturned: false,
    forbiddenExposureDetected: false
  });
}

function setSafeDiagnosticState(documentObject, fields) {
  const status = documentObject?.getElementById?.("summary-status");
  if (!status?.dataset) return;
  status.dataset.safeCategory = fields.stopCategory;
  status.dataset.requestCount = String(fields.requestCount);
  status.dataset.retryCount = String(fields.retryCount);
  status.dataset.httpStatusCategory = fields.httpStatusCategory;
}

function normalizeSafeCount(value, maximum) {
  const numeric = Number(value || 0);
  if (!Number.isInteger(numeric) || numeric < 0) return 0;
  return Math.min(numeric, maximum);
}

function normalizeHttpStatusCategory(value) {
  const status = Number(value || 0);
  if (!Number.isInteger(status) || status < 100 || status > 599) return "none";
  if (status < 300) return "success";
  if (status < 400) return "redirect";
  if (status < 500) return "client_error";
  return "server_error";
}

function setStatus(documentObject, state, text) {
  const status = documentObject?.getElementById?.("summary-status");
  if (!status) return;
  status.dataset.state = state;
  status.textContent = text;
  const connection = documentObject?.querySelector?.(".connection-card");
  const connectionLabel = documentObject?.getElementById?.("connection-label");
  if (connection) connection.dataset.state = state;
  if (connectionLabel) {
    connectionLabel.textContent = state === "ready" ? "HUB接続済み" : state === "stopped" ? "HUB接続を確認できません" : "HUB接続待機中";
  }
}

function bindTabGroup({ buttons, validKeys, panelFor, onSelect }) {
  if (!buttons.length) return;
  const activate = (button, focus = true) => {
    const key = button?.dataset?.primaryTab || button?.dataset?.secondaryTab || button?.dataset?.workforceTab;
    if (!validKeys.includes(key)) return;
    selectTab(buttons, key, panelFor, focus);
    onSelect?.(key);
  };
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => activate(button, false));
    button.addEventListener("keydown", (event) => {
      const last = buttons.length - 1;
      let nextIndex = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = index === last ? 0 : index + 1;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = index === 0 ? last : index - 1;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = last;
      if (nextIndex === null) return;
      event.preventDefault();
      activate(buttons[nextIndex]);
    });
  });
}

function selectTab(buttons, selectedKey, panelFor, focus) {
  buttons.forEach((button) => {
    const key = button?.dataset?.primaryTab || button?.dataset?.secondaryTab || button?.dataset?.workforceTab;
    const selected = key === selectedKey;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    const panel = panelFor(key);
    if (panel) panel.hidden = !selected;
    if (selected && focus) button.focus();
  });
}

function normalizeHash(hash) {
  const key = String(hash || "").replace(/^#/, "");
  return PRIMARY_TABS.includes(key) ? key : null;
}

function updateLocationHash(globalObject, key) {
  if (!globalObject?.history?.replaceState || !globalObject?.location) return;
  const url = `${globalObject.location.pathname || ""}${globalObject.location.search || ""}#${key}`;
  globalObject.history.replaceState(null, "", url);
}

function sanitizeCategory(value) {
  const candidate = String(value || "safe_stop").trim();
  return /^[a-zA-Z0-9_]{1,80}$/.test(candidate) ? candidate : "safe_stop";
}

function safeMessage(category, requestCount = 0) {
  const messages = {
    runtime_config_unavailable: "設定確認中です",
    auth_required: "認証確認が必要です（送信前に停止）",
    invalid_response: "集計形式を確認できません（1回送信・再試行なし）",
    api_error: requestCount === 1
      ? "API接続で停止しました（1回送信・再試行なし）"
      : "API接続前に停止しました",
    duplicate_control_prevented: "集計取得はすでに開始済みです",
    run_invalidated: "集計表示を中止しました",
    safe_stop: "安全のため停止しました"
  };
  return messages[category] || messages.safe_stop;
}

function initializeTalentApp() {
  initializeTalentStudentWorkspace();
  initializeTalentNavigation();
  initializeTalentSummaryControl();
  initializeTalentOperatorPanel();
}

function staleRunResult(result) {
  return Object.freeze({
    executed: false,
    httpRequestSent: result?.httpRequestSent === true,
    stopCategory: "run_invalidated",
    requestCount: Number(result?.requestCount || 0),
    retryCount: 0,
    staleCompletionSuppressed: true,
    rawResponseReturned: false,
    tokenValueReturned: false,
    authorizationHeaderReturned: false,
    rawClaimsReturned: false,
    employeeIdentityReturned: false,
    studentRowsReturned: false,
    forbiddenExposureDetected: false
  });
}

if (globalThis.document?.readyState === "loading") {
  globalThis.document.addEventListener("DOMContentLoaded", () => {
    initializeTalentApp();
  }, { once: true });
} else if (globalThis.document) {
  initializeTalentApp();
}
