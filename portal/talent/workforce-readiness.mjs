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
  "asOfDate"
]);

export const WORKFORCE_READONLY_CONTRACT = Object.freeze({
  source: "CORE_DB",
  mode: "READ_ONLY",
  personalValuesReturned: false,
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
    personalValuesReturned: false,
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
  return Object.freeze({
    rendered: true,
    status: viewModel.status,
    source: viewModel.source,
    mode: viewModel.mode,
    countsAvailable: viewModel.countsAvailable,
    categoryCount: viewModel.categories.length,
    rawValuesReturned: false
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
    && /^\d{4}-\d{2}-\d{2}$/u.test(String(value.asOfDate));
}

function setText(documentObject, id, value) {
  const element = documentObject.getElementById(id);
  if (element) element.textContent = value;
}
