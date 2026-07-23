const RESPONSE_KEYS = ["aggregateOnly", "externalSend", "mutation", "ok", "result", "selectOnly"];
const RESULT_KEYS = ["contract", "safeguards", "stores"];
const STORE_KEYS = ["availability", "periods", "storeLabel"];
const PERIOD_KEYS = ["categoryCount", "concentrationRate", "crossStoreRate", "participationRate", "periodEnd", "periodStart", "posts", "receiverCoverage", "senderCoverage", "uniquePairCount"];
const METRICS = ["participationRate", "senderCoverage", "receiverCoverage", "uniquePairCount", "concentrationRate"];
const LABELS = { participationRate: "参加の広がり", senderCoverage: "投稿する人の広がり", receiverCoverage: "受け取る人の広がり", uniquePairCount: "交流の組合せ", concentrationRate: "交流の集中度" };
const DIRECTIONS = { INCREASED: "前期間より増加", DECREASED: "前期間より減少", UNCHANGED: "前期間と同じ" };
const SIGNAL_LABELS = {
  STABLE: "大きな変化はありません",
  WATCH: "変化を確認してください",
  DIALOGUE_RECOMMENDED: "店舗での対話確認を推奨します",
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
  if (!exactKeys(result, RESULT_KEYS) || result.contract !== "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V2_CANDIDATE" ||
    !Array.isArray(result.stores) || result.stores.length > 100 || !exactKeys(result.safeguards, ["aggregateOnly", "automatedEmploymentDecision", "individualRanking", "maximumPeriods", "minimumCohort", "rawTextIncluded", "turnoverPrediction"]) ||
    result.safeguards.aggregateOnly !== true || result.safeguards.minimumCohort < 5 || result.safeguards.maximumPeriods !== 13 ||
    result.safeguards.individualRanking !== false || result.safeguards.turnoverPrediction !== false ||
    result.safeguards.rawTextIncluded !== false || result.safeguards.automatedEmploymentDecision !== false) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
  const cards = result.stores.map((store) => {
    if (!exactKeys(store, STORE_KEYS) || typeof store.storeLabel !== "string" || !["AGGREGATE_READY", "INSUFFICIENT_DATA"].includes(store.availability) || !Array.isArray(store.periods) || store.periods.length > 13) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
    const periods = store.periods.map((period) => {
      if (!exactKeys(period, PERIOD_KEYS) || !count(period.posts) || !rate(period.participationRate) || !rate(period.senderCoverage) || !rate(period.receiverCoverage) || !count(period.uniquePairCount) || !count(period.categoryCount) || !rate(period.crossStoreRate) || !rate(period.concentrationRate)) throw new Error("OBSERVATION_RESPONSE_CONTRACT_FAILED");
      return period;
    });
    if (periods.length < 2) return `<article class="org-observation-card"><h4>${escapeHtml(store.storeLabel)}</h4><p>比較には2期間分の店舗集計が必要です。</p></article>`;
    const previous = periods.at(-2); const current = periods.at(-1);
    const signal = storeSignal(previous, current);
    const rows = METRICS.map((metric) => { const value = direction(previous[metric], current[metric]); return `<li><span>${LABELS[metric]}</span><strong>${DIRECTIONS[value]}</strong></li>`; }).join("");
    return `<article class="org-observation-card"><h4>${escapeHtml(store.storeLabel)}</h4><p><strong>${SIGNAL_LABELS[signal]}</strong></p><ul>${rows}</ul><p>個人や離職可能性を判定するものではありません。</p></article>`;
  }).join("");
  target.innerHTML = cards || '<div class="notice">表示できる管轄店舗はありません。</div>';
}


