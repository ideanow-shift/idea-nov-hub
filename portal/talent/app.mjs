import { NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";
import {
  buildDashboardSummaryViewModel,
  createDashboardSummaryExact1Executor
} from "./exact1.mjs";
import { initializeTalentOperatorPanel } from "./operator.mjs";

let summaryConsumed = false;
let summaryGeneration = 0;
let activeSummaryController = null;
let activeSummaryButton = null;

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
    panelFor: (key) => documentObject.getElementById(`recruitment-${key}`)
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
