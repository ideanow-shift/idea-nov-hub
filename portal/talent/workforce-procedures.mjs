const API_PATH = "/api/talent/v1/workforce/procedure-cases";
const AUDIT_PATH = `${API_PATH}/audit`;
const STEPS_PATH = `${API_PATH}/steps`;
const PROCEDURE_TYPES = Object.freeze(["ONBOARDING", "TRANSFER", "LEAVE", "RETIREMENT"]);
const CASE_STATUSES = Object.freeze(["DRAFT", "READY_FOR_REVIEW", "CONFIRMED", "CANCELLED"]);
const CASE_FILTERS = Object.freeze(["ALL", "OPEN", ...CASE_STATUSES]);
const PRIORITY_FILTERS = Object.freeze(["ALL", "OVERDUE", "NEXT_7_DAYS", "SCHEDULED"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STEP_LABELS = Object.freeze({
  BASIC_INFO: "基本情報・配属予定を確認", DOCUMENTS: "必要書類を確認", APPROVAL: "関係者の承認を確認", CORE_HANDOFF: "Core反映の引き継ぎを確認",
  CHANGE_DETAILS: "異動内容を確認", STAKEHOLDER_CONFIRMATION: "本人・関係者の確認を記録", APPLICATION: "申請内容を確認", REQUIRED_PROCEDURES: "必要な社内手続きを確認",
  RETURN_PLAN: "復職予定・所属を確認", RETIREMENT_DATE: "退職日・最終出勤日を確認", ASSET_RETURN: "貸与物の返却を確認"
});

export const WORKFORCE_PROCEDURE_CASE_CONTRACT = Object.freeze({
  employeeMasterMutation: false,
  auditHistory: true,
  statusFilters: true,
  openCaseFilter: true,
  caseSearch: true,
  filterReset: true,
  checklistTracking: true,
  optimisticConcurrency: true,
  requestMaxPerAction: 1,
  retryCount: 0
});

export function getActiveWorkforceProcedureType(documentObject) {
  const selected = documentObject?.querySelector?.('[data-workforce-tab][aria-selected="true"]');
  const procedureType = String(selected?.dataset?.procedureType || "");
  return PROCEDURE_TYPES.includes(procedureType) ? procedureType : "ONBOARDING";
}

export function normalizeWorkforceProcedureCasePrefill(value, documentObject) {
  const draft = isRecord(value) ? value : {};
  const procedureType = PROCEDURE_TYPES.includes(draft.procedureType)
    ? draft.procedureType
    : getActiveWorkforceProcedureType(documentObject);
  const subjectLabel = typeof draft.subjectLabel === "string" ? draft.subjectLabel.trim().slice(0, 120) : "";
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(draft.effectiveDate || ""))
    ? String(draft.effectiveDate)
    : "";
  const detail = typeof draft.detail === "string" ? draft.detail.trim().slice(0, 500) : "";
  return Object.freeze({ procedureType, subjectLabel, effectiveDate, detail });
}

export function filterWorkforceProcedureCases(cases, filter = "ALL") {
  if (!Array.isArray(cases) || !CASE_FILTERS.includes(filter)) return Object.freeze([]);
  return Object.freeze(cases.filter((item) => filter === "ALL" || (filter === "OPEN"
    ? ["DRAFT", "READY_FOR_REVIEW"].includes(item.caseStatus)
    : item.caseStatus === filter)));
}

export function filterWorkforceProcedureCasesByType(cases, procedureType = "ALL") {
  if (!Array.isArray(cases) || !["ALL", ...PROCEDURE_TYPES].includes(procedureType)) return Object.freeze([]);
  return Object.freeze(cases.filter((item) => procedureType === "ALL" || item.procedureType === procedureType));
}

export function filterWorkforceProcedureCasesByPriority(cases, priority = "ALL", referenceDate = localDateIso()) {
  if (!Array.isArray(cases) || !PRIORITY_FILTERS.includes(priority)) return Object.freeze([]);
  return Object.freeze(cases.filter((item) => priority === "ALL" || classifyWorkforceProcedureCasePriority(item, referenceDate) === priority));
}

export function filterWorkforceProcedureCasesByQuery(cases, query = "") {
  if (!Array.isArray(cases)) return Object.freeze([]);
  const normalizedQuery = normalizeWorkforceProcedureCaseSearch(query);
  if (!normalizedQuery) return Object.freeze([...cases]);
  return Object.freeze(cases.filter((item) => [item.subjectLabel, item.detail]
    .some((value) => normalizeWorkforceProcedureCaseSearch(value).includes(normalizedQuery))));
}

function normalizeWorkforceProcedureCaseSearch(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP").slice(0, 120) : "";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function safeResult(ok, category, requestCount = 0, data = null) {
  return Object.freeze({ ok, category, requestCount, retryCount: 0, data });
}

function normalizeCaseList(value) {
  if (!exactKeys(value, ["cases"]) || !Array.isArray(value.cases) || value.cases.length > 200) return null;
  const cases = [];
  for (const row of value.cases) {
    if (!exactKeys(row, ["caseId", "procedureType", "caseStatus", "subjectLabel", "effectiveDate", "detail", "version", "updatedAt"])
      || !UUID.test(row.caseId) || !PROCEDURE_TYPES.includes(row.procedureType) || !CASE_STATUSES.includes(row.caseStatus)
      || typeof row.subjectLabel !== "string" || !row.subjectLabel.trim() || row.subjectLabel.trim().length > 120
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate)
      || !(row.detail === null || (typeof row.detail === "string" && row.detail.length <= 500))
      || !Number.isInteger(row.version) || row.version < 1
      || typeof row.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt)) return null;
    cases.push(Object.freeze({ ...row, subjectLabel: row.subjectLabel.trim() }));
  }
  return Object.freeze(cases);
}

function normalizeSaveResult(value) {
  if (!exactKeys(value, ["caseId", "caseVersion", "operation"])
    || !UUID.test(value.caseId) || !Number.isInteger(value.caseVersion) || value.caseVersion < 1
    || !["CREATE", "UPDATE"].includes(value.operation)) return null;
  return Object.freeze({ ...value });
}

function normalizeAudit(value) {
  if (!exactKeys(value, ["entries"]) || !Array.isArray(value.entries) || value.entries.length > 20) return null;
  const allowedFields = ["procedureType", "caseStatus", "subjectLabel", "effectiveDate", "detail"];
  const entries = [];
  for (const row of value.entries) {
    if (!exactKeys(row, ["action", "changedFields", "caseVersion", "occurredAt"])
      || !["CREATE", "UPDATE"].includes(row.action) || !Array.isArray(row.changedFields)
      || row.changedFields.length < 1 || row.changedFields.length > 5
      || row.changedFields.some((field) => !allowedFields.includes(field))
      || new Set(row.changedFields).size !== row.changedFields.length
      || !Number.isInteger(row.caseVersion) || row.caseVersion < 1
      || typeof row.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.occurredAt)) return null;
    entries.push(Object.freeze({ ...row, changedFields: Object.freeze([...row.changedFields]) }));
  }
  return Object.freeze(entries);
}

export function isWorkforceProcedureCaseReadyToConfirm(steps) {
  return Array.isArray(steps) && steps.length === 4 && steps.every((step) => step && step.isCompleted === true);
}

export function classifyWorkforceProcedureCasePriority(item, referenceDate = localDateIso()) {
  if (!item || !CASE_STATUSES.includes(item.caseStatus) || !/^\d{4}-\d{2}-\d{2}$/.test(item.effectiveDate || "")) return "SCHEDULED";
  if (["CONFIRMED", "CANCELLED"].includes(item.caseStatus)) return "CLOSED";
  const distance = daysBetween(referenceDate, item.effectiveDate);
  if (distance < 0) return "OVERDUE";
  if (distance <= 7) return "NEXT_7_DAYS";
  return "SCHEDULED";
}

export function sortWorkforceProcedureCases(cases, referenceDate = localDateIso()) {
  const order = { OVERDUE: 0, NEXT_7_DAYS: 1, SCHEDULED: 2, CLOSED: 3 };
  return Object.freeze([...cases].sort((left, right) => {
    const priority = order[classifyWorkforceProcedureCasePriority(left, referenceDate)] - order[classifyWorkforceProcedureCasePriority(right, referenceDate)];
    if (priority !== 0) return priority;
    return String(left.effectiveDate).localeCompare(String(right.effectiveDate));
  }));
}

export function buildWorkforceProcedureOperationSummary(cases, referenceDate = localDateIso()) {
  const rows = Array.isArray(cases) ? cases : [];
  const overdue = rows.filter((item) => classifyWorkforceProcedureCasePriority(item, referenceDate) === "OVERDUE").length;
  const soon = rows.filter((item) => classifyWorkforceProcedureCasePriority(item, referenceDate) === "NEXT_7_DAYS").length;
  const review = rows.filter((item) => item?.caseStatus === "READY_FOR_REVIEW").length;
  const draft = rows.filter((item) => item?.caseStatus === "DRAFT").length;
  const nextAction = overdue > 0
    ? "OVERDUE"
    : soon > 0 ? "NEXT_7_DAYS"
      : review > 0 ? "READY_FOR_REVIEW"
        : draft > 0 ? "DRAFT"
          : "NO_OPEN_WORK";
  const title = {
    OVERDUE: "期限超過の手続きから処理してください",
    NEXT_7_DAYS: "7日以内の手続きを前倒し確認します",
    READY_FOR_REVIEW: "確認待ち案件をチェックリストで確認します",
    DRAFT: "下書き案件を開いて不足情報を補います",
    NO_OPEN_WORK: "今日の優先処理はありません"
  }[nextAction];
  const copy = {
    OVERDUE: "社員マスタは変更せず、案件の状態・期限・確認項目を先に整えます。",
    NEXT_7_DAYS: "直近の入社・異動・休復職・退職を先に見て、担当者が迷わない状態にします。",
    READY_FOR_REVIEW: "確認待ちはチェックリスト完了後に確認済みへ進めます。",
    DRAFT: "下書きは対象者・実施日・メモを整えて確認待ちへ回します。",
    NO_OPEN_WORK: "対応中・確認待ちの期限キューは落ち着いています。"
  }[nextAction];
  return Object.freeze({ overdue, soon, review, draft, nextAction, title, copy });
}

export function buildWorkforceProcedureCaseFormGuide(draft, referenceDate = localDateIso()) {
  const priority = classifyWorkforceProcedureCasePriority(draft, referenceDate);
  const status = draft?.caseStatus;
  const category = status === "CONFIRMED"
    ? "CONFIRMED"
    : status === "CANCELLED"
      ? "CANCELLED"
      : priority === "OVERDUE"
        ? "OVERDUE"
        : priority === "NEXT_7_DAYS"
          ? "NEXT_7_DAYS"
          : status === "READY_FOR_REVIEW"
            ? "READY_FOR_REVIEW"
            : "DRAFT";
  const title = {
    OVERDUE: "期限超過です。確認項目と基準日を先に整えます",
    NEXT_7_DAYS: "7日以内の手続きです。確認待ちへ進める準備をします",
    READY_FOR_REVIEW: "確認待ちです。チェックリスト完了後に確認済みへ進めます",
    DRAFT: "下書きです。対象者・基準日・メモを補います",
    CONFIRMED: "確認済みです。変更時は履歴を確認してから更新します",
    CANCELLED: "中止案件です。再開する場合はメモで理由を残します"
  }[category];
  const copy = {
    OVERDUE: "社員マスタは変更せず、この案件だけを保存します。確認済みにする前に確認項目が必要です。",
    NEXT_7_DAYS: "不足情報を補ってから確認待ちにすると、日常キューで追いやすくなります。",
    READY_FOR_REVIEW: "保存前に確認項目を開き、すべて完了しているか確認してください。",
    DRAFT: "迷ったら下書きのまま保存できます。担当者が後で検索・期限順で拾えます。",
    CONFIRMED: "確認済みは監査履歴に残ります。取り消しや変更は理由をメモに残してください。",
    CANCELLED: "中止は対応中キューから外れます。誤って選んだ場合は下書きへ戻してください。"
  }[category];
  return Object.freeze({ category, title, copy });
}

export function buildWorkforceProcedureStatusMessage(category) {
  const messages = {
    idle: "手続き案件を読み込むと、下書き・確認・中止の履歴を管理できます。社員マスタはここでは変更しません。",
    loading: "手続き案件を読み込んでいます。",
    loaded: "手続き案件を表示しました。編集は案件履歴に記録されます。",
    saved: "手続き案件を保存しました。社員マスタへの反映は別の承認済み手続きで行います。",
    feature_disabled: "手続き案件の編集機能は未接続です。画面確認と導線確認はできますが、保存はまだ行えません。",
    auth_required: "認証を確認できません。ログイン状態を確認してから、保存や履歴表示をやり直してください。",
    write_forbidden: "このアカウントでは手続き案件の編集権限を確認できません。閲覧できる範囲で確認し、権限付与後に保存してください。",
    not_ready: "手続き案件APIは準備中です。入力内容は画面で確認できますが、保存は有効化後に行ってください。",
    invalid_request: "入力内容を確認してください。対象者・基準日・進捗は必須です。",
    checklist_incomplete: "確認済みにする前に、案件の確認項目をすべて完了してください。",
    invalid_response: "手続き案件の応答を確認できませんでした。値は表示せず、安全に停止しました。",
    request_failed: "手続き案件を保存できませんでした。再読み込み後、重複保存に注意して確認してください。",
    busy: "処理中です。完了するまで次の操作を待ってください。"
  };
  return messages[category] || messages.request_failed;
}

function normalizeSteps(value) {
  if (!exactKeys(value, ["procedureType", "steps"]) || !PROCEDURE_TYPES.includes(value.procedureType)
    || !Array.isArray(value.steps) || value.steps.length !== 4) return null;
  const keys = Object.keys(STEP_LABELS);
  const steps = [];
  for (const row of value.steps) {
    if (!exactKeys(row, ["stepKey", "isCompleted", "version", "updatedAt"])
      || !keys.includes(row.stepKey) || typeof row.isCompleted !== "boolean"
      || !Number.isInteger(row.version) || row.version < 0
      || !(row.updatedAt === null || (typeof row.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt)))) return null;
    steps.push(Object.freeze({ ...row }));
  }
  if (new Set(steps.map((step) => step.stepKey)).size !== steps.length) return null;
  return Object.freeze({ procedureType: value.procedureType, steps: Object.freeze(steps) });
}

function normalizeStepSaveResult(value) {
  if (!exactKeys(value, ["caseId", "stepKey", "stepVersion", "operation"])
    || !UUID.test(value.caseId) || !Object.hasOwn(STEP_LABELS, value.stepKey)
    || !Number.isInteger(value.stepVersion) || value.stepVersion < 1
    || !["COMPLETE", "REOPEN"].includes(value.operation)) return null;
  return Object.freeze({ ...value });
}

function normalizeDraft(value) {
  if (!isRecord(value) || !exactKeys(value, ["caseId", "expectedVersion", "procedureType", "caseStatus", "subjectLabel", "effectiveDate", "detail"])
    || !(value.caseId === null || UUID.test(value.caseId)) || !Number.isInteger(value.expectedVersion) || value.expectedVersion < 0
    || !PROCEDURE_TYPES.includes(value.procedureType) || !CASE_STATUSES.includes(value.caseStatus)
    || typeof value.subjectLabel !== "string" || typeof value.effectiveDate !== "string") return null;
  const subjectLabel = value.subjectLabel.normalize("NFKC").trim();
  const detail = value.detail === "" || value.detail === null ? null : typeof value.detail === "string" ? value.detail.trim() : undefined;
  if (!subjectLabel || subjectLabel.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(value.effectiveDate)
    || detail === undefined || (detail !== null && detail.length > 500)
    || (value.caseId === null && value.expectedVersion !== 0)) return null;
  return Object.freeze({ ...value, subjectLabel, detail });
}

function failureCategory(status) {
  if (status === 401) return "auth_required";
  if (status === 403) return "write_forbidden";
  if (status === 503) return "not_ready";
  return "request_failed";
}

export function createWorkforceProcedureCaseController({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  config = globalObject.NOV_TALENT_CONFIG,
  helper = globalObject.NovHubSession
} = {}) {
  const baseUrl = normalizeBaseUrl(config?.writeApiBaseUrl);
  const enabled = config?.writeApiEnabled === true && baseUrl !== null
    && typeof fetchImpl === "function" && typeof helper?.getSessionToken === "function";
  let busy = false;

  const request = async (method, payload = null, path = API_PATH) => {
    if (!enabled) return safeResult(false, "feature_disabled");
    if (busy) return safeResult(false, "busy");
    busy = true;
    try {
      let token;
      try {
        token = await helper.getSessionToken({ audience: "nov_hub" });
      } catch {
        return safeResult(false, "auth_required");
      }
      if (typeof token !== "string" || !token) return safeResult(false, "auth_required");
      let response;
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          headers: { authorization: `Bearer ${token}`, ...(payload ? { "content-type": "application/json" } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {})
        });
      } catch {
        return safeResult(false, "request_failed", 1);
      }
      if (!response.ok) return safeResult(false, failureCategory(response.status), 1);
      const body = await response.json().catch(() => null);
      if (!isRecord(body) || body.ok !== true || !Object.hasOwn(body, "data")) return safeResult(false, "invalid_response", 1);
      return safeResult(true, "saved", 1, body.data);
    } finally {
      busy = false;
    }
  };

  return Object.freeze({
    enabled,
    isBusy: () => busy,
    async load() {
      const result = await request("GET");
      const cases = result.ok ? normalizeCaseList(result.data) : null;
      return cases ? safeResult(true, "loaded", result.requestCount, cases) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async save(draft) {
      const payload = normalizeDraft(draft);
      if (!payload) return safeResult(false, "invalid_request");
      const result = await request("POST", payload);
      const saved = result.ok ? normalizeSaveResult(result.data) : null;
      return saved ? safeResult(true, "saved", result.requestCount, saved) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async loadAudit(caseId) {
      if (!UUID.test(caseId)) return safeResult(false, "invalid_request");
      const result = await request("GET", null, `${AUDIT_PATH}?caseId=${encodeURIComponent(caseId)}`);
      const entries = result.ok ? normalizeAudit(result.data) : null;
      return entries ? safeResult(true, "loaded", result.requestCount, entries) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async loadSteps(caseId) {
      if (!UUID.test(caseId)) return safeResult(false, "invalid_request");
      const result = await request("GET", null, `${STEPS_PATH}?caseId=${encodeURIComponent(caseId)}`);
      const steps = result.ok ? normalizeSteps(result.data) : null;
      return steps ? safeResult(true, "loaded", result.requestCount, steps) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async saveStep(draft) {
      if (!isRecord(draft) || !exactKeys(draft, ["caseId", "stepKey", "completed", "expectedVersion"])
        || !UUID.test(draft.caseId) || !Object.hasOwn(STEP_LABELS, draft.stepKey)
        || typeof draft.completed !== "boolean" || !Number.isInteger(draft.expectedVersion) || draft.expectedVersion < 0) return safeResult(false, "invalid_request");
      const result = await request("POST", draft, STEPS_PATH);
      const saved = result.ok ? normalizeStepSaveResult(result.data) : null;
      return saved ? safeResult(true, "saved", result.requestCount, saved) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    }
  });
}

export function initializeWorkforceProcedureDesk({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch
} = {}) {
  const desk = documentObject?.getElementById?.("workforce-procedure-desk");
  const list = documentObject?.getElementById?.("workforce-case-list");
  const form = documentObject?.getElementById?.("workforce-case-form");
  const status = documentObject?.getElementById?.("workforce-case-status");
  const audit = documentObject?.getElementById?.("workforce-case-audit");
  const auditList = documentObject?.getElementById?.("workforce-case-audit-list");
  const auditStatus = documentObject?.getElementById?.("workforce-case-audit-status");
  const steps = documentObject?.getElementById?.("workforce-case-steps");
  const stepsList = documentObject?.getElementById?.("workforce-case-steps-list");
  const stepsStatus = documentObject?.getElementById?.("workforce-case-steps-status");
  const filterStatus = documentObject?.getElementById?.("workforce-case-filter-status");
  const priorityStatus = documentObject?.getElementById?.("workforce-case-priority-status");
  const operationSummary = documentObject?.getElementById?.("workforce-case-operation-summary");
  const procedureFilter = documentObject?.getElementById?.("workforce-case-procedure-filter");
  const searchInput = documentObject?.getElementById?.("workforce-case-search");
  const filterResetButton = documentObject?.getElementById?.("workforce-case-filter-reset");
  const formGuide = documentObject?.getElementById?.("workforce-case-form-guide");
  const formGuideTitle = documentObject?.getElementById?.("workforce-case-form-guide-title");
  const formGuideCopy = documentObject?.getElementById?.("workforce-case-form-guide-copy");
  if (!desk || !list || !form || !status || !audit || !auditList || !auditStatus || !steps || !stepsList || !stepsStatus || !filterStatus || !priorityStatus || !operationSummary || !procedureFilter || !searchInput || !filterResetButton || !formGuide || !formGuideTitle || !formGuideCopy) return Object.freeze({ initialized: false, load: async () => safeResult(false, "not_ready") });
  if (desk.dataset.bound === "true") return Object.freeze({ initialized: true, duplicateBindingPrevented: true, load: async () => safeResult(false, "already_bound") });
  desk.dataset.bound = "true";
  const controller = createWorkforceProcedureCaseController({ globalObject, fetchImpl });
  let cases = [];
  let activeFilter = "ALL";
  let activeProcedureType = getActiveWorkforceProcedureType(documentObject);
  let activePriority = "ALL";
  let activeSearch = "";
  procedureFilter.value = activeProcedureType;

  const updateStatusFilterButtons = () => {
    for (const button of desk.querySelectorAll("[data-case-status-filter]")) {
      const selected = button.dataset.caseStatusFilter === activeFilter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  };
  const updatePriorityFilterButtons = () => {
    for (const button of desk.querySelectorAll("[data-case-priority-filter]")) {
      const selected = button.dataset.casePriorityFilter === activePriority;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  };
  const hasActiveFilters = () => activeFilter !== "ALL" || activePriority !== "ALL" || activeSearch !== "" || activeProcedureType !== getActiveWorkforceProcedureType(documentObject);
  const updateFilterResetButton = () => {
    const active = hasActiveFilters();
    filterResetButton.disabled = !active;
    filterResetButton.setAttribute("aria-disabled", String(!active));
  };

  const setStatus = (category) => {
    status.dataset.category = category;
    status.textContent = buildWorkforceProcedureStatusMessage(category);
  };
  const input = (name) => form.elements.namedItem(name);
  const currentDraftFromForm = () => Object.freeze({
    caseStatus: input("caseStatus")?.value,
    effectiveDate: input("effectiveDate")?.value
  });
  const renderFormGuide = () => {
    const guide = buildWorkforceProcedureCaseFormGuide(currentDraftFromForm());
    formGuide.dataset.category = guide.category;
    formGuideTitle.textContent = guide.title;
    formGuideCopy.textContent = guide.copy;
  };
  const reset = () => {
    form.reset();
    input("caseId").value = "";
    input("expectedVersion").value = "0";
    form.hidden = true;
  };
  const clearAudit = () => {
    audit.hidden = true;
    auditList.replaceChildren();
    auditStatus.textContent = "";
  };
  const clearSteps = () => {
    steps.hidden = true;
    stepsList.replaceChildren();
    stepsStatus.textContent = "";
  };
  const setFilter = (nextFilter) => {
    activeFilter = CASE_FILTERS.includes(nextFilter) ? nextFilter : "ALL";
    updateStatusFilterButtons();
    updateFilterResetButton();
    render();
  };
  const setProcedureType = (nextProcedureType) => {
    activeProcedureType = ["ALL", ...PROCEDURE_TYPES].includes(nextProcedureType) ? nextProcedureType : "ALL";
    procedureFilter.value = activeProcedureType;
    updateFilterResetButton();
    render();
  };
  const setPriorityFilter = (nextPriority) => {
    activePriority = PRIORITY_FILTERS.includes(nextPriority) ? nextPriority : "ALL";
    updatePriorityFilterButtons();
    updateFilterResetButton();
    render();
  };
  const setSearch = (nextSearch) => {
    activeSearch = normalizeWorkforceProcedureCaseSearch(nextSearch);
    updateFilterResetButton();
    render();
  };
  const resetFilters = () => {
    activeFilter = "ALL";
    activePriority = "ALL";
    activeSearch = "";
    activeProcedureType = getActiveWorkforceProcedureType(documentObject);
    procedureFilter.value = activeProcedureType;
    searchInput.value = "";
    updateStatusFilterButtons();
    updatePriorityFilterButtons();
    updateFilterResetButton();
    render();
  };
  const renderOperationSummary = (summary) => {
    const set = (id, value) => {
      const element = documentObject.getElementById(id);
      if (element) element.textContent = String(value);
    };
    operationSummary.dataset.nextAction = summary.nextAction;
    set("workforce-case-operation-title", summary.title);
    set("workforce-case-operation-copy", summary.copy);
    set("workforce-case-operation-overdue", summary.overdue);
    set("workforce-case-operation-soon", summary.soon);
    set("workforce-case-operation-review", summary.review);
    set("workforce-case-operation-draft", summary.draft);
  };
  const renderOverview = (filteredCount = null) => {
    const scopedCases = filterWorkforceProcedureCasesByType(cases, activeProcedureType);
    const counts = Object.fromEntries(CASE_FILTERS.map((key) => [key, filterWorkforceProcedureCases(scopedCases, key).length]));
    const countIds = { ALL: "workforce-case-count-all", OPEN: "workforce-case-count-open", DRAFT: "workforce-case-count-draft", READY_FOR_REVIEW: "workforce-case-count-review", CONFIRMED: "workforce-case-count-confirmed", CANCELLED: "workforce-case-count-cancelled" };
    for (const [key, id] of Object.entries(countIds)) {
      const element = documentObject.getElementById(id);
      if (element) element.textContent = String(counts[key]);
    }
    const visibleCount = Number.isInteger(filteredCount) ? filteredCount : counts[activeFilter];
    const procedureScope = activeProcedureType === "ALL" ? "すべての手続き" : procedureLabel(activeProcedureType);
    const priorityScope = activePriority === "ALL" ? "" : ` / ${priorityLabel(activePriority)}`;
    filterStatus.textContent = activeFilter === "ALL" ? `${procedureScope}${priorityScope}の案件 ${visibleCount}件を表示しています。` : `${procedureScope} / ${statusLabel(activeFilter)}${priorityScope} ${visibleCount}件を表示しています。`;
    const overdue = scopedCases.filter((item) => classifyWorkforceProcedureCasePriority(item) === "OVERDUE").length;
    const soon = scopedCases.filter((item) => classifyWorkforceProcedureCasePriority(item) === "NEXT_7_DAYS").length;
    renderOperationSummary(buildWorkforceProcedureOperationSummary(scopedCases));
    priorityStatus.textContent = overdue > 0 ? `期限を過ぎた案件 ${overdue}件、直近7日の案件 ${soon}件があります。` : soon > 0 ? `直近7日の案件が ${soon}件あります。` : "期限超過・直近7日の案件はありません。";
  };
  const showAudit = async (item) => {
    audit.hidden = false;
    auditStatus.textContent = "変更履歴を読み込んでいます。";
    auditList.replaceChildren();
    const result = await controller.loadAudit(item.caseId);
    if (!result.ok) {
      auditStatus.textContent = "変更履歴を表示できませんでした。";
      return;
    }
    auditStatus.textContent = result.data.length === 0 ? "表示できる変更履歴はありません。" : "この案件の変更履歴です。";
    const fragment = documentObject.createDocumentFragment();
    for (const entry of result.data) {
      const row = documentObject.createElement("li");
      const title = documentObject.createElement("strong");
      const meta = documentObject.createElement("span");
      title.textContent = `${entry.action === "CREATE" ? "案件を登録" : "案件を更新"}（第${entry.caseVersion}版）`;
      meta.textContent = `${entry.changedFields.map(fieldLabel).join("、")}を更新 / ${formatAuditTime(entry.occurredAt)}`;
      row.append(title, meta);
      fragment.append(row);
    }
    auditList.append(fragment);
    audit.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  };
  const showSteps = async (item) => {
    steps.hidden = false;
    stepsStatus.textContent = "確認項目を読み込んでいます。";
    stepsList.replaceChildren();
    const result = await controller.loadSteps(item.caseId);
    if (!result.ok) {
      stepsStatus.textContent = "確認項目を表示できませんでした。";
      return;
    }
    const completed = result.data.steps.filter((step) => step.isCompleted).length;
    stepsStatus.textContent = `${procedureLabel(result.data.procedureType)}の確認項目 ${completed} / ${result.data.steps.length} 件が完了しています。`;
    const fragment = documentObject.createDocumentFragment();
    for (const step of result.data.steps) {
      const label = documentObject.createElement("label");
      label.className = `procedure-case-step${step.isCompleted ? " is-completed" : ""}`;
      const checkbox = documentObject.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = step.isCompleted;
      const text = documentObject.createElement("span");
      text.textContent = STEP_LABELS[step.stepKey];
      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        const saved = await controller.saveStep({ caseId: item.caseId, stepKey: step.stepKey, completed: checkbox.checked, expectedVersion: step.version });
        if (saved.ok) {
          await showSteps(item);
        } else {
          checkbox.checked = step.isCompleted;
          checkbox.disabled = false;
          stepsStatus.textContent = "確認項目を更新できませんでした。画面を再読み込みして状態を確認してください。";
        }
      });
      label.append(checkbox, text);
      fragment.append(label);
    }
    stepsList.append(fragment);
    steps.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  };
  const render = () => {
    list.replaceChildren();
    const visibleCases = sortWorkforceProcedureCases(filterWorkforceProcedureCasesByQuery(filterWorkforceProcedureCasesByPriority(
      filterWorkforceProcedureCases(filterWorkforceProcedureCasesByType(cases, activeProcedureType), activeFilter),
      activePriority
    ), activeSearch));
    renderOverview(visibleCases.length);
    if (visibleCases.length === 0) {
      const empty = documentObject.createElement("p");
      empty.className = "procedure-case-empty";
      empty.textContent = cases.length === 0 ? "登録済みの手続き案件はありません。" : "この進捗の手続き案件はありません。";
      if (hasActiveFilters()) {
        const resetButton = documentObject.createElement("button");
        resetButton.type = "button";
        resetButton.className = "case-edit-button procedure-case-empty-reset";
        resetButton.textContent = "絞り込みを解除";
        resetButton.addEventListener("click", resetFilters);
        empty.append(resetButton);
      }
      list.append(empty);
      return;
    }
    const fragment = documentObject.createDocumentFragment();
    for (const item of visibleCases) {
      const row = documentObject.createElement("article");
      row.className = "procedure-case-row";
      const copy = documentObject.createElement("div");
      const title = documentObject.createElement("strong");
      const meta = documentObject.createElement("span");
      const priority = documentObject.createElement("span");
      const priorityCategory = classifyWorkforceProcedureCasePriority(item);
      title.textContent = item.subjectLabel;
      meta.textContent = `${procedureLabel(item.procedureType)} / ${statusLabel(item.caseStatus)} / ${item.effectiveDate}`;
      priority.className = `procedure-case-priority${priorityCategory === "OVERDUE" ? " is-overdue" : priorityCategory === "NEXT_7_DAYS" ? " is-soon" : ""}`;
      priority.textContent = priorityLabel(priorityCategory);
      copy.append(title, meta, priority);
      const edit = documentObject.createElement("button");
      edit.type = "button";
      edit.className = "case-edit-button";
      edit.textContent = "編集";
      edit.addEventListener("click", () => {
        input("caseId").value = item.caseId;
        input("expectedVersion").value = String(item.version);
        input("procedureType").value = item.procedureType;
        input("caseStatus").value = item.caseStatus;
        input("subjectLabel").value = item.subjectLabel;
        input("effectiveDate").value = item.effectiveDate;
        input("detail").value = item.detail || "";
        renderFormGuide();
        form.hidden = false;
        form.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      });
      const actions = documentObject.createElement("div");
      actions.className = "procedure-case-actions-inline";
      const history = documentObject.createElement("button");
      history.type = "button";
      history.className = "case-edit-button";
      history.textContent = "変更履歴";
      history.addEventListener("click", () => showAudit(item));
      const checklist = documentObject.createElement("button");
      checklist.type = "button";
      checklist.className = "case-edit-button";
      checklist.textContent = "確認項目";
      checklist.addEventListener("click", () => showSteps(item));
      actions.append(checklist, history, edit);
      row.append(copy, actions);
      fragment.append(row);
    }
    list.append(fragment);
  };
  const load = async () => {
    setStatus("loading");
    const result = await controller.load();
    if (result.ok) {
      cases = result.data;
      render();
    }
    setStatus(result.category);
    return result;
  };

  const openNewCase = (prefill = {}) => {
    reset();
    const normalized = normalizeWorkforceProcedureCasePrefill(prefill, documentObject);
    input("procedureType").value = normalized.procedureType;
    input("subjectLabel").value = normalized.subjectLabel;
    input("effectiveDate").value = normalized.effectiveDate;
    input("detail").value = normalized.detail;
    renderFormGuide();
    form.hidden = false;
    input("subjectLabel")?.focus?.();
  };
  documentObject.getElementById("workforce-case-new")?.addEventListener("click", () => openNewCase());
  for (const button of documentObject.querySelectorAll?.("[data-procedure-new]") || []) {
    button.addEventListener("click", () => openNewCase({ procedureType: String(button.dataset.procedureNew || "") }));
  }
  documentObject.addEventListener?.("nov-talent:open-procedure-case", (event) => {
    openNewCase(event?.detail);
    form.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
  documentObject.getElementById("workforce-case-cancel")?.addEventListener("click", reset);
  documentObject.getElementById("workforce-case-audit-close")?.addEventListener("click", clearAudit);
  documentObject.getElementById("workforce-case-steps-close")?.addEventListener("click", clearSteps);
  for (const button of desk.querySelectorAll("[data-case-status-filter]")) {
    button.addEventListener("click", () => setFilter(button.dataset.caseStatusFilter));
  }
  for (const button of desk.querySelectorAll("[data-case-priority-filter]")) {
    button.addEventListener("click", () => setPriorityFilter(button.dataset.casePriorityFilter));
  }
  procedureFilter.addEventListener("change", () => setProcedureType(procedureFilter.value));
  searchInput.addEventListener("input", () => setSearch(searchInput.value));
  filterResetButton.addEventListener("click", resetFilters);
  input("caseStatus").addEventListener("change", renderFormGuide);
  input("effectiveDate").addEventListener("change", renderFormGuide);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const draft = Object.freeze({
      caseId: input("caseId").value || null,
      expectedVersion: Number(input("expectedVersion").value),
      procedureType: input("procedureType").value,
      caseStatus: input("caseStatus").value,
      subjectLabel: input("subjectLabel").value,
      effectiveDate: input("effectiveDate").value,
      detail: input("detail").value
    });
    if (draft.caseStatus === "CONFIRMED") {
      if (draft.caseId === null) {
        setStatus("checklist_incomplete");
        return;
      }
      const checklist = await controller.loadSteps(draft.caseId);
      if (!checklist.ok || !isWorkforceProcedureCaseReadyToConfirm(checklist.data.steps)) {
        setStatus("checklist_incomplete");
        return;
      }
    }
    const controls = [...form.querySelectorAll("button,input,select,textarea")];
    controls.forEach((control) => { control.disabled = true; });
    try {
      const saved = await controller.save(draft);
      if (saved.ok) {
        reset();
        await load();
      } else {
        setStatus(saved.category);
      }
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  });
  setStatus(controller.enabled ? "idle" : "feature_disabled");
  updateStatusFilterButtons();
  updatePriorityFilterButtons();
  updateFilterResetButton();
  return Object.freeze({ initialized: true, enabled: controller.enabled, load, setProcedureType, resetFilters, controller });
}

function procedureLabel(value) {
  return ({ ONBOARDING: "入社", TRANSFER: "異動", LEAVE: "休職・復職", RETIREMENT: "退職" })[value] || "手続き";
}

function statusLabel(value) {
  if (value === "OPEN") return "対応中";
  return ({ DRAFT: "下書き", READY_FOR_REVIEW: "確認待ち", CONFIRMED: "確認済み", CANCELLED: "中止" })[value] || "未設定";
}

function fieldLabel(value) {
  return ({ procedureType: "手続き", caseStatus: "進捗", subjectLabel: "対象者", effectiveDate: "基準日", detail: "手続きメモ" })[value] || "項目";
}

function formatAuditTime(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "記録時刻を確認中";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function priorityLabel(value) {
  return ({ OVERDUE: "期限超過", NEXT_7_DAYS: "直近7日", SCHEDULED: "予定", CLOSED: "完了・中止" })[value] || "予定";
}

function localDateIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
