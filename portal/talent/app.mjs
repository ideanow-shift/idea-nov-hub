import {
  buildDashboardSummaryViewModel,
  createDashboardSummaryExecutor,
  createSelectionCoverageExecutor,
  createTalentWorkspaceExecutor
} from "./runtime.mjs?v=20260811-planning-admin-v1";
import { buildSchoolFactRow, buildTalentAnalytics, buildTalentAnalyticsActionGuide, buildTalentAnalyticsQueueHandoff } from "./analytics.mjs?v=20260811-ui-simplification-v1";
import { initializeTalent28CsvPreflight } from "./csv-import-preflight.mjs?v=20260731-sprint1-mock-2";
import { installNovTalentAuthGuard } from "./hub-auth.mjs";
import { getNovHubSessionStatus, handleNovHubSessionAuthFailure, NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";
import { createStagingCandidateClient, stagingWriteEnabled } from "./staging-write.mjs?v=20260811-ui-simplification-v1";
import { createCandidateActivityConfirmationController } from "./candidate-activity-confirmation.mjs?v=20260811-ui-simplification-v1";
import { HUB_SESSION_REAUTH_MESSAGE, isCandidateWriteSessionAvailable } from "./session-expiry-ux.mjs?v=20260811-ui-simplification-v1";
import { buildDailyWorkflowQueue, jstDateTimeLocalToRfc3339 } from "./daily-workflow.mjs?v=20260811-ui-simplification-v1";
import {
  buildCandidateHistorySummary,
  buildEventRoiView,
  buildMockRuntimePresentation,
  buildRecruitmentDashboardDecision,
  buildRecruitmentTaskBoard,
  japanBusinessDateIso
} from "./recruitment-ux.mjs?v=20260811-ui-simplification-v1";
import { CANDIDATE_STATUS_LABELS } from "./status-dictionary.mjs?v=20260804-recruiting-dashboard-completion-1";
import { initializeRecruitingIntelligenceDiagnostic } from "./recruiting-intelligence-diagnostic.mjs?v=20260811-outcome3-planning-comparison-1";
import { initializeRecruitingPlanningDiagnostic } from "./recruiting-planning-diagnostic.mjs?v=20260811-planning-diagnostic-1";
import { initializeRecruitingPlanningAdmin } from "./recruiting-planning-admin.mjs?v=20260811-planning-runtime-capability-1";

let summaryConsumed = false;
let summaryGeneration = 0;
let activeSummaryController = null;
let dailyWorkflowData = null;
let activeSummaryButton = null;
let studentWorkspaceData = null;
let studentWorkspaceGeneration = 0;
let activeStudentWorkspaceController = null;
let activeStudentWorkspacePromise = null;
let selectedStudentRecordId = null;
let historicalReviewController = null;
let activeHistoricalReviewProposal = null;
let activeHistoricalReviewStudent = null;
let profileDialogStudent = null;
let auditDialogStudent = null;
let activityDialogContext = null;
let activityConfirmationController = null;
let pendingSelectedApplicationNo = null;
let selectedGraduationYear = "ALL";
let fairOriginReviewEntries = [];
let activeStudentFactFilter = null;

const PRIMARY_TABS = Object.freeze(["recruitment"]);
const RECRUITMENT_TABS = Object.freeze(["summary", "students", "fairs", "schools", "management"]);
const WORKFORCE_TABS = Object.freeze([]);
const CANDIDATE_RENDER_FAILURE_MESSAGE = "学生表示処理に失敗しました";

export function runTalentWorkspaceRenderPipeline({
  stages = [],
  logger = globalThis.console
} = {}) {
  try {
    for (const stage of stages) {
      try {
        stage.render();
      } catch {
        logger?.error?.(`[NOV Talent] Candidate rendering failed: ${stage.name}`);
        const failure = new Error("candidate_render_failed");
        failure.renderStage = stage.name;
        throw failure;
      }
    }
    return Object.freeze({ ok: true, failedStage: null, completedStageCount: stages.length });
  } catch (error) {
    return Object.freeze({
      ok: false,
      failedStage: String(error?.renderStage || "unknown_render_stage"),
      completedStageCount: Math.max(0, stages.findIndex((stage) => stage.name === error?.renderStage))
    });
  }
}

function renderCandidateWorkspaceFailure(documentObject) {
  const panel = documentObject?.getElementById?.("mock-runtime-state");
  if (panel) {
    panel.hidden = false;
    panel.dataset.state = "stopped";
    panel.dataset.category = "CANDIDATE_RENDER_FAILED";
  }
  setText(documentObject, "mock-runtime-state-title", CANDIDATE_RENDER_FAILURE_MESSAGE);
  setText(documentObject, "mock-runtime-state-copy", "再読み込みしても解消しない場合は、管理者へ連絡してください。");
  setText(documentObject, "historical-summary-status", CANDIDATE_RENDER_FAILURE_MESSAGE);
  setText(documentObject, "fair-analysis-status", CANDIDATE_RENDER_FAILURE_MESSAGE);
  setText(documentObject, "school-analysis-status", CANDIDATE_RENDER_FAILURE_MESSAGE);
}

export async function startTalentDashboardSummary({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fiscalYear = "current",
  abortSignal = null,
  runGeneration = summaryGeneration,
  isCurrentGeneration = (generation) => generation === summaryGeneration
} = {}) {
  if (summaryConsumed) return renderSafeStop(documentObject, "duplicate_control_prevented");
  summaryConsumed = true;

  setStatus(documentObject, "loading", "集計を確認しています");
  const executor = createDashboardSummaryExecutor({ globalObject, fiscalYear });
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
  button.disabled = false;
  setStatus(documentObject, "idle", runtimeMode(globalObject) === "staging"
    ? "学生データの集計を表示します"
    : "確認用学生データの集計を表示します");

  const run = async (event) => {
    const useWorkspaceSummary = shouldUseWorkspaceSummary(globalObject);
    if (event?.repeat || button.disabled || (!useWorkspaceSummary && summaryConsumed)) {
      return renderSafeStop(documentObject, "duplicate_control_prevented");
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    if (useWorkspaceSummary) {
      const result = await loadTalentStudentWorkspace({
        globalObject,
        documentObject,
        fetchImpl,
        force: true
      });
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = result?.studentRowsReturned
        ? "集計を表示済み"
        : "集計を再取得";
      documentObject?.getElementById?.("summary-status")?.focus?.();
      return result;
    }

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
  return Object.freeze({ initialized: true, helperAvailable: false, runtimeMode: runtimeMode(globalObject), run, invalidate });
}

export function shouldUseWorkspaceSummary(globalObject = globalThis) {
  return runtimeMode(globalObject) === "staging";
}

export function buildTalentInitialLoadPlan(globalObject = globalThis) {
  return Object.freeze({
    workspace: true,
    standaloneSummary: !shouldUseWorkspaceSummary(globalObject)
  });
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
  const workforceButtons = [];
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
      if (documentObject.body) documentObject.body.dataset.talentView = key;
      if (["summary", "students", "fairs", "schools"].includes(key) && !studentWorkspaceData) {
        loadTalentStudentWorkspace({ globalObject, documentObject });
      }
    }
  });
  if (documentObject.body && !documentObject.body.dataset.talentView) documentObject.body.dataset.talentView = "summary";
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
    initialized: primaryButtons.length <= 1,
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
    hubContract: NOV_HUB_SESSION_CONTRACT,
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
  configureFairMasterAccuracyInputs(documentObject);
  const refresh = () => {
    activeStudentFactFilter = null;
    renderStudentWorkspace(documentObject);
  };
  for (const button of documentObject.querySelectorAll("[data-graduation-year]")) {
    button.addEventListener("click", () => {
      selectedGraduationYear = normalizeGraduationYearFilter(button.dataset.graduationYear);
      updateGraduationYearSwitcher(documentObject);
      if (!studentWorkspaceData) return;
      renderStudentWorkspace(documentObject);
      renderTalentAnalytics(documentObject);
      const workspace = graduationYearWorkspace(studentWorkspaceData);
      renderTalentTodayDashboard(documentObject, workspace);
      renderTodayTasks(documentObject, workspace.todayTasks || []);
    });
  }
  updateGraduationYearSwitcher(documentObject);
  documentObject.getElementById("student-search")?.addEventListener("input", refresh);
  documentObject.getElementById("student-source-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-state-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-progress-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-month-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-follow-up-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("student-sort-filter")?.addEventListener("change", refresh);
  documentObject.getElementById("today-task-all-open")?.addEventListener("click", () => {
    documentObject.querySelector?.('[data-secondary-tab="students"]')?.click?.();
    documentObject.getElementById("daily-workflow-queue-title")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
  for (const id of ["daily-workflow-filter", "daily-workflow-candidate-filter", "daily-workflow-assignee-filter"]) {
    documentObject.getElementById(id)?.addEventListener(id === "daily-workflow-filter" ? "change" : "input", () => renderDailyWorkflowQueue(documentObject, dailyWorkflowData));
  }
  for (const button of documentObject.querySelectorAll("[data-workflow-home-filter]")) {
    button.addEventListener("click", () => {
      documentObject.querySelectorAll("[data-workflow-home-filter]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      renderDailyWorkflowHome(documentObject, dailyWorkflowData);
    });
  }
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
  documentObject.getElementById("student-daily-queue-start-button")?.addEventListener("click", () => {
    const guidePanel = documentObject.getElementById("student-daily-queue-start-guide");
    openStudentWorkspace(documentObject, buildStudentDailyQueueStartFilter(guidePanel?.dataset?.filterCategory));
  });
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
  for (const button of documentObject.querySelectorAll("[data-triage-queue]")) {
    button.addEventListener("click", () => {
      openStudentWorkspace(documentObject, buildBulkTriageQueueFilter(button.dataset.triageQueue));
    });
  }
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
    const control = documentObject.getElementById("fair-latest-month-open");
    if (control?.disabled) return;
    const key = control?.dataset.monthKey;
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
    if ((stagingWriteEnabled(globalObject) && student?.recordId)
      || student?.applicationNo
      || (student?.mappingStatus === "UNMAPPED" && student?.recordId)) {
      openStudentProfileDialog({ documentObject, student });
    }
  });
  documentObject.getElementById("student-next-action-open")?.addEventListener("click", () => {
    const student = studentWorkspaceData?.students.find((row) => row.recordId === selectedStudentRecordId);
    if (student?.recordId && studentWorkspaceData?.canWrite) openCandidateActivityDialog({ documentObject, entityType: "NEXT_ACTION" });
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
  documentObject.getElementById("profile-school-id")?.addEventListener("change", (event) => {
    const master = (studentWorkspaceData?.schoolMasters || []).find((row) => row.school_id === event.target?.value);
    if (!master) return;
    const school = documentObject.getElementById("profile-school");
    const faculty = documentObject.getElementById("profile-faculty");
    if (school) school.value = master.school_name || "";
    if (faculty && !faculty.value.trim()) faculty.value = master.faculty_name || "";
  });
  documentObject.getElementById("candidate-contact-add")?.addEventListener("click", () => openCandidateActivityDialog({ documentObject, entityType: "EVENT" }));
  documentObject.getElementById("candidate-communication-add")?.addEventListener("click", () => openCandidateActivityDialog({ documentObject, entityType: "EVENT", initialCode: "COMMUNICATION_RECORDED" }));
  documentObject.getElementById("candidate-selection-add")?.addEventListener("click", () => openCandidateActivityDialog({ documentObject, entityType: "SELECTION" }));
  documentObject.getElementById("candidate-action-add")?.addEventListener("click", () => openCandidateActivityDialog({ documentObject, entityType: "NEXT_ACTION" }));
  documentObject.getElementById("activity-entity-type")?.addEventListener("change", () => refreshActivityForm(documentObject));
  documentObject.getElementById("activity-code")?.addEventListener("change", () => refreshActivityForm(documentObject));
  documentObject.getElementById("activity-create-follow-up")?.addEventListener("change", () => refreshActivityForm(documentObject));
  documentObject.getElementById("candidate-activity-cancel")?.addEventListener("click", () => {
    activityConfirmationController?.close?.({ restoreFocus: false });
    documentObject.getElementById("candidate-activity-dialog")?.close?.();
    activityDialogContext = null;
  });
  documentObject.getElementById("candidate-activity-dialog")?.addEventListener("cancel", () => {
    activityConfirmationController?.close?.({ restoreFocus: false });
    activityDialogContext = null;
  });
  activityConfirmationController = createCandidateActivityConfirmationController({
    documentObject,
    onConfirm: (command) => executeCandidateActivitySave({ globalObject, documentObject, command })
  });
  documentObject.getElementById("candidate-activity-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCandidateActivity({ documentObject });
  });
  documentObject.getElementById("fair-master-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); saveRecruitmentMaster({ globalObject, documentObject, entityType: "FAIR" });
  });
  documentObject.getElementById("school-master-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); saveRecruitmentMaster({ globalObject, documentObject, entityType: "SCHOOL" });
  });
  documentObject.getElementById("fair-master-reset")?.addEventListener("click", () => resetRecruitmentMasterForm(documentObject, "FAIR"));
  documentObject.getElementById("school-master-reset")?.addEventListener("click", () => resetRecruitmentMasterForm(documentObject, "SCHOOL"));
  documentObject.getElementById("fair-master-body")?.addEventListener("click", (event) => handleMasterTableAction({ globalObject, documentObject, event, entityType: "FAIR" }));
  documentObject.getElementById("school-master-body")?.addEventListener("click", (event) => handleMasterTableAction({ globalObject, documentObject, event, entityType: "SCHOOL" }));
  documentObject.getElementById("fair-detail-close")?.addEventListener("click", () => {
    const panel = documentObject.getElementById("fair-detail-panel");
    if (panel) panel.hidden = true;
  });
  documentObject.getElementById("candidate-activity-deactivate")?.addEventListener("click", () => {
    deactivateCandidateActivity({ globalObject, documentObject });
  });
  documentObject.getElementById("student-profile-deactivate")?.addEventListener("click", async () => {
    const reason = documentObject.getElementById("profile-change-reason")?.value?.trim();
    if (!profileDialogStudent?.recordId || !reason || !globalObject.confirm?.("この学生を無効化しますか？履歴から復元できます。")) return;
    const client = createStagingCandidateClient({ globalObject });
    const result = await client?.deactivate(profileDialogStudent.recordId, { expectedVersion: profileDialogStudent.profileVersion, reason });
    if (!result?.ok) return setProfileStatus(documentObject, result?.category === "version_conflict" ? "他の更新があります。再読み込みしてください" : "無効化できませんでした", "stopped");
    documentObject.getElementById("student-profile-dialog")?.close?.();
    profileDialogStudent = null; studentWorkspaceData = null;
    await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
  });
  if (!shouldUseWorkspaceSummary(globalObject)) {
    documentObject.getElementById("summary-load-button")?.addEventListener("click", () => {
      loadTalentStudentWorkspace({ globalObject, documentObject });
    });
  }
  globalObject?.addEventListener?.("pagehide", () => activeStudentWorkspaceController?.abort?.(), { once: true });
  globalObject?.addEventListener?.("novhub:logout", () => {
    activeStudentWorkspaceController?.abort?.();
    studentWorkspaceData = null;
    selectedStudentRecordId = null;
    historicalReviewController = null;
  });
  return Object.freeze({ initialized: true });
}

export function loadTalentStudentWorkspace(options = {}) {
  if (activeStudentWorkspacePromise && options.force !== true) return activeStudentWorkspacePromise;
  const promise = performTalentStudentWorkspaceLoad(options);
  activeStudentWorkspacePromise = promise;
  promise.finally(() => {
    if (activeStudentWorkspacePromise === promise) activeStudentWorkspacePromise = null;
  });
  return promise;
}

async function performTalentStudentWorkspaceLoad({
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
    status.textContent = runtimeMode(globalObject) === "staging" ? "学生を読み込んでいます" : "確認用学生を読み込んでいます";
  }
  renderMockRuntimeState(documentObject, "loading");
  if (reload) {
    reload.disabled = true;
    reload.setAttribute("aria-busy", "true");
  }

  const generation = ++studentWorkspaceGeneration;
  const AbortControllerClass = globalObject.AbortController || globalThis.AbortController;
  const controller = new AbortControllerClass();
  activeStudentWorkspaceController?.abort?.();
  activeStudentWorkspaceController = controller;
  const executor = createTalentWorkspaceExecutor({ globalObject });
  const coverageExecutor = createSelectionCoverageExecutor({ globalObject });
  const coveragePromise = coverageExecutor ? coverageExecutor.run() : Promise.resolve(null);
  const dailyWorkflowPromise = createStagingCandidateClient({ globalObject })?.dailyWorkflow?.() || Promise.resolve(null);
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
    handleNovHubSessionAuthFailure(result?.httpStatus);
    const presentation = renderMockRuntimeState(documentObject, result?.stopCategory);
    const message = presentation.title;
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
  renderWorkspaceDashboardSummary(documentObject, result.data);
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
  const renderResult = runTalentWorkspaceRenderPipeline({
    logger: globalObject.console,
    stages: [
      { name: "renderStudentMonthFilterOptions", render: () => renderStudentMonthFilterOptions(documentObject, result.data.students) },
      { name: "renderStudentWorkspace", render: () => renderStudentWorkspace(documentObject) },
      { name: "renderImportOverview", render: () => renderImportOverview(documentObject, result.data) },
      { name: "renderHistoricalReviewSummary", render: () => renderHistoricalReviewSummary(documentObject, result.data.overview) },
      { name: "renderBulkTriageSummary", render: () => renderBulkTriageSummary(documentObject, result.data.students) },
      { name: "renderTalentTodayDashboard", render: () => renderTalentTodayDashboard(documentObject, graduationYearWorkspace(result.data)) },
      { name: "renderSelectionFactCoverage", render: () => renderSelectionFactCoverage(documentObject, result.data, null) },
      { name: "renderTalentAnalytics", render: () => renderTalentAnalytics(documentObject) },
      { name: "renderRecruitmentMasters", render: () => renderRecruitmentMasters(documentObject) },
      { name: "renderTodayTasks", render: () => renderTodayTasks(documentObject, graduationYearWorkspace(result.data).todayTasks || []) },
      { name: "renderUnlinkedInterviews", render: () => renderUnlinkedInterviews(
        documentObject,
        result.data.unlinkedSelectionHistory || [],
        globalObject,
        !new Set(result.data.partialStatus?.unavailableViews || []).has("source_facts")
      ) }
    ]
  });
  if (!renderResult.ok) {
    studentWorkspaceData = null;
    renderCandidateWorkspaceFailure(documentObject);
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = CANDIDATE_RENDER_FAILURE_MESSAGE;
    }
    return Object.freeze({
      executed: false,
      studentRowsReturned: false,
      stopCategory: "candidate_render_failed",
      failedRenderStage: renderResult.failedStage,
      requestCount: result.requestCount,
      retryCount: result.retryCount
    });
  }
  void coveragePromise.then((coverageResult) => {
    if (generation !== studentWorkspaceGeneration || controller.signal.aborted) return;
    renderSelectionFactCoverage(documentObject, result.data, coverageResult?.okBoolean === true ? coverageResult.data : null);
  }).catch(() => {
    if (generation !== studentWorkspaceGeneration || controller.signal.aborted) return;
    renderSelectionFactCoverage(documentObject, result.data, null);
  });
  void dailyWorkflowPromise.then((dailyResult) => {
    if (generation !== studentWorkspaceGeneration || controller.signal.aborted) return;
    dailyWorkflowData = dailyResult?.ok === true ? dailyResult.data : { sourceCoverageState: "PREPARING", communications: [], nextActions: [], assignees: [] };
    renderStudentWorkspace(documentObject);
    renderDailyWorkflowQueue(documentObject, dailyWorkflowData);
  }).catch(() => {
    dailyWorkflowData = { sourceCoverageState: "PREPARING", communications: [], nextActions: [], assignees: [] };
    renderDailyWorkflowQueue(documentObject, dailyWorkflowData);
  });
  renderMockRuntimeState(documentObject, result.data.students.length ? "ready" : "empty");
  if (runtimeMode(globalObject) === "staging") {
    setStatus(documentObject, "ready", "運用データを表示中");
  }
  if (status) {
    status.dataset.state = "ready";
    status.textContent = `${result.data.students.length}件の${runtimeMode(globalObject) === "staging" ? "" : "確認用"}学生を表示`;
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
  activeStudentWorkspacePromise = null;
  selectedStudentRecordId = null;
  historicalReviewController = null;
  activeHistoricalReviewStudent = null;
  profileDialogStudent = null;
  pendingSelectedApplicationNo = null;
  selectedGraduationYear = "ALL";
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
  const contactShortageRelease = unmapped.filter(isContactShortageQuarantineReleaseCandidate).length;
  return Object.freeze({
    exact1,
    newApplicant,
    contactShortageRelease,
    ambiguous,
    hold: Math.max(0, unmapped.length - exact1 - ambiguous - newApplicant - contactShortageRelease)
  });
}

export function buildReviewWorkloadGuide(students) {
  const counts = buildBulkTriageCounts(students);
  const bulk = counts.exact1;
  const individual = counts.newApplicant + counts.contactShortageRelease;
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
    contactShortageRelease: counts.contactShortageRelease,
    bulkCopy: bulk > 0
      ? "一致候補だけを一括反映できます。新規・曖昧行は混ぜません。"
      : "一括反映できる一致候補はありません。",
    individualCopy: individual > 0
      ? "新規候補と、連絡先未取得だけで止まっていた接触行は個別確認で判断します。"
      : "個別確認で新規判断する候補はありません。",
    quarantineCopy: quarantine > 0
      ? "曖昧・保留は隔離維持し、補足と次回対応で追跡します。"
      : "隔離維持が必要な未解決候補はありません。"
  });
}

export function buildReviewWorkloadSteps(guide) {
  const normalized = guide && typeof guide === "object" ? guide : buildReviewWorkloadGuide([]);
  const steps = [
    {
      category: "BULK_MATCH_ONLY",
      count: Number(normalized.bulk || 0),
      label: "自動一致だけを一括反映"
    },
    {
      category: "INDIVIDUAL_REVIEW",
      count: Number(normalized.individual || 0),
      label: "新規候補を1件ずつ確認"
    },
    {
      category: "KEEP_QUARANTINED",
      count: Number(normalized.quarantine || 0),
      label: "曖昧・保留は隔離のまま補足"
    }
  ];
  return Object.freeze(steps.map((step, index) => Object.freeze({
    order: index + 1,
    category: step.category,
    countCategory: step.count === 0 ? "ZERO" : step.count === 1 ? "ONE" : "MULTIPLE",
    isCurrent: normalized.nextAction === step.category,
    label: step.label
  })));
}

export function buildReviewWorkloadApprovalGuide(guide) {
  const normalized = guide && typeof guide === "object" ? guide : buildReviewWorkloadGuide([]);
  const category = normalized.nextAction === "BULK_MATCH_ONLY"
    ? "BULK_APPROVAL_READY"
    : normalized.nextAction === "INDIVIDUAL_REVIEW"
      ? "INDIVIDUAL_REVIEW_REQUIRED"
      : normalized.nextAction === "KEEP_QUARANTINED"
        ? "QUARANTINE_REVIEW_REQUIRED"
        : "NO_REVIEW_WORK";
  const title = {
    BULK_APPROVAL_READY: "一括反映の承認候補があります",
    INDIVIDUAL_REVIEW_REQUIRED: "個別確認を先に進めます",
    QUARANTINE_REVIEW_REQUIRED: "隔離維持の理由を整えます",
    NO_REVIEW_WORK: "確認待ちはありません"
  }[category];
  const copy = {
    BULK_APPROVAL_READY: "一致候補だけを対象にできます。新規候補・曖昧行・隔離は混ぜず、別承認までcanonical/LINE履歴へは書き込みません。",
    INDIVIDUAL_REVIEW_REQUIRED: "新規候補は1件ずつ確認します。一括反映には含めず、判断を残してから次へ進みます。",
    QUARANTINE_REVIEW_REQUIRED: "曖昧・保留は昇格せず隔離を維持します。補足と次回確認のカテゴリだけを整理します。",
    NO_REVIEW_WORK: "未処理の確認対象はありません。必要に応じて確認済み・隔離の一覧を見直します。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    approvalReachable: category === "BULK_APPROVAL_READY",
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildReviewWorkloadApprovalSteps(approvalGuide) {
  const category = String(approvalGuide?.category || "NO_REVIEW_WORK");
  const stepsByCategory = {
    BULK_APPROVAL_READY: [
      ["EXACT_MATCH_ONLY", "一括対象は一致候補だけに限定"],
      ["SEPARATE_UNMAPPED_WORK", "新規・曖昧・隔離は個別確認へ残す"],
      ["NO_PROMOTION", "別承認までcanonical・LINE履歴へ進めない"]
    ],
    INDIVIDUAL_REVIEW_REQUIRED: [
      ["OPEN_ONE_RECORD", "候補を1件ずつ開いて確認"],
      ["RECORD_DECISION", "新規作成・紐付け・隔離維持を記録"],
      ["KEEP_OUT_OF_BULK", "一括反映には混ぜない"]
    ],
    QUARANTINE_REVIEW_REQUIRED: [
      ["KEEP_QUARANTINED", "判断不能行は隔離のまま保持"],
      ["ADD_FOLLOWUP_REASON", "不足理由と次回確認だけを残す"],
      ["NO_AUTOMATIC_MAPPING", "自動紐付けは行わない"]
    ],
    NO_REVIEW_WORK: [
      ["CHECK_COUNTS", "件数カテゴリだけを確認"],
      ["NO_ACTION_REQUIRED", "未処理がなければ操作しない"],
      ["KEEP_BOUNDARY", "昇格は別承認まで到達不可"]
    ]
  };
  const selected = stepsByCategory[category] || stepsByCategory.NO_REVIEW_WORK;
  return Object.freeze({
    category,
    steps: Object.freeze(selected.map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    }))),
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildReviewWorkloadCompletionSummary(guide) {
  const normalized = guide && typeof guide === "object" ? guide : buildReviewWorkloadGuide([]);
  const bulk = Number(normalized.bulk || 0);
  const individual = Number(normalized.individual || 0);
  const quarantine = Number(normalized.quarantine || 0);
  const category = bulk > 0
    ? "BULK_REVIEW_READY"
    : individual > 0
      ? "INDIVIDUAL_REVIEW_REMAINS"
      : quarantine > 0
        ? "QUARANTINE_REVIEW_REMAINS"
        : "REVIEW_CLOSED";
  const title = {
    BULK_REVIEW_READY: "一括反映前の完了条件を確認します",
    INDIVIDUAL_REVIEW_REMAINS: "個別確認の残りがあります",
    QUARANTINE_REVIEW_REMAINS: "隔離維持の確認が残っています",
    REVIEW_CLOSED: "レビュー完了待ちはありません"
  }[category];
  const copy = {
    BULK_REVIEW_READY: "一括対象・個別対象・隔離対象を混ぜず、承認前に件数カテゴリだけを読み合わせます。",
    INDIVIDUAL_REVIEW_REMAINS: "新規候補や手動紐付け候補を1件ずつ確認してから、次の承認へ進めます。",
    QUARANTINE_REVIEW_REMAINS: "隔離維持は自動昇格せず、理由と次回確認だけを残す前提で扱います。",
    REVIEW_CLOSED: "一括反映・個別確認・隔離維持の残りはありません。"
  }[category];
  const countCategory = (value) => value === 0 ? "ZERO" : value === 1 ? "ONE" : "MULTIPLE";
  return Object.freeze({
    category,
    title,
    copy,
    metrics: Object.freeze([
      Object.freeze({ category: "BULK_REVIEW", label: "一括反映候補", countCategory: countCategory(bulk) }),
      Object.freeze({ category: "INDIVIDUAL_REVIEW", label: "個別確認", countCategory: countCategory(individual) }),
      Object.freeze({ category: "QUARANTINE_REVIEW", label: "隔離維持", countCategory: countCategory(quarantine) })
    ]),
    approvalReachable: category === "BULK_REVIEW_READY",
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function isNewApplicantCandidate(student) {
  return Boolean(student)
    && student.mappingStatus === "UNMAPPED"
    && ["ENTRIES_27", "OFFERS_27"].includes(student.sourceCode)
    && student.suggestionCategory === "NONE";
}

function normalizeReasonCodes(student) {
  const raw = [
    student?.reasonCodes,
    student?.reason_codes,
    student?.reasonCode,
    student?.reason_code
  ].flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(/[,\s]+/u);
    return [];
  });
  return raw.map((value) => String(value || "").trim()).filter(Boolean);
}

function hasStudentContactHint(student) {
  return [
    student?.phone,
    student?.email,
    student?.lineName,
    student?.lineDisplayName,
    student?.line_display_name
  ].some((value) => String(value || "").trim().length > 0);
}

export function isContactShortageQuarantineReleaseCandidate(student) {
  if (!student || student.mappingStatus !== "UNMAPPED") return false;
  if (student.sourceCode !== "CONTACTS_27" || student.suggestionCategory !== "NONE") return false;
  if (hasStudentContactHint(student)) return false;
  const reasons = normalizeReasonCodes(student);
  return reasons.includes("SOURCE_KEY_UNPROVEN")
    || reasons.includes("CONTACT_CHANNEL_MISSING")
    || reasons.includes("MISSING_CONTACT_CHANNEL")
    || reasons.includes("CONTACTLESS_TOUCHPOINT");
}

function renderBulkTriageSummary(documentObject, students) {
  const counts = buildBulkTriageCounts(students);
  setText(documentObject, "triage-exact1", counts.exact1);
  setText(documentObject, "triage-new", counts.newApplicant + counts.contactShortageRelease);
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
  const approvalGuide = buildReviewWorkloadApprovalGuide(guide);
  const approval = documentObject.getElementById("review-workload-approval-guide");
  if (approval) {
    approval.dataset.category = approvalGuide.category;
    approval.textContent = `${approvalGuide.title}: ${approvalGuide.copy}`;
  }
  const approvalSteps = documentObject.getElementById("review-workload-approval-steps");
  if (approvalSteps) {
    const steps = buildReviewWorkloadApprovalSteps(approvalGuide);
    approvalSteps.dataset.category = steps.category;
    approvalSteps.replaceChildren(...steps.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
  }
  const completion = buildReviewWorkloadCompletionSummary(guide);
  const completionPanel = documentObject.getElementById("review-workload-completion-summary");
  if (completionPanel) completionPanel.dataset.category = completion.category;
  setText(documentObject, "review-workload-completion-title", completion.title);
  setText(documentObject, "review-workload-completion-copy", completion.copy);
  const completionMetrics = documentObject.getElementById("review-workload-completion-metrics");
  if (completionMetrics) {
    completionMetrics.replaceChildren(...completion.metrics.map((metric) => {
      const item = documentObject.createElement("div");
      const term = documentObject.createElement("dt");
      const description = documentObject.createElement("dd");
      item.dataset.category = metric.category;
      term.textContent = metric.label;
      description.textContent = formatSafeCategoryLabel(metric.countCategory);
      item.append(term, description);
      return item;
    }));
  }
  const stepList = documentObject.getElementById("review-workload-steps");
  if (stepList) {
    stepList.replaceChildren(...buildReviewWorkloadSteps(guide).map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.dataset.countCategory = step.countCategory;
      if (step.isCurrent) item.dataset.current = "true";
      item.textContent = `${step.order}. ${step.label} / ${formatSafeCategoryLabel(step.countCategory)}`;
      return item;
    }));
  }
}

export function buildStudentReviewModeCopy(mode) {
  const normalized = mode === "SINGLE_STUDENT" ? "SINGLE_STUDENT" : "BULK_MATCH_ONLY";
  return Object.freeze({
    mode: normalized,
    title: {
      BULK_MATCH_ONLY: "一括反映は一致候補だけに限定します",
      SINGLE_STUDENT: "この学生だけを個別確認します"
    }[normalized],
    copy: {
      BULK_MATCH_ONLY: "新規候補・曖昧行・隔離行は含めず、個別確認に残します。",
      SINGLE_STUDENT: "一括反映とは別に、選択中の候補と紐付け先だけを確認します。"
    }[normalized]
  });
}

function renderStudentReviewMode(documentObject, mode) {
  const copy = buildStudentReviewModeCopy(mode);
  const note = documentObject.getElementById("student-review-mode-note");
  if (note) note.dataset.mode = copy.mode;
  setText(documentObject, "student-review-mode-title", copy.title);
  setText(documentObject, "student-review-mode-copy", copy.copy);
}

function openHistoricalReviewDialog({ globalObject, documentObject }) {
  if (!studentWorkspaceData) return;
  const proposal = buildMatchOnlyReviewProposal(studentWorkspaceData);
  if (proposal.linkPairs.length === 0) return;
  activeHistoricalReviewProposal = proposal;
  activeHistoricalReviewStudent = null;
  setManualReviewTargetOptions(documentObject, []);
  renderStudentReviewMode(documentObject, "BULK_MATCH_ONLY");
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
  renderStudentReviewMode(documentObject, "SINGLE_STUDENT");
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

export function buildImportOverviewViewModel(data) {
  const overview = data?.overview || {};
  const availability = data?.dashboard?.availability || {};
  const unavailable = new Set(data?.partialStatus?.unavailableViews || []);
  const preparing = "集計準備中";
  const sourceFactsReady = !unavailable.has("source_facts");
  const contactsReady = availability.eventCount === true && !unavailable.has("recruitment_events");
  const entriesReady = availability.entries === true && !unavailable.has("selection_history");
  const offersReady = availability.offers === true && !unavailable.has("selection_history");
  const count = (value) => Number.isInteger(value) && value >= 0 ? value : 0;
  return Object.freeze({ sourceFactsReady, values: Object.freeze({
    "import-total": overview.total,
    "import-review": sourceFactsReady ? overview.ownerReview : preparing,
    "import-quarantine": overview.quarantined,
    "import-mapped": overview.mapped,
    "student-total": overview.total,
    "student-contacts": contactsReady ? overview.contacts : preparing,
    "student-entries": entriesReady ? overview.entries : preparing,
    "student-offers": offersReady ? overview.offers : preparing,
    "student-manual": sourceFactsReady ? overview.manual : preparing,
    "student-owner-review": sourceFactsReady ? overview.ownerReview : preparing,
    "student-quarantine": overview.quarantined,
    "student-importable": overview.mapped,
    "student-needs-review": sourceFactsReady ? count(overview.ownerReview) + count(overview.quarantined) : preparing
  }) });
}

function renderImportOverview(documentObject, data) {
  const view = buildImportOverviewViewModel(data);
  Object.entries(view.values).forEach(([id, value]) => {
    const element = documentObject?.getElementById?.(id);
    if (element) element.textContent = String(value);
  });
  for (const id of ["student-review-open", "review-workload-open"]) {
    const control = documentObject?.getElementById?.(id);
    if (!control) continue;
    control.disabled = !view.sourceFactsReady;
    control.setAttribute("aria-disabled", String(!view.sourceFactsReady));
    control.title = view.sourceFactsReady ? "" : "要確認データを集計準備中です";
  }
  const status = documentObject?.getElementById?.("import-overview-status");
  if (status) status.textContent = view.sourceFactsReady
    ? "27卒・28卒のStaging Candidate Dataset（read-only）"
    : "一部の要確認指標は集計準備中です";
}

function renderTalentAnalytics(documentObject) {
  if (!studentWorkspaceData) return;
  const workspace = graduationYearWorkspace(studentWorkspaceData);
  const analytics = buildTalentAnalytics(workspace);
  const decision = buildRecruitmentDashboardDecision(workspace, workspace.todayTasks);
  renderRecruitmentDecision(documentObject, decision);
  renderMetricCollection(documentObject, "historical-summary-metrics", decision.metrics);
  renderSummaryFollowUpCounts(documentObject, workspace.students);
  renderAnalyticsCoverage(documentObject, analytics, workspace);
  const actionGuide = buildTalentAnalyticsActionGuide(analytics);
  renderTalentAnalyticsActionGuide(documentObject, actionGuide, buildTalentAnalyticsQueueHandoff(actionGuide));
  renderMonthlyFlow(documentObject, analytics.flow, analytics.fairSourceAvailable);
  renderEventRoi(documentObject, buildEventRoiView(workspace));
  renderSchoolAnalysis(documentObject, analytics.schools, analytics.schoolSourceAvailable);
  setText(documentObject, "historical-summary-status", `${workspace.students.length}件を集計`);
  setText(documentObject, "fair-analysis-status", analytics.fairSourceAvailable
    ? `有効Fair ${analytics.flow.length}件`
    : "集計準備中");
  setText(documentObject, "school-analysis-status", analytics.schoolSourceAvailable
    ? `${analytics.schools.length}校を表示`
    : "集計準備中");
}

function renderRecruitmentDecision(documentObject, decision) {
  const panel = documentObject.getElementById("recruitment-decision-summary");
  if (panel) panel.dataset.category = decision.category;
  setText(documentObject, "recruitment-decision-title", decision.title);
  setText(documentObject, "recruitment-decision-copy", decision.copy);
}

function renderEventRoi(documentObject, roi) {
  const panel = documentObject.getElementById("event-roi-panel");
  if (panel) panel.dataset.category = roi.category;
  setText(documentObject, "event-roi-title", roi.title);
  setText(documentObject, "event-roi-copy", roi.copy);
  renderMetricCollection(documentObject, "event-roi-metrics", roi.metrics);
}

function renderMockRuntimeState(documentObject, state) {
  const presentation = buildMockRuntimePresentation(state);
  const panel = documentObject?.getElementById?.("mock-runtime-state");
  if (panel) {
    panel.hidden = presentation.state === "ready";
    panel.dataset.state = presentation.state;
    panel.dataset.category = presentation.category;
  }
  setText(documentObject, "mock-runtime-state-title", presentation.title);
  setText(documentObject, "mock-runtime-state-copy", presentation.copy);
  return presentation;
}

function renderTalentAnalyticsActionGuide(documentObject, guide, queueHandoff = buildTalentAnalyticsQueueHandoff(guide)) {
  const panel = documentObject.getElementById("talent-analytics-action-guide");
  if (panel) {
    panel.dataset.category = guide.category;
    panel.dataset.needsActionCategory = guide.needsActionCategory;
    panel.dataset.lineRegistrationRateCategory = guide.lineRegistrationRateCategory;
    panel.dataset.schoolMissingCategory = guide.schoolMissingCategory;
    panel.dataset.queueHandoffCategory = queueHandoff.category;
    panel.dataset.queueFilterCategory = queueHandoff.queueFilterCategory;
    panel.dataset.queueSortCategory = queueHandoff.sortCategory;
  }
  setText(documentObject, "talent-analytics-action-title", guide.title);
  setText(documentObject, "talent-analytics-action-copy", guide.copy);
  const steps = documentObject.getElementById("talent-analytics-action-steps");
  if (!steps) return;
  steps.dataset.category = guide.category;
  steps.replaceChildren(...guide.steps.map((step) => {
    const item = documentObject.createElement("li");
    item.dataset.category = step.category;
    item.textContent = `${step.order}. ${step.label}`;
    return item;
  }));
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

function renderAnalyticsCoverage(documentObject, analytics, workspace) {
  const fairSummary = analytics.fairSourceAvailable
    ? summarizeActiveFairMasters(workspace?.fairMasters || [])
    : null;
  const preparing = "集計準備中";
  setText(documentObject, "fair-active-count", fairSummary ? fairSummary.activeCount : preparing);
  setText(documentObject, "fair-contact-count", fairSummary ? fairCountLabel(fairSummary.contactCount) : preparing);
  setText(documentObject, "fair-line-count", fairSummary ? fairCountLabel(fairSummary.lineRegistrationCount) : preparing);
  setText(documentObject, "fair-tour-count", fairSummary ? fairCountLabel(fairSummary.salonTourCount) : preparing);
  setText(documentObject, "fair-fee-total", fairSummary?.participationFeeComplete ? fairCurrencyLabel(fairSummary.participationFee) : preparing);
  setText(documentObject, "fair-contact-coverage", fairSummary ? fairCoverageLabel(fairSummary.contactRegisteredCount, fairSummary.activeCount) : preparing);
  setText(documentObject, "fair-line-coverage", fairSummary ? fairCoverageLabel(fairSummary.lineRegistrationRegisteredCount, fairSummary.activeCount) : preparing);
  setText(documentObject, "fair-tour-coverage", fairSummary ? fairCoverageLabel(fairSummary.salonTourRegisteredCount, fairSummary.activeCount) : preparing);
  setText(documentObject, "fair-fee-coverage", fairSummary ? fairCoverageLabel(fairSummary.participationFeeRegisteredCount, fairSummary.activeCount) : preparing);
  setText(documentObject, "fair-contact-cost", fairSummary
    ? fairContactCostLabel(
      fairSummary.participationFeeComplete ? fairSummary.participationFee : null,
      fairSummary.contactComplete ? fairSummary.contactCount : null
    )
    : preparing);
  setText(documentObject, "fair-line-rate", fairSummary?.lineRegistrationComplete && fairSummary.contactComplete ? fairRateLabel(fairSummary.lineRegistrationCount, fairSummary.contactCount) : preparing);
  setText(documentObject, "fair-tour-rate", fairSummary?.salonTourComplete && fairSummary.contactComplete ? fairRateLabel(fairSummary.salonTourCount, fairSummary.contactCount) : preparing);
  setText(documentObject, "fair-month-count", analytics.fairSourceAvailable ? analytics.coverage.monthCount : preparing);
  setText(documentObject, "school-count", analytics.schoolSourceAvailable ? analytics.schools.length : preparing);
  setText(documentObject, "school-registered-count", analytics.schoolSourceAvailable ? analytics.schools.length : preparing);
  setText(documentObject, "school-missing-count", analytics.schoolSourceAvailable ? analytics.coverage.schoolMissing : preparing);
  const topSchool = analytics.schools.find((row) => Number.isInteger(row?.contacts) && row.contacts > 0);
  const schoolContactsPreparing = !analytics.schoolSourceAvailable
    || analytics.schools.some((row) => row?.contacts === null);
  setText(documentObject, "school-top-name", topSchool?.school
    || (schoolContactsPreparing ? "集計準備中" : "接触実績なし"));
  const latestMonth = analytics.flow[0];
  const latestButton = documentObject.getElementById("fair-latest-month-open");
  if (latestButton) {
    const candidateLinkReady = Boolean(latestMonth?.key && latestMonth?.candidateLinkReady === true);
    latestButton.disabled = !candidateLinkReady;
    latestButton.dataset.monthKey = candidateLinkReady ? latestMonth.key : "";
    latestButton.textContent = latestMonth?.label
      ? candidateLinkReady ? `${latestMonth.label}を見る` : `${latestMonth.label}（起点確認待ち）`
      : "最新月を見る";
  }
  const schoolButton = documentObject.getElementById("school-top-open");
  if (schoolButton) {
    schoolButton.disabled = !topSchool?.school;
    schoolButton.dataset.schoolName = topSchool?.school || "";
  }
}

export function buildAnalyticsListState({ sourceAvailable = true, count = 0, unit = "件", emptyText = "表示できるデータがありません。" } = {}) {
  if (!sourceAvailable) return Object.freeze({
    countLabel: "集計準備中", emptyText: "集計準備中", controlsDisabled: true, showEmpty: true
  });
  return Object.freeze({
    countLabel: `${count}${unit}`, emptyText, controlsDisabled: false, showEmpty: count === 0
  });
}

function renderMonthlyFlow(documentObject, rows, sourceAvailable = true) {
  const body = documentObject.getElementById("fair-flow-body");
  const empty = documentObject.getElementById("fair-flow-empty");
  if (!body) return;
  const visible = sourceAvailable ? rows.slice(0, 18) : [];
  const state = buildAnalyticsListState({
    sourceAvailable,
    count: visible.length,
    emptyText: "表示できる有効フェアがありません。"
  });
  body.replaceChildren(...visible.map((row) => createMonthlyFlowRow(documentObject, row)));
  if (empty) { empty.textContent = state.emptyText; empty.hidden = !state.showEmpty; }
}

function createMonthlyFlowRow(documentObject, flow) {
  const row = createAnalysisRow(documentObject, [
    flow.label,
    fairCountLabel(flow.contacts),
    fairCountLabel(flow.lineRegistrations),
    flow.entries === null ? "集計準備中" : fairCountLabel(flow.entries),
    flow.offers === null ? "集計準備中" : fairCountLabel(flow.offers),
    flow.needsAction === null ? "集計準備中" : flow.needsAction
  ]);
  const action = documentObject.createElement("td");
  const button = documentObject.createElement("button");
  button.type = "button";
  button.className = "analysis-followup-button";
  const candidateLinkReady = Boolean(flow.key && flow.candidateLinkReady === true);
  button.disabled = !candidateLinkReady;
  button.textContent = candidateLinkReady ? "対象月を見る" : "起点確認待ち";
  button.setAttribute("aria-label", candidateLinkReady
    ? `${flow.label}の学生フォローを表示`
    : `${flow.label}は学生とのきっかけ確認待ち`);
  if (candidateLinkReady) {
    button.addEventListener("click", () => openStudentWorkspace(documentObject, buildMonthlyFollowUpFilter(flow.key)));
  }
  action.append(button);
  row.append(action);
  return row;
}

function renderSchoolAnalysis(documentObject, rows, sourceAvailable = true) {
  const query = normalizeSearch(documentObject.getElementById("school-search")?.value);
  const sort = documentObject.getElementById("school-sort")?.value || "contacts";
  const sorted = (sourceAvailable ? rows : [])
    .filter((row) => !query || normalizeSearch(row.school).includes(query))
    .sort((left, right) => (
      Number(right[sort] || 0) - Number(left[sort] || 0)
      || right.contacts - left.contacts
      || left.school.localeCompare(right.school, "ja")
    ));
  const body = documentObject.getElementById("school-analysis-body");
  const empty = documentObject.getElementById("school-analysis-empty");
  const count = documentObject.getElementById("school-result-count");
  const state = buildAnalyticsListState({
    sourceAvailable,
    count: sorted.length,
    unit: "校",
    emptyText: "条件に一致する学校がありません。"
  });
  if (count) count.textContent = state.countLabel;
  for (const id of ["school-search", "school-sort"]) {
    const control = documentObject.getElementById(id);
    if (control) { control.disabled = state.controlsDisabled; control.setAttribute?.("aria-disabled", String(state.controlsDisabled)); }
  }
  if (body) {
    body.replaceChildren(...sorted.slice(0, 100).map((row) => createSchoolAnalysisRow(documentObject, row)));
  }
  if (empty) { empty.textContent = state.emptyText; empty.hidden = !state.showEmpty; }
}

function createSchoolAnalysisRow(documentObject, school) {
  const row = createAnalysisRow(documentObject, [
    school.school,
    school.contacts === null ? "集計準備中" : school.contacts,
    school.lineRegistrations === null ? "集計準備中" : school.lineRegistrations,
    school.entries === null ? "集計準備中" : school.entries,
    school.offers === null ? "集計準備中" : school.offers,
    school.entryRate === null ? "集計準備中" : `${school.entryRate}%`,
    school.offerRate === null ? "集計準備中" : `${school.offerRate}%`,
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
  activeStudentFactFilter = filter.factSource && filter.factCode
    ? Object.freeze({ factSource: filter.factSource, factCode: filter.factCode })
    : null;
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

const TALENT_PROGRESS_CODES = Object.freeze(Object.keys(CANDIDATE_STATUS_LABELS));

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
    contacts: { factSource: "EVENT", factCode: "CONTACT_RECORDED" },
    entries: { factSource: "SELECTION", factCode: "APPLICATION_RECEIVED" },
    offers: { factSource: "SELECTION", factCode: "OFFERED" },
    overdueFollowUp: { followUp: "OVERDUE" },
    nextWeekFollowUp: { followUp: "NEXT_7_DAYS" },
    needsAction: { state: "NEEDS_ACTION" }
  };
  const selected = filters[String(key || "")];
  if (!selected) return null;
  return Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "ALL", ...selected });
}

export function buildBulkTriageQueueFilter(key) {
  const filters = {
    newApplicant: { state: "NEW_CANDIDATE" },
    ambiguous: { state: "NEEDS_ACTION" },
    hold: { state: "NEEDS_ACTION" }
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
    CONTACTS_27: "27卒 接触",
    ENTRIES_27: "27卒 エントリー",
    OFFERS_27: "27卒 内定",
    CONTACTS_28: "28卒 接触",
    ENTRIES_28: "28卒 エントリー",
    OFFERS_28: "28卒 内定",
    MANUAL: "手入力"
  }),
  state: Object.freeze({
    OWNER_REVIEW: "要確認",
    QUARANTINE: "隔離",
    IMPORTABLE: "確認済み",
    NEW_CANDIDATE: "個別確認候補",
    NEEDS_ACTION: "要確認・隔離"
  }),
  progress: Object.freeze({ UNSET: "進捗未登録", ...CANDIDATE_STATUS_LABELS }),
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
  if (!displayName || !student.applicationNo || !["OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(student.statusCode)
    || !/^\d{4}-\d{2}-\d{2}$/.test(expectedJoinDate)) return null;
  return Object.freeze({
    procedureType: "ONBOARDING",
    subjectLabel: displayName,
    effectiveDate: expectedJoinDate
  });
}

export function filterTalentStudents(students, { query = "", source = "ALL", state = "ALL", progress = "ALL", month = "ALL", followUp = "ALL", factSource = "", factCode = "" } = {}) {
  const normalizedQuery = normalizeSearch(query);
  return (Array.isArray(students) ? students : []).filter((student) => {
    if (source !== "ALL" && student.sourceCode !== source) return false;
    if (state === "NEW_CANDIDATE") {
      if (!isNewApplicantCandidate(student) && !isContactShortageQuarantineReleaseCandidate(student)) return false;
    } else if (state === "NEEDS_ACTION") {
      if (!["OWNER_REVIEW", "QUARANTINE"].includes(student.classification)) return false;
    } else if (state !== "ALL" && student.classification !== state) {
      return false;
    }
    if (progress !== "ALL" && getTalentStudentProgressKey(student) !== progress) return false;
    if (factSource && factCode) {
      const facts = factSource === "EVENT"
        ? [...(student.contactHistory || []), ...(student.eventHistory || [])]
        : factSource === "SELECTION" ? (student.selectionHistory || []) : [];
      if (!facts.some((fact) => fact?.active !== false && fact?.code === factCode)) return false;
    }
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

export function talentStudentPriorityLabel(student, referenceDate = localTalentDateIso()) {
  return Object.freeze({
    OVERDUE: "高（期限超過）",
    NEXT_7_DAYS: "中（7日以内）",
    SCHEDULED: "通常（予定あり）",
    UNSCHEDULED: "未登録"
  })[classifyTalentStudentFollowUp(student, referenceDate)];
}

export function buildStudentDailyOperation(student, capability = {}, referenceDate = localTalentDateIso()) {
  if (!student) {
    return {
      category: "NO_SELECTION",
      badge: "未選択",
      title: "学生を選択してください",
      copy: "一覧から対象を選ぶと、今日の更新・確認・引継ぎの順番を表示します。",
      steps: ["学生一覧から対象を選択", "状態・対応履歴・次回対応日を確認"]
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

export function buildStudentDailyCompletionChecklist(operation) {
  const category = operation?.category || "NO_SELECTION";
  const plans = Object.freeze({
    NO_SELECTION: Object.freeze({
      title: "学生を選択すると完了条件を表示します",
      copy: "一覧から1名を選択するまで、完了チェックは待機します。",
      steps: Object.freeze([
        "一覧から学生を1名選択する",
        "編集前に確認区分を確かめる",
        "未選択のまま完了記録を残さない"
      ])
    }),
    ONBOARDING_HANDOFF: Object.freeze({
      title: "入社引継ぎの結果を記録します",
      copy: "入社予定日と配属予定を確認し、引継ぎ状態だけを記録します。",
      steps: Object.freeze(["入社予定日と配属予定を確認する", "引継ぎ内容を確認する", "別案件の準備完了後に完了を記録する"])
    }),
    OVERDUE_FOLLOW_UP: Object.freeze({
      title: "期限超過の対応を完了します",
      copy: "担当者と次の予定が分かるよう、次回対応日と記録を残します。",
      steps: Object.freeze(["次回対応日を更新する", "対応メモを残す", "移動前に履歴を確認する"])
    }),
    NEXT_WEEK_FOLLOW_UP: Object.freeze({
      title: "直近のフォロー予定を確認します",
      copy: "元データを変更せず、予定日と現在の状態を最新に保ちます。",
      steps: Object.freeze(["連絡予定日を確認する", "返答が変わった場合だけ状態を更新する", "未解決はフォロー一覧に残す"])
    }),
    OWNER_REVIEW: Object.freeze({
      title: "個別確認の判断を記録します",
      copy: "一括確認・個別確認・隔離維持を混ぜず、1名ずつ判断します。",
      steps: Object.freeze(["この学生の確認区分を選ぶ", "確認・差戻し・保留の結果を記録する", "判断できない場合は隔離を維持する"])
    }),
    QUARANTINE_REVIEW: Object.freeze({
      title: "隔離理由と次の確認を記録します",
      copy: "個人値を広げず、隔離理由と次の安全な対応だけを残します。",
      steps: Object.freeze(["不足・曖昧の理由区分を記録する", "必要なら次回確認日を設定する", "隔離から自動昇格しない"])
    }),
    CANONICAL_PROFILE_UPDATE: Object.freeze({
      title: "プロフィール更新履歴を確認します",
      copy: "編集後に変更履歴を確認してから次の学生へ進みます。",
      steps: Object.freeze(["必要なプロフィール項目を保存する", "業務に影響する変更は履歴を開く", "過去の参照データは変更しない"])
    }),
    STAGING_SUPPLEMENT: Object.freeze({
      title: "補足記録の完了を確認します",
      copy: "別承認まではstaging内に保ち、フォローに必要な補足だけを残します。",
      steps: Object.freeze(["次回対応・メモ・状態の補足だけを保存する", "stagingのままであることを確認する", "紐付け不明なら確認一覧へ戻す"])
    }),
    READ_ONLY: Object.freeze({
      title: "閲覧のみで確認を完了します",
      copy: "直接編集できない行では、確認結果だけを業務上の目印にします。",
      steps: Object.freeze(["閲覧のみの理由を確認する", "必要な変更は確認または隔離へ回す", "自動削除・自動昇格を行わない"])
    })
  });
  const selected = plans[category] || plans.NO_SELECTION;
  return Object.freeze({
    category,
    title: selected.title,
    copy: selected.copy,
    steps: selected.steps,
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildStudentReviewBoundary(student, capability = {}) {
  if (!student) {
    return Object.freeze({
      category: "NO_SELECTION",
      badge: "未選択",
      title: "学生を選択すると整理レーンを表示します",
      copy: "一括反映・個別確認・隔離維持のどこで扱うかを、個人値を出さずに案内します。",
      allowed: "許可: 対象選択後に表示",
      caution: "注意: 自動昇格は行いません"
    });
  }
  if (student.mappingStatus === "OWNER_CONFIRMED") {
    return Object.freeze({
      category: "CONFIRMED_CANONICAL",
      badge: "確認済み",
      title: "確認済みとして日常更新に進めます",
      copy: "候補整理は完了しています。必要な変更は正本プロフィール更新と変更履歴で扱います。",
      allowed: "許可: 正本プロフィール更新",
      caution: "注意: staging原本は変更しません"
    });
  }
  if (student.mappingStatus === "UNMAPPED" && student.suggestionCategory === "EXACT1" && student.suggestedTargetRecordId) {
    return Object.freeze({
      category: "BULK_SAFE_EXACT_LINK",
      badge: "一括対象",
      title: "一致候補として一括反映できます",
      copy: "自動一致が1件に絞られた行です。一括反映に含めても、新規候補や隔離行は混ぜません。",
      allowed: "許可: 一致候補の紐付け確認",
      caution: "除外: 新規・曖昧・隔離は別レーン"
    });
  }
  if (capability.confirmable || isNewApplicantCandidate(student)) {
    return Object.freeze({
      category: "INDIVIDUAL_REVIEW",
      badge: "個別確認",
      title: "この候補だけを個別に判断します",
      copy: "新規候補または個別確認が必要な行です。一括反映へ混ぜず、担当者が1件ずつ確認します。",
      allowed: "許可: この候補だけ確認",
      caution: "注意: 迷う場合は隔離維持"
    });
  }
  if (student.classification === "QUARANTINE") {
    return Object.freeze({
      category: "QUARANTINE_HOLD",
      badge: "隔離維持",
      title: "隔離理由を整理して保留します",
      copy: "正本へ寄せる根拠が足りない行です。補足と次回対応日を残し、勝手に昇格しません。",
      allowed: "許可: 補足・次回対応の記録",
      caution: "禁止: 自動昇格・一括混入"
    });
  }
  if (capability.editable) {
    return Object.freeze({
      category: "STAGING_SUPPLEMENT",
      badge: "補足記録",
      title: "staging補足として整理します",
      copy: "正本未確定のまま、後続確認に必要な補足だけを記録します。",
      allowed: "許可: 補足・状態・次回対応",
      caution: "注意: 正本化は別の確認操作"
    });
  }
  return Object.freeze({
    category: "READ_ONLY",
    badge: "閲覧のみ",
    title: "読み取り専用で確認します",
    copy: "この行は今すぐ編集・確認できません。必要なら要確認・隔離キューで扱います。",
    allowed: "許可: 内容確認",
    caution: "禁止: 削除・自動昇格"
  });
}

export function buildStudentReviewLaneSteps(boundary) {
  const category = boundary?.category || "NO_SELECTION";
  const labelsByCategory = Object.freeze({
    NO_SELECTION: ["学生を選択", "整理レーンを確認", "必要な操作だけ実行"],
    CONFIRMED_CANONICAL: ["正本プロフィールを更新", "変更履歴を確認", "必要なら入社手続きへ引継ぎ"],
    BULK_SAFE_EXACT_LINK: ["一括対象に含める", "新規・隔離を混ぜない", "反映後に確認済みへ進める"],
    INDIVIDUAL_REVIEW: ["候補を1件だけ開く", "紐付け先または新規作成を確認", "迷う場合は隔離維持"],
    QUARANTINE_HOLD: ["隔離理由を確認", "補足と次回対応を記録", "根拠が揃うまで昇格しない"],
    STAGING_SUPPLEMENT: ["補足情報を保存", "次回対応日を設定", "正本化は別承認で扱う"],
    READ_ONLY: ["内容を確認", "要確認・隔離キューで扱う", "削除や自動昇格は行わない"]
  });
  const labels = labelsByCategory[category] || labelsByCategory.NO_SELECTION;
  return Object.freeze({
    category,
    steps: Object.freeze(labels.map((label, index) => Object.freeze({ order: index + 1, label }))),
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildStudentReviewDecisionGuide(boundary) {
  const category = boundary?.category || "NO_SELECTION";
  const guides = Object.freeze({
    NO_SELECTION: {
      label: "判断: 対象選択後に表示",
      record: "記録: 自動保存しません",
      command: "操作: 一覧から学生を選択"
    },
    CONFIRMED_CANONICAL: {
      label: "判断: 日常更新へ進める",
      record: "記録: 正本プロフィールと変更履歴",
      command: "操作: 編集または次回対応を設定"
    },
    BULK_SAFE_EXACT_LINK: {
      label: "判断: 一括反映の対象",
      record: "記録: 一致候補だけを確認済みにする",
      command: "操作: 確認候補を一括反映"
    },
    INDIVIDUAL_REVIEW: {
      label: "判断: 1件ずつ確認",
      record: "記録: 紐付け・新規作成・隔離維持のどれか",
      command: "操作: この候補を確認"
    },
    QUARANTINE_HOLD: {
      label: "判断: 隔離を維持",
      record: "記録: 補足と次回対応日だけ残す",
      command: "操作: 編集または次回対応を設定"
    },
    STAGING_SUPPLEMENT: {
      label: "判断: staging補足として整理",
      record: "記録: 原本を変えず補足だけ保存",
      command: "操作: 編集で補足を更新"
    },
    READ_ONLY: {
      label: "判断: 閲覧のみ",
      record: "記録: この画面からは保存しません",
      command: "操作: 要確認・隔離キューで扱う"
    }
  });
  const selected = guides[category] || guides.NO_SELECTION;
  return Object.freeze({
    category,
    ...selected,
    rawValuesIncluded: false,
    automaticPromotionReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildStudentReviewQueuePriority(boundary) {
  const category = boundary?.category || "NO_SELECTION";
  const priorities = Object.freeze({
    BULK_SAFE_EXACT_LINK: Object.freeze({ order: 1, label: "整理順 1: 一括対象", category: "BULK_FIRST" }),
    INDIVIDUAL_REVIEW: Object.freeze({ order: 2, label: "整理順 2: 個別確認", category: "INDIVIDUAL_SECOND" }),
    QUARANTINE_HOLD: Object.freeze({ order: 3, label: "整理順 3: 隔離維持", category: "QUARANTINE_THIRD" }),
    STAGING_SUPPLEMENT: Object.freeze({ order: 4, label: "整理順 4: 補足記録", category: "SUPPLEMENT_FOURTH" }),
    CONFIRMED_CANONICAL: Object.freeze({ order: 5, label: "整理済み", category: "DONE" }),
    READ_ONLY: Object.freeze({ order: 6, label: "閲覧のみ", category: "READ_ONLY" }),
    NO_SELECTION: Object.freeze({ order: 0, label: "未選択", category: "NO_SELECTION" })
  });
  const selected = priorities[category] || priorities.NO_SELECTION;
  return Object.freeze({
    ...selected,
    rawValuesIncluded: false,
    automaticPromotionReachable: false,
    lineHistoryWriteReachable: false
  });
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
  return japanBusinessDateIso();
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
  const cohortStudents = graduationYearWorkspace(studentWorkspaceData).students;
  const query = normalizeSearch(documentObject.getElementById("student-search")?.value);
  const source = documentObject.getElementById("student-source-filter")?.value || "ALL";
  const state = documentObject.getElementById("student-state-filter")?.value || "ALL";
  const progress = documentObject.getElementById("student-progress-filter")?.value || "ALL";
  const month = documentObject.getElementById("student-month-filter")?.value || "ALL";
  const followUp = documentObject.getElementById("student-follow-up-filter")?.value || "ALL";
  const sort = documentObject.getElementById("student-sort-filter")?.value || "DEFAULT";
  const visible = sortTalentStudentsByFollowUp(
    filterTalentStudents(cohortStudents, { query, source, state, progress, month, followUp, ...(activeStudentFactFilter || {}) }),
    sort
  );
  updateStudentQuickFilterState(documentObject, state, cohortStudents);
  updateStudentFilterResetState(documentObject, { query, source, state, progress, month, followUp, sort });
  renderStudentFilterSummary(documentObject, buildStudentFilterSummary({ query, source, state, progress, month, followUp, sort }));
  const dailyQueueSummary = buildStudentDailyQueueSummary(cohortStudents);
  renderStudentDailyQueueSummary(documentObject, dailyQueueSummary);
  renderStudentDailyQueueStartGuide(documentObject, buildStudentDailyQueueStartGuide(dailyQueueSummary));
  renderStudentEmptyState(documentObject, {
    total: cohortStudents.length,
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
    cohortStudents.find((student) => student.recordId === selectedStudentRecordId) || null
  );
}

export function normalizeGraduationYearFilter(value) {
  const normalized = String(value || "ALL");
  return ["2027", "2028"].includes(normalized) ? normalized : "ALL";
}

function updateGraduationYearSwitcher(documentObject) {
  const selected = normalizeGraduationYearFilter(selectedGraduationYear);
  for (const button of documentObject.querySelectorAll("[data-graduation-year]")) {
    const active = button.dataset.graduationYear === selected;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  const label = selected === "ALL" ? "すべての卒業年度" : selected === "2027" ? "27卒" : "28卒";
  setText(documentObject, "graduation-year-filter-status", `${label}を表示中`);
  setText(documentObject, "recruitment-summary-title", selected === "ALL" ? "今日、誰に、何をするか" : `${label}の今日やること`);
}

export function graduationYearWorkspace(workspace, graduationYear = selectedGraduationYear) {
  const selected = normalizeGraduationYearFilter(graduationYear);
  if (!workspace || selected === "ALL") return workspace;
  const year = Number(selected);
  const students = (Array.isArray(workspace.students) ? workspace.students : []).filter((student) => Number(student.graduationYear) === year);
  const candidateIds = new Set(students.map((student) => student.recordId).filter(Boolean));
  const fairIds = new Set(students.map((student) => student.fairId).filter(Boolean));
  const schoolIds = new Set(students.map((student) => student.schoolId).filter(Boolean));
  const eventFacts = (student) => [...(student.contactHistory || []), ...(student.eventHistory || [])]
    .filter((item) => item?.active !== false);
  const selectionFacts = (student) => (student.selectionHistory || []).filter((item) => item?.active !== false);
  const hasEvent = (student, code) => eventFacts(student).some((item) => item.code === code);
  const hasSelection = (student, code) => selectionFacts(student).some((item) => item.code === code);
  const countEventCandidates = (code) => students.filter((student) => hasEvent(student, code)).length;
  const countEventRows = (code) => students.reduce((count, student) => (
    count + eventFacts(student).filter((item) => item.code === code).length
  ), 0);
  const countSelectionCandidates = (code) => students.filter((student) => hasSelection(student, code)).length;
  const availability = workspace.dashboard?.availability || {};
  const availableCount = (key, count) => availability[key] === true ? count : 0;
  const today = localTalentDateIso();
  const todayTasks = (Array.isArray(workspace.todayTasks) ? workspace.todayTasks : []).filter((task) => candidateIds.has(task.candidateId));
  const schoolMasters = (Array.isArray(workspace.schoolMasters) ? workspace.schoolMasters : []).filter((master) => (
    master?.is_active !== false && schoolIds.has(master.school_id)
  ));
  const fairMasters = (Array.isArray(workspace.fairMasters) ? workspace.fairMasters : []).filter((master) => master?.is_active !== false && fairIds.has(master.fair_id));
  const contacts = countEventRows("CONTACT_RECORDED");
  const lineRegistrations = countEventCandidates("LINE_REGISTERED");
  const salonTours = countEventCandidates("SALON_TOUR_COMPLETED");
  const interviews = countSelectionCandidates("INTERVIEW_COMPLETED");
  const entries = countSelectionCandidates("APPLICATION_RECEIVED");
  const offers = countSelectionCandidates("OFFERED");
  const selectionHistoryCount = students.reduce((sum, student) => sum + selectionFacts(student).length, 0);
  const eventCount = students.reduce((sum, student) => sum + eventFacts(student).length, 0);
  const undatedActions = students.reduce((sum, student) => sum + (student.nextActions || [])
    .filter((item) => item?.active !== false && !item?.date).length, 0);
  const dashboard = Object.freeze({
    ...(workspace.dashboard || {}),
    availability: Object.freeze({ ...availability, todayActions: false, fairCount: false }),
    candidateCount: students.length,
    graduation2027: year === 2027 ? students.length : 0,
    graduation2028: year === 2028 ? students.length : 0,
    lineRegistrations: availableCount("lineRegistrations", lineRegistrations),
    salonTourPlanned: availableCount("salonTourPlanned", countEventCandidates("SALON_TOUR_PLANNED")),
    salonTourCompleted: availableCount("salonTourCompleted", salonTours),
    interviewPlanned: availableCount("interviewPlanned", students.filter((student) => selectionFacts(student)
      .some((item) => item.code === "INTERVIEW_PLANNED" && item.date >= today)).length),
    interviewHistory: availableCount("interviewHistory", interviews),
    entries: availableCount("entries", entries),
    offers: availableCount("offers", offers),
    offeredElsewhere: availableCount("offeredElsewhere", countSelectionCandidates("OFFERED_ELSEWHERE")),
    withdrawals: availableCount("withdrawals", countSelectionCandidates("WITHDRAWN")),
    rejected: availableCount("rejected", countSelectionCandidates("REJECTED")),
    schoolCount: schoolMasters.length,
    fairCount: fairMasters.length,
    todayActions: 0,
    eventCount: availableCount("eventCount", eventCount),
    selectionHistoryCount,
    undatedActions,
    unlinkedInterviewHistoryCount: 0
  });
  const summary = Object.freeze({
    contacts,
    lineRegistrations,
    salonTours,
    interviews,
    passed: countSelectionCandidates("OFFER_ACCEPTED"),
    offers,
    expectedJoiners: students.filter((student) => student.statusCode === "EXPECTED_JOIN").length
  });
  const overview = Object.freeze({
    ...(workspace.overview || {}),
    total: students.length,
    contacts,
    entries,
    offers,
    mapped: students.filter((student) => ["MAPPED", "OWNER_CONFIRMED"].includes(student.mappingStatus)).length,
    primaryCandidates: students.filter((student) => student.primaryEligible === true).length,
    ownerReview: students.filter((student) => student.classification === "OWNER_REVIEW").length,
    quarantined: students.filter((student) => student.classification === "QUARANTINE").length
  });
  return Object.freeze({ ...workspace, students: Object.freeze(students), todayTasks: Object.freeze(todayTasks), schoolMasters: Object.freeze(schoolMasters), fairMasters: Object.freeze(fairMasters), dashboard, summary, overview });
}

export function buildTalentTodayDashboard(workspace, referenceDate = localTalentDateIso()) {
  const students = Array.isArray(workspace?.students) ? workspace.students : [];
  const today = /^\d{4}-\d{2}-\d{2}$/u.test(referenceDate) ? referenceDate : localTalentDateIso();
  const activeEventRows = (student) => [...(student?.contactHistory || []), ...(student?.eventHistory || [])]
    .filter((row) => row?.active !== false);
  const activeSelectionRows = (student) => (student?.selectionHistory || []).filter((row) => row?.active !== false);
  const eventDatedCode = (student, code, date = today) => activeEventRows(student)
    .some((row) => row.code === code && row.date === date);
  const selectionDatedCode = (student, code, date = today) => activeSelectionRows(student)
    .some((row) => row.code === code && row.date === date);
  const incompleteAction = (row) => row?.active !== false
    && !row?.completedAt
    && !["COMPLETED", "DONE"].includes(String(row?.state || "").toUpperCase());
  const overdueIds = new Set(students.filter((student) => (
    classifyTalentStudentFollowUp(student, today) === "OVERDUE"
    || (student.nextActions || []).some((row) => incompleteAction(row) && /^\d{4}-\d{2}-\d{2}$/u.test(String(row.date || "")) && row.date < today)
  )).map((student) => student.recordId));
  const awaitingContactIds = new Set(students.filter((student) => (
    (student.nextActions || []).some((row) => incompleteAction(row) && (
      ["FOLLOW_UP", "CONTACT", "CONTACT_FOLLOW_UP"].includes(String(row.code || "").toUpperCase())
      || /連絡|フォロー/u.test(String(row.label || ""))
    ))
    || (student.nextActionAt && /連絡|フォロー/u.test(String(student.nextActionLabel || "")))
  )).map((student) => student.recordId));
  const newStudentIds = new Set(students.filter((student) => (
    selectionDatedCode(student, "APPLICATION_RECEIVED")
  )).map((student) => student.recordId));
  const availability = workspace?.dashboard?.availability || {};
  const nextActionsReady = availability.todayActions === true;
  return Object.freeze({
    actions: nextActionsReady && Number.isInteger(workspace?.dashboard?.todayActions)
      ? workspace.dashboard.todayActions
      : null,
    overdue: nextActionsReady ? overdueIds.size : null,
    visits: availability.salonTourPlanned === true ? students.filter((student) => eventDatedCode(student, "SALON_TOUR_PLANNED")).length : null,
    interviews: availability.interviewPlanned === true ? students.filter((student) => selectionDatedCode(student, "INTERVIEW_PLANNED")).length : null,
    awaitingContact: nextActionsReady ? awaitingContactIds.size : null,
    newStudents: availability.entries === true ? newStudentIds.size : null,
    // Workspace Contract v1.0.0 does not expose Candidate created_at/updated_at.
    // Do not synthesize "recent" from unrelated business/event/action dates.
    recentStudents: null,
    referenceDate: today,
    rawValuesIncluded: false
  });
}

function renderTalentTodayDashboard(documentObject, workspace) {
  const viewModel = buildTalentTodayDashboard(workspace);
  const values = {
    "today-dashboard-actions": viewModel.actions,
    "today-dashboard-overdue": viewModel.overdue,
    "today-dashboard-visits": viewModel.visits,
    "today-dashboard-interviews": viewModel.interviews,
    "today-dashboard-awaiting-contact": viewModel.awaitingContact,
    "today-dashboard-new-students": viewModel.newStudents,
    "today-dashboard-recent-students": viewModel.recentStudents
  };
  for (const [id, value] of Object.entries(values)) {
    const element = documentObject?.getElementById?.(id);
    if (!element) continue;
    element.textContent = value === null ? "集計準備中" : `${value}件`;
    element.closest?.("article")?.setAttribute?.("data-state", Number(value || 0) > 0 && ["today-dashboard-actions", "today-dashboard-overdue"].includes(id) ? "attention" : "ready");
  }
  setText(documentObject, "talent-today-dashboard-status", `${viewModel.referenceDate} 現在`);
}

export function buildStudentDailyQueueSummary(students = [], referenceDate = localTalentDateIso()) {
  const rows = Array.isArray(students) ? students : [];
  const counts = rows.reduce((summary, student) => {
    const followUp = classifyTalentStudentFollowUp(student, referenceDate);
    if (followUp === "OVERDUE") summary.overdue += 1;
    if (followUp === "NEXT_7_DAYS") summary.nextWeek += 1;
    if (student?.classification === "OWNER_REVIEW") summary.ownerReview += 1;
    if (student?.classification === "QUARANTINE") summary.quarantine += 1;
    if (["OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(student?.statusCode) || student?.expectedJoinDate) summary.onboardingReady += 1;
    return summary;
  }, { overdue: 0, nextWeek: 0, ownerReview: 0, quarantine: 0, onboardingReady: 0 });

  const category = counts.overdue > 0
    ? "OVERDUE_FIRST"
    : counts.nextWeek > 0
      ? "NEXT_WEEK_FIRST"
      : "STEADY_STATE";
  const copyByCategory = {
    OVERDUE_FIRST: ["期限超過から対応", "対応期限を過ぎた学生を先に開き、次回対応日と状態を更新します。"],
    NEXT_WEEK_FIRST: ["直近7日の予定を確認", "直近対応の学生を一覧化して、今日処理する順番を決めます。"],
    STEADY_STATE: ["通常フォローを継続", "検索・学校別・月別の導線から、次の対象を選びます。"]
  };
  const stepsByCategory = {
    OVERDUE_FIRST: [["OPEN_OVERDUE", "期限超過で絞り込み"], ["UPDATE_NEXT_ACTION", "次回対応日を更新"], ["LEAVE_AUDIT", "対応履歴を残す"]],
    NEXT_WEEK_FIRST: [["OPEN_NEXT_WEEK", "直近7日で絞り込み"], ["SORT_FOLLOW_UP", "対応期限順で確認"], ["SET_OWNER", "担当と状態を整える"]],
    STEADY_STATE: [["OPEN_ALL", "学生一覧を開く"], ["USE_ANALYTICS", "学校・月別分析から対象を選ぶ"], ["KEEP_DAILY_UPDATES", "状態と次回対応を更新"]]
  };

  return Object.freeze({
    category,
    title: copyByCategory[category][0],
    copy: copyByCategory[category][1],
    counts: Object.freeze(counts),
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false,
    steps: Object.freeze(stepsByCategory[category].map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    })))
  });
}

export function buildStudentDailyQueueStartGuide(summary = {}) {
  const counts = summary?.counts || {};
  const hasOverdue = Number(counts.overdue || 0) > 0;
  const hasNextWeek = Number(counts.nextWeek || 0) > 0;
  const category = hasOverdue
    ? "START_OVERDUE_FILTER"
    : hasNextWeek
      ? "START_NEXT_WEEK_FILTER"
      : "START_STEADY_LIST";
  const guides = {
    START_OVERDUE_FILTER: {
      title: "まず期限超過だけ開く",
      copy: "最初の一覧条件は「期限超過」です。対象を減らして、次回対応日・状態・対応履歴を順番に整えます。",
      filterCategory: "FOLLOW_UP_OVERDUE",
      buttonLabel: "期限超過を開く",
      steps: ["対応期限フィルタを期限超過にする", "先頭行から詳細を開く", "次回対応日または状態を更新する"]
    },
    START_NEXT_WEEK_FILTER: {
      title: "直近7日を今日の処理対象にする",
      copy: "期限超過がなければ、直近7日の予定を対応期限順で確認します。",
      filterCategory: "FOLLOW_UP_NEXT_7_DAYS",
      buttonLabel: "直近7日を開く",
      steps: ["対応期限フィルタを直近7日にする", "並び順を対応期限順にする", "今日処理する対象だけ更新する"]
    },
    START_STEADY_LIST: {
      title: "通常フォローから始める",
      copy: "急ぎの件数がなければ、学校別・月別分析から対象を選んで日常フォローを続けます。",
      filterCategory: "ALL_STUDENTS",
      buttonLabel: "全学生を見る",
      steps: ["学生一覧を開く", "学校別または月別分析から対象を選ぶ", "状態と次回対応を更新する"]
    }
  };
  const guide = guides[category];
  return Object.freeze({
    category,
    title: guide.title,
    copy: guide.copy,
    filterCategory: guide.filterCategory,
    buttonLabel: guide.buttonLabel,
    steps: Object.freeze(guide.steps.map((label, index) => Object.freeze({ order: index + 1, label }))),
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildStudentDailyQueueStartFilter(filterCategory = "ALL_STUDENTS") {
  const plans = Object.freeze({
    FOLLOW_UP_OVERDUE: Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "ALL", month: "ALL", followUp: "OVERDUE", sort: "FOLLOW_UP" }),
    FOLLOW_UP_NEXT_7_DAYS: Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "ALL", month: "ALL", followUp: "NEXT_7_DAYS", sort: "FOLLOW_UP" }),
    STATE_OWNER_REVIEW: Object.freeze({ query: "", source: "ALL", state: "OWNER_REVIEW", progress: "ALL", month: "ALL", followUp: "ALL", sort: "DEFAULT" }),
    STATE_QUARANTINE: Object.freeze({ query: "", source: "ALL", state: "QUARANTINE", progress: "ALL", month: "ALL", followUp: "ALL", sort: "DEFAULT" }),
    ONBOARDING_HANDOFF: Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "OFFERED", month: "ALL", followUp: "ALL", sort: "DEFAULT" }),
    ALL_STUDENTS: Object.freeze({ query: "", source: "ALL", state: "ALL", progress: "ALL", month: "ALL", followUp: "ALL", sort: "DEFAULT" })
  });
  const selected = plans[filterCategory] || plans.ALL_STUDENTS;
  return Object.freeze({
    ...selected,
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

function renderStudentDailyQueueSummary(documentObject, summary) {
  const panel = documentObject.getElementById("student-daily-queue-summary");
  if (panel) panel.dataset.category = summary.category;
  setText(documentObject, "student-daily-queue-title", summary.title);
  setText(documentObject, "student-daily-queue-copy", summary.copy);
  setText(documentObject, "student-daily-queue-overdue", summary.counts.overdue);
  setText(documentObject, "student-daily-queue-next-week", summary.counts.nextWeek);
  setText(documentObject, "student-daily-queue-review", summary.counts.ownerReview);
  setText(documentObject, "student-daily-queue-quarantine", summary.counts.quarantine);
  setText(documentObject, "student-daily-queue-onboarding", summary.counts.onboardingReady);
  const steps = documentObject.getElementById("student-daily-queue-steps");
  if (!steps) return;
  steps.dataset.category = summary.category;
  steps.replaceChildren(...summary.steps.map((step) => {
    const item = documentObject.createElement("li");
    item.dataset.category = step.category;
    item.textContent = `${step.order}. ${step.label}`;
    return item;
  }));
}

function renderStudentDailyQueueStartGuide(documentObject, guide) {
  const panel = documentObject.getElementById("student-daily-queue-start-guide");
  if (panel) {
    panel.dataset.category = guide.category;
    panel.dataset.filterCategory = guide.filterCategory;
  }
  setText(documentObject, "student-daily-queue-start-title", guide.title);
  setText(documentObject, "student-daily-queue-start-copy", guide.copy);
  setText(documentObject, "student-daily-queue-start-button", guide.buttonLabel);
  const steps = documentObject.getElementById("student-daily-queue-start-steps");
  if (!steps) return;
  steps.replaceChildren(...guide.steps.map((step) => {
    const item = documentObject.createElement("li");
    item.textContent = `${step.order}. ${step.label}`;
    return item;
  }));
}

export function buildStudentEmptyState({ total = 0, visible = 0, hasActiveFilters = false } = {}) {
  if (visible > 0) return Object.freeze({ visible: false, title: "", copy: "", canReset: false });
  if (total === 0) {
    return Object.freeze({
      visible: true,
      title: "表示できる学生データがまだありません",
      copy: "学生を追加すると、ここに学生一覧が表示されます。",
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
  badge.textContent = student.status || "選考状況 未登録";
  top.append(name, badge);

  const meta = documentObject.createElement("span");
  meta.className = "student-list-meta";
  meta.textContent = [student.school, student.graduationYear ? `${String(student.graduationYear).slice(-2)}卒` : "卒年未登録", `担当 ${student.assignee || "未設定"}`].filter(Boolean).join(" · ");
  const status = documentObject.createElement("span");
  status.className = "student-list-status";
  status.textContent = student.nextActionLabel
    ? `次の予定 ${student.nextActionLabel}${student.nextActionAt ? `・${student.nextActionAt}` : ""}`
    : student.nextActionAt ? `次回対応 ${student.nextActionAt}` : "次の予定 未設定";
  const reviewBoundary = buildStudentReviewBoundary(student, {
    confirmable: isStudentIndividuallyConfirmable(student),
    editable: Boolean(student.applicationNo) || (student.mappingStatus === "UNMAPPED" && Boolean(student.recordId))
  });
  const reviewLane = documentObject.createElement("span");
  reviewLane.className = "student-list-review-lane";
  reviewLane.classList.add("ui-diagnostic");
  reviewLane.dataset.category = reviewBoundary.category;
  reviewLane.textContent = reviewBoundary.badge;
  const queuePriority = buildStudentReviewQueuePriority(reviewBoundary);
  const queue = documentObject.createElement("span");
  queue.className = "student-list-review-priority";
  queue.classList.add("ui-diagnostic");
  queue.dataset.category = queuePriority.category;
  queue.textContent = queuePriority.label;
  const followUpCategory = classifyTalentStudentFollowUp(student);
  const followUp = documentObject.createElement("span");
  followUp.className = `student-list-followup is-${followUpCategory.toLowerCase().replaceAll("_", "-")}`;
  if (followUpCategory !== "UNSCHEDULED") {
    followUp.textContent = `次回対応 ${student.nextActionAt}`;
  }
  const reasons = Array.isArray(student.reasonLabels) ? student.reasonLabels.filter(Boolean).slice(0, 2) : [];
  const reason = documentObject.createElement("span");
  reason.className = "student-list-reason";
  reason.classList.add("ui-diagnostic");
  reason.textContent = reasons.length ? reasons.join("・") : "";
  if (reasons.length) button.title = `確認事項: ${reasons.join("・")}`;
  button.append(top, meta, status, reviewLane, queue, followUp, reason);
  button.addEventListener("click", () => {
    selectedStudentRecordId = student.recordId;
    renderStudentWorkspace(documentObject);
  });
  return button;
}

function isStudentIndividuallyConfirmable(student) {
  return student?.mappingStatus === "UNMAPPED"
    && (student.primaryEligible
      || (student.suggestionCategory === "EXACT1" && Boolean(student.suggestedTargetRecordId))
      || ["ENTRIES_27", "OFFERS_27"].includes(student.sourceCode));
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
    renderStudentReviewBoundary(documentObject, buildStudentReviewBoundary(null));
    renderStudentDailyOperation(documentObject, buildStudentDailyOperation(null));
    renderStudentDailyCompletionChecklist(documentObject, buildStudentDailyCompletionChecklist(buildStudentDailyOperation(null)));
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
  const editable = (stagingWriteEnabled(globalThis) && Boolean(student.recordId)) || Boolean(student.applicationNo)
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
    const auditable = Boolean(student.recordId);
    auditButton.disabled = !auditable;
    auditButton.setAttribute("aria-disabled", String(!auditable));
    auditButton.title = auditable ? "情報の変更履歴を表示" : "編集可能な情報がありません";
  }
  const confirmButton = documentObject.getElementById("student-confirm-open");
  const confirmable = isStudentIndividuallyConfirmable(student);
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
  setText(documentObject, "student-detail-graduation-year", student.graduationYear ? `${String(student.graduationYear).slice(-2)}卒` : "未登録");
  setText(documentObject, "student-detail-status", student.status || "未登録");
  setText(documentObject, "student-detail-assignee", student.assignee || "未設定");
  setText(documentObject, "student-detail-priority", talentStudentPriorityLabel(student));
  setText(documentObject, "student-detail-last-contact", student.businessDate || "未登録");
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
    editable,
    confirmable,
    onboardingReady: Boolean(onboardingDraft),
    mappingStatus: student.mappingStatus,
  };
  renderStudentActionGuide(documentObject, actionCapability);
  renderStudentReviewBoundary(documentObject, buildStudentReviewBoundary(student, actionCapability));
  const dailyOperation = buildStudentDailyOperation(student, actionCapability);
  renderStudentDailyOperation(documentObject, dailyOperation);
  renderStudentDailyCompletionChecklist(documentObject, buildStudentDailyCompletionChecklist(dailyOperation));
  renderCandidateHistories(documentObject, student);
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
    copy.textContent = "この行は過去の参照データのため直接編集できません。利用中の学生プロフィール、または新しく追加した学生情報を編集してください。";
  }
  setStudentActionState(edit, capability.editable ? "編集: 利用できます" : "編集: 正本化後に利用", capability.editable);
  setStudentActionState(audit, capability.hasCanonicalProfile || capability.hasSupplement ? "履歴: 表示できます" : "履歴: 最初の保存後に表示", capability.hasCanonicalProfile || capability.hasSupplement);
  setStudentActionState(confirm, capability.confirmable ? "候補確認: 利用できます" : capability.mappingStatus === "OWNER_CONFIRMED" ? "候補確認: 済み" : "候補確認: 対象外", capability.confirmable);
}

function setStudentActionState(element, label, enabled) {
  element.textContent = label;
  element.className = `student-action-state ${enabled ? "is-ready" : "is-blocked"}`;
}

function renderStudentReviewBoundary(documentObject, boundary) {
  const badge = documentObject.getElementById("student-review-boundary-badge");
  const title = documentObject.getElementById("student-review-boundary-title");
  const copy = documentObject.getElementById("student-review-boundary-copy");
  const allowed = documentObject.getElementById("student-review-boundary-allowed");
  const caution = documentObject.getElementById("student-review-boundary-caution");
  const laneSteps = documentObject.getElementById("student-review-boundary-steps");
  const decisionLabel = documentObject.getElementById("student-review-decision-label");
  const decisionRecord = documentObject.getElementById("student-review-decision-record");
  const decisionCommand = documentObject.getElementById("student-review-decision-command");
  if (!badge || !title || !copy || !allowed || !caution) return;
  const safeBoundary = boundary || buildStudentReviewBoundary(null);
  const safeLaneSteps = buildStudentReviewLaneSteps(safeBoundary);
  const safeDecision = buildStudentReviewDecisionGuide(safeBoundary);
  badge.textContent = safeBoundary.badge;
  badge.dataset.category = safeBoundary.category;
  title.textContent = safeBoundary.title;
  copy.textContent = safeBoundary.copy;
  allowed.textContent = safeBoundary.allowed;
  caution.textContent = safeBoundary.caution;
  if (decisionLabel) decisionLabel.textContent = safeDecision.label;
  if (decisionRecord) decisionRecord.textContent = safeDecision.record;
  if (decisionCommand) decisionCommand.textContent = safeDecision.command;
  if (laneSteps) {
    laneSteps.replaceChildren(...safeLaneSteps.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
  }
}

function renderCandidateHistories(documentObject, student) {
  const summary = buildCandidateHistorySummary(student);
  const communications = dailyWorkflowData?.sourceCoverageState === "COMPLETE"
    ? (dailyWorkflowData.communications || []).filter((row) => row.candidateId === student?.recordId)
      .map((row) => ({ ...row, date: row.occurredAt?.slice?.(0, 10), code: "COMMUNICATION_RECORDED",
        label: `${row.method}・${row.summary}${row.isCorrection ? `・訂正：${row.correctionReason || "理由記録済み"}` : ""}${row.isEffective ? "" : "・訂正済み"}`, state: "COMPLETED" }))
    : null;
  const formalEvents = (student?.eventHistory || []).filter((row) => row.code !== "COMMUNICATION_RECORDED");
  setText(documentObject, "candidate-history-summary", `接触 ${summary.contactCount}件・連絡 ${communications?.filter((row) => row.isEffective).length ?? "集計準備中"}・イベント ${formalEvents.length}件・選考 ${summary.selectionCount}件`);
  const groups = [
    ["candidate-contact-history", student?.contactHistory, "EVENT"],
    ["candidate-communication-history", communications, "COMMUNICATION"],
    ["candidate-event-history", formalEvents, "EVENT"],
    ["candidate-selection-history", student?.selectionHistory, "SELECTION"],
    ["candidate-next-action-history", student?.nextActions, "NEXT_ACTION"]
  ];
  groups.forEach(([id, rows, entityType]) => {
    const list = documentObject.getElementById(id);
    if (!list) return;
    if (entityType === "COMMUNICATION" && dailyWorkflowData?.sourceCoverageState !== "COMPLETE") {
      list.replaceChildren(Object.assign(documentObject.createElement("li"), { textContent: "集計準備中" }));
      return;
    }
    const safeRows = Array.isArray(rows) ? rows.slice(0, 5) : [];
    list.replaceChildren(...(safeRows.length ? safeRows.map((row) => {
      const item = documentObject.createElement("li");
      const label = documentObject.createElement("span");
      label.textContent = `${row.date || "日付未設定"} · ${row.label || "記録"}${row.state === "COMPLETED" ? " · 完了" : ""}${row.active === false ? " · 無効" : ""}`;
      item.append(label);
      if (studentWorkspaceData?.canWrite && row.id) {
        if (entityType === "COMMUNICATION" && row.isEffective) {
          const correct = documentObject.createElement("button");
          correct.type = "button";
          correct.className = "history-edit-command";
          correct.textContent = "この履歴を訂正";
          correct.addEventListener("click", () => openCandidateActivityDialog({ documentObject, entityType: "EVENT",
            initialCode: "COMMUNICATION_RECORDED", correctionRow: row }));
          item.append(correct);
        }
        if (entityType === "NEXT_ACTION" && row.active !== false && row.state === "OPEN") {
          const complete = documentObject.createElement("button");
          complete.type = "button";
          complete.className = "history-edit-command";
          complete.textContent = "完了";
          complete.addEventListener("click", () => completeCandidateNextAction({ globalObject: globalThis, documentObject, row, student }));
          item.append(complete);
        }
        if (entityType === "EVENT") {
          const edit = documentObject.createElement("button");
          edit.type = "button";
          edit.className = "history-edit-command";
          edit.textContent = row.active === false ? "復元" : "編集";
          edit.addEventListener("click", () => openCandidateActivityDialog({ documentObject, entityType, row }));
          item.append(edit);
        }
      }
      return item;
    }) : [Object.assign(documentObject.createElement("li"), { textContent: "履歴はありません" })]));
  });
}

function renderDailyWorkflowHome(documentObject, data) {
  const list = documentObject.getElementById("daily-workflow-home-list");
  const status = documentObject.getElementById("daily-workflow-home-status");
  if (!list || !status) return;
  const queue = buildDailyWorkflowQueue(data, japanBusinessDateIso());
  if (queue.state !== "READY") {
    status.textContent = "集計準備中";
    list.replaceChildren();
    documentObject.querySelectorAll("[data-workflow-home-count]").forEach((item) => { item.textContent = "-"; });
    return;
  }
  const categories = ["OVERDUE", "TODAY", "AWAITING_REPLY", "FUTURE", "CLOSED"];
  const rowsByCategory = new Map(categories.map((key) => [key, []]));
  queue.rows.forEach((row) => {
    const key = rowsByCategory.has(row.category) ? row.category : "FUTURE";
    rowsByCategory.get(key).push(row);
  });
  documentObject.querySelectorAll("[data-workflow-home-count]").forEach((item) => {
    item.textContent = String(rowsByCategory.get(item.dataset.workflowHomeCount)?.length || 0);
  });
  const active = documentObject.querySelector("[data-workflow-home-filter].is-active")?.dataset.workflowHomeFilter || "OVERDUE";
  const rows = rowsByCategory.get(active) || [];
  status.textContent = rows.length ? `${rows.length}件` : "該当する対応はありません";
  list.replaceChildren(...rows.slice(0, 10).map((row) => {
    const item = documentObject.createElement("li");
    const button = documentObject.createElement("button");
    button.type = "button";
    const student = (studentWorkspaceData?.students || []).find((entry) => entry.recordId === row.candidateId);
    const title = documentObject.createElement("strong");
    title.textContent = student?.displayName || "学生";
    const detail = documentObject.createElement("span");
    detail.textContent = [row.text, row.dueDate, row.assignedTo ? `担当 ${row.assignedTo}` : "担当者未設定"].filter(Boolean).join(" · ");
    button.append(title, detail);
    button.addEventListener("click", () => {
      selectedStudentRecordId = row.candidateId;
      documentObject.querySelector('[data-secondary-tab="students"]')?.click?.();
      renderStudentWorkspace(documentObject);
      documentObject.getElementById("student-detail-title")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    item.append(button);
    return item;
  }));
}

function renderDailyWorkflowQueue(documentObject, data) {
  renderDailyWorkflowHome(documentObject, data);
  const list = documentObject.getElementById("daily-workflow-queue-list");
  const status = documentObject.getElementById("daily-workflow-queue-status");
  if (!list || !status) return;
  const queue = buildDailyWorkflowQueue(data, japanBusinessDateIso());
  if (queue.state !== "READY") {
    status.textContent = "集計準備中";
    list.replaceChildren();
    return;
  }
  const category = documentObject.getElementById("daily-workflow-filter")?.value || "ALL";
  if (category === "MY") {
    status.textContent = "自分の担当を表示";
  }
  const candidateQuery = documentObject.getElementById("daily-workflow-candidate-filter")?.value?.trim?.().toLowerCase() || "";
  const assigneeQuery = documentObject.getElementById("daily-workflow-assignee-filter")?.value?.trim?.().toLowerCase() || "";
  const rows = queue.rows.filter((row) => category === "ALL" ? row.category !== "CLOSED" : category === "MY" ? row.isMine === true : row.category === category)
    .filter((row) => {
      const candidateName = (studentWorkspaceData?.students || []).find((student) => student.recordId === row.candidateId)?.displayName || "";
      return (!candidateQuery || candidateName.toLowerCase().includes(candidateQuery))
        && (!assigneeQuery || String(row.assignedTo || "").toLowerCase().includes(assigneeQuery));
    });
  status.textContent = `${rows.length}件`;
  list.replaceChildren(...rows.map((row) => {
    const item = documentObject.createElement("li");
    const candidateName = (studentWorkspaceData?.students || []).find((student) => student.recordId === row.candidateId)?.displayName || "学生";
    const label = documentObject.createElement("span");
    label.textContent = `${row.category === "OVERDUE" ? "期限超過" : row.category === "TODAY" ? "今日" : row.category === "AWAITING_REPLY" ? "返信待ち" : row.category === "ON_HOLD" ? "保留" : row.category === "CLOSED" ? "完了・取消" : "今後"}・${candidateName}・${row.text}${row.dueDate ? `・${row.dueDate}` : ""}${row.assigneeState === "UNREGISTERED" ? "・担当者未登録・確認必要" : row.assignedTo ? `・担当：${row.assignedTo}` : ""}`;
    item.append(label);
    if (studentWorkspaceData?.canWrite && ["OPEN", "ON_HOLD"].includes(row.state)) {
      const operation = documentObject.createElement("select");
      const allowed = row.state === "ON_HOLD" ? [["ASSIGN", "担当者変更"], ["REOPEN", "再開"], ["CANCEL", "取消"]]
        : [["ASSIGN", "担当者変更"], ["COMPLETE", "完了"], ["HOLD", "保留"], ["CANCEL", "取消"]];
      operation.replaceChildren(...allowed.map(([value, textContent]) => Object.assign(documentObject.createElement("option"), { value, textContent })));
      const assignee = documentObject.createElement("select");
      assignee.replaceChildren(Object.assign(documentObject.createElement("option"), { value: "", textContent: "担当者を選択" }),
        ...(data?.assignees || []).map((entry) => Object.assign(documentObject.createElement("option"), { value: entry.employeeId, textContent: entry.displayName })));
      assignee.hidden = operation.value !== "ASSIGN";
      operation.addEventListener("change", () => { assignee.hidden = operation.value !== "ASSIGN"; });
      const reason = documentObject.createElement("input"); reason.type = "text"; reason.maxLength = 500; reason.placeholder = "操作理由（必須）";
      const execute = documentObject.createElement("button"); execute.type = "button"; execute.className = "secondary-command compact-command"; execute.textContent = "確認";
      execute.addEventListener("click", () => {
        if (!reason.value.trim()) return reason.focus();
        if (operation.value === "ASSIGN" && !assignee.value) return assignee.focus();
        const selectedLabel = operation.options[operation.selectedIndex]?.textContent || operation.value;
        activityConfirmationController?.open?.({ candidateName, eventLabel: `次回対応：${selectedLabel}`,
          date: row.dueDate, reason: reason.value.trim(), focusTarget: execute,
          command: { commandType: "NEXT_ACTION", operation: operation.value, entityId: row.id,
            expectedVersion: row.version, candidateId: row.candidateId, holdReason: operation.value === "HOLD" ? reason.value.trim() : null,
            assignedEmployeeId: operation.value === "ASSIGN" ? assignee.value : null,
            assignedTo: operation.value === "ASSIGN" ? assignee.options[assignee.selectedIndex]?.textContent : null,
            reason: reason.value.trim() } });
      });
      item.append(operation, assignee, reason, execute);
    }
    return item;
  }));
}

const ACTIVITY_CODE_OPTIONS = Object.freeze({
  EVENT: Object.freeze([
    ["CONTACT_RECORDED", "接触記録"], ["LINE_REGISTERED", "LINE登録"],
    ["SALON_TOUR_PLANNED", "サロン見学［予定］"], ["SALON_TOUR_COMPLETED", "サロン見学［済］"],
    ["COMMUNICATION_RECORDED", "連絡記録"]
  ]),
  SELECTION: Object.freeze([
    ["APPLICATION_RECEIVED", "応募"], ["INTERVIEW_PLANNED", "面接予定"],
    ["INTERVIEW_COMPLETED", "面接済み"], ["OFFERED", "内定"], ["OFFER_ACCEPTED", "内定承諾"],
    ["WITHDRAWN", "辞退・離脱"], ["REJECTED", "不採用"]
  ]),
  NEXT_ACTION: Object.freeze([
    ["FOLLOW_UP", "次回対応"], ["SALON_TOUR_FOLLOW_UP", "見学フォロー"],
    ["INTERVIEW_FOLLOW_UP", "面接フォロー"], ["OFFER_FOLLOW_UP", "内定フォロー"]
  ])
});

export function isWritableActivityCode(entityType, code) {
  return Boolean(ACTIVITY_CODE_OPTIONS[entityType]?.some(([value]) => value === code));
}

function isLegacyCrossSourceActivity(entityType, row) {
  return Boolean(row?.code && !isWritableActivityCode(entityType, row.code));
}

function openCandidateActivityDialog({ documentObject, entityType, row = null, initialCode = null, correctionRow = null }) {
  const student = studentWorkspaceData?.students.find((item) => item.recordId === selectedStudentRecordId);
  if (!student?.recordId || !studentWorkspaceData?.canWrite) return;
  if (entityType === "SELECTION" && row) return;
  activityDialogContext = { student, entityType, row, correctionRow };
  const type = documentObject.getElementById("activity-entity-type");
  if (type) { type.value = entityType; type.disabled = Boolean(row || correctionRow); }
  refreshActivityForm(documentObject);
  const fields = {
    "activity-date": row?.date || "", "activity-name": row?.label || "", "activity-content": row?.content || "",
    "activity-notes": row?.notes || "", "activity-reason": "", "activity-correction-reason": ""
  };
  Object.entries(fields).forEach(([id, value]) => { const input = documentObject.getElementById(id); if (input) input.value = value; });
  const code = documentObject.getElementById("activity-code"); if (code && (row?.code || initialCode)) code.value = row?.code || initialCode;
  const assignee = documentObject.getElementById("activity-assignee");
  if (assignee) {
    assignee.replaceChildren(Object.assign(documentObject.createElement("option"), { value: "", textContent: "担当者を選択してください" }),
      ...(dailyWorkflowData?.assignees || []).map((item) => Object.assign(documentObject.createElement("option"), {
        value: item.employeeId, textContent: item.displayName
      })));
    const preferred = row?.assignedEmployeeId || (dailyWorkflowData?.assignees || []).find((item) => item.displayName === (row?.assignedTo || student.assignee))?.employeeId || "";
    assignee.value = preferred;
  }
  const correctionFields = documentObject.getElementById("activity-correction-fields");
  if (correctionFields) correctionFields.hidden = !correctionRow;
  setText(documentObject, "activity-correction-original", correctionRow
    ? `訂正元：${correctionRow.occurredAt || "日時未登録"} ・ ${correctionRow.method || ""} ・ ${correctionRow.summary || ""}` : "");
  const correctionReason = documentObject.getElementById("activity-correction-reason");
  if (correctionReason) correctionReason.required = Boolean(correctionRow);
  refreshActivityForm(documentObject);
  if (correctionRow) {
    if (type) type.disabled = true;
    if (code) code.disabled = true;
  }
  if (correctionRow) {
    const localAt = String(correctionRow.occurredAt || "").replace(/Z$/u, "+00:00");
    const instant = Date.parse(localAt);
    const jst = Number.isNaN(instant) ? "" : new Date(instant + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const correctionValues = {
      "activity-communication-at": jst,
      "activity-communication-method": correctionRow.method || "LINE",
      "activity-communication-direction": correctionRow.direction || "OUTBOUND",
      "activity-communication-result": correctionRow.result || "REACHED",
      "activity-content": correctionRow.summary || ""
    };
    Object.entries(correctionValues).forEach(([id, value]) => { const input = documentObject.getElementById(id); if (input) input.value = value; });
    const awaiting = documentObject.getElementById("activity-awaiting-reply"); if (awaiting) awaiting.checked = correctionRow.awaitingReply === true;
  }
  const state = documentObject.getElementById("activity-state"); if (state && row?.state) state.value = row.state;
  setText(documentObject, "candidate-activity-dialog-title", correctionRow ? "連絡履歴を訂正" : row ? "履歴を編集" : "履歴を追加");
  const legacyReadOnly = isLegacyCrossSourceActivity(entityType, row);
  if (activityDialogContext) activityDialogContext.legacyReadOnly = legacyReadOnly;
  setText(documentObject, "candidate-activity-status", legacyReadOnly
    ? "この旧記録は参照と無効化・復元のみ可能です。正式な記録先から新規登録してください。"
    : "必要事項を入力してください");
  const deactivate = documentObject.getElementById("candidate-activity-deactivate");
  if (deactivate) {
    deactivate.hidden = !row || entityType === "SELECTION";
    deactivate.textContent = row?.active === false ? "理由付きで復元" : "理由付きで無効化";
  }
  const save = documentObject.getElementById("candidate-activity-save");
  if (save) save.hidden = row?.active === false || legacyReadOnly;
  for (const id of ["activity-code", "activity-date", "activity-state", "activity-name", "activity-content", "activity-assignee", "activity-notes"]) {
    const field = documentObject.getElementById(id);
    if (field) field.disabled = legacyReadOnly || Boolean(correctionRow && id === "activity-code");
  }
  documentObject.getElementById("candidate-activity-dialog")?.showModal?.();
}

function refreshActivityForm(documentObject) {
  const type = documentObject.getElementById("activity-entity-type")?.value || activityDialogContext?.entityType || "EVENT";
  if (activityDialogContext) activityDialogContext.entityType = type;
  const select = documentObject.getElementById("activity-code");
  if (select) {
    const desiredCode = select.value || activityDialogContext?.row?.code || "";
    const options = [...ACTIVITY_CODE_OPTIONS[type]];
    const current = activityDialogContext?.row;
    if (isLegacyCrossSourceActivity(type, current)) {
      options.unshift([current.code, `${current.label || current.code}（旧記録・編集不可）`]);
    }
    select.replaceChildren(...options.map(([value, label]) => Object.assign(documentObject.createElement("option"), { value, textContent: label })));
    if (options.some(([value]) => value === desiredCode)) select.value = desiredCode;
    select.disabled = Boolean(activityDialogContext?.correctionRow);
  }
  const eventState = documentObject.getElementById("activity-state-field"); if (eventState) eventState.hidden = type !== "EVENT";
  setText(documentObject, "activity-date-label", type === "NEXT_ACTION" ? "次回対応日 *" : "実施日・予定日 *");
  const date = documentObject.getElementById("activity-date"); if (date) date.required = true;
  const communication = type === "EVENT" && documentObject.getElementById("activity-code")?.value === "COMMUNICATION_RECORDED";
  const communicationFields = documentObject.getElementById("activity-communication-fields");
  if (communicationFields) communicationFields.hidden = !communication;
  const communicationAt = documentObject.getElementById("activity-communication-at");
  if (communicationAt) communicationAt.required = communication;
  const assignee = documentObject.getElementById("activity-assignee");
  const assigneeRequired = type === "NEXT_ACTION" || (communication && documentObject.getElementById("activity-create-follow-up")?.checked === true);
  if (assignee) assignee.required = assigneeRequired;
  setText(documentObject, "activity-assignee-label", assigneeRequired ? "担当者 *" : "担当者");
  if (date) {
    date.required = !communication;
    date.closest?.("label")?.toggleAttribute?.("hidden", communication);
  }
}

function saveCandidateActivity({ documentObject }) {
  const form = documentObject.getElementById("candidate-activity-form");
  if (!form?.reportValidity?.() || !activityDialogContext?.student?.recordId) return;
  if (!guardCandidateActivitySession(documentObject)) return;
  const { student, entityType, row, correctionRow } = activityDialogContext;
  if (activityDialogContext.legacyReadOnly || (row && !isWritableActivityCode(entityType, row.code))) {
    setText(documentObject, "candidate-activity-status", "旧記録は編集できません。無効化または復元のみ行えます。");
    return;
  }
  const assigneeSelect = documentObject.getElementById("activity-assignee");
  const assignedEmployeeId = assigneeSelect?.value || null;
  const assignedTo = assignedEmployeeId ? assigneeSelect?.options?.[assigneeSelect.selectedIndex]?.textContent || null : null;
  const payload = {
    entityType, operation: row ? "UPDATE" : "CREATE", entityId: row?.id || null, expectedVersion: row?.version || null,
    expectedCandidateVersion: student.profileVersion,
    candidateId: student.recordId, code: documentObject.getElementById("activity-code")?.value,
    date: documentObject.getElementById("activity-date")?.value || null, name: documentObject.getElementById("activity-name")?.value || null,
    state: entityType === "EVENT" ? documentObject.getElementById("activity-state")?.value : entityType === "NEXT_ACTION" ? "OPEN" : null,
    content: documentObject.getElementById("activity-content")?.value || null, assignedTo, assignedEmployeeId,
    notes: documentObject.getElementById("activity-notes")?.value || null, reason: documentObject.getElementById("activity-reason")?.value || ""
  };
  if (entityType === "EVENT" && payload.code === "COMMUNICATION_RECORDED") {
    const localAt = documentObject.getElementById("activity-communication-at")?.value;
    const createNextAction = documentObject.getElementById("activity-create-follow-up")?.checked === true;
    const followUpDate = documentObject.getElementById("activity-follow-up-date")?.value;
    const followUpText = documentObject.getElementById("activity-follow-up-text")?.value;
    const correctionReason = documentObject.getElementById("activity-correction-reason")?.value?.trim?.() || null;
    if (!localAt || !String(payload.content || "").trim()
      || (correctionRow && !correctionReason)
      || (createNextAction && (!followUpDate || !String(followUpText || "").trim() || !assignedEmployeeId))) {
      setText(documentObject, "candidate-activity-status", "連絡日時・対応要約と、作成する場合は次回対応日・内容を入力してください");
      return;
    }
    Object.assign(payload, {
      commandType: "COMMUNICATION", expectedCandidateVersion: student.profileVersion,
      communicationAt: jstDateTimeLocalToRfc3339(localAt),
      method: documentObject.getElementById("activity-communication-method")?.value,
      direction: documentObject.getElementById("activity-communication-direction")?.value,
      result: documentObject.getElementById("activity-communication-result")?.value,
      summary: payload.content, awaitingReply: documentObject.getElementById("activity-awaiting-reply")?.checked === true,
      createNextAction, nextActionCode: createNextAction ? "FOLLOW_UP" : null,
      nextActionDueDate: createNextAction ? followUpDate : null,
      nextActionText: createNextAction ? followUpText : null,
      nextActionAssignedTo: createNextAction ? payload.assignedTo : null,
      nextActionAssignedEmployeeId: createNextAction ? assignedEmployeeId : null,
      correctsCommunicationId: correctionRow?.id || null,
      correctionReason
    });
  } else if (entityType === "NEXT_ACTION") {
    if (!String(payload.content || payload.name || "").trim() || !assignedEmployeeId) {
      setText(documentObject, "candidate-activity-status", "次回対応日と対応内容を入力してください");
      return;
    }
    Object.assign(payload, { commandType: "NEXT_ACTION", actionCode: payload.code, dueDate: payload.date,
      actionText: payload.content || payload.name, assignedTo: payload.assignedTo, assignedEmployeeId,
      operation: row ? "UPDATE" : "CREATE" });
  }
  const codeSelect = documentObject.getElementById("activity-code");
  const eventLabel = codeSelect?.options?.[codeSelect.selectedIndex]?.textContent || payload.code;
  const saveButton = documentObject.getElementById("candidate-activity-save");
  const opened = activityConfirmationController?.open?.({
    candidateName: student.displayName,
    eventLabel,
    date: payload.communicationAt || payload.date,
    reason: payload.reason.trim(),
    command: payload,
    focusTarget: saveButton
  });
  if (!opened) setText(documentObject, "candidate-activity-status", "保存内容の確認画面を開けませんでした");
}

async function executeCandidateActivitySave({ globalObject, documentObject, command }) {
  if (!guardCandidateActivitySession(documentObject)) return false;
  setText(documentObject, "candidate-activity-status", "保存しています");
  const client = createStagingCandidateClient({ globalObject });
  const result = command.commandType === "COMMUNICATION"
    ? await client?.recordCommunication({
      candidateId: command.candidateId, expectedCandidateVersion: command.expectedCandidateVersion,
      communicationAt: command.communicationAt, method: command.method, direction: command.direction,
      result: command.result, summary: command.summary, awaitingReply: command.awaitingReply,
      createNextAction: command.createNextAction, nextActionCode: command.nextActionCode,
      nextActionDueDate: command.nextActionDueDate, nextActionText: command.nextActionText,
      nextActionAssignedTo: command.nextActionAssignedTo,
      nextActionAssignedEmployeeId: command.nextActionAssignedEmployeeId,
      correctsCommunicationId: command.correctsCommunicationId, correctionReason: command.correctionReason,
      reason: command.reason
    })
    : command.commandType === "NEXT_ACTION"
      ? await client?.mutateNextAction({ operation: command.operation, candidateId: command.candidateId,
        nextActionId: command.entityId, expectedVersion: command.expectedVersion,
        actionCode: command.actionCode, dueDate: command.dueDate, actionText: command.actionText,
        assignedTo: command.assignedTo, assignedEmployeeId: command.assignedEmployeeId,
        holdReason: command.holdReason, reason: command.reason })
      : await client?.mutateActivity(command);
  if (!result?.ok) {
    if (result?.category === "auth_required") handleNovHubSessionAuthFailure(401);
    setText(documentObject, "candidate-activity-status", result?.category === "auth_required"
      ? HUB_SESSION_REAUTH_MESSAGE
      : result?.category === "version_conflict" ? "他の更新があります。再読み込みしてください" : "保存できませんでした");
    return false;
  }
  documentObject.getElementById("candidate-activity-dialog")?.close?.();
  activityDialogContext = null; studentWorkspaceData = null;
  await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
  return true;
}

async function deactivateCandidateActivity({ globalObject, documentObject }) {
  const context = activityDialogContext;
  if (context?.entityType === "SELECTION") return;
  if (!guardCandidateActivitySession(documentObject)) return;
  const reason = documentObject.getElementById("activity-reason")?.value?.trim();
  const restoring = context?.row?.active === false;
  const confirmation = restoring ? "この履歴を復元しますか？" : "この履歴を無効化しますか？物理削除はしません。";
  if (!context?.row?.id || !reason || !globalObject.confirm?.(confirmation)) return;
  const result = await createStagingCandidateClient({ globalObject })?.mutateActivity({
    entityType: context.entityType, operation: restoring ? "RESTORE" : "DEACTIVATE", entityId: context.row.id,
    expectedVersion: context.row.version, candidateId: context.student.recordId, reason
  });
  if (!result?.ok) {
    if (result?.category === "auth_required") handleNovHubSessionAuthFailure(401);
    return setText(documentObject, "candidate-activity-status", result?.category === "auth_required"
      ? HUB_SESSION_REAUTH_MESSAGE
      : restoring ? "復元できませんでした" : "無効化できませんでした");
  }
  documentObject.getElementById("candidate-activity-dialog")?.close?.(); activityDialogContext = null; studentWorkspaceData = null;
  await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
}

async function completeCandidateNextAction({ globalObject, documentObject, row, student }) {
  if (!row?.id || !student?.recordId) return;
  if (!guardCandidateActivitySession(documentObject)) return;
  activityConfirmationController?.open?.({
    candidateName: student.displayName, eventLabel: `次回対応を完了：${row.label || "対応"}`,
    date: row.date, reason: "次回対応の完了確認", focusTarget: documentObject.activeElement,
    command: { commandType: "NEXT_ACTION", operation: "COMPLETE", entityId: row.id,
      expectedVersion: row.version, candidateId: student.recordId, reason: "次回対応の完了確認" }
  });
}

function guardCandidateActivitySession(documentObject) {
  if (isCandidateWriteSessionAvailable(getNovHubSessionStatus())) return true;
  setText(documentObject, "candidate-activity-status", HUB_SESSION_REAUTH_MESSAGE);
  return false;
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

function renderStudentDailyCompletionChecklist(documentObject, checklist) {
  const panel = documentObject.getElementById("student-daily-completion");
  const title = documentObject.getElementById("student-daily-completion-title");
  const copy = documentObject.getElementById("student-daily-completion-copy");
  const steps = documentObject.getElementById("student-daily-completion-steps");
  if (!panel || !title || !copy || !steps) return;
  const safeChecklist = checklist || buildStudentDailyCompletionChecklist(buildStudentDailyOperation(null));
  panel.dataset.category = safeChecklist.category;
  title.textContent = safeChecklist.title;
  copy.textContent = safeChecklist.copy;
  steps.replaceChildren(...safeChecklist.steps.map((step) => {
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
  if (!student?.recordId) return;
  auditDialogStudent = student;
  const status = documentObject.getElementById("student-audit-status");
  const body = documentObject.getElementById("student-audit-body");
  if (status) {
    status.dataset.state = "loading";
    status.textContent = "変更履歴を読み込んでいます";
  }
  if (body) body.replaceChildren();
  documentObject.getElementById("student-audit-dialog")?.showModal?.();
  const result = await createStagingCandidateClient({ globalObject })?.audit(student.recordId);
  if (!auditDialogStudent || auditDialogStudent.recordId !== student.recordId) return;
  if (result?.ok !== true) {
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = result?.category === "auth_required"
        ? "HUBへ再ログインしてください"
        : "変更履歴を取得できません";
    }
    return;
  }
  const allEntries = [...(result.data.entries || []), ...(result.data.activityEntries || [])]
    .sort((left, right) => String(right.occurred_at || "").localeCompare(String(left.occurred_at || "")));
  if (status) {
    status.dataset.state = "ready";
    status.textContent = `${allEntries.length}件の変更履歴`;
  }
  if (body) {
    body.replaceChildren(...allEntries.map((entry) => {
      const row = documentObject.createElement("tr");
      const action = documentObject.createElement("th");
      action.scope = "row";
      action.textContent = `${entry.entity_type ? `${activityTypeLabel(entry.entity_type)}・` : ""}${entry.action === "CREATE" ? "作成" : entry.action === "DEACTIVATE" ? "無効化" : entry.action === "RESTORE" ? "復元" : entry.action === "COMPLETE" ? "完了" : "更新"}`;
      const fields = documentObject.createElement("td");
      fields.textContent = (entry.changed_fields || []).map((field) => PROFILE_FIELD_LABELS[field] || "学生情報").join("、");
      const version = documentObject.createElement("td");
      version.textContent = `v${entry.candidate_version || entry.entity_version}`;
      const occurredAt = documentObject.createElement("td");
      occurredAt.textContent = formatAuditDate(entry.occurred_at);
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
  setText(documentObject, "student-profile-dialog-title", student ? "学生情報を編集" : "学生を追加");
  const fields = {
    "profile-graduation-year": student?.graduationYear || 2028,
    "profile-display-name": student?.displayName || "",
    "profile-kana": student?.kana || "",
    "profile-school": student?.school || "",
    "profile-phone": student?.phone || "",
    "profile-email": student?.email || "",
    "profile-faculty": student?.faculty || "",
    "profile-line": student?.lineIdentifier || "",
    "profile-source": student?.acquisitionSource || "",
    "profile-assignee": student?.assignee || "",
    "profile-notes": student?.notes || "",
    "profile-status": student?.statusCode || "",
    "profile-change-reason": "",
  };
  Object.entries(fields).forEach(([id, value]) => {
    const input = documentObject.getElementById(id);
    if (input) input.value = value;
  });
  const projectionStatus = documentObject.getElementById("profile-status");
  if (projectionStatus) projectionStatus.disabled = true;
  populateCandidateMasterOptions(documentObject, student);
  const status = documentObject.getElementById("student-profile-status");
  if (status) {
    status.dataset.state = "idle";
    status.textContent = student
      ? "変更内容と更新理由を確認して保存してください"
      : "必要事項を入力してください";
  }
  documentObject.getElementById("student-profile-dialog")?.showModal?.();
  const deactivate = documentObject.getElementById("student-profile-deactivate");
  if (deactivate) deactivate.hidden = !student;
  documentObject.getElementById(focusField)?.focus?.();
}

async function saveStudentProfile({ globalObject, documentObject }) {
  const form = documentObject.getElementById("student-profile-form");
  if (!form?.reportValidity?.()) return;
  const payload = {
    expectedVersion: profileDialogStudent?.profileVersion || undefined,
    graduationYear: Number(documentObject.getElementById("profile-graduation-year")?.value),
    displayName: documentObject.getElementById("profile-display-name")?.value || "",
    kana: documentObject.getElementById("profile-kana")?.value || "",
    school: documentObject.getElementById("profile-school")?.value || "",
    faculty: documentObject.getElementById("profile-faculty")?.value || "",
    phone: documentObject.getElementById("profile-phone")?.value || "",
    email: documentObject.getElementById("profile-email")?.value || "",
    lineIdentifier: documentObject.getElementById("profile-line")?.value || "",
    currentStatus: documentObject.getElementById("profile-status")?.value || "",
    acquisitionSource: documentObject.getElementById("profile-source")?.value || "",
    assignedTo: documentObject.getElementById("profile-assignee")?.value || "",
    notes: documentObject.getElementById("profile-notes")?.value || "",
    changeReason: documentObject.getElementById("profile-change-reason")?.value || "",
  };
  const stagingEdit = Boolean(profileDialogStudent?.recordId);
  if (!globalObject.confirm?.(stagingEdit
    ? "入力内容で学生情報を更新します。よろしいですか？"
    : "入力内容で学生を登録します。よろしいですか？")) return;
  const saveButton = documentObject.getElementById("student-profile-save");
  const status = documentObject.getElementById("student-profile-status");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
  }
  const client = createStagingCandidateClient({ globalObject });
  const duplicateResult = await client?.checkDuplicates({ ...payload, candidateId: profileDialogStudent?.recordId || null });
  if (!duplicateResult?.ok) {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.setAttribute("aria-busy", "false");
    }
    if (status) {
      status.dataset.state = "stopped";
      status.textContent = "重複候補を確認できませんでした。保存は行っていません。";
    }
    return;
  }
  const duplicateCount = Number(duplicateResult.data?.matchCount || 0);
  if (duplicateCount > 0 && !globalObject.confirm?.(`重複候補が${duplicateCount}件あります。自動統合せず、別の学生として保存しますか？`)) {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.setAttribute("aria-busy", "false");
    }
    if (status) {
      status.dataset.state = "idle";
      status.textContent = "重複候補を確認するため保存を中止しました。";
    }
    return;
  }
  if (status) {
    status.dataset.state = "loading";
    status.textContent = stagingEdit ? "学生情報を更新しています" : "学生を登録しています";
  }
  const result = stagingEdit ? await client?.update(profileDialogStudent.recordId, payload) : await client?.create(payload);
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.setAttribute("aria-busy", "false");
  }
  if (!result?.ok) {
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
  const savedCandidateId = profileDialogStudent?.recordId || result.data?.candidate_id || result.data?.candidateId;
  const savedVersion = result.data?.candidate_version || result.data?.candidateVersion;
  const masterResult = savedCandidateId && savedVersion ? await client?.linkMasters(savedCandidateId, {
    expectedVersion: Number(savedVersion), schoolId: documentObject.getElementById("profile-school-id")?.value || null,
    fairId: documentObject.getElementById("profile-fair-id")?.value || null, reason: payload.changeReason
  }) : { ok: true };
  if (!masterResult?.ok) {
    if (status) { status.dataset.state = "stopped"; status.textContent = "学生情報は保存しましたが、学校・フェアの紐付けに失敗しました。再読み込みして編集してください。"; }
    studentWorkspaceData = null; await loadTalentStudentWorkspace({ globalObject, documentObject, force: true }); return;
  }
  pendingSelectedApplicationNo = null;
  if (status) {
    status.dataset.state = "ready";
    status.textContent = stagingEdit ? "学生情報を更新しました" : "学生を追加しました";
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

function formatSafeCategoryLabel(category) {
  return ({
    ZERO: "なし",
    NONE: "なし",
    ONE: "1件",
    MULTIPLE: "複数あり",
    PRESENT: "あり",
    EXACT1: "1件",
    EXACT3: "3区分あり",
    PARTIAL: "一部あり",
    PASS: "確認済み",
    NOT_EVALUATED: "未確認"
  })[String(category || "")] || "確認中";
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
    const label = runtimeMode(globalThis) === "staging" ? "運用データ" : "確認用データ";
    connectionLabel.textContent = state === "ready" ? label : state === "stopped" ? `${label}停止` : `${label}準備中`;
  }
}

function activityTypeLabel(value) {
  return ({ EVENT: "接触・イベント", SELECTION: "選考", NEXT_ACTION: "次回対応", SOURCE_FACT: "未紐付け履歴" })[value] || "採用履歴";
}

function setProfileStatus(documentObject, text, state = "idle") {
  const status = documentObject.getElementById("student-profile-status");
  if (status) { status.textContent = text; status.dataset.state = state; }
}

function runtimeMode(globalObject = globalThis) {
  return String(globalObject?.NOV_TALENT_CONFIG?.runtimeMode || "mock") === "staging" ? "staging" : "mock";
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

export function configureTalentOperationUi(documentObject, accessProfile) {
  const isAdministrator = accessProfile === "full";
  const canWriteCandidates = ["full", "recruiter"].includes(accessProfile);
  const managementTab = documentObject?.querySelector?.("[data-talent-management-tab]");
  const managementPanel = documentObject?.getElementById?.("recruitment-management");
  const managementSections = [...(documentObject?.querySelectorAll?.("[data-management-section]") || [])];

  if (managementTab) managementTab.hidden = !isAdministrator;
  if (managementPanel) managementPanel.hidden = true;
  for (const section of managementSections) {
    section.hidden = !isAdministrator;
  }
  for (const item of documentObject?.querySelectorAll?.("[data-talent-write-only]") || []) {
    item.hidden = !canWriteCandidates;
  }

  const backButton = documentObject?.querySelector?.("[data-management-back]");
  if (backButton && !backButton.dataset.bound) {
    backButton.dataset.bound = "true";
    backButton.addEventListener("click", (event) => {
      event.preventDefault();
      documentObject?.querySelector?.('[data-secondary-tab="summary"]')?.click?.();
    });
  }

  for (const button of documentObject?.querySelectorAll?.("[data-management-open-tab]") || []) {
    if (button.dataset.bound) continue;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const tab = documentObject?.querySelector?.(`[data-secondary-tab="${button.dataset.managementOpenTab}"]`);
      tab?.click?.();
    });
  }

  return Object.freeze({
    managementVisible: isAdministrator,
    candidateWriteVisible: canWriteCandidates,
    managementSectionCount: managementSections.length,
    managementTierCount: documentObject?.querySelectorAll?.("[data-management-tier-content]")?.length || 0
  });
}

function initializeTalentApp() {
  const authorization = installNovTalentAuthGuard();
  if (!authorization.allowed) return authorization;
  configureTalentOperationUi(globalThis.document, authorization.access?.profile);
  enableStagingWriteControls(globalThis.document, authorization.access?.profile);
  if (authorization.access?.profile === "full") {
    initializeFairOriginReview(globalThis.document, globalThis);
    initializeFairOriginPreparation(globalThis.document, globalThis);
    initializeRecruitingIntelligenceDiagnostic(globalThis.document, globalThis);
    initializeRecruitingPlanningDiagnostic(globalThis.document, globalThis);
    initializeRecruitingPlanningAdmin(globalThis.document, globalThis);
  }
  initializeTalentStudentWorkspace();
  initializeTalentNavigation();
  const summaryControl = initializeTalentSummaryControl();
  if (authorization.access?.profile === "full") initializeTalent28CsvPreflight();
  const loadPlan = buildTalentInitialLoadPlan(globalThis);
  if (loadPlan.workspace) loadTalentStudentWorkspace();
  if (loadPlan.standaloneSummary) summaryControl.run?.();
  return authorization;
}

const SUMMARY_VIEW_DEPENDENCIES = Object.freeze({
  contacts: Object.freeze(["recruitment_events"]),
  lineRegistrations: Object.freeze(["recruitment_events"]),
  salonTours: Object.freeze(["recruitment_events"]),
  interviews: Object.freeze(["selection_history"]),
  passed: Object.freeze(["selection_history"]),
  offers: Object.freeze(["selection_history"]),
  expectedJoiners: Object.freeze([])
});

const SUMMARY_AVAILABILITY_KEYS = Object.freeze({
  contacts: "eventCount",
  lineRegistrations: "lineRegistrations",
  salonTours: "salonTourCompleted",
  interviews: "interviewHistory",
  passed: "offers",
  offers: "offers",
  expectedJoiners: "candidateCount"
});

export function buildWorkspaceDashboardSummaryViewModel(data) {
  const unavailable = new Set(data?.partialStatus?.unavailableViews || []);
  const availability = data?.dashboard?.availability || {};
  return buildDashboardSummaryViewModel({ summary: data?.summary }).map((metric) => Object.freeze({
    ...metric,
    value: (SUMMARY_VIEW_DEPENDENCIES[metric.key] || []).some((view) => unavailable.has(view))
      || (Object.hasOwn(availability, SUMMARY_AVAILABILITY_KEYS[metric.key])
        && availability[SUMMARY_AVAILABILITY_KEYS[metric.key]] !== true)
      ? "集計準備中"
      : metric.value
  }));
}

const SELECTION_COVERAGE_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "applications", code: "APPLICATION_RECEIVED", label: "応募" }),
  Object.freeze({ key: "interviews", code: "INTERVIEW_COMPLETED", label: "面接" }),
  Object.freeze({ key: "offers", code: "OFFERED", label: "内定" }),
  Object.freeze({ key: "accepted", code: "OFFER_ACCEPTED", label: "内定承諾" }),
  Object.freeze({ key: "withdrawn", code: "WITHDRAWN", label: "辞退" }),
  Object.freeze({ key: "rejected", code: "REJECTED", label: "不採用" })
]);

export function buildSelectionFactCoverage(workspace, coverageData = null) {
  const ready = coverageData?.sourceCoverageState === "READY";
  const metricByCode = new Map((Array.isArray(coverageData?.metrics) ? coverageData.metrics : [])
    .map((row) => [row.code, row]));
  const metrics = SELECTION_COVERAGE_DEFINITIONS.map((definition) => {
    const source = metricByCode.get(definition.code);
    const officialRows = ready ? source?.officialRows : null;
    const unlinkedTotal = ready ? source?.unlinkedEvidenceTotal : null;
    const state = !ready || !Number.isInteger(officialRows) || !Number.isInteger(unlinkedTotal)
      ? "PREPARING"
      : unlinkedTotal > 0 ? "PARTIAL" : officialRows > 0 ? "RECORDED" : "NOT_REGISTERED";
    return Object.freeze({
      ...definition,
      state,
      candidateCount: ready ? source?.officialUniqueCandidates ?? null : null,
      officialRowCount: ready ? officialRows : null,
      unlinkedEvidenceCount: ready ? unlinkedTotal : null,
      datedUnlinkedEvidence: ready ? source?.datedUnlinkedEvidence ?? null : null,
      undatedUnlinkedEvidence: ready ? source?.undatedUnlinkedEvidence ?? null : null,
      grain: "UNIQUE_CANDIDATE"
    });
  });
  return Object.freeze({
    state: !ready ? "PREPARING" : Number(coverageData.unlinkedEvidenceTotal) > 0 ? "PARTIAL" : "READY",
    selectionReady: ready,
    sourceFactsReady: ready,
    unlinkedEvidenceTotal: ready ? coverageData.unlinkedEvidenceTotal : null,
    datedUnlinkedEvidence: ready ? coverageData.datedUnlinkedEvidence : null,
    undatedUnlinkedEvidence: ready ? coverageData.undatedUnlinkedEvidence : null,
    officialSelectionTotal: ready ? coverageData.officialSelectionRows : null,
    officialUniqueCandidates: ready ? coverageData.officialUniqueCandidates : null,
    metrics: Object.freeze(metrics)
  });
}

function renderSelectionFactCoverage(documentObject, workspace, coverageData = null) {
  const grid = documentObject?.getElementById?.("selection-coverage-grid");
  const status = documentObject?.getElementById?.("selection-coverage-status");
  if (!grid) return;
  const coverage = buildSelectionFactCoverage(workspace, coverageData);
  if (status) status.textContent = coverage.state === "PREPARING"
    ? "集計準備中"
    : `確認待ちの元データ ${coverage.unlinkedEvidenceTotal}件（日付確認可能 ${coverage.datedUnlinkedEvidence}件 / 日付未登録 ${coverage.undatedUnlinkedEvidence}件）`;
  grid.replaceChildren(...coverage.metrics.map((metric) => {
    const article = documentObject.createElement("article");
    article.dataset.state = metric.state;
    const label = documentObject.createElement("span"); label.textContent = metric.label;
    const value = documentObject.createElement("strong");
    value.textContent = metric.state === "PREPARING" ? "集計準備中"
      : `正式登録 ${metric.officialRowCount}件`;
    const detail = documentObject.createElement("small");
    detail.textContent = metric.state === "PREPARING" ? "確認待ちの元データを取得できません"
      : `確認待ち ${metric.unlinkedEvidenceCount}件（日付あり ${metric.datedUnlinkedEvidence}件 / 日付未登録 ${metric.undatedUnlinkedEvidence}件）`;
    const grain = documentObject.createElement("small"); grain.textContent = "正式登録だけを実績へ集計します";
    article.append(label, value, detail, grain);
    return article;
  }));
}

function renderWorkspaceDashboardSummary(documentObject, data) {
  renderMetrics(documentObject, buildWorkspaceDashboardSummaryViewModel(data));
  const availability = data?.dashboard?.availability || {};
  const shortcutAvailability = Object.freeze({ contacts: "eventCount", entries: "entries", offers: "offers" });
  for (const button of documentObject?.querySelectorAll?.("[data-summary-followup]") || []) {
    const availabilityKey = shortcutAvailability[button.dataset.summaryFollowup];
    if (!availabilityKey) continue;
    const enabled = availability[availabilityKey] === true;
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", String(!enabled));
    button.title = enabled ? "" : "正式な履歴を集計準備中です";
  }
  const partial = data?.partialStatus?.state === "partial";
  setStatus(documentObject, partial ? "partial" : "ready", partial
    ? "一部指標は集計準備中です"
    : "集計を表示しました");
}

function enableStagingWriteControls(documentObject, accessProfile) {
  if (!stagingWriteEnabled(globalThis)) return;
  const canWrite = ["full", "recruiter"].includes(accessProfile);
  for (const id of ["student-add-open", "student-edit-open", "candidate-history-actions"]) {
    const button = documentObject.getElementById(id);
    if (button && canWrite) { button.hidden = false; button.classList.remove("sprint1-mock-write"); }
  }
  const audit = documentObject.getElementById("student-audit-open");
  if (audit) { audit.hidden = false; audit.classList.remove("sprint1-mock-write"); }
}

function renderTodayTasks(documentObject, tasks) {
  const list = documentObject?.getElementById?.("today-task-list");
  const status = documentObject?.getElementById?.("today-task-status");
  if (!list) return;
  const rows = buildRecruitmentTaskBoard(tasks);
  if (status) {
    const available = studentWorkspaceData?.dashboard?.availability?.todayActions === true;
    const undated = Number(studentWorkspaceData?.dashboard?.undatedActions || 0);
    status.textContent = rows.length ? `${rows.length}件を優先表示`
      : !available ? "集計準備中"
        : undated ? `対応日未登録 ${undated}件` : "今日の対応は0件です";
  }
  list.replaceChildren(...rows.map((task) => {
    const item = documentObject.createElement("li");
    const button = documentObject.createElement("button");
    button.type = "button";
    button.dataset.candidateId = task.candidateId;
    const candidateName = (studentWorkspaceData?.students || [])
      .find((student) => student.recordId === task.candidateId)?.displayName || "学生";
    button.innerHTML = `<strong>${escapeHtml(task.label)}</strong><span>${escapeHtml(candidateName)}${task.dueDate ? ` · ${escapeHtml(task.dueDate)}` : ""}</span>`;
    button.addEventListener("click", () => {
      selectedStudentRecordId = task.candidateId;
      documentObject.querySelector?.('[data-secondary-tab="students"]')?.click?.();
      renderStudentWorkspace(documentObject);
      documentObject.getElementById("student-detail")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    item.append(button);
    return item;
  }));
}

function renderUnlinkedInterviews(documentObject, rows, globalObject, sourceFactsAvailable = true) {
  const list = documentObject.getElementById("unlinked-interview-list");
  const status = documentObject.getElementById("unlinked-interview-status");
  if (!list) return;
  const safeRows = Array.isArray(rows) ? rows : [];
  if (status) status.textContent = !sourceFactsAvailable
    ? "未紐付け履歴は集計準備中です"
    : safeRows.length ? `${safeRows.length}件の人間確認が必要です` : "未紐付け履歴はありません";
  if (!sourceFactsAvailable) {
    list.replaceChildren();
    return;
  }
  list.replaceChildren(...safeRows.map((row) => {
    const item = documentObject.createElement("article");
    const text = documentObject.createElement("div");
    const sourceLabel = row.sourceType === "OFFERS_27" ? "27卒 内定者情報" : "27卒 エントリー一覧";
    const title = documentObject.createElement("strong"); title.textContent = `${sourceLabel}・行${row.sourceRowNo}`;
    const detail = documentObject.createElement("span"); detail.textContent = `${row.date || "日付未登録"} · ${row.label || "選考根拠"}`;
    text.append(title, detail); item.append(text);
    if (studentWorkspaceData?.canWrite) {
      const button = documentObject.createElement("button"); button.type = "button"; button.className = "secondary-command compact-command";
      button.textContent = "選択中の学生へ紐付け";
      button.disabled = !selectedStudentRecordId;
      button.addEventListener("click", async () => {
        const selectedCandidate = (studentWorkspaceData?.students || [])
          .find((student) => student.recordId === selectedStudentRecordId);
        if (!selectedCandidate?.recordId || !Number.isInteger(selectedCandidate.profileVersion)
          || !globalObject.confirm?.("正本と学生を確認し、この選考根拠を紐付けますか？")) return;
        const result = await createStagingCandidateClient({ globalObject })?.linkUnlinkedSelection({
          candidateId: selectedCandidate.recordId, expectedCandidateVersion: selectedCandidate.profileVersion,
          sourceType: row.sourceType, sourceRowNo: row.sourceRowNo, factCode: row.code,
          expectedVersion: row.version,
          evidenceReference: `SOURCE:${row.sourceType}:ROW:${row.sourceRowNo}:${row.code}`,
          reason: "正本と学生の人間確認による紐付け"
        });
        if (!result?.ok) { if (status) status.textContent = "紐付けできませんでした。再読み込みしてください"; return; }
        studentWorkspaceData = null;
        await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
      });
      item.append(button);
    }
    return item;
  }));
}

export function initializeFairOriginReview(documentObject, globalObject = globalThis) {
  const reload = documentObject?.getElementById?.("fair-origin-review-reload");
  const filters = ["fair-origin-review-filter", "fair-origin-review-candidate-filter"]
    .map((id) => documentObject?.getElementById?.(id)).filter(Boolean);
  if (reload && !reload.dataset.bound) {
    reload.dataset.bound = "true";
    reload.addEventListener("click", () => loadFairOriginReview(documentObject, globalObject));
  }
  for (const filter of filters) {
    if (filter.dataset.bound) continue;
    filter.dataset.bound = "true";
    filter.addEventListener("change", () => renderFairOriginReview(documentObject, globalObject));
  }
  return Object.freeze({ initialized: Boolean(reload && filters.length === 2) });
}

export function initializeFairOriginPreparation(documentObject, globalObject = globalThis, clientOverride = null) {
  const panel = documentObject?.getElementById?.("fair-origin-preparation-panel");
  const open = documentObject?.getElementById?.("fair-origin-preparation-open");
  const dialog = documentObject?.getElementById?.("fair-origin-preparation-dialog");
  const cancel = documentObject?.getElementById?.("fair-origin-preparation-cancel");
  const execute = documentObject?.getElementById?.("fair-origin-preparation-execute");
  const result = documentObject?.getElementById?.("fair-origin-preparation-result");
  const canonicalHubOrigin = String(globalObject?.location?.origin || "") === "https://ideanow-shift.github.io";
  if (!panel || !open || !dialog || !cancel || !execute || runtimeMode(globalObject) !== "staging" || !canonicalHubOrigin) {
    if (panel) panel.hidden = true;
    return Object.freeze({ initialized: false });
  }
  let attempted = false;
  const setCount = (id, value, suffix) => {
    const target = documentObject.getElementById(id);
    if (target) target.textContent = `${Number(value)}${suffix}`;
  };
  const close = () => typeof dialog.close === "function" ? dialog.close() : (dialog.hidden = true);
  const client = clientOverride || createStagingCandidateClient({ globalObject });
  panel.hidden = true;
  open.disabled = true;
  client?.fairOriginPreparationReadiness().then((readiness) => {
    if (!readiness?.ok) {
      if (readiness?.category === "preparation_locked") {
        const status = documentObject.getElementById("fair-origin-preparation-status");
        if (status) status.textContent = "現在は実行できません。実行承認後に利用できます。";
        panel.hidden = false;
      }
      return;
    }
    setCount("fair-origin-preparation-logical", readiness.data.logicalCandidateCount, "名");
    setCount("fair-origin-preparation-single", readiness.data.singleCandidateCount, "名");
    setCount("fair-origin-preparation-multiple", readiness.data.multipleCandidateCount, "名");
    setCount("fair-origin-preparation-physical", readiness.data.physicalPendingRowCount, "件");
    open.disabled = readiness.data?.ready !== true;
    const status = documentObject.getElementById("fair-origin-preparation-status");
    if (status) status.textContent = readiness.data?.ready === true
      ? "実行前の確認が完了しました。"
      : "現在は実行できません。実行承認後に利用できます。";
    panel.hidden = false;
  });
  open.addEventListener("click", () => {
    if (attempted) return;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.hidden = false;
  });
  cancel.addEventListener("click", close);
  execute.addEventListener("click", async () => {
    if (attempted) return;
    attempted = true;
    execute.disabled = true;
    cancel.disabled = true;
    open.disabled = true;
    if (result) result.textContent = "準備しています。画面を閉じずにお待ちください。";
    const response = await client?.prepareFairOriginReview();
    if (response?.ok && response.data?.completed === true) {
      if (result) result.textContent = "確認データの準備が完了しました。161名の確認を開始できます。";
      panel.hidden = true;
      await loadFairOriginReview(documentObject, globalObject);
      return;
    }
    if (result) result.textContent = "準備を完了できませんでした。データは変更されていません。";
  });
  return Object.freeze({ initialized: true });
}

async function loadFairOriginReview(documentObject, globalObject) {
  const status = documentObject?.getElementById?.("fair-origin-review-status");
  const reload = documentObject?.getElementById?.("fair-origin-review-reload");
  if (status) status.textContent = "確認候補を読み込んでいます";
  if (reload) reload.disabled = true;
  const result = await createStagingCandidateClient({ globalObject })?.fairOriginReviewQueue();
  if (reload) reload.disabled = false;
  if (!result?.ok) {
    if (status) status.textContent = result?.category === "forbidden" ? "この操作を行う権限がありません" : "確認候補を取得できませんでした";
    return;
  }
  fairOriginReviewEntries = Array.isArray(result.data?.entries) ? result.data.entries : [];
  renderFairOriginReview(documentObject, globalObject);
}

function fairOriginReviewDisplayStatus(row) {
  if (row?.attribution_status === "PENDING" && String(row?.review_note || "").trim()) return "HOLD";
  return row?.attribution_status || "UNKNOWN";
}

export function groupFairOriginReviewEntries(entries = []) {
  const groups = new Map();
  for (const row of Array.isArray(entries) ? entries : []) {
    const candidateKey = String(row?.candidate_id || `unresolved:${row?.attribution_id || groups.size}`);
    if (!groups.has(candidateKey)) groups.set(candidateKey, { candidateKey, entries: [] });
    groups.get(candidateKey).entries.push(row);
  }
  return [...groups.values()].map((group) => Object.freeze({
    ...group,
    candidateCount: group.entries.length,
    candidateKind: group.entries.length > 1 ? "MULTIPLE" : "UNIQUE"
  }));
}

export function filterFairOriginReviewGroups(groups = [], { candidateFilter = "ALL", statusFilter = "ALL" } = {}) {
  return groups.filter((group) => {
    if (candidateFilter !== "ALL" && group.candidateKind !== candidateFilter) return false;
    return statusFilter === "ALL" || group.entries.some((row) => fairOriginReviewDisplayStatus(row) === statusFilter);
  });
}

export function fairOriginReviewLogicalCounts(groups = []) {
  return Object.freeze({
    logical: groups.length,
    unique: groups.filter((group) => group.candidateKind === "UNIQUE").length,
    multiple: groups.filter((group) => group.candidateKind === "MULTIPLE").length,
    physical: groups.reduce((count, group) => count + group.entries.length, 0)
  });
}

function appendFairOriginReviewField(documentObject, list, label, value) {
  const item = documentObject.createElement("div");
  const term = documentObject.createElement("dt");
  const description = documentObject.createElement("dd");
  term.textContent = label;
  description.textContent = value || "未登録";
  item.append(term, description);
  list.append(item);
}

function appendFairOriginReviewActions(documentObject, globalObject, status, row) {
  if (row.attribution_status !== "PENDING") return null;
  const actions = documentObject.createElement("div"); actions.className = "fair-origin-review-actions";
  for (const [decision, label] of [["CONFIRMED", "このフェアで確認"], ["REJECTED", "このフェアではない"], ["PENDING", "保留"]]) {
    const button = documentObject.createElement("button"); button.type = "button"; button.textContent = label;
    if (decision !== "CONFIRMED") button.className = "secondary-command";
    button.addEventListener("click", async () => {
      const reason = globalObject.prompt?.(`${label}の理由を入力してください`);
      if (!reason?.trim()) return;
      const result = await createStagingCandidateClient({ globalObject })?.decideFairOrigin(row.attribution_id, {
        decision, expectedVersion: row.attribution_version, reason: reason.trim(),
        evidenceReference: row.evidence_reference, reviewNote: reason.trim()
      });
      if (!result?.ok) {
        if (status) status.textContent = result?.category === "version_conflict" ? "別の更新がありました。再読み込みしてください" : "判断を保存できませんでした";
        return;
      }
      await loadFairOriginReview(documentObject, globalObject);
    });
    actions.append(button);
  }
  return actions;
}

export function renderFairOriginReview(documentObject, globalObject, entries = fairOriginReviewEntries) {
  const list = documentObject?.getElementById?.("fair-origin-review-list");
  const status = documentObject?.getElementById?.("fair-origin-review-status");
  const statusFilter = documentObject?.getElementById?.("fair-origin-review-filter")?.value || "ALL";
  const candidateFilter = documentObject?.getElementById?.("fair-origin-review-candidate-filter")?.value || "ALL";
  if (!list) return;
  const allGroups = groupFairOriginReviewEntries(entries);
  const groups = filterFairOriginReviewGroups(allGroups, { candidateFilter, statusFilter });
  const counts = fairOriginReviewLogicalCounts(allGroups);
  if (status) status.textContent = `確認対象 ${counts.logical}件（1候補 ${counts.unique}件 / 複数候補 ${counts.multiple}件）・表示 ${groups.length}件`;
  if (!groups.length) {
    const empty = documentObject.createElement("p"); empty.className = "fair-origin-review-empty";
    empty.textContent = allGroups.length ? "選択した条件の確認候補はありません" : "確認候補はまだ登録されていません";
    list.replaceChildren(empty); return;
  }
  list.replaceChildren(...groups.map((group) => {
    const representative = group.entries[0];
    const card = documentObject.createElement("article");
    card.className = `fair-origin-review-card fair-origin-review-card-${group.candidateKind.toLowerCase()}`;
    const heading = documentObject.createElement("header");
    const title = documentObject.createElement("strong"); title.textContent = representative.candidate_name || "氏名未登録";
    const badge = documentObject.createElement("span"); badge.className = "fair-origin-review-kind";
    badge.textContent = group.candidateKind === "MULTIPLE" ? `複数候補（${group.entries.length}件）` : "1候補";
    heading.append(title, badge);
    const prompt = documentObject.createElement("p"); prompt.className = "fair-origin-review-prompt";
    prompt.textContent = group.candidateKind === "MULTIPLE" ? "候補となるフェアが複数あります" : "この学生はこのフェアがきっかけで合っていますか？";
    const studentDetails = documentObject.createElement("dl"); studentDetails.className = "fair-origin-review-student";
    appendFairOriginReviewField(documentObject, studentDetails, "学生", representative.candidate_name);
    appendFairOriginReviewField(documentObject, studentDetails, "学校", representative.school_name);
    appendFairOriginReviewField(documentObject, studentDetails, "きっかけ", representative.original_trigger);
    const candidates = documentObject.createElement("div"); candidates.className = "fair-origin-review-candidates";
    group.entries.forEach((row, index) => {
      const candidate = documentObject.createElement("section"); candidate.className = "fair-origin-review-candidate";
      const candidateHeading = documentObject.createElement("h3");
      candidateHeading.textContent = group.candidateKind === "MULTIPLE" ? `候補${index + 1}：${row.fair_name || "フェア名未登録"}` : row.fair_name || "フェア名未登録";
      const candidateDetails = documentObject.createElement("dl");
      appendFairOriginReviewField(documentObject, candidateDetails, "候補フェア", row.fair_name);
      appendFairOriginReviewField(documentObject, candidateDetails, "開催日", row.fair_event_date);
      appendFairOriginReviewField(documentObject, candidateDetails, "根拠", row.evidence_reference);
      appendFairOriginReviewField(documentObject, candidateDetails, "確認状態", ({ PENDING: "確認待ち", HOLD: "保留", CONFIRMED: "確認済み", REJECTED: "否認済み" })[fairOriginReviewDisplayStatus(row)] || "状態不明");
      candidate.append(candidateHeading, candidateDetails);
      const actions = appendFairOriginReviewActions(documentObject, globalObject, status, row);
      if (actions) candidate.append(actions);
      candidates.append(candidate);
    });
    card.append(heading, prompt, studentDetails, candidates);
    return card;
  }));
}

function populateCandidateMasterOptions(documentObject, student) {
  const replace = (id, masters, valueKey, labelKey, selected) => {
    const select = documentObject.getElementById(id); if (!select) return;
    const empty = documentObject.createElement("option"); empty.value = ""; empty.textContent = "未設定";
    select.replaceChildren(empty, ...masters.filter((row) => row.is_active !== false).map((row) => {
      const option = documentObject.createElement("option"); option.value = row[valueKey]; option.textContent = row[labelKey]; return option;
    })); select.value = selected || "";
  };
  replace("profile-school-id", studentWorkspaceData?.schoolMasters || [], "school_id", "school_name", student?.schoolId);
  replace("profile-fair-id", studentWorkspaceData?.fairMasters || [], "fair_id", "fair_name", student?.fairId);
}

export function buildRecruitmentMasterViewState(workspace = {}) {
  const availability = workspace?.dashboard?.availability || {};
  const fairReady = availability.fairCount !== false;
  const schoolReady = availability.schoolCount !== false;
  return Object.freeze({
    fairReady,
    schoolReady,
    canManageFair: workspace?.canWrite === true && fairReady,
    canManageSchool: workspace?.canWrite === true && schoolReady,
    fairMasters: Object.freeze(fairReady && Array.isArray(workspace?.fairMasters) ? workspace.fairMasters.slice() : []),
    schoolMasters: Object.freeze(schoolReady && Array.isArray(workspace?.schoolMasters) ? workspace.schoolMasters.slice() : [])
  });
}

function renderRecruitmentMasters(documentObject) {
  const view = buildRecruitmentMasterViewState(studentWorkspaceData || {});
  const fairForm = documentObject.getElementById("fair-master-form");
  const schoolForm = documentObject.getElementById("school-master-form");
  if (fairForm) fairForm.hidden = !view.canManageFair;
  if (schoolForm) schoolForm.hidden = !view.canManageSchool;
  renderFairMasters(documentObject, view.fairMasters, view.fairReady);
  renderSchoolMasters(documentObject, view.schoolMasters, view.schoolReady);
}

function renderFairMasters(documentObject, masters, sourceReady = true) {
  const body = documentObject.getElementById("fair-master-body"); if (!body) return;
  if (!sourceReady) {
    body.replaceChildren();
    const status = documentObject.getElementById("fair-master-status");
    if (status) { status.textContent = "集計準備中"; status.dataset.state = "loading"; }
    const detail = documentObject.getElementById("fair-detail-panel");
    if (detail) detail.hidden = true;
    return;
  }
  const activeMasters = masters.filter((fair) => fair.is_active !== false);
  body.replaceChildren(...activeMasters.map((fair) => {
    const row = documentObject.createElement("tr");
    row.innerHTML = [
      ["フェア", escapeHtml(fair.fair_name)],
      ["開催日", escapeHtml(fair.event_date)],
      ["参加費", fairCurrencyLabel(fair.participation_fee)],
      ["接触", fairCountLabel(fair.contact_count)],
      ["LINE登録", fairCountLabel(fair.line_registration_count)],
      ["見学", fairCountLabel(fair.salon_tour_count)],
      ["担当", escapeHtml(fair.assigned_to || "未設定")],
      ["状態", "有効"],
      ["作成元", "未登録"]
    ].map(([label, value]) => `<td data-label="${label}">${value}</td>`).join("") + '<td data-label="操作"></td>';
    const cell = row.lastElementChild;
    if (cell) {
      cell.append(masterActionButton(documentObject, "詳細", "detail", fair.fair_id));
      if (studentWorkspaceData?.canWrite) cell.append(masterActionButton(documentObject, "編集", "edit", fair.fair_id), masterActionButton(documentObject, fair.is_active === false ? "復元" : "無効化", fair.is_active === false ? "restore" : "deactivate", fair.fair_id));
    }
    return row;
  }));
  const status = documentObject.getElementById("fair-master-status");
  if (status) { status.textContent = `${activeMasters.length}件の有効フェアを表示`; status.dataset.state = "ready"; }
}

function fairCountLabel(value) {
  return value === null || value === undefined ? "未登録" : `${value}件`;
}

function fairCurrencyLabel(value, emptyLabel = "未登録") {
  if (value === null || value === undefined) return emptyLabel;
  const amount = Number(value);
  return Number.isFinite(amount) ? `${Math.round(amount).toLocaleString("ja-JP")}円` : emptyLabel;
}

function fairRateLabel(numerator, denominator) {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) return "集計準備中";
  if (denominator === 0) return "算出不可";
  return `${((Number(numerator) / Number(denominator)) * 100).toFixed(1)}%`;
}

export function fairContactCostLabel(participationFee, contactCount) {
  if (participationFee === null || participationFee === undefined || contactCount === null || contactCount === undefined) {
    return "集計準備中";
  }
  if (Number(contactCount) === 0) return "算出不可（接触0件）";
  return fairCurrencyLabel(Number(participationFee) / Number(contactCount), "集計準備中");
}

function fairCoverageLabel(registeredCount, totalCount) {
  return `${registeredCount} / ${totalCount}件登録`;
}

export function summarizeActiveFairMasters(masters = []) {
  const active = masters.filter((fair) => fair?.is_active !== false);
  const isComplete = (key) => active.every((fair) => fair?.[key] !== null && fair?.[key] !== undefined);
  const registeredCount = (key) => active.filter((fair) => fair?.[key] !== null && fair?.[key] !== undefined).length;
  const sumNullable = (key) => {
    const registered = active.map((fair) => fair?.[key]).filter((value) => value !== null && value !== undefined);
    return registered.length ? registered.reduce((sum, value) => sum + Number(value), 0) : null;
  };
  const contactCount = sumNullable("contact_count");
  const participationFee = sumNullable("participation_fee");
  const contactComplete = isComplete("contact_count");
  const participationFeeComplete = isComplete("participation_fee");
  return Object.freeze({
    activeCount: active.length,
    contactCount,
    contactRegisteredCount: registeredCount("contact_count"),
    contactComplete,
    lineRegistrationCount: sumNullable("line_registration_count"),
    lineRegistrationRegisteredCount: registeredCount("line_registration_count"),
    lineRegistrationComplete: isComplete("line_registration_count"),
    salonTourCount: sumNullable("salon_tour_count"),
    salonTourRegisteredCount: registeredCount("salon_tour_count"),
    salonTourComplete: isComplete("salon_tour_count"),
    participationFee,
    participationFeeRegisteredCount: registeredCount("participation_fee"),
    participationFeeComplete,
    contactCost: !participationFeeComplete || !contactComplete || participationFee === null || contactCount === null || contactCount === 0
      ? null : Math.round(participationFee / contactCount)
  });
}

export function buildFairDetailView(fair = {}) {
  return Object.freeze({
    title: String(fair.fair_name || "フェア詳細"),
    sections: Object.freeze([
      Object.freeze({ title: "基本情報", fields: Object.freeze([
        ["フェア名", fair.fair_name || "未登録"], ["開催日", fair.event_date || "未登録"],
        ["運営会社", fair.organizer_name || "未登録"], ["開催形式", fair.event_format || "未登録"],
        ["会場", fair.venue || "未登録"], ["担当", fair.assigned_to || "未設定"],
        ["状態", fair.is_active === false ? "無効" : "有効"]
      ]) }),
      Object.freeze({ title: "費用・規模", fields: Object.freeze([
        ["参加費", fairCurrencyLabel(fair.participation_fee)], ["接触見込み数", fairCountLabel(fair.expected_contacts)],
        ["全体入場数", fairCountLabel(fair.total_attendance)], ["参加サロン数", fairCountLabel(fair.participating_salons)]
      ]) }),
      Object.freeze({ title: "実績", fields: Object.freeze([
        ["接触数", fairCountLabel(fair.contact_count)], ["LINE登録数", fairCountLabel(fair.line_registration_count)],
        ["見学数", fairCountLabel(fair.salon_tour_count)], ["面接数", "集計準備中"],
        ["内定数", "集計準備中"], ["採用数", "集計準備中"]
      ]) }),
      Object.freeze({ title: "分析", fields: Object.freeze([
        ["LINE登録率", fairRateLabel(fair.line_registration_count, fair.contact_count)],
        ["見学率", fairRateLabel(fair.salon_tour_count, fair.contact_count)],
        ["接触単価", fairContactCostLabel(fair.participation_fee, fair.contact_count)],
        ["採用率", "集計準備中"],
        ["採用単価", "集計準備中"]
      ]) }),
      Object.freeze({ title: "補足", fields: Object.freeze([
        ["備考", fair.note || "未登録"], ["Source Lineage", "未登録"],
        ["作成日時", fair.created_at ? new Date(fair.created_at).toLocaleString("ja-JP") : "未登録"],
        ["Import Batch", "未登録"]
      ]) })
    ])
  });
}

function renderFairDetail(documentObject, fair) {
  const panel = documentObject.getElementById("fair-detail-panel");
  const content = documentObject.getElementById("fair-detail-content");
  if (!panel || !content) return;
  const view = buildFairDetailView(fair);
  setText(documentObject, "fair-detail-title", view.title);
  content.innerHTML = view.sections.map((section) => `<section class="fair-detail-section"><h4>${escapeHtml(section.title)}</h4><dl>${section.fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`).join("");
  panel.hidden = false;
  panel.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

function renderSchoolMasters(documentObject, masters, sourceReady = true) {
  const body = documentObject.getElementById("school-master-body"); if (!body) return;
  if (!sourceReady) {
    body.replaceChildren();
    const status = documentObject.getElementById("school-master-status");
    if (status) { status.textContent = "集計準備中"; status.dataset.state = "loading"; }
    return;
  }
  const students = studentWorkspaceData?.students || [];
  body.replaceChildren(...masters.map((school) => {
    const candidates = students.filter((student) => studentMatchesSchoolMaster(student, school));
    const facts = buildSchoolFactRow(school.school_id, school.school_name, candidates, studentWorkspaceData?.dashboard?.availability);
    const row = documentObject.createElement("tr"); if (school.is_active === false) row.className = "master-row-inactive";
    row.innerHTML = `<td>${escapeHtml(school.school_name)}</td><td>${escapeHtml(school.faculty_name || "-")}</td><td>${escapeHtml(school.assigned_to || "未設定")}</td><td>${candidates.length}</td><td>${facts.salonTours === null ? "集計準備中" : facts.salonTours}</td><td>${facts.interviews === null ? "集計準備中" : facts.interviews}</td><td>${facts.offers === null ? "集計準備中" : facts.offers}</td><td>${facts.hireRate === null ? "集計準備中" : `${facts.hireRate.toFixed(1)}%`}</td><td></td>`;
    const cell = row.lastElementChild;
    if (studentWorkspaceData?.canWrite) cell.append(masterActionButton(documentObject, "編集", "edit", school.school_id), masterActionButton(documentObject, school.is_active === false ? "復元" : "無効化", school.is_active === false ? "restore" : "deactivate", school.school_id));
    return row;
  }));
  const status = documentObject.getElementById("school-master-status");
  if (status) { status.textContent = `${masters.filter((row) => row.is_active !== false).length}校を表示`; status.dataset.state = "ready"; }
}

export function studentMatchesSchoolMaster(student, school) {
  return Boolean(student?.schoolId && student.schoolId === school?.school_id);
}

function masterActionButton(documentObject, label, action, id) {
  const button = documentObject.createElement("button"); button.type = "button"; button.className = "secondary-command compact-command";
  button.textContent = label; button.dataset.masterAction = action; button.dataset.masterId = id; return button;
}

function resetRecruitmentMasterForm(documentObject, entityType) {
  const prefix = entityType === "FAIR" ? "fair-master" : "school-master";
  documentObject.getElementById(`${prefix}-form`)?.reset?.();
  const id = documentObject.getElementById(`${prefix}-id`); const version = documentObject.getElementById(`${prefix}-version`);
  if (id) id.value = ""; if (version) version.value = "";
  if (entityType === "FAIR") configureFairMasterAccuracyInputs(documentObject);
}

const NULLABLE_FAIR_INPUTS = Object.freeze(["fee", "participants", "contacts", "line", "tours"]);
const LEGACY_FAIR_KPI_INPUTS = Object.freeze(["interviews", "offers", "hires"]);

function configureFairMasterAccuracyInputs(documentObject) {
  for (const suffix of NULLABLE_FAIR_INPUTS) {
    const input = documentObject?.getElementById?.(`fair-master-${suffix}`);
    if (input) input.value = "";
  }
  for (const suffix of LEGACY_FAIR_KPI_INPUTS) {
    const input = documentObject?.getElementById?.(`fair-master-${suffix}`);
    if (!input) continue;
    input.value = "";
    input.disabled = true;
    input.setAttribute?.("aria-disabled", "true");
    const field = input.closest?.("label");
    if (field) field.hidden = true;
  }
}

export function parseNullableFairNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0) throw new TypeError("invalid_fair_number");
  return number;
}

export function buildFairMasterMutationPayload({ entityId = "", expectedVersion = null, values = {} } = {}) {
  const text = (key) => String(values[key] ?? "").trim();
  return Object.freeze({
    entityType: "FAIR",
    operation: entityId ? "UPDATE" : "CREATE",
    entityId: entityId || null,
    expectedVersion,
    fairName: text("name"),
    eventDate: text("date"),
    participationFee: parseNullableFairNumber(values.fee),
    venue: text("venue"),
    assignedTo: text("owner"),
    participantCount: parseNullableFairNumber(values.participants),
    contactCount: parseNullableFairNumber(values.contacts),
    lineRegistrationCount: parseNullableFairNumber(values.line),
    salonTourCount: parseNullableFairNumber(values.tours),
    reason: text("reason")
  });
}

async function saveRecruitmentMaster({ globalObject, documentObject, entityType }) {
  const prefix = entityType === "FAIR" ? "fair-master" : "school-master";
  const value = (suffix) => documentObject.getElementById(`${prefix}-${suffix}`)?.value?.trim() || "";
  const entityId = value("id"), expectedVersion = value("version") ? Number(value("version")) : null;
  const status = documentObject.getElementById(`${prefix}-status`); if (status) status.textContent = "保存しています";
  let payload;
  try {
    payload = entityType === "SCHOOL" ? {
      entityType, operation: entityId ? "UPDATE" : "CREATE", entityId: entityId || null, expectedVersion,
      schoolName: value("name"), facultyName: value("faculty"), assignedTo: value("owner"), reason: value("reason")
    } : buildFairMasterMutationPayload({
      entityId,
      expectedVersion,
      values: Object.freeze({
        name: value("name"), date: value("date"), fee: value("fee"), venue: value("venue"), owner: value("owner"),
        participants: value("participants"), contacts: value("contacts"), line: value("line"), tours: value("tours"), reason: value("reason")
      })
    });
  } catch {
    if (status) status.textContent = "件数・金額は0以上の整数で入力してください";
    return;
  }
  const result = await createStagingCandidateClient({ globalObject })?.mutateMaster(payload);
  if (!result?.ok) { if (status) status.textContent = result?.category === "version_conflict" ? "他の更新があります。再読み込みしてください" : "保存できませんでした"; return; }
  resetRecruitmentMasterForm(documentObject, entityType); studentWorkspaceData = null;
  await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
}

async function handleMasterTableAction({ globalObject, documentObject, event, entityType }) {
  const button = event.target?.closest?.("[data-master-action]"); if (!button) return;
  const list = entityType === "FAIR" ? studentWorkspaceData?.fairMasters : studentWorkspaceData?.schoolMasters;
  const idKey = entityType === "FAIR" ? "fair_id" : "school_id";
  const master = (list || []).find((row) => row[idKey] === button.dataset.masterId); if (!master) return;
  const prefix = entityType === "FAIR" ? "fair-master" : "school-master";
  if (entityType === "FAIR" && button.dataset.masterAction === "detail") {
    renderFairDetail(documentObject, master);
    return;
  }
  if (button.dataset.masterAction === "edit") {
    const set = (suffix, value) => { const element = documentObject.getElementById(`${prefix}-${suffix}`); if (element) element.value = value ?? ""; };
    set("id", master[idKey]); set("version", master.version); set("name", master[entityType === "FAIR" ? "fair_name" : "school_name"]); set("owner", master.assigned_to);
    if (entityType === "SCHOOL") set("faculty", master.faculty_name); else {
      set("date", master.event_date); set("fee", master.participation_fee); set("venue", master.venue); set("participants", master.participant_count);
      set("contacts", master.contact_count); set("line", master.line_registration_count); set("tours", master.salon_tour_count);
    }
    documentObject.getElementById(`${prefix}-form`)?.scrollIntoView?.({ behavior: "smooth", block: "start" }); return;
  }
  const operation = button.dataset.masterAction === "restore" ? "RESTORE" : "DEACTIVATE";
  if (!globalObject.confirm?.(operation === "RESTORE" ? "このマスタを復元しますか？" : "このマスタを無効化しますか？")) return;
  const result = await createStagingCandidateClient({ globalObject })?.mutateMaster({ entityType, operation, entityId: master[idKey], expectedVersion: master.version, reason: operation === "RESTORE" ? "業務利用のため復元" : "業務上使用しないため無効化" });
  if (!result?.ok) return; studentWorkspaceData = null; await loadTalentStudentWorkspace({ globalObject, documentObject, force: true });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
