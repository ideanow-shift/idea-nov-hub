const WORKFORCE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "onboarding", label: "入社手続き", description: "入社予定から受け入れ完了まで" }),
  Object.freeze({ key: "transfer", label: "異動手続き", description: "所属・役職変更の承認と反映" }),
  Object.freeze({ key: "leave", label: "休職・復職", description: "休職開始から復職完了まで" }),
  Object.freeze({ key: "retirement", label: "退職手続き", description: "退職受付から完了確認まで" })
]);

const WORKFORCE_SUMMARY_KEYS = Object.freeze([
  "activeEmployeeCount",
  "onboardingCount",
  "leaveCount",
  "retirementCount",
  "transferAvailable",
  "transferCount",
  "asOfDate",
  "procedureQueues"
]);

const QUEUE_PROCEDURE_TYPES = Object.freeze({
  onboarding: "ONBOARDING",
  leave: "LEAVE",
  retirement: "RETIREMENT"
});

export const WORKFORCE_READONLY_CONTRACT = Object.freeze({
  source: "CORE_DB",
  mode: "READ_ONLY",
  personalValuesReturned: true,
  contactValuesReturned: false,
  mutationsAllowed: false,
  status: "NOT_CONNECTED"
});

export function buildWorkforceReadinessViewModel({
  source = WORKFORCE_READONLY_CONTRACT.source,
  mode = WORKFORCE_READONLY_CONTRACT.mode,
  status = WORKFORCE_READONLY_CONTRACT.status,
  summary = null
} = {}) {
  const safeSource = source === "CORE_DB" ? source : "UNKNOWN";
  const safeMode = mode === "READ_ONLY" ? mode : "UNAVAILABLE";
  const safeSummary = isWorkforceSummary(summary) ? Object.freeze({ ...summary }) : null;
  const safeStatus = safeSource === "CORE_DB" && safeMode === "READ_ONLY" && status === "CONNECTED" && safeSummary
    ? "CONNECTED"
    : "NOT_CONNECTED";
  return Object.freeze({
    source: safeSource,
    mode: safeMode,
    status: safeStatus,
    countsAvailable: safeStatus === "CONNECTED",
    summary: safeSummary,
    categories: WORKFORCE_CATEGORIES,
    personalValuesReturned: safeStatus === "CONNECTED",
    contactValuesReturned: false,
    mutationsAllowed: false
  });
}

export function renderWorkforceReadiness(documentObject = globalThis.document, viewModel = buildWorkforceReadinessViewModel()) {
  if (!documentObject?.getElementById) return Object.freeze({ rendered: false });
  const statusText = viewModel.status === "CONNECTED" ? "Core DB 読み取り済み" : "Core DB 読み取り待ち";
  const sourceText = viewModel.source === "CORE_DB" ? "Core DB 正本" : "接続先未確定";
  const modeText = viewModel.mode === "READ_ONLY" ? "読み取り専用" : "利用停止";
  setText(documentObject, "workforce-status", statusText);
  setText(documentObject, "workforce-source", sourceText);
  setText(documentObject, "workforce-mode", modeText);
  const summary = viewModel.summary;
  setText(documentObject, "workforce-count-onboarding", viewModel.countsAvailable ? String(summary.onboardingCount) : "未接続");
  setText(documentObject, "workforce-count-transfer", viewModel.countsAvailable
    ? (summary.transferAvailable ? String(summary.transferCount) : "未連携")
    : "未接続");
  setText(documentObject, "workforce-count-leave", viewModel.countsAvailable ? String(summary.leaveCount) : "未接続");
  setText(documentObject, "workforce-count-retirement", viewModel.countsAvailable ? String(summary.retirementCount) : "未接続");
  setText(documentObject, "workforce-as-of", viewModel.countsAvailable ? `基準日 ${summary.asOfDate}` : "基準日 未確定");
  renderProcedureQueue(documentObject, "onboarding", viewModel.countsAvailable ? summary.procedureQueues.onboarding : null);
  renderProcedureQueue(documentObject, "leave", viewModel.countsAvailable ? summary.procedureQueues.leave : null);
  renderProcedureQueue(documentObject, "retirement", viewModel.countsAvailable ? summary.procedureQueues.retirement : null);
  return Object.freeze({
    rendered: true,
    status: viewModel.status,
    source: viewModel.source,
    mode: viewModel.mode,
    countsAvailable: viewModel.countsAvailable,
    categoryCount: viewModel.categories.length,
    personalValuesReturned: viewModel.personalValuesReturned,
    contactValuesReturned: false
  });
}

function isWorkforceSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== WORKFORCE_SUMMARY_KEYS.length
    || WORKFORCE_SUMMARY_KEYS.some((key) => !Object.hasOwn(value, key))) return false;
  return ["activeEmployeeCount", "onboardingCount", "leaveCount", "retirementCount"]
    .every((key) => Number.isInteger(value[key]) && value[key] >= 0)
    && typeof value.transferAvailable === "boolean"
    && (value.transferCount === null || (Number.isInteger(value.transferCount) && value.transferCount >= 0))
    && (!value.transferAvailable || value.transferCount !== null)
    && /^\d{4}-\d{2}-\d{2}$/u.test(String(value.asOfDate))
    && isProcedureQueues(value.procedureQueues);
}

function isProcedureQueues(value) {
  const keys = ["onboarding", "leave", "retirement"];
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Array.isArray(value[key]) && value[key].length <= 100 && value[key].every(isProcedureQueueRow));
}

function isProcedureQueueRow(row) {
  return row && typeof row === "object" && !Array.isArray(row)
    && Object.keys(row).length === 3
    && ["displayName", "effectiveDate", "detail"].every((field) => Object.hasOwn(row, field))
    && typeof row.displayName === "string" && row.displayName.length > 0
    && /^\d{4}-\d{2}-\d{2}$/u.test(row.effectiveDate)
    && typeof row.detail === "string" && row.detail.length > 0;
}

export function buildWorkforceProcedureCasePrefill(queueKey, row) {
  const procedureType = QUEUE_PROCEDURE_TYPES[queueKey];
  if (!procedureType || !isProcedureQueueRow(row)) return null;
  return Object.freeze({
    procedureType,
    subjectLabel: row.displayName,
    effectiveDate: row.effectiveDate
  });
}

function renderProcedureQueue(documentObject, key, rows) {
  const container = documentObject.getElementById(`workforce-queue-${key}`);
  if (!container) return;
  container.replaceChildren();
  if (!Array.isArray(rows)) {
    container.textContent = "Core DB読取後に対象者を表示します";
    return;
  }
  if (rows.length === 0) {
    container.textContent = "現在の対象者はいません";
    return;
  }
  const fragment = documentObject.createDocumentFragment();
  for (const row of rows) {
    const item = documentObject.createElement("li");
    const name = documentObject.createElement("strong");
    const detail = documentObject.createElement("span");
    const action = documentObject.createElement("button");
    name.textContent = row.displayName;
    detail.textContent = `${row.effectiveDate} / ${row.detail}`;
    action.type = "button";
    action.className = "workforce-queue-create";
    action.textContent = "案件を登録";
    action.addEventListener("click", () => openWorkforceProcedureCase(documentObject, buildWorkforceProcedureCasePrefill(key, row)));
    item.append(name, detail, action);
    fragment.append(item);
  }
  container.append(fragment);
}

function openWorkforceProcedureCase(documentObject, draft) {
  const EventConstructor = documentObject?.defaultView?.CustomEvent || globalThis.CustomEvent;
  if (!draft || typeof EventConstructor !== "function" || typeof documentObject?.dispatchEvent !== "function") return false;
  documentObject.dispatchEvent(new EventConstructor("nov-talent:open-procedure-case", { detail: draft }));
  documentObject.getElementById("workforce-procedure-desk")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  return true;
}

function setText(documentObject, id, value) {
  const element = documentObject.getElementById(id);
  if (element) element.textContent = value;
}
