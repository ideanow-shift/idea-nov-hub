const CATEGORIES = Object.freeze([
  "笑顔で挨拶する", "約束を守る", "助け合う", "伝え合う", "思いやる", "未設定",
]);
const PERIODS = new Set(["CURRENT_MONTH", "PREVIOUS_MONTH", "CURRENT_FISCAL_YEAR", "ROLLING_12_MONTHS"]);
const BANDS = new Set(["NONE", "LOW", "MEDIUM", "HIGH"]);
const TRENDS = new Set(["DOWN", "STABLE", "UP", "INSUFFICIENT_DATA"]);
const QUALITY = new Set(["OK", "UNKNOWN_VISIBILITY_EXCLUDED"]);
const SAFE_CATEGORIES = new Set([
  "LOADING", "READY", "INVALID_REQUEST", "UNAUTHORIZED", "REQUEST_LIMIT_REACHED",
  "QUERY_FAILED", "OUTPUT_CONTRACT_FAILED",
]);
const RESPONSE_KEYS = Object.freeze([
  "periodCategory", "overallPostCount", "participatingSenderCount", "participatingRecipientCount",
  "monthlyTrend", "categoryDistribution", "organizationDistribution", "suppressedGroupPresent",
  "unknownVisibilityExcluded", "qualityFlagCategory", "rawValuesIncluded",
]);

const exactKeys = (value, keys) => Boolean(value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const safeCount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export function validateThanksCoinAnalyticsData(value) {
  if (!exactKeys(value, RESPONSE_KEYS)) return false;
  if (!PERIODS.has(value.periodCategory)
    || !safeCount(value.overallPostCount)
    || !safeCount(value.participatingSenderCount)
    || !safeCount(value.participatingRecipientCount)
    || typeof value.suppressedGroupPresent !== "boolean"
    || typeof value.unknownVisibilityExcluded !== "boolean"
    || !QUALITY.has(value.qualityFlagCategory)
    || value.rawValuesIncluded !== false) return false;
  if (!Array.isArray(value.monthlyTrend) || value.monthlyTrend.length > 12
    || value.monthlyTrend.some((row) => !exactKeys(row, ["monthCategory", "trendCategory"])
      || !/^M(?:0[1-9]|1[0-2])$/.test(String(row.monthCategory))
      || !TRENDS.has(row.trendCategory))) return false;
  if (!Array.isArray(value.categoryDistribution)
    || value.categoryDistribution.map((row) => row?.category).join("|") !== CATEGORIES.join("|")
    || value.categoryDistribution.some((row) => !exactKeys(row, ["category", "activityCategory"])
      || !BANDS.has(row.activityCategory))) return false;
  if (!Array.isArray(value.organizationDistribution) || value.organizationDistribution.length > 100
    || value.organizationDistribution.some((row) => !exactKeys(row, ["organizationLabel", "activityCategory"])
      || typeof row.organizationLabel !== "string" || row.organizationLabel.length < 1
      || row.organizationLabel.length > 80 || !BANDS.has(row.activityCategory))) return false;
  return !/(employee(Id|Number|Name)|sender(Id|Key|Name)|recipient(Id|Key|Name)|postId|requestId|title|body|comment|email|phone|privateCount|memberCount)/i.test(JSON.stringify(value));
}

export function buildThanksCoinAnalyticsViewModel(envelope) {
  if (!exactKeys(envelope, ["category", "data"]) || !SAFE_CATEGORIES.has(envelope.category)) {
    return { state: "ERROR", message: "分析結果を安全に表示できません。" };
  }
  if (envelope.category === "LOADING" && envelope.data === null) {
    return { state: "LOADING", message: "集計しています。" };
  }
  if (envelope.category !== "READY") {
    return { state: "ERROR", message: "分析結果を取得できませんでした。" };
  }
  if (!validateThanksCoinAnalyticsData(envelope.data)) {
    return { state: "ERROR", message: "分析結果を安全に表示できません。" };
  }
  const data = envelope.data;
  if (data.overallPostCount === 0) {
    return { state: "EMPTY", message: "対象期間の称賛投稿はありません。" };
  }
  return {
    state: "READY",
    overallPostCount: data.overallPostCount,
    participatingSenderCount: data.participatingSenderCount,
    participatingRecipientCount: data.participatingRecipientCount,
    organizationDistribution: data.organizationDistribution,
    privacyNotice: data.suppressedGroupPresent
      ? "5人未満の組織はプライバシー保護のため表示していません。" : "",
    qualityNotice: data.unknownVisibilityExcluded
      ? "公開範囲を確認できない投稿は集計から除外しました。" : "",
  };
}

export function renderThanksCoinAnalytics(view) {
  if (view.state !== "READY") {
    return `<section class="tc-analytics tc-state" data-analytics-state="${escapeHtml(view.state)}"><p>${escapeHtml(view.message)}</p></section>`;
  }
  const cards = [
    ["称賛投稿", view.overallPostCount],
    ["参加した投稿者", view.participatingSenderCount],
    ["参加した受取者", view.participatingRecipientCount],
  ].map(([label, value]) => `<article class="tc-card"><h4>${label}</h4><strong>${value}</strong></article>`).join("");
  const organizations = view.organizationDistribution
    .map((row) => `<li><span>${escapeHtml(row.organizationLabel)}</span><b>${escapeHtml(row.activityCategory)}</b></li>`)
    .join("");
  return `<section class="tc-analytics" data-analytics-state="READY"><div class="tc-card-grid">${cards}</div><section class="tc-panel"><h4>組織別の活動傾向</h4><ul>${organizations}</ul></section><p class="tc-notice">${escapeHtml(view.privacyNotice)}</p><p class="tc-notice">${escapeHtml(view.qualityNotice)}</p></section>`;
}
