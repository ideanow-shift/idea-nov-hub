export const PERIOD_CATEGORIES = Object.freeze([
  "CURRENT_MONTH", "PREVIOUS_MONTH", "CURRENT_FISCAL_YEAR", "ROLLING_12_MONTHS",
] as const);
export const ANALYTICS_CATEGORIES = Object.freeze([
  "笑顔で挨拶する", "約束を守る", "助け合う", "伝え合う", "思いやる", "未設定",
] as const);

type PeriodCategory = typeof PERIOD_CATEGORIES[number];
type JsonObject = Record<string, unknown>;
type Authority = Readonly<{ category: "AUTHORIZED_ANALYTICS_BACKEND" | "DENIED" }>;
type Dependencies = Readonly<{
  authorizeServerSide: (request: Request) => Promise<Authority>;
  callAggregateRpc: (input: Readonly<{ p_period_category: PeriodCategory; retry: 0 }>) => Promise<unknown>;
}>;

const exactKeys = (value: unknown, keys: readonly string[]): value is JsonObject => Boolean(
  value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|"),
);
const bands = new Set(["NONE", "LOW", "MEDIUM", "HIGH"]);
const trends = new Set(["DOWN", "STABLE", "UP", "INSUFFICIENT_DATA"]);
const quality = new Set(["OK", "UNKNOWN_VISIBILITY_EXCLUDED"]);
const safeCount = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000;

export function validateAggregateResponse(value: unknown): value is JsonObject {
  const keys = [
    "periodCategory", "overallPostCount", "participatingSenderCount", "participatingRecipientCount",
    "monthlyTrend", "categoryDistribution", "organizationDistribution", "suppressedGroupPresent",
    "unknownVisibilityExcluded", "qualityFlagCategory", "rawValuesIncluded",
  ];
  if (!exactKeys(value, keys)) return false;
  if (
    !PERIOD_CATEGORIES.includes(value.periodCategory as PeriodCategory)
    || !safeCount(value.overallPostCount)
    || !safeCount(value.participatingSenderCount)
    || !safeCount(value.participatingRecipientCount)
    || typeof value.suppressedGroupPresent !== "boolean"
    || typeof value.unknownVisibilityExcluded !== "boolean"
    || !quality.has(String(value.qualityFlagCategory))
    || value.rawValuesIncluded !== false
  ) return false;
  if (
    !Array.isArray(value.monthlyTrend) || value.monthlyTrend.length > 12
    || value.monthlyTrend.some((row) => !exactKeys(row, ["monthCategory", "trendCategory"])
      || !/^M(?:0[1-9]|1[0-2])$/.test(String(row.monthCategory))
      || !trends.has(String(row.trendCategory)))
  ) return false;
  if (
    !Array.isArray(value.categoryDistribution)
    || value.categoryDistribution.map((row: unknown) => exactKeys(row, ["category", "activityCategory"]) ? row.category : null).join("|") !== ANALYTICS_CATEGORIES.join("|")
    || value.categoryDistribution.some((row) => !exactKeys(row, ["category", "activityCategory"])
      || !bands.has(String(row.activityCategory)))
  ) return false;
  if (
    !Array.isArray(value.organizationDistribution) || value.organizationDistribution.length > 100
    || value.organizationDistribution.some((row) => !exactKeys(row, ["organizationLabel", "activityCategory"])
      || typeof row.organizationLabel !== "string" || row.organizationLabel.length < 1
      || row.organizationLabel.length > 80 || !bands.has(String(row.activityCategory)))
  ) return false;
  return !/(employee(Id|Number|Name)|sender(Id|Key|Name)|recipient(Id|Key|Name)|postId|requestId|title|body|comment|email|phone|privateCount|memberCount)/i.test(JSON.stringify(value));
}

export function createThanksCoinAnalyticsApiAdapter(deps: Dependencies) {
  if (typeof deps?.authorizeServerSide !== "function" || typeof deps?.callAggregateRpc !== "function") {
    throw new Error("DEPENDENCY_CONTRACT_FAILED");
  }
  let queryCount = 0;
  return async function handle(request: Request): Promise<Readonly<{ category: string; data: JsonObject | null }>> {
    const url = new URL(request.url);
    const params = [...url.searchParams.keys()];
    const period = url.searchParams.get("periodCategory") as PeriodCategory | null;
    if (
      request.method !== "GET" || params.length !== 1
      || params[0] !== "periodCategory" || !period
      || !PERIOD_CATEGORIES.includes(period)
    ) return { category: "INVALID_REQUEST", data: null };
    let authority: Authority;
    try {
      authority = await deps.authorizeServerSide(request);
    } catch {
      return { category: "UNAUTHORIZED", data: null };
    }
    if (authority.category !== "AUTHORIZED_ANALYTICS_BACKEND") return { category: "UNAUTHORIZED", data: null };
    if (queryCount >= 1) return { category: "REQUEST_LIMIT_REACHED", data: null };
    queryCount++;
    let result: unknown;
    try {
      result = await deps.callAggregateRpc({ p_period_category: period, retry: 0 });
    } catch {
      return { category: "QUERY_FAILED", data: null };
    }
    if (!validateAggregateResponse(result)) return { category: "OUTPUT_CONTRACT_FAILED", data: null };
    return { category: "READY", data: result };
  };
}
