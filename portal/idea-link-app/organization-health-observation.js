const RESPONSE_KEYS = ["aggregateOnly", "externalSend", "mutation", "ok", "result", "selectOnly"];
const RESULT_KEYS = ["contract", "safeguards", "stores"];
const STORE_KEYS = ["activitySignalOverflow", "activitySignals", "availability", "periods", "storeLabel"];
const PERIOD_KEYS = ["categoryCount", "concentrationRate", "crossStoreRate", "participationRate", "periodEnd", "periodStart", "posts", "receiverCoverage", "senderCoverage", "uniquePairCount"];
const ACTIVITY_SIGNAL_KEYS = ["employeeLabel", "signalCategory"];
const METRICS = ["participationRate", "senderCoverage", "receiverCoverage", "uniquePairCount", "concentrationRate"];
const LABELS = { participationRate: "参加の広がり", senderCoverage: "投稿する人の広がり", receiverCoverage: "受け取る人の広がり", uniquePairCount: "交流の組合せ", concentrationRate: "交流の集中度" };
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

export function renderOrganizationHealthObservationResponse(target, response) {
  if (!target || !exactKeys(response, RESPONSE_KEYS) || response.ok !== true || response.selectOnly !== true ||
    response.aggregateOnly !== true || response.mutation !== false || response.externalSend !== false) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
  const result = response.result;
  if (!exactKeys(result, RESULT_KEYS) || result.contract !== "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V3" ||
    !Array.isArray(result.stores) || result.stores.length > 100 || !exactKeys(result.safeguards, ["aggregateOnly", "automatedEmploymentDecision", "individualRanking", "individualSupportSignals", "maximumPeriods", "minimumCohort", "rawTextIncluded", "supportSignalMeaning", "turnoverPrediction"]) ||
    result.safeguards.aggregateOnly !== true || result.safeguards.minimumCohort < 5 || result.safeguards.maximumPeriods !== 13 ||
    result.safeguards.individualSupportSignals !== true || result.safeguards.supportSignalMeaning !== "CONVERSATION_PROMPT_ONLY" ||
    result.safeguards.individualRanking !== false || result.safeguards.turnoverPrediction !== false ||
    result.safeguards.rawTextIncluded !== false || result.safeguards.automatedEmploymentDecision !== false) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
  const cards = result.stores.map((store) => {
    if (!exactKeys(store, STORE_KEYS) || typeof store.storeLabel !== "string" || !["AGGREGATE_READY", "INSUFFICIENT_DATA"].includes(store.availability) ||
      !Array.isArray(store.periods) || store.periods.length > 13 || !Array.isArray(store.activitySignals) ||
      store.activitySignals.length > 25 || typeof store.activitySignalOverflow !== "boolean") throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
    const periods = store.periods.map((period) => {
      if (!exactKeys(period, PERIOD_KEYS) || !count(period.posts) || !rate(period.participationRate) || !rate(period.senderCoverage) || !rate(period.receiverCoverage) || !count(period.uniquePairCount) || !count(period.categoryCount) || !rate(period.crossStoreRate) || !rate(period.concentrationRate)) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
      return period;
    });
    const activitySignals = store.activitySignals.map((item) => {
      if (!exactKeys(item, ACTIVITY_SIGNAL_KEYS) || typeof item.employeeLabel !== "string" || !item.employeeLabel.trim() ||
        item.employeeLabel.length > 200 || !Object.hasOwn(ACTIVITY_SIGNAL_LABELS, item.signalCategory)) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
      return item;
    });
    const activityRows = activitySignals.map((item) =>
      `<li class="org-support-signal"><span>${escapeHtml(item.employeeLabel)}</span><strong>${ACTIVITY_SIGNAL_LABELS[item.signalCategory]}</strong></li>`
    ).join("");
    const supportSection = `<section class="org-support-signals"><h5>声掛けの参考</h5>${
      activityRows ? `<ul>${activityRows}</ul>${store.activitySignalOverflow ? "<p>このほかにも確認候補があります。</p>" : ""}` :
        "<p>現在、公開投稿の大きな変化は検出されていません。</p>"
    }<p>公開投稿の変化だけを示します。モチベーションや離職可能性の判定には使用しません。</p></section>`;
    if (periods.length < 2) return `<article class="org-observation-card"><h4>${escapeHtml(store.storeLabel)}</h4><p>店舗比較には2期間分の集計が必要です。</p>${supportSection}</article>`;
    const previous = periods.at(-2); const current = periods.at(-1);
    const signal = storeSignal(previous, current);
    const rows = METRICS.map((metric) => { const value = direction(previous[metric], current[metric]); return `<li><span>${LABELS[metric]}</span><strong>${DIRECTIONS[value]}</strong></li>`; }).join("");
    return `<article class="org-observation-card"><h4>${escapeHtml(store.storeLabel)}</h4><p><strong>${SIGNAL_LABELS[signal]}</strong></p><ul>${rows}</ul>${supportSection}<p>個人や離職可能性を判定するものではありません。</p></article>`;
  }).join("");
  target.innerHTML = cards || '<div class="notice">表示できる管轄店舗はありません。</div>';
}


