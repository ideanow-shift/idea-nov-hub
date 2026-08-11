const CONTRACT_VERSION = "1.0.0";
const TRACKS = Object.freeze(["NEW_GRAD", "MID_CAREER"]);
const METRICS = Object.freeze(["CONTACT_COUNT", "SALON_VISIT_COUNT", "APPLICATION_COUNT", "OFFERED_COUNT", "OFFER_ACCEPTED_COUNT"]);
const CHANNELS = Object.freeze(["JOB_FAIR", "SCHOOL_GUIDANCE", "SCHOOL_VISIT", "PAID_JOB_MEDIA", "FREE_JOB_MEDIA", "SNS", "OWNED_WEB", "REFERRAL", "HELLO_WORK", "REHIRE", "DEALER_REFERRAL", "OTHER"]);
const FORBIDDEN_KEYS = Object.freeze(["authorization", "sessionToken", "actor", "approvedBy", "createdBy", "employeeId", "email", "phone"]);

export function createRecruitingPlanningDiagnosticExecutor({ globalObject = globalThis, fetchImpl = globalObject.fetch, hubSessionHelper = globalObject.NovHubSession } = {}) {
  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return stop("duplicate_prevented", 0);
      consumed = true;
      const base = String(globalObject?.NOV_TALENT_CONFIG?.readonlyApiBaseUrl || "").replace(/\/+$/u, "");
      if (!/^https:\/\//u.test(base) || typeof fetchImpl !== "function" || typeof hubSessionHelper?.getSessionToken !== "function") return stop("runtime_unavailable", 0);
      let token;
      try { token = await hubSessionHelper.getSessionToken(); } catch { return stop("auth_required", 0); }
      if (typeof token !== "string" || token.trim().length < 20) return stop("auth_required", 0);
      const headers = { Accept: "application/json", Authorization: `Bearer ${token.trim()}` };
      try {
        const currentResponse = await fetchImpl(`${base}/api/talent/v1/recruiting-planning/current`, { method: "GET", credentials: "omit", cache: "no-store", headers });
        const current = await currentResponse.json().catch(() => null);
        if (currentResponse.status === 401) return stop("auth_required", 1, 401);
        if (!currentResponse.ok) return stop("api_error", 1, currentResponse.status);
        const historyResponse = await fetchImpl(`${base}/api/talent/v1/recruiting-planning/history`, { method: "GET", credentials: "omit", cache: "no-store", headers });
        const history = await historyResponse.json().catch(() => null);
        if (!historyResponse.ok) return stop(historyResponse.status === 401 ? "auth_required" : "api_error", 2, historyResponse.status);
        const writeResponse = await fetchImpl(`${base}/api/talent/v1/recruiting-planning/targets/drafts`, {
          method: "POST", credentials: "omit", cache: "no-store", headers: { ...headers, "Content-Type": "application/json" }, body: "{}"
        });
        const writeEnvelope = await writeResponse.json().catch(() => null);
        if (writeResponse.status !== 503 || writeEnvelope?.safeCode !== "RECRUITING_PLANNING_WRITES_DISABLED") return stop("write_flag_gate_failed", 3, writeResponse.status);
        const data = summarize(current, history);
        if (!data) return stop("invalid_response", 3, historyResponse.status);
        return Object.freeze({ ok: true, category: "ready", requestCount: 3, httpStatus: 200, rawResponseReturned: false, tokenValueReturned: false, data });
      } catch { return stop("api_error", 0); }
    }
  });
}

export function summarize(currentEnvelope, historyEnvelope) {
  const current = currentEnvelope?.ok === true ? currentEnvelope.data : null;
  const history = historyEnvelope?.ok === true ? historyEnvelope.data : null;
  if (!valid(current, "APPROVED") || !valid(history, "HISTORY")) return null;
  const serialized = JSON.stringify({ current, history });
  if (FORBIDDEN_KEYS.some((key) => serialized.includes(`"${key}"`))) return null;
  const sources = current.actualSources;
  if (!sources || !METRICS.every((metric) => typeof sources[metric] === "string")) return null;
  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    sourceAvailability: true,
    tracks: TRACKS,
    metrics: METRICS,
    channels: CHANNELS,
    currentTargetCount: current.targets.length,
    currentBudgetCount: current.budgets.length,
    currentBudgetLineCount: current.budgetLines.length,
    historyTargetCount: history.targets.length,
    historyBudgetCount: history.budgets.length,
    historyBudgetLineCount: history.budgetLines.length,
    actualSources: Object.freeze({ ...sources }),
    writeFlag: "OFF",
    piiForbiddenKeysPresent: Object.freeze([])
  });
}

export function initializeRecruitingPlanningDiagnostic(documentObject = globalThis.document, globalObject = globalThis) {
  const button = documentObject?.getElementById?.("planning-diagnostic-run");
  const status = documentObject?.getElementById?.("planning-diagnostic-status");
  const output = documentObject?.getElementById?.("planning-diagnostic-output");
  if (!button || !status || !output || button.dataset.bound) return null;
  button.dataset.bound = "true";
  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "確認しています";
    output.replaceChildren();
    const result = await createRecruitingPlanningDiagnosticExecutor({ globalObject }).run();
    if (!result.ok) {
      status.textContent = result.category === "auth_required" ? "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。" : "確認を完了できませんでした";
      button.disabled = false;
      return;
    }
    status.textContent = `HTTP ${result.httpStatus}・Contract ${result.data.contractVersion}`;
    const rows = [
      ["Source", result.data.sourceAvailability ? "READY" : "PREPARING"],
      ["Recruiting Track", result.data.tracks.join(" / ")],
      ["Funnel Target", result.data.metrics.join(" / ")],
      ["Current Approved Target", `${result.data.currentTargetCount}件`],
      ["Target Version History", `${result.data.historyTargetCount}件`],
      ["Budget / Budget Line", `${result.data.currentBudgetCount}件 / ${result.data.currentBudgetLineCount}件`],
      ["Canonical Channel", `${result.data.channels.length}種類`],
      ["Write Flag", result.data.writeFlag]
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
    button.disabled = false;
  });
  return Object.freeze({ initialized: true });
}

function valid(data, kind) {
  return data?.recruiting_planning_contract_version === CONTRACT_VERSION && data.kind === kind && data.sourceAvailability === true &&
    Array.isArray(data.targets) && Array.isArray(data.budgets) && Array.isArray(data.budgetLines);
}

function stop(category, requestCount, httpStatus = null) {
  return Object.freeze({ ok: false, category, requestCount, httpStatus, rawResponseReturned: false, tokenValueReturned: false });
}
