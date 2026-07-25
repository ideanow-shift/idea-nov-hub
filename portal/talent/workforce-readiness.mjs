const WORKFORCE_CATEGORIES = Object.freeze([
  Object.freeze({ key: "onboarding", label: "入社手続き", description: "入社予定から受け入れ完了まで" }),
  Object.freeze({ key: "transfer", label: "異動手続き", description: "所属・役職変更の承認と反映" }),
  Object.freeze({ key: "leave", label: "休職・復職", description: "休職開始から復職完了まで" }),
  Object.freeze({ key: "retirement", label: "退職手続き", description: "退職受付から完了確認まで" })
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
  status = WORKFORCE_READONLY_CONTRACT.status
} = {}) {
  const safeSource = source === "CORE_DB" ? source : "UNKNOWN";
  const safeMode = mode === "READ_ONLY" ? mode : "UNAVAILABLE";
  const safeStatus = safeSource === "CORE_DB" && safeMode === "READ_ONLY" && status === "CONNECTED"
    ? "CONNECTED"
    : "NOT_CONNECTED";
  return Object.freeze({
    source: safeSource,
    mode: safeMode,
    status: safeStatus,
    countsAvailable: safeStatus === "CONNECTED",
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
  for (const category of viewModel.categories) {
    setText(documentObject, `workforce-count-${category.key}`, viewModel.countsAvailable ? "-" : "未接続");
  }
  return Object.freeze({
    rendered: true,
    status: viewModel.status,
    source: viewModel.source,
    mode: viewModel.mode,
    categoryCount: viewModel.categories.length,
    rawValuesReturned: false
  });
}

function setText(documentObject, id, value) {
  const element = documentObject.getElementById(id);
  if (element) element.textContent = value;
}
