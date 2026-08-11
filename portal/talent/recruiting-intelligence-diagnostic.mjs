const CONTRACT_VERSION = "1.1.0";
const BUCKETS = Object.freeze([
  "OVERDUE", "DUE_TODAY", "AWAITING_REPLY", "SELECTION_WITHOUT_NEXT_ACTION", "UNASSIGNED_ACTION", "STALLED"
]);
const FORBIDDEN_RESPONSE_KEYS = Object.freeze([
  "student_name", "studentName", "phone", "email", "line_identifier", "notes",
  "contact_content", "summary", "actor_employee_id", "sessionToken", "authorization"
]);

export function createRecruitingIntelligenceDiagnosticExecutor({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  hubSessionHelper = globalObject.NovHubSession
} = {}) {
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeStop("duplicate_prevented", 0);
      consumed = true;
      const apiBase = String(globalObject?.NOV_TALENT_CONFIG?.readonlyApiBaseUrl || "").replace(/\/+$/u, "");
      if (!/^https:\/\//u.test(apiBase) || typeof fetchImpl !== "function" || typeof hubSessionHelper?.getSessionToken !== "function") {
        return safeStop("runtime_unavailable", 0);
      }
      let token = null;
      try { token = await hubSessionHelper.getSessionToken(); } catch { return safeStop("auth_required", 0); }
      if (typeof token !== "string" || token.trim().length < 20) return safeStop("auth_required", 0);
      try {
        const response = await fetchImpl(`${apiBase}/api/talent/v1/recruiting-intelligence`, {
          method: "GET", credentials: "omit", cache: "no-store",
          headers: { Accept: "application/json", Authorization: `Bearer ${token.trim()}` }
        });
        const envelope = await response.json().catch(() => null);
        if (response.status === 401) return safeStop("auth_required", 1, response.status);
        if (!response.ok) return safeStop("api_error", 1, response.status);
        const summary = summarizeResponse(envelope);
        if (!summary) return safeStop("invalid_response", 1, response.status);
        return Object.freeze({ ok: true, category: "ready", requestCount: 1, httpStatus: response.status,
          rawResponseReturned: false, tokenValueReturned: false, candidateDetailReturned: false, data: summary });
      } catch { return safeStop("api_error", 1); }
    }
  });
}

export function summarizeResponse(envelope) {
  const data = envelope?.ok === true ? envelope.data : null;
  if (!data || data.recruiting_intelligence_contract_version !== CONTRACT_VERSION) return null;
  if (!["COMPLETE", "PREPARING"].includes(data.sourceCoverageState)) return null;
  const availability = data.sourceAvailability;
  if (!availability || Object.values(availability).some((value) => typeof value !== "boolean")) return null;
  const priorityRows = Array.isArray(data.priorities?.buckets) ? data.priorities.buckets : [];
  if (data.priorities?.state === "READY" && (priorityRows.length !== BUCKETS.length || priorityRows.some((row, index) => row?.bucket !== BUCKETS[index]))) return null;
  const candidateIds = priorityRows.flatMap((row) => Array.isArray(row.candidates) ? row.candidates.map((item) => item?.candidateId).filter(Boolean) : []);
  const duplicateCandidateCount = candidateIds.length - new Set(candidateIds).size;
  if (duplicateCandidateCount !== 0) return null;
  const serialized = JSON.stringify(data);
  const forbiddenKeys = FORBIDDEN_RESPONSE_KEYS.filter((key) => serialized.includes(`"${key}"`));
  if (forbiddenKeys.length) return null;
  const assigneeCounts = data.assigneeWorkload?.openActionCounts;
  const assigneeValues = assigneeCounts && typeof assigneeCounts === "object" ? Object.values(assigneeCounts) : [];
  const planningRows = Array.isArray(data.planningComparison?.rows) ? data.planningComparison.rows : [];
  if (!["READY", "PREPARING"].includes(data.planningComparison?.state) || (data.planningComparison.state === "PREPARING" && planningRows.length)) return null;
  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    sourceCoverageState: data.sourceCoverageState,
    sourceAvailability: Object.freeze({ ...availability }),
    currentPosition: Object.freeze({ state: data.currentPosition?.state, candidateCount: data.currentPosition?.candidateCount, projectionCounts: data.currentPosition?.projectionCounts }),
    funnel: Object.freeze({ state: data.funnel?.state, uniqueCandidateReachedCounts: data.funnel?.uniqueCandidateReachedCounts, rates: data.funnel?.rates }),
    graduationYears: Object.freeze({ state: data.graduationYears?.state, rows: data.graduationYears?.rows }),
    school: Object.freeze({ state: data.schoolProgress?.state, rowCount: Array.isArray(data.schoolProgress?.rows) ? data.schoolProgress.rows.length : null }),
    fair: Object.freeze({ state: data.fairResults?.state, rowCount: Array.isArray(data.fairResults?.rows) ? data.fairResults.rows.length : null, confirmedOriginCandidateCount: data.fairResults?.confirmedOriginCandidateCount }),
    assignee: Object.freeze({ state: data.assigneeWorkload?.state, groupCount: assigneeValues.length, openActionCount: assigneeValues.reduce((sum, value) => sum + Number(value || 0), 0) }),
    priorities: Object.freeze({ state: data.priorities?.state, stallThresholdDays: data.priorities?.stallThresholdDays,
      duplicateCandidateCount: 0, buckets: priorityRows.map((row) => Object.freeze({ bucket: row.bucket, count: row.count, truncated: row.truncated === true })) }),
    fairPending: Object.freeze({ state: data.managementDiagnostics?.state, candidateCount: data.managementDiagnostics?.pendingFairAttributionCandidateCount, rowCount: data.managementDiagnostics?.pendingFairAttributionRowCount }),
    planning: Object.freeze({ state: data.planningComparison.state, rows: planningRows.map((row) => Object.freeze({
      recruitingTrack: row.recruitingTrack, graduationYear: row.graduationYear, period: row.period, scope: row.scope,
      approvedPlanningVersion: row.approvedPlanningVersion, metrics: row.metrics, budget: row.budget
    })) }),
    target: Object.freeze({ state: data.targets?.state, candidateTarget: data.targets?.candidateTarget, achievementRate: data.targets?.achievementRate }),
    piiForbiddenKeysPresent: Object.freeze([])
  });
}

export function initializeRecruitingIntelligenceDiagnostic(documentObject = globalThis.document, globalObject = globalThis) {
  const button = documentObject?.getElementById?.("outcome3-diagnostic-run");
  const status = documentObject?.getElementById?.("outcome3-diagnostic-status");
  const output = documentObject?.getElementById?.("outcome3-diagnostic-output");
  if (!button || !status || !output || button.dataset.bound) return null;
  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "確認しています";
    output.replaceChildren();
    const result = await createRecruitingIntelligenceDiagnosticExecutor({ globalObject }).run();
    if (!result.ok) {
      status.textContent = result.category === "auth_required" ? "HUBへ戻り、求人管理を開き直してください" : "集計準備中";
      button.disabled = false;
      return;
    }
    status.textContent = `HTTP ${result.httpStatus}・Contract ${result.data.contractVersion}`;
    renderDiagnostic(output, result.data, documentObject);
    button.disabled = false;
  });
  return Object.freeze({ initialized: true });
}

function renderDiagnostic(output, data, documentObject) {
  const rows = [
    ["Source / Coverage", `${data.sourceCoverageState}・${Object.entries(data.sourceAvailability).map(([key, ready]) => `${key}:${ready ? "READY" : "PREPARING"}`).join(" / ")}`],
    ["採用現在地", sectionText(data.currentPosition, data.currentPosition.candidateCount, data.currentPosition.projectionCounts)],
    ["選考ファネル", sectionText(data.funnel, null, data.funnel.uniqueCandidateReachedCounts)],
    ["卒業年度", sectionText(data.graduationYears, null, data.graduationYears.rows)],
    ["学校", sectionText(data.school, data.school.rowCount)],
    ["フェア", sectionText(data.fair, data.fair.rowCount, { confirmedOriginCandidateCount: data.fair.confirmedOriginCandidateCount })],
    ["担当者", sectionText(data.assignee, data.assignee.groupCount, { openActionCount: data.assignee.openActionCount })],
    ["優先Bucket", `${data.priorities.state}・重複 ${data.priorities.duplicateCandidateCount}件・${data.priorities.buckets.map((row) => `${row.bucket}:${row.count}`).join(" / ")}`],
    ["Fair確認待ち（管理診断）", sectionText(data.fairPending, data.fairPending.candidateCount, { physicalRows: data.fairPending.rowCount })],
    ["Recruiting Intelligence 1.1 / 承認済み計画", data.planning.state === "READY" ? JSON.stringify(data.planning.rows) : "集計準備中"],
    ["採用目標", data.target.state === "UNSET" ? "目標未設定" : String(data.target.state)]
  ];
  const list = documentObject.createElement("dl");
  list.className = "outcome3-diagnostic-grid";
  for (const [label, value] of rows) {
    const item = documentObject.createElement("div");
    const term = documentObject.createElement("dt"); term.textContent = label;
    const description = documentObject.createElement("dd"); description.textContent = value;
    item.append(term, description); list.append(item);
  }
  output.append(list);
}

function sectionText(section, count = null, details = null) {
  if (section?.state !== "READY") return "集計準備中";
  const parts = [];
  if (count !== null && count !== undefined) parts.push(`${count}件`);
  if (details !== null && details !== undefined) parts.push(JSON.stringify(details));
  return parts.join("・") || "READY";
}

function safeStop(category, requestCount, httpStatus = null) {
  return Object.freeze({ ok: false, category, requestCount, httpStatus, rawResponseReturned: false,
    tokenValueReturned: false, candidateDetailReturned: false });
}
