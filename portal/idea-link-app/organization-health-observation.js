const RESPONSE_KEYS = ["aggregateOnly", "externalSend", "mutation", "ok", "result", "selectOnly"];
const RESULT_KEYS = ["contract", "safeguards", "stores"];
const STORE_KEYS = ["activitySignalOverflow", "activitySignals", "availability", "followups", "periods", "storeLabel"];
const PERIOD_KEYS = ["categoryCount", "concentrationRate", "crossStoreRate", "participationRate", "periodEnd", "periodStart", "posts", "receiverCoverage", "senderCoverage", "uniquePairCount"];
const ACTIVITY_SIGNAL_KEYS = ["employeeLabel", "signalCategories", "targetEmployeeId"];
const FOLLOWUP_KEYS = ["assignedToLabel", "employeeLabel", "nextReviewOn", "status", "targetEmployeeId", "updatedAt"];
const METRICS = ["participationRate", "senderCoverage", "receiverCoverage", "uniquePairCount", "concentrationRate"];
const LABELS = {
  participationRate: "参加の広がり",
  senderCoverage: "投稿する人の広がり",
  receiverCoverage: "受け取る人の広がり",
  uniquePairCount: "交流の組み合わせ",
  concentrationRate: "交流の集中度",
};
const DIRECTIONS = { INCREASED: "前期間より増加", DECREASED: "前期間より減少", UNCHANGED: "前期間と同じ" };
const SIGNAL_LABELS = {
  STABLE: "大きな変化はありません",
  WATCH: "変化を確認してください",
  DIALOGUE_RECOMMENDED: "店舗での対話確認を推奨します",
};
const ACTIVITY_SIGNAL_LABELS = {
  NO_PUBLIC_SEND_ACTIVITY: "直近2期間に公開投稿がありません",
  PUBLIC_SEND_ACTIVITY_DROPPED: "公開投稿の頻度が大きく低下しています",
  PUBLIC_SEND_ACTIVITY_STOPPED: "前期間にあった公開投稿が今期間はありません",
  NO_PUBLIC_RECEIVE_ACTIVITY: "直近2期間に公開投稿を受け取っていません",
  PUBLIC_RECEIVE_ACTIVITY_DROPPED: "公開投稿を受け取る頻度が大きく低下しています",
  PUBLIC_RECEIVE_ACTIVITY_STOPPED: "前期間に受け取っていた公開投稿が今期間はありません",
};
const FOLLOWUP_STATUS_LABELS = {
  PENDING: "未対応",
  CONTACTED: "声掛け済み",
  MONITORING: "経過確認中",
  COMPLETED: "完了",
};

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function rate(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
function count(value) { return Number.isInteger(value) && value >= 0 && value <= 1000000; }
function direction(previous, current) { return current === previous ? "UNCHANGED" : current > previous ? "INCREASED" : "DECREASED"; }
function storeSignal(previous, current) {
  const declines = ["participationRate", "senderCoverage", "receiverCoverage", "uniquePairCount"]
    .filter((metric) => current[metric] < previous[metric]).length;
  const concentrationIncrease = current.concentrationRate > previous.concentrationRate ? 1 : 0;
  const adverseSignals = declines + concentrationIncrease;
  return adverseSignals >= 3 ? "DIALOGUE_RECOMMENDED" : adverseSignals >= 1 ? "WATCH" : "STABLE";
}
function validateFollowup(item) {
  return exactKeys(item, FOLLOWUP_KEYS) &&
    typeof item.targetEmployeeId === "string" && item.targetEmployeeId.length <= 50 &&
    typeof item.employeeLabel === "string" && item.employeeLabel.trim() && item.employeeLabel.length <= 200 &&
    Object.hasOwn(FOLLOWUP_STATUS_LABELS, item.status) &&
    typeof item.assignedToLabel === "string" && item.assignedToLabel.length <= 200 &&
    (item.nextReviewOn === null || /^\d{4}-\d{2}-\d{2}$/.test(item.nextReviewOn)) &&
    typeof item.updatedAt === "string";
}
function statusOptions(selected) {
  return Object.entries(FOLLOWUP_STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`)
    .join("");
}
function followupControl(targetEmployeeId, followup) {
  const status = followup?.status || "PENDING";
  const date = followup?.nextReviewOn || "";
  const assignment = followup ? `担当: ${escapeHtml(followup.assignedToLabel)}` : "保存すると自分が担当になります";
  return `<div class="org-followup-control" data-followup-target="${escapeHtml(targetEmployeeId)}">
    <label>対応状況<select data-followup-status>${statusOptions(status)}</select></label>
    <label>次回確認日<input data-followup-date type="date" value="${escapeHtml(date)}"></label>
    <button type="button" data-followup-save>保存</button>
    <small data-followup-message>${assignment}</small>
  </div>`;
}

export function renderOrganizationHealthObservationResponse(target, response, onSave) {
  if (!target || !exactKeys(response, RESPONSE_KEYS) || response.ok !== true || response.selectOnly !== true ||
    response.aggregateOnly !== true || response.mutation !== false || response.externalSend !== false) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
  const result = response.result;
  if (!exactKeys(result, RESULT_KEYS) || result.contract !== "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V4" ||
    !Array.isArray(result.stores) || result.stores.length > 100 ||
    !exactKeys(result.safeguards, ["aggregateOnly", "automatedEmploymentDecision", "followupFreeText", "followupStatusesOnly", "individualRanking", "individualSupportSignals", "maximumPeriods", "minimumCohort", "rawTextIncluded", "supportSignalMeaning", "turnoverPrediction"]) ||
    result.safeguards.aggregateOnly !== true || result.safeguards.minimumCohort < 5 || result.safeguards.maximumPeriods !== 13 ||
    result.safeguards.individualSupportSignals !== true || result.safeguards.supportSignalMeaning !== "CONVERSATION_PROMPT_ONLY" ||
    result.safeguards.followupFreeText !== false || result.safeguards.followupStatusesOnly !== true ||
    result.safeguards.individualRanking !== false || result.safeguards.turnoverPrediction !== false ||
    result.safeguards.rawTextIncluded !== false || result.safeguards.automatedEmploymentDecision !== false) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
  const cards = result.stores.map((store) => {
    if (!exactKeys(store, STORE_KEYS) || typeof store.storeLabel !== "string" || !["AGGREGATE_READY", "INSUFFICIENT_DATA"].includes(store.availability) ||
      !Array.isArray(store.periods) || store.periods.length > 13 || !Array.isArray(store.activitySignals) ||
      store.activitySignals.length > 25 || !Array.isArray(store.followups) || store.followups.length > 25 ||
      typeof store.activitySignalOverflow !== "boolean") throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
    const periods = store.periods.map((period) => {
      if (!exactKeys(period, PERIOD_KEYS) || !count(period.posts) || !rate(period.participationRate) || !rate(period.senderCoverage) || !rate(period.receiverCoverage) || !count(period.uniquePairCount) || !count(period.categoryCount) || !rate(period.crossStoreRate) || !rate(period.concentrationRate)) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
      return period;
    });
    const followups = store.followups.map((item) => {
      if (!validateFollowup(item)) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
      return item;
    });
    const followupByTarget = new Map(followups.map((item) => [item.targetEmployeeId, item]));
    const activitySignals = store.activitySignals.map((item) => {
      if (!exactKeys(item, ACTIVITY_SIGNAL_KEYS) || typeof item.targetEmployeeId !== "string" || item.targetEmployeeId.length > 50 ||
        typeof item.employeeLabel !== "string" || !item.employeeLabel.trim() || item.employeeLabel.length > 200 ||
        !Array.isArray(item.signalCategories) || item.signalCategories.length < 1 || item.signalCategories.length > 6 ||
        item.signalCategories.some((category) => !Object.hasOwn(ACTIVITY_SIGNAL_LABELS, category))) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
      return item;
    });
    const activityRows = activitySignals.map((item) => {
      const labels = item.signalCategories.map((category) => `<strong>${ACTIVITY_SIGNAL_LABELS[category]}</strong>`).join("");
      return `<li class="org-support-signal"><div><span>${escapeHtml(item.employeeLabel)}</span>${labels}</div>${
        typeof onSave === "function" ? followupControl(item.targetEmployeeId, followupByTarget.get(item.targetEmployeeId)) : ""
      }</li>`;
    }).join("");
    const signaledIds = new Set(activitySignals.map((item) => item.targetEmployeeId));
    const continuing = followups.filter((item) => !signaledIds.has(item.targetEmployeeId) && item.status !== "COMPLETED")
      .map((item) => `<li class="org-support-signal"><div><span>${escapeHtml(item.employeeLabel)}</span><strong>継続中の声掛けフォロー</strong></div>${
        typeof onSave === "function" ? followupControl(item.targetEmployeeId, item) : ""
      }</li>`).join("");
    const supportSection = `<section class="org-support-signals"><h5>声掛けの参考</h5>${
      activityRows || continuing ? `<ul>${activityRows}${continuing}</ul>${store.activitySignalOverflow ? "<p>このほかにも確認候補があります。</p>" : ""}` :
        "<p>現在、公開投稿の大きな変化は検出されていません。</p>"
    }<p>公開投稿の送信・受信の変化だけを示します。モチベーションや離職可能性の判定には使用しません。</p></section>`;
    if (periods.length < 2) return `<article class="org-observation-card"><h4>${escapeHtml(store.storeLabel)}</h4><p>店舗比較には2期間分の集計が必要です。</p>${supportSection}</article>`;
    const previous = periods.at(-2); const current = periods.at(-1);
    const signal = storeSignal(previous, current);
    const rows = METRICS.map((metric) => {
      const value = direction(previous[metric], current[metric]);
      return `<li><span>${LABELS[metric]}</span><strong>${DIRECTIONS[value]}</strong></li>`;
    }).join("");
    return `<article class="org-observation-card"><h4>${escapeHtml(store.storeLabel)}</h4><p><strong>${SIGNAL_LABELS[signal]}</strong></p><ul>${rows}</ul>${supportSection}<p>個人や離職可能性を判定するものではありません。</p></article>`;
  }).join("");
  target.innerHTML = cards || '<div class="notice">表示できる対象店舗はありません。</div>';
  if (typeof onSave === "function") {
    target.querySelectorAll("[data-followup-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        const control = button.closest("[data-followup-target]");
        const message = control?.querySelector("[data-followup-message]");
        if (!control || !message || button.disabled) return;
        button.disabled = true;
        message.textContent = "保存中";
        try {
          await onSave({
            targetEmployeeId: control.dataset.followupTarget,
            status: control.querySelector("[data-followup-status]")?.value || "",
            nextReviewOn: control.querySelector("[data-followup-date]")?.value || null,
          });
          message.textContent = "保存しました";
        } catch (_error) {
          message.textContent = "保存できませんでした";
          button.disabled = false;
        }
      });
    });
  }
}
