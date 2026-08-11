const CONTRACT_VERSION = "1.1.0";
const BUCKET_ORDER = Object.freeze([
  "OVERDUE", "DUE_TODAY", "AWAITING_REPLY", "SELECTION_WITHOUT_NEXT_ACTION", "UNASSIGNED_ACTION", "STALLED"
]);
const BUCKET_LABELS = Object.freeze({
  OVERDUE: "期限超過", DUE_TODAY: "今日期限", AWAITING_REPLY: "返信待ち・要対応",
  SELECTION_WITHOUT_NEXT_ACTION: "選考後の予定未設定", UNASSIGNED_ACTION: "担当者未登録", STALLED: "7日以上停滞"
});
const METRICS = Object.freeze([
  ["CONTACT_COUNT", "接触"], ["SALON_VISIT_COUNT", "サロン見学"], ["APPLICATION_COUNT", "応募"],
  ["OFFERED_COUNT", "内定"], ["OFFER_ACCEPTED_COUNT", "内定承諾"]
]);

export function createRecruitingIntelligenceViewExecutor({ globalObject = globalThis, fetchImpl = globalObject.fetch,
  hubSessionHelper = globalObject.NovHubSession } = {}) {
  return Object.freeze({
    async run() {
      const base = String(globalObject?.NOV_TALENT_CONFIG?.readonlyApiBaseUrl || "").replace(/\/+$/u, "");
      if (!/^https:\/\//u.test(base) || typeof fetchImpl !== "function" || typeof hubSessionHelper?.getSessionToken !== "function") return stop("runtime_unavailable", 0);
      let token = null;
      try { token = await hubSessionHelper.getSessionToken(); } catch { return stop("auth_required", 0); }
      if (typeof token !== "string" || token.trim().length < 20) return stop("auth_required", 0);
      try {
        const response = await fetchImpl(`${base}/api/talent/v1/recruiting-intelligence`, {
          method: "GET", credentials: "omit", cache: "no-store",
          headers: { Accept: "application/json", Authorization: `Bearer ${token.trim()}` }
        });
        const envelope = await response.json().catch(() => null);
        if (response.status === 401) return stop("auth_required", 1, response.status);
        if (!response.ok) return stop("api_error", 1, response.status);
        const data = validateResponse(envelope);
        return data ? Object.freeze({ ok: true, requestCount: 1, httpStatus: response.status, data }) : stop("invalid_response", 1, response.status);
      } catch { return stop("api_error", 1); }
    }
  });
}

export function validateResponse(envelope) {
  const data = envelope?.ok === true ? envelope.data : null;
  if (!data || data.recruiting_intelligence_contract_version !== CONTRACT_VERSION) return null;
  const planningRows = Array.isArray(data.planningComparison?.rows) ? data.planningComparison.rows : [];
  const buckets = Array.isArray(data.priorities?.buckets) ? data.priorities.buckets : [];
  if (!["READY", "PREPARING"].includes(data.planningComparison?.state)) return null;
  if (data.priorities?.state === "READY" && (buckets.length !== BUCKET_ORDER.length || buckets.some((row, index) => row?.bucket !== BUCKET_ORDER[index]))) return null;
  const ids = buckets.flatMap((row) => (Array.isArray(row?.candidates) ? row.candidates : []).map((item) => item?.candidateId).filter(Boolean));
  if (ids.length !== new Set(ids).size) return null;
  return data;
}

export function buildRecruitingIntelligenceViewModel(data, {
  recruitingTrack = "NEW_GRAD", graduationYear = 2027, resolveCandidateName = () => null,
  resolveSchoolName = () => null, resolveFairName = () => null, resolveAssigneeName = () => null
} = {}) {
  const planning = (data?.planningComparison?.rows || []).find((row) => row.recruitingTrack === recruitingTrack
    && Number(row.graduationYear) === Number(graduationYear));
  if (!planning || data?.planningComparison?.state !== "READY") return Object.freeze({ state: "PREPARING" });
  const cards = METRICS.map(([key, label]) => metricCard(key, label, planning.metrics?.[key]));
  const application = cards.find((card) => card.key === "APPLICATION_COUNT");
  const contact = cards.find((card) => card.key === "CONTACT_COUNT");
  const salon = cards.find((card) => card.key === "SALON_VISIT_COUNT");
  const unavailable = [contact, salon].filter((card) => card.sourceState !== "READY").map((card) => card.label);
  const summary = `${graduationYear}卒は応募${application.planText}目標に対して正式応募${application.actualText}。${unavailable.length ? `${unavailable.join("・")}実績は現在集計準備中です。` : "実績を集計済みです。"}`;
  const priorities = (data?.priorities?.state === "READY" ? data.priorities.buckets : [])
    .flatMap((bucket) => (bucket.candidates || []).map((candidate) => ({
      bucket: bucket.bucket, label: BUCKET_LABELS[bucket.bucket], candidateId: candidate.candidateId,
      candidateName: resolveCandidateName(candidate.candidateId) || "学生", deadline: candidate.deadline || null
    }))).slice(0, 10);
  const funnelCounts = data?.funnel?.state === "READY" ? data.funnel.uniqueCandidateReachedCounts || {} : null;
  const funnel = cards.map((card) => {
    const selectionCode = { APPLICATION_COUNT: "APPLICATION_RECEIVED", OFFERED_COUNT: "OFFERED", OFFER_ACCEPTED_COUNT: "OFFER_ACCEPTED" }[card.key];
    if (!selectionCode) return { label: card.label, value: card.sourceState === "READY" ? formatCount(card.actual) : "集計準備中" };
    return { label: card.label, value: funnelCounts ? formatCount(Number(funnelCounts[selectionCode] || 0)) : "集計準備中" };
  });
  const schoolRows = data?.schoolProgress?.state === "READY" ? (data.schoolProgress.rows || []).map((row) => ({
    label: resolveSchoolName(row.schoolId) || "学校名を確認中", primary: `${Number(row.candidateCount || 0)}名`, secondary: `正式選考 ${Number(row.officialSelectionCandidateCount || 0)}名`
  })) : null;
  const fairRows = data?.fairResults?.state === "READY" ? (data.fairResults.rows || []).map((row) => ({
    label: resolveFairName(row.fairId) || "フェア名を確認中", primary: `${Number(row.confirmedOriginCandidateCount || 0)}名`, secondary: `正式選考 ${Number(row.officialSelectionCandidateCount || 0)}名`
  })) : null;
  const assigneeRows = data?.assigneeWorkload?.state === "READY" ? Object.entries(data.assigneeWorkload.openActionCounts || {}).map(([id, count]) => ({
    label: id === "UNASSIGNED" ? "担当者未登録" : resolveAssigneeName(id) || "担当者名を確認中", primary: `${Number(count || 0)}件`, secondary: "未完了の対応"
  })) : null;
  return Object.freeze({ state: "READY", recruitingTrack, graduationYear, period: planning.period, approvedVersion: planning.approvedPlanningVersion,
    summary, cards, priorities, priorityReady: data?.priorities?.state === "READY", funnel,
    breakdown: Object.freeze({ FAIR: fairRows, SCHOOL: schoolRows, ASSIGNEE: assigneeRows }), budget: budgetCard(planning.budget) });
}

export function initializeRecruitingIntelligenceView(documentObject = globalThis.document, globalObject = globalThis, options = {}) {
  const root = documentObject?.getElementById?.("recruiting-intelligence-view");
  if (!root) return null;
  let loading = null;
  let loaded = false;
  let activeBreakdown = "FAIR";
  const load = async () => {
    if (loading) return loading;
    if (loaded) return Object.freeze({ ok: true, cached: true });
    setText(documentObject, "recruiting-intelligence-status", "採用状況を確認しています");
    loading = createRecruitingIntelligenceViewExecutor({ globalObject }).run().then((result) => {
      loading = null;
      if (!result.ok) {
        setText(documentObject, "recruiting-intelligence-status", result.category === "auth_required" ? "セッションの有効期限が切れました。HUBへ戻り、求人管理を開き直してください。" : "集計準備中");
        return result;
      }
      const model = buildRecruitingIntelligenceViewModel(result.data, options);
      if (model.state !== "READY") { setText(documentObject, "recruiting-intelligence-status", "集計準備中"); return stop("preparing", 1, 200); }
      render(documentObject, model, options, () => activeBreakdown, (value) => { activeBreakdown = value; renderBreakdown(documentObject, model, activeBreakdown); });
      loaded = true;
      return result;
    });
    return loading;
  };
  return Object.freeze({ initialized: true, load });
}

function render(documentObject, model, options, getBreakdown, setBreakdown) {
  setText(documentObject, "recruiting-intelligence-status", `${model.graduationYear}卒の承認済み計画を表示中`);
  setText(documentObject, "recruiting-intelligence-summary", model.summary);
  const cards = documentObject.getElementById("recruiting-intelligence-kpis");
  cards?.replaceChildren(...model.cards.map((card) => createCard(documentObject, card)), createCard(documentObject, model.budget));
  const priority = documentObject.getElementById("recruiting-intelligence-priority-list");
  priority?.replaceChildren(...(model.priorityReady ? model.priorities : []).map((row) => {
    const item = documentObject.createElement("li");
    const button = documentObject.createElement("button"); button.type = "button"; button.textContent = row.candidateName;
    button.addEventListener("click", () => options.onOpenCandidate?.(row.candidateId));
    const details = documentObject.createElement("span"); details.textContent = `${row.label}${row.deadline ? `・${row.deadline}` : ""}`;
    item.append(button, details); return item;
  }));
  setText(documentObject, "recruiting-intelligence-priority-empty", model.priorityReady ? (model.priorities.length ? "" : "今週の優先確認はありません") : "集計準備中");
  const funnel = documentObject.getElementById("recruiting-intelligence-funnel");
  funnel?.replaceChildren(...model.funnel.map((row, index) => {
    const item = documentObject.createElement("li"); const label = documentObject.createElement("span"); label.textContent = row.label;
    const value = documentObject.createElement("strong"); value.textContent = row.value; item.append(label, value);
    if (index < model.funnel.length - 1) { const arrow = documentObject.createElement("span"); arrow.className = "intelligence-funnel-arrow"; arrow.textContent = "↓"; item.append(arrow); }
    return item;
  }));
  for (const button of documentObject.querySelectorAll("[data-intelligence-breakdown]")) button.addEventListener("click", () => {
    const key = button.dataset.intelligenceBreakdown; if (!["FAIR", "SCHOOL", "ASSIGNEE"].includes(key)) return;
    for (const item of documentObject.querySelectorAll("[data-intelligence-breakdown]")) item.setAttribute("aria-pressed", String(item === button));
    setBreakdown(key);
  });
  renderBreakdown(documentObject, model, getBreakdown());
  setText(documentObject, "recruiting-intelligence-budget-plan", model.budget.planText);
  setText(documentObject, "recruiting-intelligence-budget-actual", model.budget.actualText);
  setText(documentObject, "recruiting-intelligence-budget-copy", model.budget.sourceText === "集計済み" ? "実績費用を集計済みです" : "実績費用：集計準備中。残額は算出していません。" );
}

function renderBreakdown(documentObject, model, key) {
  const list = documentObject.getElementById("recruiting-intelligence-breakdown-list"); if (!list) return;
  const rows = model.breakdown[key];
  if (!rows) { list.replaceChildren(message(documentObject, "集計準備中")); return; }
  if (!rows.length) { list.replaceChildren(message(documentObject, "正式に集計できる実績は0件です")); return; }
  list.replaceChildren(...rows.slice(0, 12).map((row) => {
    const item = documentObject.createElement("li"); const label = documentObject.createElement("strong"); label.textContent = row.label;
    const values = documentObject.createElement("span"); values.textContent = `${row.primary}・${row.secondary}`; item.append(label, values); return item;
  }));
}

function metricCard(key, label, metric = {}) {
  const noTarget = metric.targetStatus === "NO_APPROVED_TARGET";
  const ready = metric.actualSourceStatus === "READY";
  return Object.freeze({ key, label, planText: noTarget ? "目標未設定" : formatCount(metric.plan), actualText: ready ? formatCount(metric.actual) : "集計準備中",
    achievementText: noTarget ? "目標未設定" : ready && metric.achievementRate !== null ? `${Math.round(metric.achievementRate * 100)}%` : "集計準備中",
    remainingText: noTarget ? "目標未設定" : ready && metric.remaining !== null ? formatCount(metric.remaining) : "集計準備中",
    sourceText: ready ? "集計済み" : "集計準備中", sourceState: ready ? "READY" : "PREPARING" });
}
function budgetCard(budget = {}) {
  const ready = budget.actualSourceStatus === "READY";
  const noTarget = budget.targetStatus === "NO_APPROVED_TARGET";
  return Object.freeze({ key: "BUDGET", label: "求人予算", planText: noTarget ? "目標未設定" : formatYen(budget.plan), actualText: ready ? formatYen(budget.actualSpend) : "集計準備中",
    achievementText: "—", remainingText: ready && budget.remaining !== null ? formatYen(budget.remaining) : "集計準備中", sourceText: ready ? "集計済み" : "集計準備中" });
}
function createCard(documentObject, card) {
  const article = documentObject.createElement("article"); article.dataset.metric = card.key;
  const title = documentObject.createElement("h4"); title.textContent = card.label;
  const dl = documentObject.createElement("dl");
  for (const [label, value] of [["計画", card.planText], ["実績", card.actualText], ["達成", card.achievementText], ["残り", card.remainingText], ["集計状態", card.sourceText]]) {
    const row = documentObject.createElement("div"); const dt = documentObject.createElement("dt"); dt.textContent = label;
    const dd = documentObject.createElement("dd"); dd.textContent = value; row.append(dt, dd); dl.append(row);
  }
  article.append(title, dl); return article;
}
function message(documentObject, text) { const item = documentObject.createElement("li"); item.textContent = text; return item; }
function formatCount(value) { return Number.isInteger(Number(value)) ? `${Number(value).toLocaleString("ja-JP")}名` : "集計準備中"; }
function formatYen(value) { return Number.isInteger(Number(value)) ? `${Number(value).toLocaleString("ja-JP")}円` : "集計準備中"; }
function setText(documentObject, id, text) { const node = documentObject?.getElementById?.(id); if (node) node.textContent = text; }
function stop(category, requestCount, httpStatus = null) { return Object.freeze({ ok: false, category, requestCount, httpStatus }); }
