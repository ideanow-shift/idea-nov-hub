import { NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";
import {
  buildDashboardSummaryViewModel,
  createDashboardSummaryExact1Executor,
  createTalentWorkspaceExact1Executor,
  createTalentWorkforceSummaryExact1Executor,
  createTalentStudentProfileAuditExact1Executor,
  createTalentStagingSupplementAuditExact1Executor
} from "./exact1.mjs?v=20260725-workforce-queues-1";
import { initializeTalentOperatorPanel } from "./operator.mjs?v=20260725-owner-review-workspace-1";
import { createTalentHistoricalReviewController } from "./review.mjs?v=20260725-owner-review-workspace-1";
import { buildTalentAnalytics } from "./analytics.mjs?v=20260725-talent-analytics-1";
import { createTalentStudentProfileController } from "./student-profile.mjs?v=20260725-review-kpis-1";
import { createTalentStagingSupplementController } from "./staging-supplement.mjs?v=20260725-staging-edit-1";
import { buildWorkforceReadinessViewModel, renderWorkforceReadiness } from "./workforce-readiness.mjs?v=20260726-workforce-queue-case-prefill-1";
import { initializeWorkforceProcedureDesk } from "./workforce-procedures.mjs?v=20260726-workforce-operation-summary-2";

let summaryConsumed = false;
let summaryGeneration = 0;
let activeSummaryController = null;
let activeSummaryButton = null;
let studentWorkspaceData = null;
let studentWorkspaceGeneration = 0;
let activeStudentWorkspaceController = null;
let selectedStudentRecordId = null;
let historicalReviewController = null;
let activeHistoricalReviewProposal = null;
let activeHistoricalReviewStudent = null;
let profileDialogStudent = null;
let auditDialogStudent = null;
let pendingSelectedApplicationNo = null;
let workforceSummaryConsumed = false;
let workforceProcedureDesk = null;

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
      if (key === "workforce") {
        loadTalentWorkforceSummary({ globalObject, documentObject });
        workforceProcedureDesk?.load?.();
      }
    }
  });
  bindTabGroup({
    buttons: secondaryButtons,
    validKeys: RECRUITMENT_TABS,
    panelFor: (key) => documentObject.getElementById(`recruitment-${key}`),
    onSelect: (key) => {
      if (["summary", "students", "fairs", "schools"].includes(key) && !studentWorkspaceData) {
        loadTalentStudentWorkspace({ globalObject, documentObject });
      }
    }
  });
  bindTabGroup({
    buttons: workforceButtons,
    validKeys: WORKFORCE_TABS,
    panelFor: (key) => documentObject.getElementById(`workforce-${key}`),
    onSelect: (key) => workforceProcedureDesk?.setProcedureType?.({
      onboarding: "ONBOARDING",
      transfer: "TRANSFER",
      leave: "LEAVE",
      retirement: "RETIREMENT"
    }[key])
  });
  for (const button of documentObject.querySelectorAll("[data-workforce-open]")) {
    button.addEventListener("click", () => {
      const key = String(button.dataset.workforceOpen || "");
      if (!WORKFORCE_TABS.includes(key)) return;
      primaryButtons.find((item) => item.dataset.primaryTab === "workforce")?.click?.();
      workforceButtons.find((item) => item.dataset.workforceTab === key)?.click?.();
      documentObject.getElementById("workforce-procedure-desk")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }

  const initialPrimary = normalizeHash(globalObject?.location?.hash);
  if (initialPrimary) selectTab(primaryButtons, initialPrimary, (key) => documentObject.getElementById(`panel-${key}`), false);
  if (initialPrimary === "workforce") {
    loadTalentWorkforceSummary({ globalObject, documentObject });
    workforceProcedureDesk?.load?.();
  }
  return Object.freeze({
    initialized: primaryButtons.length === 2,
    primaryTabCount: primaryButtons.length,
    workforceTabCount: workforceButtons.length
  });
}

export async function loadTalentWorkforceSummary({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch
} = {}) {
  if (workforceSummaryConsumed) {
    return Object.freeze({ executed: false, duplicatePrevented: true });
  }
  workforceSummaryConsumed = true;
  const executor = createTalentWorkforceSummaryExact1Executor({
    globalObject,
    hubSessionHelper: globalObject.NovHubSession,
    hubContract: globalObject.NOV_HUB_SESSION_CONTRACT || NOV_HUB_SESSION_CONTRACT,
    fetchImpl
  });
  const result = executor ? await executor.run() : null;
  if (result?.okBoolean === true && result.data) {
    renderWorkforceReadiness(documentObject, buildWorkforceReadinessViewModel({
      source: "CORE_DB",
      mode: "READ_ONLY",
      status: "CONNECTED",
      summary: result.data
    }));
    return Object.freeze({ executed: true, connected: true, requestCount: result.requestCount, rawValuesReturned: false });
  }
  renderWorkforceReadiness(documentObject, buildWorkforceReadinessViewModel());
  documentObject?.getElementById?.("workforce-status")?.setAttribute?.("data-safe-category", String(result?.stopCategory || "api_error"));
  return Object.freeze({ executed: Boolean(result?.executed), connected: false, requestCount: Number(result?.requestCount || 0), rawValuesReturned: false });
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
  documentObject.getElementById("student-progress-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-month-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-follow-up-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-sort-filter")?.addEventListener("change", refresh);
  const resetStudentFilters = () => {
    const controls = ["student-search", "student-source-filter", "student-state-filter", "student-progress-filter", "student-month-filter", "student-follow-up-filter", "student-sort-filter"];
    controls.forEach((id) => {
      const control = documentObject.getElementById(id);
      if (control) control.value = id === "student-search" ? "" : id === "student-sort-filter" ? "DEFAULT" : "ALL";
    });
    refresh();
  };
  documentObject.getElementById("student-filter-reset")?.addEventListener("click", resetStudentFilters);
  documentObject.getElementById("student-empty-reset")?.addEventListener("click", resetStudentFilters);
  [
    ["student-filter-all", "ALL"],
    ["student-filter-review", "OWNER_REVIEW"],
    ["student-filter-quarantine", "QUARANTINE"],
    ["student-filter-confirmed", "IMPORTABLE"],
    ["student-filter-new", "NEW_CANDIDATE"]
  ].forEach(([id, state]) => {
    documentObject.getElementById(id)?.addEventListener("click", () => {
      const filter = documentObject.getElementById("student-state-filter");
      if (!filter) return;
      filter.value = state;
      refresh();
    });
  });
  documentObject.getElementById("triage-new-open")?.addEventListener("click", () => {
    const filter = documentObject.getElementById("student-state-filter");
    if (!filter) return;
    filter.value = "NEW_CANDIDATE";
    refresh();
    documentObject.getElementById("student-list")?.scrollIntoView?.({ block: "nearest" });
  });
  documentObject.getElementById("review-workload-open")?.addEventListener("click", () => {
    const panel = documentObject.getElementById("student-review-workload");
    const filter = documentObject.getElementById("student-state-filter");
    if (!panel || !filter) return;
    filter.value = panel.dataset.nextFilterState || "ALL";
    refresh();
    documentObject.getElementById("student-list")?.scrollIntoView?.({ block: "nearest" });
  });
  for (const button of documentObject.querySelectorAll("[data-summary-followup]")) {
    button.addEventListener("click", () => {
      openStudentWorkspace(documentObject, buildSummaryFollowUpFilter(button.dataset.summaryFollowup));
    });
  }
  documentObject.getElementById("school-search")?.addEventListener("input", () => {
    renderTalentAnalytics(documentObject);
  });
  documentObject.getElementById("school-sort")?.addEventListener("change", () => {
    renderTalentAnalytics(documentObject);
  });
  documentObject.getElementById("fair-latest-month-open")?.addEventListener("click", () => {
    const key = documentObject.getElementById("fair-latest-month-open")?.dataset.monthKey;
    openStudentWorkspace(documentObject, buildMonthlyFollowUpFilter(key));
  });
  documentObject.getElementById("school-top-open")?.addEventListener("click", () => {
    const school = documentObject.getElementById("school-top-open")?.dataset.schoolName;
    openSchoolStudentWorkspace(documentObject, school);
  });
  documentObject.getElementById("student-reload")?.addEventListener("click", () => {
    loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
  });
  documentObject.getElementById("student-review-open")?.addEventListener("click", () => {
    openHistoricalReviewDialog({ globalObject, documentObject });
  });
  documentObject.getElementById("student-confirm-open")?.addEventListener("click", () => {
    const student = studentWorkspaceData?.students.find((row) => row.recordId === selectedStudentRecordId);
    openSingleStudentReviewDialog({ globalObject, documentObject, student });
  });
  documentObject.getElementById("student-onboarding-open")?.addEventListener("click", () => {
    const student = studentWorkspaceData?.students.find((row) => row.recordId === selectedStudentRecordId);
    const draft = buildOnboardingHandoffDraft(student);
    if (!draft) return;
    documentObject.querySelector?.('[data-primary-tab="workforce"]')?.click?.();
    documentObject.querySelector?.('[data-workforce-tab="onboarding"]')?.click?.();
    if (typeof globalObject.CustomEvent !== "function") return;
    documentObject.dispatchEvent(new globalObject.CustomEvent("nov-talent:open-procedure-case", { detail: draft }));
  });
  documentObject.getElementById("student-review-cancel")?.addEventListener("click", () => {
    documentObject.getElementById("student-review-dialog")?.close?.();
    activeHistoricalReviewProposal = null;
    activeHistoricalReviewStudent = null;
    setManualReviewTargetOptions(documentObject, []);
  });
  documentObject.getElementById("student-review-confirm")?.addEventListener("click", () => {
    applyHistoricalReview({ globalObject, documentObject });
  });
  documentObject.getElementById("student-review-target")?.addEventListener("change", (event) => {
    const proposal = buildSingleStudentReviewProposal(
      activeHistoricalReviewStudent,
      studentWorkspaceData,
      event.target?.value || ""
    );
    if (!proposal) return;
    activeHistoricalReviewProposal = proposal;
    setText(documentObject, "review-confirm-primary", proposal.primaryRecordIds.length);
    setText(documentObject, "review-confirm-links", proposal.linkPairs.length);
    const confirmButton = documentObject.getElementById("student-review-confirm");
    if (confirmButton) {
      confirmButton.disabled = !historicalReviewController?.enabled;
      confirmButton.setAttribute("aria-disabled", String(!historicalReviewController?.enabled));
    }
  });
  documentObject.getElementById("student-add-open")?.addEventListener("click", () => {
    openStudentProfileDialog({ documentObject, student: null });
  });
  documentObject.getElementById("student-edit-open")?.addEventListener("click", () => {
    const student = studentWorkspaceData?.students.find((row) => row.recordId === selectedStudentRecordId);
    if (student?.applicationNo || (student?.mappingStatus === "UNMAPPED" && student?.recordId)) {
      openStudentProfileDialog({ documentObject, student });
    }
  });
  documentObject.getElementById("student-next-action-open")?.addEventListener("click", () => {
    const student = studentWorkspaceData?.students.find((row) => row.recordId === selectedStudentRecordId);
    if (student?.applicationNo || (student?.mappingStatus === "UNMAPPED" && student?.recordId)) {
      openStudentProfileDialog({ documentObject, student, focusField: "profile-next-action" });
    }
  });
  documentObject.getElementById("student-audit-open")?.addEventListener("click", () => {
    const student = studentWorkspaceData?.students.find((row) => row.recordId === selectedStudentRecordId);
    openStudentAuditDialog({ globalObject, documentObject, student });
  });
  documentObject.getElementById("student-audit-close")?.addEventListener("click", () => {
    documentObject.getElementById("student-audit-dialog")?.close?.();
    auditDialogStudent = null;
  });
  documentObject.getElementById("student-profile-cancel")?.addEventListener("click", () => {
    documentObject.getElementById("student-profile-dialog")?.close?.();
  });
  documentObject.getElementById("student-profile-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveStudentProfile({ globalObject, documentObject });
  });
  documentObject.getElementById("summary-load-button")?.addEventListener("click", () => {
    loadTalentStudentWorkspace({ globalObject, documentObject });
  });
  globalObject?.addEventListener?.("pagehide", () => activeStudentWorkspaceController?.abort?.(), { once: true });
  globalObject?.addEventListener?.("novhub:logout", () => {
    activeStudentWorkspaceController?.abort?.();
    studentWorkspaceData = null;
    selectedStudentRecordId = null;
    historicalReviewController = null;
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
    const message = result?.stopCategory === "auth_required"
      ? "HUBへ再ログインしてください"
      : "27卒データを取得できません";
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = message;
    }
    setText(documentObject, "historical-summary-status", message);
    setText(documentObject, "fair-analysis-status", message);
    setText(documentObject, "school-analysis-status", message);
    return Object.freeze({
      executed: false,
      studentRowsReturned: false,
      stopCategory: result?.stopCategory || "runtime_config_unavailable"
    });
  }

  studentWorkspaceData = result.data;
  if (pendingSelectedApplicationNo) {
    selectedStudentRecordId = result.data.students.find(
      (student) => student.applicationNo === pendingSelectedApplicationNo
    )?.recordId || selectedStudentRecordId;
    pendingSelectedApplicationNo = null;
  }
  const first = result.data.students[0];
  if (!result.data.students.some((student) => student.recordId === selectedStudentRecordId)) {
    selectedStudentRecordId = first?.recordId || null;
  }
  renderStudentMonthFilterOptions(documentObject, result.data.students);
  renderStudentWorkspace(documentObject);
  renderImportOverview(documentObject, result.data.overview);
  renderHistoricalReviewSummary(documentObject, result.data.overview);
  renderBulkTriageSummary(documentObject, result.data.students);
  renderTalentAnalytics(documentObject);
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
  historicalReviewController = null;
  activeHistoricalReviewStudent = null;
  profileDialogStudent = null;
  pendingSelectedApplicationNo = null;
}

function buildHistoricalReviewProposal(data) {
  if (!data?.students) return Object.freeze({ primaryRecordIds: [], linkPairs: [] });
  return Object.freeze({
    primaryRecordIds: Object.freeze(data.students
      .filter((student) => student.primaryEligible)
      .map((student) => student.recordId)),
    linkPairs: Object.freeze(data.students
      .filter((student) => (
        student.mappingStatus === "UNMAPPED"
        && student.suggestionCategory === "EXACT1"
        && student.suggestedTargetRecordId
      ))
      .map((student) => Object.freeze({
        sourceRecordId: student.recordId,
        targetRecordId: student.suggestedTargetRecordId
      })))
  });
}

export function buildMatchOnlyReviewProposal(data) {
  if (!data?.students) return Object.freeze({ primaryRecordIds: [], linkPairs: Object.freeze([]) });
  return Object.freeze({
    primaryRecordIds: Object.freeze([]),
    linkPairs: Object.freeze(data.students
      .filter((student) => (
        student.mappingStatus === "UNMAPPED"
        && student.suggestionCategory === "EXACT1"
        && student.suggestedTargetRecordId
      ))
      .map((student) => Object.freeze({
        sourceRecordId: student.recordId,
        targetRecordId: student.suggestedTargetRecordId
      })))
  });
}

function renderHistoricalReviewSummary(documentObject, overview) {
  setText(documentObject, "review-primary-count", overview.primaryCandidates);
  setText(documentObject, "review-link-count", overview.exactLinkSuggestions);
  setText(documentObject, "review-manual-count", overview.remainingManual);
  const button = documentObject.getElementById("student-review-open");
  if (button) {
    const pending = overview.exactLinkSuggestions;
    button.disabled = pending === 0;
    button.textContent = pending === 0 ? "一致反映済み" : "名簿一致だけを一括反映";
  }
}

export function buildBulkTriageCounts(students) {
  const rows = Array.isArray(students) ? students : [];
  const unmapped = rows.filter((student) => student.mappingStatus === "UNMAPPED");
  const exact1 = unmapped.filter((student) => student.suggestionCategory === "EXACT1").length;
  const ambiguous = unmapped.filter((student) => student.suggestionCategory === "AMBIGUOUS").length;
  const newApplicant = unmapped.filter(isNewApplicantCandidate).length;
  return Object.freeze({
    exact1,
    newApplicant,
    ambiguous,
    hold: Math.max(0, unmapped.length - exact1 - ambiguous - newApplicant)
  });
}

export function buildReviewWorkloadGuide(students) {
  const counts = buildBulkTriageCounts(students);
  const bulk = counts.exact1;
  const individual = counts.newApplicant;
  const quarantine = counts.ambiguous + counts.hold;
  const nextAction = bulk > 0
    ? "BULK_MATCH_ONLY"
    : individual > 0 ? "INDIVIDUAL_REVIEW"
      : quarantine > 0 ? "KEEP_QUARANTINED"
        : "NO_PENDING_REVIEW";
  return Object.freeze({
    nextAction,
    nextTitle: {
      BULK_MATCH_ONLY: "まず一致候補だけを安全に片付けます",
      INDIVIDUAL_REVIEW: "新規候補を1件ずつ確認します",
      KEEP_QUARANTINED: "曖昧・保留は隔離維持で整理します",
      NO_PENDING_REVIEW: "要確認・隔離の整理は落ち着いています"
    }[nextAction],
    nextCopy: {
      BULK_MATCH_ONLY: "一括反映は一致候補だけに限定します。新規候補や曖昧行は一覧で確認してから扱います。",
      INDIVIDUAL_REVIEW: "接触データがない候補は、学生詳細から新規扱いか隔離維持かを判断します。",
      KEEP_QUARANTINED: "自動判断できない行は昇格せず、補足・次回対応日を整えて追跡します。",
      NO_PENDING_REVIEW: "未処理の候補はありません。必要に応じて確認済み・新規候補を一覧で見直せます。"
    }[nextAction],
    nextFilterState: {
      BULK_MATCH_ONLY: "OWNER_REVIEW",
      INDIVIDUAL_REVIEW: "NEW_CANDIDATE",
      KEEP_QUARANTINED: "QUARANTINE",
      NO_PENDING_REVIEW: "ALL"
    }[nextAction],
    bulk,
    individual,
    quarantine,
    bulkCopy: bulk > 0
      ? "一致候補だけを一括反映できます。新規・曖昧行は混ぜません。"
      : "一括反映できる一致候補はありません。",
    individualCopy: individual > 0
      ? "新規候補は個別確認で正本化の判断をします。"
      : "個別確認で新規判断する候補はありません。",
    quarantineCopy: quarantine > 0
      ? "曖昧・保留は隔離維持し、補足と次回対応で追跡します。"
      : "隔離維持が必要な未解決候補はありません。"
  });
}

export function isNewApplicantCandidate(student) {
  return Boolean(student)
    && student.mappingStatus === "UNMAPPED"
    && ["ENTRIES_27", "OFFERS_27"].includes(student.sourceCode)
    && student.suggestionCategory === "NONE";
}

function renderBulkTriageSummary(documentObject, students) {
  const counts = buildBulkTriageCounts(students);
  setText(documentObject, "triage-exact1", counts.exact1);
  setText(documentObject, "triage-new", counts.newApplicant);
  setText(documentObject, "triage-ambiguous", counts.ambiguous);
  setText(documentObject, "triage-hold", counts.hold);
  renderReviewWorkloadGuide(documentObject, buildReviewWorkloadGuide(students));
}

function renderReviewWorkloadGuide(documentObject, guide) {
  setText(documentObject, "review-workload-bulk", guide.bulk);
  setText(documentObject, "review-workload-individual", guide.individual);
  setText(documentObject, "review-workload-quarantine", guide.quarantine);
  setText(documentObject, "review-workload-title", guide.nextTitle);
  setText(documentObject, "review-workload-copy", guide.nextCopy);
  setText(documentObject, "review-workload-bulk-copy", guide.bulkCopy);
  setText(documentObject, "review-workload-individual-copy", guide.individualCopy);
  setText(documentObject, "review-workload-quarantine-copy", guide.quarantineCopy);
  const panel = documentObject.getElementById("student-review-workload");
  if (panel) {
    panel.dataset.nextAction = guide.nextAction;
    panel.dataset.nextFilterState = guide.nextFilterState;
  }
}

function openHistoricalReviewDialog({ globalObject, documentObject }) {
  if (!studentWorkspaceData) return;
  const proposal = buildMatchOnlyReviewProposal(studentWorkspaceData);
  if (proposal.linkPairs.length === 0) return;
  activeHistoricalReviewProposal = proposal;
  activeHistoricalReviewStudent = null;
  setManualReviewTargetOptions(documentObject, []);
  setText(documentObject, "review-dialog-title", "既存名簿との一致だけを反映しますか");
  setText(documentObject, "review-confirm-primary", 0);
  setText(documentObject, "review-confirm-links", proposal.linkPairs.length);
  setText(documentObject, "review-confirm-remaining", studentWorkspaceData.overview.remainingManual);
  historicalReviewController = createTalentHistoricalReviewController({ globalObject });
  const confirmButton = documentObject.getElementById("student-review-confirm");
  if (confirmButton) {
    confirmButton.disabled = !historicalReviewController.enabled;
    confirmButton.setAttribute("aria-disabled", String(!historicalReviewController.enabled));
    confirmButton.setAttribute("aria-busy", "false");
  }
  documentObject.getElementById("student-review-dialog")?.showModal?.();
}

function openSingleStudentReviewDialog({ globalObject, documentObject, student }) {
  activeHistoricalReviewStudent = student;
  const proposal = buildSingleStudentReviewProposal(student, studentWorkspaceData);
  const manualCandidates = proposal ? [] : listManualContactCandidates(studentWorkspaceData, student);
  if (!proposal && manualCandidates.length === 0) return;
  activeHistoricalReviewProposal = proposal;
  setText(documentObject, "review-dialog-title", "この候補を確認しますか");
  setText(documentObject, "review-confirm-primary", proposal?.primaryRecordIds.length || 0);
  setText(documentObject, "review-confirm-links", proposal?.linkPairs.length || 0);
  setText(documentObject, "review-confirm-remaining", 0);
  setManualReviewTargetOptions(documentObject, manualCandidates);
  setText(documentObject, "student-review-status", proposal
    ? "対象者を確認してから実行してください"
    : "紐付け先の接触データを1件選択してください");
  historicalReviewController = createTalentHistoricalReviewController({ globalObject });
  const confirmButton = documentObject.getElementById("student-review-confirm");
  if (confirmButton) {
    confirmButton.disabled = !proposal || !historicalReviewController.enabled;
    confirmButton.setAttribute("aria-disabled", String(!proposal || !historicalReviewController.enabled));
    confirmButton.setAttribute("aria-busy", "false");
  }
  documentObject.getElementById("student-review-dialog")?.showModal?.();
}

function listManualContactCandidates(workspaceData, sourceStudent) {
  return (workspaceData?.students || [])
    .filter((row) => row.sourceCode === "CONTACTS_27"
      && row.recordId !== sourceStudent?.recordId
      && row.mappingStatus !== "OWNER_CONFIRMED")
    .sort((left, right) => String(left.displayName || "").localeCompare(String(right.displayName || ""), "ja"));
}

function setManualReviewTargetOptions(documentObject, candidates) {
  const field = documentObject.getElementById("student-review-target-field");
  const select = documentObject.getElementById("student-review-target");
  if (!field || !select) return;
  select.replaceChildren();
  if (!candidates.length) {
    field.hidden = true;
    return;
  }
  const placeholder = documentObject.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "接触データを選択してください";
  placeholder.selected = true;
  select.appendChild(placeholder);
  candidates.forEach((candidate) => {
    const option = documentObject.createElement("option");
    option.value = candidate.recordId;
    const label = [candidate.displayName, candidate.school, candidate.businessDate]
      .filter(Boolean).join("・");
    option.textContent = label || "接触データ（内容未登録）";
    option.label = option.textContent;
    select.appendChild(option);
  });
  select.value = "";
  select.selectedIndex = 0;
  field.hidden = false;
}

export function buildSingleStudentReviewProposal(student, workspaceData, selectedTargetRecordId = "") {
  if (!student || student.mappingStatus !== "UNMAPPED") return null;
  if (student.primaryEligible) {
    return Object.freeze({ primaryRecordIds: Object.freeze([student.recordId]), linkPairs: Object.freeze([]) });
  }
  const targetRecordId = student.suggestionCategory === "EXACT1" && student.suggestedTargetRecordId
    ? student.suggestedTargetRecordId
    : selectedTargetRecordId;
  if (!targetRecordId) return null;
  const target = workspaceData?.students?.find((row) => row.recordId === targetRecordId);
  if (!target || target.sourceCode !== "CONTACTS_27") return null;
  const primaryRecordIds = target?.sourceCode === "CONTACTS_27" && target.mappingStatus === "UNMAPPED"
    ? Object.freeze([target.recordId])
    : Object.freeze([]);
  return Object.freeze({
    primaryRecordIds,
    linkPairs: Object.freeze([Object.freeze({
      sourceRecordId: student.recordId,
      targetRecordId
    })])
  });
}

async function applyHistoricalReview({ globalObject, documentObject }) {
  const confirmButton = documentObject.getElementById("student-review-confirm");
  const status = documentObject.getElementById("student-review-status");
  const proposal = activeHistoricalReviewProposal || buildHistoricalReviewProposal(studentWorkspaceData);
  if (!historicalReviewController?.enabled || !confirmButton) {
    if (status) status.textContent = "確定機能を利用できません";
    return;
  }
  confirmButton.disabled = true;
  confirmButton.setAttribute("aria-busy", "true");
  if (status) status.textContent = "確認内容を反映しています";
  const result = await historicalReviewController.apply(proposal);
  confirmButton.setAttribute("aria-busy", "false");
  if (!result.ok) {
    if (status) status.textContent = result.category === "write_forbidden"
      ? "この操作を実行する権限がありません"
      : "反映できませんでした。画面を再読込して状態を確認してください";
    return;
  }
  if (status) {
    status.textContent =
      `応募化 ${result.data.createdPrimary}件、紐付け ${result.data.confirmedLinks}件を反映しました`;
  }
  documentObject.getElementById("student-review-dialog")?.close?.();
  studentWorkspaceData = null;
  historicalReviewController = null;
  activeHistoricalReviewProposal = null;
  activeHistoricalReviewStudent = null;
  setManualReviewTargetOptions(documentObject, []);
  await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
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
    "student-manual": overview.manual,
    "student-owner-review": overview.ownerReview,
    "student-quarantine": overview.quarantined,
    "student-importable": overview.mapped,
    "student-needs-review": overview.ownerReview + overview.quarantined
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = documentObject?.getElementById?.(id);
    if (element) element.textContent = String(value);
  });
  const status = documentObject?.getElementById?.("import-overview-status");
  if (status) status.textContent = "本番stagingに取り込まれた27卒データ";
}

function renderTalentAnalytics(documentObject) {
  if (!studentWorkspaceData) return;
  const analytics = buildTalentAnalytics(studentWorkspaceData);
  renderMetricCollection(documentObject, "historical-summary-metrics", analytics.summary);
  renderSummaryFollowUpCounts(documentObject, studentWorkspaceData.students);
  renderAnalyticsCoverage(documentObject, analytics);
  renderMonthlyFlow(documentObject, analytics.flow);
  renderSchoolAnalysis(documentObject, analytics.schools);
  setText(documentObject, "historical-summary-status", `${analytics.summary[0].value}件を集計`);
  setText(documentObject, "fair-analysis-status", `${analytics.flow.length}か月分を表示`);
  setText(documentObject, "school-analysis-status", `${analytics.schools.length}校を表示`);
}

function renderSummaryFollowUpCounts(documentObject, students) {
  setText(documentObject, "summary-followup-overdue-count", filterTalentStudents(students, { followUp: "OVERDUE" }).length);
  setText(documentObject, "summary-followup-next-week-count", filterTalentStudents(students, { followUp: "NEXT_7_DAYS" }).length);
}

function renderMetricCollection(documentObject, containerId, metrics) {
  const container = documentObject.getElementById(containerId);
  if (!container) return;
  container.replaceChildren(...metrics.map((metric) => createMetricCard(documentObject, metric)));
}

function renderAnalyticsCoverage(documentObject, analytics) {
  setText(documentObject, "fair-contact-count", analytics.summary.find((item) => item.key === "contacts")?.value ?? 0);
  setText(documentObject, "fair-line-rate", `${analytics.coverage.lineRegistrationRate}%`);
  setText(documentObject, "fair-month-count", analytics.coverage.monthCount);
  setText(documentObject, "school-count", analytics.schools.length);
  setText(documentObject, "school-registered-count", analytics.schools.length);
  setText(documentObject, "school-missing-count", analytics.coverage.schoolMissing);
  const topSchool = analytics.schools[0];
  setText(documentObject, "school-top-name", topSchool?.school || "未集計");
  const latestMonth = analytics.flow[0];
  const latestButton = documentObject.getElementById("fair-latest-month-open");
  if (latestButton) {
    latestButton.disabled = !latestMonth?.key;
    latestButton.dataset.monthKey = latestMonth?.key || "";
    latestButton.textContent = latestMonth?.label ? `${latestMonth.label}を見る` : "最新月を見る";
  }
  const schoolButton = documentObject.getElementById("school-top-open");
  if (schoolButton) {
    schoolButton.disabled = !topSchool?.school;
    schoolButton.dataset.schoolName = topSchool?.school || "";
  }
}

function renderMonthlyFlow(documentObject, rows) {
  const body = documentObject.getElementById("fair-flow-body");
  const empty = documentObject.getElementById("fair-flow-empty");
  if (!body) return;
  const visible = rows.slice(0, 18);
  body.replaceChildren(...visible.map((row) => createMonthlyFlowRow(documentObject, row)));
  if (empty) empty.hidden = visible.length > 0;
}

function createMonthlyFlowRow(documentObject, flow) {
  const row = createAnalysisRow(documentObject, [
    flow.label,
    flow.contacts,
    flow.lineRegistrations,
    flow.entries,
    flow.offers,
    flow.needsAction
  ]);
  const action = documentObject.createElement("td");
  const button = documentObject.createElement("button");
  button.type = "button";
  button.className = "analysis-followup-button";
  button.textContent = "対象月を見る";
  button.setAttribute("aria-label", `${flow.label}の学生フォローを表示`);
  button.addEventListener("click", () => openStudentWorkspace(documentObject, buildMonthlyFollowUpFilter(flow.key)));
  action.append(button);
  row.append(action);
  return row;
}

function renderSchoolAnalysis(documentObject, rows) {
  const query = normalizeSearch(documentObject.getElementById("school-search")?.value);
  const sort = documentObject.getElementById("school-sort")?.value || "contacts";
  const sorted = rows
    .filter((row) => !query || normalizeSearch(row.school).includes(query))
    .sort((left, right) => (
      Number(right[sort] || 0) - Number(left[sort] || 0)
      || right.contacts - left.contacts
      || left.school.localeCompare(right.school, "ja")
    ));
  const body = documentObject.getElementById("school-analysis-body");
  const empty = documentObject.getElementById("school-analysis-empty");
  const count = documentObject.getElementById("school-result-count");
  if (count) count.textContent = `${sorted.length}校`;
  if (body) {
    body.replaceChildren(...sorted.slice(0, 100).map((row) => createSchoolAnalysisRow(documentObject, row)));
  }
  if (empty) empty.hidden = sorted.length > 0;
}

function createSchoolAnalysisRow(documentObject, school) {
  const row = createAnalysisRow(documentObject, [
    school.school,
    school.contacts,
    school.lineRegistrations,
    school.entries,
    school.offers,
    `${school.entryRate}%`,
    `${school.offerRate}%`,
    school.needsAction
  ]);
  const action = documentObject.createElement("td");
  const button = documentObject.createElement("button");
  button.type = "button";
  button.className = "analysis-followup-button";
  button.textContent = "学生を見る";
  button.setAttribute("aria-label", `${school.school}の学生フォローを表示`);
  button.addEventListener("click", () => openSchoolStudentWorkspace(documentObject, school.school));
  action.append(button);
  row.append(action);
  return row;
}

function openSchoolStudentWorkspace(documentObject, school) {
  openStudentWorkspace(documentObject, buildSchoolFollowUpFilter(school));
}

function openStudentWorkspace(documentObject, filter) {
  if (!filter) return;
  const search = documentObject.getElementById("student-search");
  const source = documentObject.getElementById("student-source-filter");
  const state = documentObject.getElementById("student-state-filter");
  const progress = documentObject.getElementById("student-progress-filter");
  const month = documentObject.getElementById("student-month-filter");
  const followUp = documentObject.getElementById("student-follow-up-filter");
  const sort = documentObject.getElementById("student-sort-filter");
  if (search) search.value = filter.query;
  if (source) source.value = filter.source;
  if (state) state.value = filter.state;
  if (progress) progress.value = filter.progress;
  if (month) month.value = filter.month || "ALL";
  if (followUp) followUp.value = filter.followUp || "ALL";
  if (sort) sort.value = filter.sort || "DEFAULT";
  documentObject.querySelector?.('[data-secondary-tab="students"]')?.click?.();
  renderStudentWorkspace(documentObject);
  documentObject.getElementById("recruitment-students")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function createAnalysisRow(documentObject, values) {
  const row = documentObject.createElement("tr");
  values.forEach((value, index) => {
    const cell = documentObject.createElement(index === 0 ? "th" : "td");
    if (index === 0) cell.scope = "row";
    cell.textContent = String(value);
    row.append(cell);
  });
  return row;
}

const TALENT_PROGRESS_CODES = Object.freeze([
  "CONTACT", "LINE_REGISTERED", "SALON_TOUR", "INTERVIEW",
  "PASSED", "OFFER", "EXPECTED_JOIN", "WITHDRAWN"
]);

export function getTalentStudentProgressKey(student) {
  const progress = String(student?.statusCode || "");
  return TALENT_PROGRESS_CODES.includes(progress) ? progress : "UNSET";
}

export function buildSchoolFollowUpFilter(school) {
  const query = typeof school === "string" ? school.trim() : "";
  if (!query) return null;
  return Object.freeze({ query, source: "ALL", state: "ALL", progress: "ALL" });
}

export function buildSummaryFollowUpFilter(key) {
  const filters = {
    contacts: { source: "CONTACTS_27" },
    entries: { source: "ENTRIES_27" },
    offers: { source: "OFFERS_27" },
    overdueFollowUp: { followUp: "OVERDUE" },
    nextWeekFollowUp: { followUp: "NEXT_7_DAYS" },
    needsAction: { state: "NEEDS_ACTION" }
  };
  const selected = filters[String(key || "")];
  if (!selected) return null;
  return Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "ALL", ...selected });
}

export function buildMonthlyFollowUpFilter(month) {
  const value = String(month || "");
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  return Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "ALL", month: value });
}

const STUDENT_FILTER_LABELS = Object.freeze({
  source: Object.freeze({
    CONTACTS_27: "接触",
    ENTRIES_27: "エントリー",
    OFFERS_27: "内定",
    MANUAL: "手入力"
  }),
  state: Object.freeze({
    OWNER_REVIEW: "要確認",
    QUARANTINE: "隔離",
    IMPORTABLE: "確認済み",
    NEW_CANDIDATE: "新規候補",
    NEEDS_ACTION: "要確認・隔離"
  }),
  progress: Object.freeze({
    UNSET: "進捗未登録",
    CONTACT: "接触",
    LINE_REGISTERED: "LINE登録",
    SALON_TOUR: "サロン見学",
    INTERVIEW: "面接",
    PASSED: "通過",
    OFFER: "内定",
    EXPECTED_JOIN: "入社予定",
    WITHDRAWN: "辞退・保留"
  }),
  followUp: Object.freeze({
    OVERDUE: "期限超過",
    NEXT_7_DAYS: "7日以内",
    SCHEDULED: "予定あり",
    UNSCHEDULED: "未設定"
  }),
  sort: Object.freeze({
    FOLLOW_UP: "対応期限順"
  })
});

export function buildStudentFilterSummary({ query = "", source = "ALL", state = "ALL", progress = "ALL", month = "ALL", followUp = "ALL", sort = "DEFAULT" } = {}) {
  const labels = [];
  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery) labels.push(`検索: ${normalizedQuery}`);
  if (source !== "ALL") labels.push(`区分: ${STUDENT_FILTER_LABELS.source[source] || source}`);
  if (state !== "ALL") labels.push(`状態: ${STUDENT_FILTER_LABELS.state[state] || state}`);
  if (progress !== "ALL") labels.push(`進捗: ${STUDENT_FILTER_LABELS.progress[progress] || progress}`);
  if (month !== "ALL") labels.push(`記録月: ${month}`);
  if (followUp !== "ALL") labels.push(`対応期限: ${STUDENT_FILTER_LABELS.followUp[followUp] || followUp}`);
  if (sort !== "DEFAULT") labels.push(`並び順: ${STUDENT_FILTER_LABELS.sort[sort] || sort}`);
  return Object.freeze({
    active: labels.length > 0,
    title: labels.length > 0 ? "条件を絞って表示中" : "すべての学生を表示中",
    labels: Object.freeze(labels)
  });
}

export function buildOnboardingHandoffDraft(student) {
  if (!student || typeof student !== "object") return null;
  const displayName = typeof student.displayName === "string" ? student.displayName.trim() : "";
  const expectedJoinDate = String(student.expectedJoinDate || "");
  if (!displayName || !student.applicationNo || !["OFFER", "EXPECTED_JOIN"].includes(student.statusCode)
    || !/^\d{4}-\d{2}-\d{2}$/.test(expectedJoinDate)) return null;
  return Object.freeze({
    procedureType: "ONBOARDING",
    subjectLabel: displayName,
    effectiveDate: expectedJoinDate
  });
}

export function filterTalentStudents(students, { query = "", source = "ALL", state = "ALL", progress = "ALL", month = "ALL", followUp = "ALL" } = {}) {
  const normalizedQuery = normalizeSearch(query);
  return (Array.isArray(students) ? students : []).filter((student) => {
    if (source !== "ALL" && student.sourceCode !== source) return false;
    if (state === "NEW_CANDIDATE") {
      if (!isNewApplicantCandidate(student)) return false;
    } else if (state === "NEEDS_ACTION") {
      if (!["OWNER_REVIEW", "QUARANTINE"].includes(student.classification)) return false;
    } else if (state !== "ALL" && student.classification !== state) {
      return false;
    }
    if (progress !== "ALL" && getTalentStudentProgressKey(student) !== progress) return false;
    if (month !== "ALL" && getTalentStudentMonthKey(student) !== month) return false;
    if (followUp !== "ALL" && classifyTalentStudentFollowUp(student) !== followUp) return false;
    if (!normalizedQuery) return true;
    return [
      student.displayName, student.kana, student.school, student.status,
      student.preferredStore, student.sourceLabel
    ].some((value) => normalizeSearch(value).includes(normalizedQuery));
  });
}

export function classifyTalentStudentFollowUp(student, referenceDate = localTalentDateIso()) {
  const nextActionAt = String(student?.nextActionAt || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextActionAt)) return "UNSCHEDULED";
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : localTalentDateIso();
  const days = (Date.parse(`${nextActionAt}T00:00:00Z`) - Date.parse(`${reference}T00:00:00Z`)) / 86400000;
  if (days < 0) return "OVERDUE";
  if (days <= 7) return "NEXT_7_DAYS";
  return "SCHEDULED";
}

export function buildStudentDailyOperation(student, capability = {}, referenceDate = localTalentDateIso()) {
  if (!student) {
    return {
      category: "NO_SELECTION",
      badge: "未選択",
      title: "学生を選択してください",
      copy: "一覧から対象を選ぶと、今日の更新・確認・引継ぎの順番を表示します。",
      steps: ["学生一覧から対象を選択", "状態・確認事項・次回対応日を確認"]
    };
  }
  const followUp = classifyTalentStudentFollowUp(student, referenceDate);
  if (capability.onboardingReady) {
    return {
      category: "ONBOARDING_HANDOFF",
      badge: "入社手続き",
      title: "内定者は入社手続きへ引き継ぐ",
      copy: "個人データをここで増やさず、下書き作成から入社手続き案件へ安全に渡します。",
      steps: ["入社手続きへを開く", "入社予定日と配属予定の有無を確認", "保存前に下書き内容を確認"]
    };
  }
  if (followUp === "OVERDUE") {
    return {
      category: "OVERDUE_FOLLOW_UP",
      badge: "期限超過",
      title: "まず次回対応を更新する",
      copy: "期限超過の学生です。状態更新より先に、次の対応日と担当メモを整えると追跡が安定します。",
      steps: ["次回対応を設定を開く", "対応日・状態・補足を保存", "変更履歴で記録されたことを確認"]
    };
  }
  if (followUp === "NEXT_7_DAYS") {
    return {
      category: "NEXT_WEEK_FOLLOW_UP",
      badge: "7日以内",
      title: "予定対応を前倒しで確認する",
      copy: "直近7日以内のフォロー対象です。今日触るべきか、担当者が迷わない状態にします。",
      steps: ["次回対応日を確認", "必要なら対応日や状態を更新", "未対応なら一覧の期限順に残す"]
    };
  }
  if (capability.confirmable) {
    return {
      category: "OWNER_REVIEW",
      badge: "要確認",
      title: "候補確認か補足記録を行う",
      copy: "一括反映ではなく、この学生だけを確認できます。判断できない場合は隔離を維持します。",
      steps: ["この候補を確認を開く", "一致候補または新規候補として判断", "迷う行は補足を残して隔離維持"]
    };
  }
  if (student.classification === "QUARANTINE") {
    return {
      category: "QUARANTINE_REVIEW",
      badge: "隔離",
      title: "隔離理由を整理して安全に保留する",
      copy: "不明な行を無理に正本へ寄せず、補足・履歴・確認導線で次の判断材料を残します。",
      steps: ["確認事項を読む", "編集で補足情報を残す", "判断できないものは隔離維持"]
    };
  }
  if (capability.hasCanonicalProfile) {
    return {
      category: "CANONICAL_PROFILE_UPDATE",
      badge: "正本更新",
      title: "正本プロフィールを日常更新する",
      copy: "連絡状況や次回対応を正本側へ記録します。取込原本は変更しません。",
      steps: ["編集を開く", "状態・次回対応・担当メモを更新", "変更履歴で差分を確認"]
    };
  }
  if (capability.editable) {
    return {
      category: "STAGING_SUPPLEMENT",
      badge: "補足記録",
      title: "staging補足だけを記録する",
      copy: "正本未確定の行です。個別確認や後続の一括処理に使う補足だけを残します。",
      steps: ["編集を開く", "補足情報と次回対応を保存", "一括反映とは別の個別記録として扱う"]
    };
  }
  return {
    category: "READ_ONLY",
    badge: "閲覧のみ",
    title: "取込原本は保護されています",
    copy: "この行は直接編集せず、正本化または確認対象になったあとに更新します。",
    steps: ["確認事項を読む", "必要なら要確認・隔離キューで扱う", "自動削除や昇格は行わない"]
  };
}

export function sortTalentStudentsByFollowUp(students, mode = "DEFAULT", referenceDate = localTalentDateIso()) {
  const rows = Array.isArray(students) ? students.slice() : [];
  if (mode !== "FOLLOW_UP") return rows;
  const priority = { OVERDUE: 0, NEXT_7_DAYS: 1, SCHEDULED: 2, UNSCHEDULED: 3 };
  return rows
    .map((student, index) => ({ student, index, category: classifyTalentStudentFollowUp(student, referenceDate) }))
    .sort((left, right) => (
      priority[left.category] - priority[right.category]
      || String(left.student.nextActionAt || "").localeCompare(String(right.student.nextActionAt || ""))
      || left.index - right.index
    ))
    .map(({ student }) => student);
}

function localTalentDateIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function getTalentStudentMonthKey(student) {
  const value = String(student?.businessDate || student?.lineRegistrationDate || "");
  return /^\d{4}-\d{2}(?:-\d{2})?$/.test(value) ? value.slice(0, 7) : "";
}

function renderStudentMonthFilterOptions(documentObject, students) {
  const select = documentObject.getElementById("student-month-filter");
  if (!select) return;
  const selected = select.value || "ALL";
  const months = [...new Set((Array.isArray(students) ? students : [])
    .map(getTalentStudentMonthKey)
    .filter(Boolean))]
    .sort((left, right) => right.localeCompare(left));
  const all = documentObject.createElement("option");
  all.value = "ALL";
  all.textContent = "すべて";
  select.replaceChildren(all, ...months.map((month) => {
    const option = documentObject.createElement("option");
    option.value = month;
    option.textContent = `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
    return option;
  }));
  select.value = months.includes(selected) ? selected : "ALL";
}

function renderStudentWorkspace(documentObject) {
  if (!studentWorkspaceData) return;
  const query = normalizeSearch(documentObject.getElementById("student-search")?.value);
  const source = documentObject.getElementById("student-source-filter")?.value || "ALL";
  const state = documentObject.getElementById("student-state-filter")?.value || "ALL";
  const progress = documentObject.getElementById("student-progress-filter")?.value || "ALL";
  const month = documentObject.getElementById("student-month-filter")?.value || "ALL";
  const followUp = documentObject.getElementById("student-follow-up-filter")?.value || "ALL";
  const sort = documentObject.getElementById("student-sort-filter")?.value || "DEFAULT";
  const visible = sortTalentStudentsByFollowUp(
    filterTalentStudents(studentWorkspaceData.students, { query, source, state, progress, month, followUp }),
    sort
  );
  updateStudentQuickFilterState(documentObject, state, studentWorkspaceData.students);
  updateStudentFilterResetState(documentObject, { query, source, state, progress, month, followUp, sort });
  renderStudentFilterSummary(documentObject, buildStudentFilterSummary({ query, source, state, progress, month, followUp, sort }));
  renderStudentEmptyState(documentObject, {
    total: studentWorkspaceData.students.length,
    visible: visible.length,
    hasActiveFilters: hasActiveStudentFilters({ query, source, state, progress, month, followUp, sort })
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

export function buildStudentEmptyState({ total = 0, visible = 0, hasActiveFilters = false } = {}) {
  if (visible > 0) return Object.freeze({ visible: false, title: "", copy: "", canReset: false });
  if (total === 0) {
    return Object.freeze({
      visible: true,
      title: "表示できる学生データがまだありません",
      copy: "27卒データの取込または手入力追加が完了すると、ここに学生一覧が表示されます。",
      canReset: false
    });
  }
  return Object.freeze({
    visible: true,
    title: hasActiveFilters ? "条件に一致する学生がいません" : "表示できる学生がありません",
    copy: hasActiveFilters
      ? "検索・区分・確認状態・対応期限の条件をゆるめると、対象が見つかる可能性があります。"
      : "取込済みデータはありますが、現在の表示条件では一覧化できません。",
    canReset: hasActiveFilters
  });
}

function hasActiveStudentFilters({ query = "", source = "ALL", state = "ALL", progress = "ALL", month = "ALL", followUp = "ALL", sort = "DEFAULT" } = {}) {
  return Boolean(query) || source !== "ALL" || state !== "ALL" || progress !== "ALL" || month !== "ALL" || followUp !== "ALL" || sort !== "DEFAULT";
}

function renderStudentEmptyState(documentObject, state) {
  const view = buildStudentEmptyState(state);
  const title = documentObject.getElementById("student-empty-title");
  const copy = documentObject.getElementById("student-empty-copy");
  const reset = documentObject.getElementById("student-empty-reset");
  if (title) title.textContent = view.title;
  if (copy) copy.textContent = view.copy;
  if (reset) reset.hidden = !view.canReset;
}

function updateStudentQuickFilterState(documentObject, state, students) {
  const controls = [
    ["student-filter-all", "ALL"],
    ["student-filter-review", "OWNER_REVIEW"],
    ["student-filter-quarantine", "QUARANTINE"],
    ["student-filter-confirmed", "IMPORTABLE"],
    ["student-filter-new", "NEW_CANDIDATE"]
  ];
  controls.forEach(([id, value]) => {
    const button = documentObject.getElementById(id);
    if (!button) return;
    const active = value === state;
    const count = value === "ALL"
      ? students.length
      : filterTalentStudents(students, { state: value }).length;
    const label = button.dataset.label || button.textContent || "";
    button.textContent = `${label} ${count}`;
    button.setAttribute("aria-label", `${label} ${count}件`);
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateStudentFilterResetState(documentObject, { query, source, state, progress, month, followUp, sort }) {
  const button = documentObject.getElementById("student-filter-reset");
  if (!button) return;
  const active = hasActiveStudentFilters({ query, source, state, progress, month, followUp, sort });
  button.disabled = !active;
  button.setAttribute("aria-disabled", String(!active));
}

function renderStudentFilterSummary(documentObject, summary) {
  const container = documentObject.getElementById("student-filter-summary");
  const title = documentObject.getElementById("student-filter-summary-title");
  const chips = documentObject.getElementById("student-filter-summary-chips");
  if (!container || !title || !chips) return;
  container.dataset.active = String(summary.active);
  title.textContent = summary.title;
  chips.replaceChildren(...summary.labels.map((label) => {
    const chip = documentObject.createElement("span");
    chip.textContent = label;
    return chip;
  }));
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
  const followUpCategory = classifyTalentStudentFollowUp(student);
  const followUp = documentObject.createElement("span");
  followUp.className = `student-list-followup is-${followUpCategory.toLowerCase().replaceAll("_", "-")}`;
  if (followUpCategory !== "UNSCHEDULED") {
    followUp.textContent = `次回対応 ${student.nextActionAt}`;
  }
  const reasons = Array.isArray(student.reasonLabels) ? student.reasonLabels.filter(Boolean).slice(0, 2) : [];
  const reason = documentObject.createElement("span");
  reason.className = "student-list-reason";
  reason.textContent = reasons.length ? reasons.join("・") : "";
  if (reasons.length) button.title = `確認事項: ${reasons.join("・")}`;
  button.append(top, meta, status, followUp, reason);
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
    const editButton = documentObject.getElementById("student-edit-open");
    const nextActionButton = documentObject.getElementById("student-next-action-open");
    const auditButton = documentObject.getElementById("student-audit-open");
    if (editButton) {
      editButton.disabled = true;
      editButton.setAttribute("aria-disabled", "true");
      editButton.title = "学生を選択してください";
    }
    if (nextActionButton) {
      nextActionButton.disabled = true;
      nextActionButton.setAttribute("aria-disabled", "true");
      nextActionButton.title = "学生を選択してください";
    }
    const confirmButton = documentObject.getElementById("student-confirm-open");
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.setAttribute("aria-disabled", "true");
      confirmButton.title = "確認候補がありません";
    }
    const onboardingButton = documentObject.getElementById("student-onboarding-open");
    if (onboardingButton) {
      onboardingButton.disabled = true;
      onboardingButton.setAttribute("aria-disabled", "true");
      onboardingButton.title = "内定と入社予定日を登録すると利用できます";
    }
    if (auditButton) {
      auditButton.disabled = true;
      auditButton.setAttribute("aria-disabled", "true");
      auditButton.title = "学生を選択してください";
    }
    renderStudentActionGuide(documentObject, null);
    renderStudentDailyOperation(documentObject, buildStudentDailyOperation(null));
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
  const editable = Boolean(student.applicationNo)
    || (student.mappingStatus === "UNMAPPED" && Boolean(student.recordId));
  const editButton = documentObject.getElementById("student-edit-open");
  if (editButton) {
    editButton.disabled = !editable;
    editButton.setAttribute("aria-disabled", String(!editable));
    editButton.title = student.applicationNo
      ? "正本プロフィールを編集"
      : editable ? "staging補足情報を編集" : "編集できるデータがありません";
  }
  const nextActionButton = documentObject.getElementById("student-next-action-open");
  if (nextActionButton) {
    nextActionButton.disabled = !editable;
    nextActionButton.setAttribute("aria-disabled", String(!editable));
    nextActionButton.title = editable ? "次回対応日を設定" : "このデータには補足情報を登録できません";
  }
  const auditButton = documentObject.getElementById("student-audit-open");
  if (auditButton) {
    const auditable = Boolean(student.applicationNo || student.supplementVersion);
    auditButton.disabled = !auditable;
    auditButton.setAttribute("aria-disabled", String(!auditable));
    auditButton.title = auditable ? "情報の変更履歴を表示" : "編集可能な情報がありません";
  }
  const confirmButton = documentObject.getElementById("student-confirm-open");
  const confirmable = student.mappingStatus === "UNMAPPED"
    && (student.primaryEligible
      || (student.suggestionCategory === "EXACT1" && Boolean(student.suggestedTargetRecordId))
      || ["ENTRIES_27", "OFFERS_27"].includes(student.sourceCode));
  if (confirmButton) {
    confirmButton.disabled = !confirmable;
    confirmButton.setAttribute("aria-disabled", String(!confirmable));
    confirmButton.title = confirmable ? "この候補だけを確認" : "このデータは個別確認の対象外です";
  }
  const onboardingDraft = buildOnboardingHandoffDraft(student);
  const onboardingButton = documentObject.getElementById("student-onboarding-open");
  if (onboardingButton) {
    onboardingButton.disabled = !onboardingDraft;
    onboardingButton.setAttribute("aria-disabled", String(!onboardingDraft));
    onboardingButton.title = onboardingDraft
      ? "入社手続き案件の下書きを作成"
      : "内定と入社予定日を登録すると利用できます";
  }
  setText(documentObject, "student-detail-school", student.school || "未登録");
  setText(documentObject, "student-detail-status", student.status || "未登録");
  setText(documentObject, "student-detail-phone", student.phone || "未登録");
  setText(documentObject, "student-detail-email", student.email || "未登録");
  setText(documentObject, "student-detail-store", student.preferredStore || "未登録");
  setText(documentObject, "student-detail-offer-date", student.offerDate || "未登録");
  setText(documentObject, "student-detail-expected-join-date", student.expectedJoinDate || "未登録");
  setText(documentObject, "student-detail-planned-store", student.plannedStore || "未登録");
  setText(documentObject, "student-detail-application", student.applicationNo || "未確定");
  setText(documentObject, "student-detail-next-action", student.nextActionAt || "未登録");
  const followUpCategory = classifyTalentStudentFollowUp(student);
  const followUpState = documentObject.getElementById("student-detail-followup-state");
  if (followUpState) {
    const labels = {
      OVERDUE: "期限超過: 優先対応",
      NEXT_7_DAYS: "7日以内: 対応予定",
      SCHEDULED: "予定あり",
      UNSCHEDULED: "未設定"
    };
    followUpState.textContent = labels[followUpCategory];
    followUpState.className = `detail-followup-state is-${followUpCategory.toLowerCase().replaceAll("_", "-")}`;
  }
  setText(documentObject, "student-detail-profile-version", student.profileVersion ? `v${student.profileVersion}` : "未登録");
  setText(
    documentObject,
    "student-detail-mapping",
    student.mappingStatus === "OWNER_CONFIRMED"
      ? "確認済み"
      : student.suggestionCategory === "EXACT1" ? "一致候補あり" : "要確認"
  );
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
  const actionCapability = {
    hasCanonicalProfile: Boolean(student.applicationNo),
    hasSupplement: Boolean(student.supplementVersion),
    editable: Boolean(student.applicationNo) || (student.mappingStatus === "UNMAPPED" && Boolean(student.recordId)),
    confirmable,
    onboardingReady: Boolean(onboardingDraft),
    mappingStatus: student.mappingStatus,
  };
  renderStudentActionGuide(documentObject, actionCapability);
  renderStudentDailyOperation(documentObject, buildStudentDailyOperation(student, actionCapability));
}

function renderStudentActionGuide(documentObject, capability) {
  const title = documentObject.getElementById("student-action-guide-title");
  const copy = documentObject.getElementById("student-action-guide-copy");
  const edit = documentObject.getElementById("student-action-edit-state");
  const audit = documentObject.getElementById("student-action-audit-state");
  const confirm = documentObject.getElementById("student-action-confirm-state");
  if (!title || !copy || !edit || !audit || !confirm) return;
  if (!capability) {
    title.textContent = "学生を選択すると操作を案内します";
    copy.textContent = "一覧から対象を選ぶと、編集・履歴・確認の可否と理由をここに表示します。";
    setStudentActionState(edit, "編集: 対象を選択", false);
    setStudentActionState(audit, "履歴: 対象を選択", false);
    setStudentActionState(confirm, "確認: 対象を選択", false);
    return;
  }
  if (capability.onboardingReady) {
    title.textContent = "入社手続きの下書きを作成できます";
    copy.textContent = "入社手続きへ引き継ぐと、対象者と入社予定日だけをフォームへ入力します。保存するまで案件は作成されません。";
  } else if (capability.hasCanonicalProfile) {
    title.textContent = "正本プロフィールを更新できます";
    copy.textContent = "編集で最新情報を保存し、変更履歴で更新項目と時刻を確認できます。取込元の原本は変更しません。";
  } else if (capability.confirmable) {
    title.textContent = "候補の確認または補足情報の記録ができます";
    copy.textContent = "確認すると応募者の作成・紐付けだけを反映します。内容を直す場合は編集から補足情報を保存してください。";
  } else if (capability.editable) {
    title.textContent = "取込データに補足情報を記録できます";
    copy.textContent = "編集は取込原本を変えず、選考状況を含む総務人事部の補足情報だけを保存します。紐付け確定後は正本側で編集できます。";
  } else {
    title.textContent = "取込原本は保護された状態です";
    copy.textContent = "この行は取込データのため直接編集しません。紐付け後の正本プロフィール、または新規追加した学生情報を編集してください。";
  }
  setStudentActionState(edit, capability.editable ? "編集: 利用できます" : "編集: 正本化後に利用", capability.editable);
  setStudentActionState(audit, capability.hasCanonicalProfile || capability.hasSupplement ? "履歴: 表示できます" : "履歴: 最初の保存後に表示", capability.hasCanonicalProfile || capability.hasSupplement);
  setStudentActionState(confirm, capability.confirmable ? "候補確認: 利用できます" : capability.mappingStatus === "OWNER_CONFIRMED" ? "候補確認: 済み" : "候補確認: 対象外", capability.confirmable);
}

function setStudentActionState(element, label, enabled) {
  element.textContent = label;
  element.className = `student-action-state ${enabled ? "is-ready" : "is-blocked"}`;
}

function renderStudentDailyOperation(documentObject, operation) {
  const badge = documentObject.getElementById("student-daily-operation-badge");
  const title = documentObject.getElementById("student-daily-operation-title");
  const copy = documentObject.getElementById("student-daily-operation-copy");
  const steps = documentObject.getElementById("student-daily-operation-steps");
  if (!badge || !title || !copy || !steps) return;
  const safeOperation = operation || buildStudentDailyOperation(null);
  badge.textContent = safeOperation.badge;
  badge.dataset.category = safeOperation.category;
  title.textContent = safeOperation.title;
  copy.textContent = safeOperation.copy;
  steps.replaceChildren(...safeOperation.steps.map((step) => {
    const item = documentObject.createElement("li");
    item.textContent = step;
    return item;
  }));
}

const PROFILE_FIELD_LABELS = Object.freeze({
  displayName: "氏名", kana: "フリガナ", school: "学校", phone: "電話番号", email: "メール",
  preferredStore: "希望店舗", currentStatus: "現在の状態", nextActionAt: "次回対応日",
  offerDate: "内定日", expectedJoinDate: "入社予定日", plannedStore: "配属予定"
});

async function openStudentAuditDialog({ globalObject, documentObject, student }) {
  if (!student?.applicationNo && !student?.supplementVersion) return;
  auditDialogStudent = student;
  const status = documentObject.getElementById("student-audit-status");
  const body = documentObject.getElementById("student-audit-body");
  if (status) {
    status.dataset.state = "loading";
    status.textContent = "変更履歴を読み込んでいます";
  }
  if (body) body.replaceChildren();
  documentObject.getElementById("student-audit-dialog")?.showModal?.();
  const executor = student.applicationNo
    ? createTalentStudentProfileAuditExact1Executor({
      applicationNo: student.applicationNo,
      globalObject,
      hubSessionHelper: globalObject.NovHubSession,
      hubContract: globalObject.NOV_HUB_SESSION_CONTRACT || NOV_HUB_SESSION_CONTRACT
    })
    : createTalentStagingSupplementAuditExact1Executor({
      stagingRecordId: student.recordId,
      globalObject,
      hubSessionHelper: globalObject.NovHubSession,
      hubContract: globalObject.NOV_HUB_SESSION_CONTRACT || NOV_HUB_SESSION_CONTRACT
    });
  const result = executor ? await executor.run() : null;
  if (!auditDialogStudent || auditDialogStudent.recordId !== student.recordId) return;
  if (result?.okBoolean !== true) {
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = result?.stopCategory === "auth_required"
        ? "HUBへ再ログインしてください"
        : "変更履歴を取得できません";
    }
    return;
  }
  if (status) {
    status.dataset.state = "ready";
    status.textContent = `${result.data.entries.length}件の変更履歴`;
  }
  if (body) {
    body.replaceChildren(...result.data.entries.map((entry) => {
      const row = documentObject.createElement("tr");
      const action = documentObject.createElement("th");
      action.scope = "row";
      action.textContent = entry.action === "CREATE" ? "作成" : "更新";
      const fields = documentObject.createElement("td");
      fields.textContent = entry.changedFields.map((field) => PROFILE_FIELD_LABELS[field] || "変更項目").join("、");
      const version = documentObject.createElement("td");
      version.textContent = `v${entry.profileVersion || entry.supplementVersion}`;
      const occurredAt = documentObject.createElement("td");
      occurredAt.textContent = formatAuditDate(entry.occurredAt);
      row.append(action, fields, version, occurredAt);
      return row;
    }));
  }
}

function formatAuditDate(value) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "日時未登録";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(parsed);
}

function openStudentProfileDialog({ documentObject, student, focusField = "profile-display-name" }) {
  profileDialogStudent = student;
  const stagingEdit = Boolean(student && !student.applicationNo && student.recordId);
  setText(documentObject, "student-profile-dialog-title", stagingEdit ? "staging補足情報を編集" : student ? "学生情報を編集" : "学生を追加");
  const fields = {
    "profile-display-name": student?.displayName || "",
    "profile-kana": student?.kana || "",
    "profile-school": student?.school || "",
    "profile-phone": student?.phone || "",
    "profile-email": student?.email || "",
    "profile-store": student?.preferredStore || "",
    "profile-offer-date": student?.offerDate || "",
    "profile-expected-join-date": student?.expectedJoinDate || "",
    "profile-planned-store": student?.plannedStore || "",
    "profile-status": student?.statusCode || "CONTACT",
    "profile-next-action": student?.nextActionAt || "",
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = documentObject.getElementById(id);
    if (input) input.value = value;
  });
  const status = documentObject.getElementById("student-profile-status");
  if (status) {
    status.dataset.state = "idle";
    status.textContent = student
      ? stagingEdit ? "staging補足情報を確認して保存してください" : "変更内容を確認して保存してください"
      : "必要事項を入力してください";
  }
  documentObject.getElementById("student-profile-dialog")?.showModal?.();
  documentObject.getElementById(focusField)?.focus?.();
}

async function saveStudentProfile({ globalObject, documentObject }) {
  const form = documentObject.getElementById("student-profile-form");
  if (!form?.reportValidity?.()) return;
  const saveButton = documentObject.getElementById("student-profile-save");
  const status = documentObject.getElementById("student-profile-status");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
  }
  const payload = {
    applicationNo: profileDialogStudent?.applicationNo || null,
    expectedVersion: profileDialogStudent?.profileVersion || 0,
    displayName: documentObject.getElementById("profile-display-name")?.value || "",
    kana: documentObject.getElementById("profile-kana")?.value || "",
    school: documentObject.getElementById("profile-school")?.value || "",
    phone: documentObject.getElementById("profile-phone")?.value || "",
    email: documentObject.getElementById("profile-email")?.value || "",
    preferredStore: documentObject.getElementById("profile-store")?.value || "",
    currentStatus: documentObject.getElementById("profile-status")?.value || "CONTACT",
    nextActionAt: documentObject.getElementById("profile-next-action")?.value || "",
    offerDate: documentObject.getElementById("profile-offer-date")?.value || "",
    expectedJoinDate: documentObject.getElementById("profile-expected-join-date")?.value || "",
    plannedStore: documentObject.getElementById("profile-planned-store")?.value || "",
  };
  const stagingEdit = Boolean(profileDialogStudent && !profileDialogStudent.applicationNo && profileDialogStudent.recordId);
  if (status) {
    status.dataset.state = "loading";
    status.textContent = stagingEdit ? "staging補足情報を保存しています" : "正本プロフィールへ保存しています";
  }
  const controller = stagingEdit
    ? createTalentStagingSupplementController({ globalObject })
    : createTalentStudentProfileController({ globalObject });
  if (stagingEdit) {
    delete payload.applicationNo;
    delete payload.profileVersion;
    payload.stagingRecordId = profileDialogStudent.recordId;
    payload.expectedVersion = profileDialogStudent.supplementVersion || 0;
  }
  const result = await controller.save(payload);
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.setAttribute("aria-busy", "false");
  }
  if (!result.ok) {
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = result.category === "auth_required"
        ? "HUBへ再ログインしてください"
        : result.category === "invalid_request"
          ? "入力内容を確認してください"
          : "保存できませんでした。最新情報を再読み込みしてください";
    }
    return;
  }
  pendingSelectedApplicationNo = result.data.applicationNo || null;
  if (status) {
    status.dataset.state = "ready";
    status.textContent = stagingEdit
      ? "staging補足情報を保存しました"
      : result.data.operation === "CREATE" ? "学生を追加しました" : "学生情報を更新しました";
  }
  documentObject.getElementById("student-profile-dialog")?.close?.();
  profileDialogStudent = null;
  studentWorkspaceData = null;
  await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
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
  workforceProcedureDesk = initializeWorkforceProcedureDesk();
  initializeTalentStudentWorkspace();
  initializeTalentNavigation();
  renderWorkforceReadiness(globalThis.document, buildWorkforceReadinessViewModel());
  initializeTalentSummaryControl();
  initializeTalentOperatorPanel();
  loadTalentStudentWorkspace();
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
