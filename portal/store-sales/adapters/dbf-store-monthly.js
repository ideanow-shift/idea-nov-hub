import { ProjectionRequestError } from "./projection.js";

export const DBF_STORE_MONTHLY_CONTRACT = "STORE_MONTHLY_ACTUAL_V1";
export const DBF_STORE_MONTHLY_COMPARISON_CONTRACT = "STORE_MONTHLY_COMPARISON_V1";

const METRICS = Object.freeze({
  TOTAL_SALES: ["sales", "総売上（税抜）", "yen"],
  TECHNICAL_SALES: ["technicalSales", "技術売上（税抜）", "yen"],
  RETAIL_SALES: ["retailSales", "店販売上（税抜）", "yen"],
  MID_SALES: ["mid", "MID売上（税抜）", "yen"],
  EC_ALLOCATED_SALES: ["ecSales", "EC按分売上（税抜）", "yen"],
  TOTAL_CUSTOMERS: ["customerCount", "総客数", "count"],
  NEW_CUSTOMERS: ["newCustomerCount", "新規客数", "count"],
  EXISTING_CUSTOMERS: ["existingCustomerCount", "既存客数", "count"],
  TOTAL_UNIT_PRICE: ["totalTicket", "総単価（税抜）", "yen"],
  TECHNICAL_UNIT_PRICE: ["technicalTicket", "技術単価（税抜）", "yen"],
  TOTAL_REPEAT_RATE: ["totalRepeat", "総リピート率", "percent"],
  NEW_REPEAT_RATE: ["new", "新規リピート率", "percent"],
  SECOND_REPEAT_RATE: ["returning", "再来リピート率", "percent"],
  THIRD_REPEAT_RATE: ["thirdRepeat", "3回目リピート率", "percent"],
  FIXED_REPEAT_RATE: ["loyal", "固定リピート率", "percent"],
  TOTAL_PRODUCTIVITY: ["productivity", "総生産性", "yen"],
  TECHNICAL_PRODUCTIVITY: ["technicalProductivity", "技術生産性", "yen"],
  RETAIL_PURCHASE_RATE: ["retailPurchaseRate", "店販購買率", "percent"],
  OPERATING_PROFIT: ["operatingProfit", "店舗営業利益", "yen"]
});

const EXPECTED_CODES = Object.freeze(Object.keys(METRICS));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FORBIDDEN_KEYS = new Set(["storeId", "store_id", "rawStoreId", "raw_store_id", "employeeId", "employee_id", "companyId", "company_id"]);
const STATUS_ERRORS = Object.freeze({
  400: ["VALIDATION_ERROR", "対象月を確認してください。", false],
  401: ["UNAUTHORIZED", "セッションの有効期限が切れました。", false],
  403: ["FORBIDDEN", "アクセス権限がありません。", false],
  404: ["NOT_FOUND", "対象データを準備しています。", false],
  408: ["TIMEOUT", "通信に時間がかかっています。", true],
  500: ["SERVER_ERROR", "一時的に取得できません。", true],
  503: ["SERVER_ERROR", "一時的に取得できません。", true]
});

function fail(code, message = code) {
  throw new ProjectionRequestError("VALIDATION_ERROR", message, 422, false);
}

function assertNoPrivateIdentifiers(value) {
  if (typeof value === "string" && UUID.test(value)) fail("RAW_UUID_RETURNED");
  if (Array.isArray(value)) return value.forEach(assertNoPrivateIdentifiers);
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, child]) => {
    if (FORBIDDEN_KEYS.has(key)) fail("PRIVATE_IDENTIFIER_RETURNED");
    assertNoPrivateIdentifiers(child);
  });
}

function format(value, unit) {
  if (unit === "yen") return `¥${Math.round(value).toLocaleString("ja-JP")}`;
  if (unit === "count") return `${Math.round(value).toLocaleString("ja-JP")}人`;
  return `${Number(value).toFixed(1)}%`;
}

function preparingMetric(label, unit, reason = "正式データを準備しています") {
  return Object.freeze({ label, value: null, rawValue: null, displayValue: null, unit, dataState: "preparing", reason });
}

function normalizeMetric(fact, definition) {
  const [key, fallbackLabel, unit] = definition;
  if (!fact) return [key, preparingMetric(fallbackLabel, unit)];
  const raw = String(fact.value ?? "");
  if (!/^-?\d+(?:\.\d+)?$/u.test(raw)) fail("INVALID_METRIC_VALUE");
  const value = Number(raw);
  if (!Number.isFinite(value)) fail("INVALID_METRIC_VALUE");
  return [key, Object.freeze({
    label: String(fact.displayName || fallbackLabel), value, rawValue: value,
    displayValue: format(value, unit), unit, dataState: "available", reason: "DBF月次確定値"
  })];
}

function normalizeComparison(source, label, unit = "percent") {
  const raw = source?.value;
  if (source?.dataState !== "confirmed" || raw === null || raw === undefined || !/^-?\d+(?:\.\d+)?$/u.test(String(raw))) {
    return preparingMetric(label, unit, "正式比較データを準備しています");
  }
  const value = Number(raw);
  return Object.freeze({ label, value, rawValue: value, displayValue: format(value, unit), unit, dataState: "available", reason: "DBF正式比較値" });
}

function normalizeTrend(source) {
  if (!Array.isArray(source)) fail("INVALID_MONTHLY_TREND");
  const seen = new Set();
  return Object.freeze(source.map((point) => {
    const fiscalMonth = String(point?.fiscalMonth || "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(fiscalMonth) || seen.has(fiscalMonth) || !["confirmed", "preparing"].includes(point?.dataState)) fail("INVALID_TREND_POINT");
    seen.add(fiscalMonth);
    if (!Array.isArray(point.metrics)) fail("INVALID_TREND_METRICS");
    const metrics = {};
    point.metrics.forEach((metric) => {
      const definition = METRICS[String(metric?.metricCode || "")];
      if (!definition || !["TOTAL_SALES", "OPERATING_PROFIT", "TOTAL_CUSTOMERS", "TOTAL_UNIT_PRICE", "RETAIL_SALES", "EC_ALLOCATED_SALES"].includes(String(metric.metricCode)) || !/^-?\d+(?:\.\d+)?$/u.test(String(metric.value ?? ""))) fail("INVALID_TREND_METRIC");
      metrics[definition[0]] = Number(metric.value);
    });
    return Object.freeze({ fiscalMonth, dataState: point.dataState, metrics: Object.freeze(metrics) });
  }));
}

export function validateDbfStoreMonthlyProjection(payload) {
  if (!payload || typeof payload !== "object") fail("INVALID_PROJECTION");
  assertNoPrivateIdentifiers(payload);
  if (payload.contractVersion !== DBF_STORE_MONTHLY_CONTRACT) fail("INVALID_CONTRACT_VERSION");
  const comparisonEnabled = payload.comparisonContractVersion === DBF_STORE_MONTHLY_COMPARISON_CONTRACT;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(String(payload.fiscalMonth || ""))) fail("INVALID_FISCAL_MONTH");
  const scope = payload.scope;
  if (!scope || scope.serverResolved !== true || scope.rawStoreIdsReturned !== false) fail("UNSAFE_SCOPE");
  const baseline = scope.operatingStoreBaseline;
  if (!baseline || baseline.total !== 20 || baseline.direct !== 13 || baseline.fc !== 7) fail("INVALID_STORE_BASELINE");
  if (!Array.isArray(payload.stores) || payload.stores.length !== Number(scope.visibleStoreCount)) fail("INVALID_STORE_COUNT");
  if (scope.mode === "all" && payload.stores.length !== baseline.total) fail("INVALID_ALL_SCOPE_COUNT");
  if (scope.mode === "own" && payload.stores.length > 1) fail("INVALID_OWN_SCOPE_COUNT");
  if (!payload.readiness || payload.readiness.missingDataPolicy !== "preparing-not-zero") fail("INVALID_MISSING_DATA_POLICY");
  const seen = new Set();
  const stores = payload.stores.map((source) => {
    const storeKey = String(source?.storeKey || "");
    if (!storeKey || UUID.test(storeKey) || seen.has(storeKey)) fail("UNSAFE_STORE_KEY");
    seen.add(storeKey);
    if (!String(source.storeName || "") || !["DIRECT", "FC"].includes(source.ownership)) fail("INVALID_STORE");
    if (source.fiscalMonth !== payload.fiscalMonth || !["confirmed", "preparing"].includes(source.dataState)) fail("INVALID_DATA_STATE");
    if (!Array.isArray(source.metrics)) fail("INVALID_METRICS");
    const byCode = new Map();
    source.metrics.forEach((fact) => {
      const code = String(fact?.metricCode || "");
      if (!METRICS[code] || byCode.has(code)) fail("INVALID_METRIC_CODE");
      if (!["amount", "quantity", "rate"].includes(String(fact.valueKind || ""))) fail("INVALID_VALUE_KIND");
      byCode.set(code, fact);
    });
    const metrics = Object.fromEntries(EXPECTED_CODES.map((code) => normalizeMetric(byCode.get(code), METRICS[code])));
    metrics.storeSales = preparingMetric("店舗売上（税抜）", "yen", "正式Contract未提供");
    metrics.regularRetail = metrics.retailSales;
    ["grossProfit", "operatingProfitMargin", "ordinaryProfit", "yearOverYearRatio", "budgetRatio", "profitYearOverYear", "customerYearOverYear", "ticketYearOverYear", "retailYearOverYear", "ecTargetRatio", "ecYearOverYear", "staffCount"].forEach((key) => {
      metrics[key] = preparingMetric(key, key.includes("Ratio") || key.includes("Year") ? "percent" : "yen", "比較Contract未提供");
    });
    const comparisons = comparisonEnabled ? source.comparisons : null;
    if (comparisonEnabled && comparisons?.contractVersion !== DBF_STORE_MONTHLY_COMPARISON_CONTRACT) fail("INVALID_COMPARISON_CONTRACT");
    if (comparisonEnabled) {
      metrics.budgetRatio = normalizeComparison(comparisons.budgetRatio, "予算比");
      metrics.yearOverYearRatio = normalizeComparison(comparisons.yearOverYearRatio, "前年同月比");
    }
    const fiscalYear = comparisons?.fiscalYear || {};
    const yearly = Object.freeze({
      dataState: fiscalYear.dataState === "confirmed" ? "confirmed" : "preparing",
      startMonth: fiscalYear.startMonth || null,
      endMonth: fiscalYear.endMonth || payload.fiscalMonth,
      metrics: Object.freeze({
        sales: normalizeComparison(fiscalYear.metrics?.TOTAL_SALES, "年間累計売上", "yen"),
        operatingProfit: normalizeComparison(fiscalYear.metrics?.OPERATING_PROFIT, "年間累計営業利益", "yen"),
        customerCount: normalizeComparison(fiscalYear.metrics?.TOTAL_CUSTOMERS, "年間累計客数", "count"),
        budgetAchievement: normalizeComparison(fiscalYear.budgetAchievement, "年間累計予算比")
      })
    });
    const monthlyTrend = comparisonEnabled ? normalizeTrend(comparisons.monthlyTrend) : Object.freeze([]);
    return Object.freeze({
      storeKey, storeName: String(source.storeName), corporationName: String(source.corporationName || ""),
      ownership: source.ownership === "DIRECT" ? "Direct" : "FC", status: "Preparing",
      statusReason: source.dataState === "preparing" ? "正式データを準備しています。" : "比較指標が準備中のため、店舗状態はまだ判定しません。",
      conclusion: source.dataState === "preparing" ? "正式データを準備しています。" : "当月確定値を表示しています。店舗状態は比較指標の接続後に判定します。",
      focus: source.dataState === "preparing" ? "データ準備完了後に確認してください。" : "当月実績を確認しましょう。",
      metrics: Object.freeze(metrics), yearly, monthlyTrend, actions: Object.freeze([])
    });
  });
  if (scope.mode === "all" && (stores.filter((store) => store.ownership === "Direct").length !== baseline.direct || stores.filter((store) => store.ownership === "FC").length !== baseline.fc)) fail("INVALID_OWNERSHIP_BASELINE");
  const confirmed = payload.stores.filter((store) => store.dataState === "confirmed").length;
  const trendKeys = ["sales", "operatingProfit", "customerCount", "totalTicket", "retailSales", "ecSales"];
  const monthlyTrend = Object.fromEntries(trendKeys.map((metricKey) => {
    const months = [...new Set(stores.flatMap((store) => store.monthlyTrend.map((point) => point.fiscalMonth)))].sort();
    const points = months.flatMap((month) => {
      const values = stores.map((store) => store.monthlyTrend.find((point) => point.fiscalMonth === month)?.metrics?.[metricKey]);
      if (values.some((value) => !Number.isFinite(value))) return [];
      const value = metricKey === "totalTicket"
        ? values.reduce((sum, item) => sum + item, 0) / values.length
        : values.reduce((sum, item) => sum + item, 0);
      return [{ fiscalMonth: month, value }];
    });
    const projectionKey = ({ operatingProfit: "profit", customerCount: "customers", totalTicket: "ticket", retailSales: "retail", ecSales: "ec" })[metricKey] || "sales";
    return [projectionKey, Object.freeze(points)];
  }));
  return Object.freeze({
    contractVersion: DBF_STORE_MONTHLY_CONTRACT, comparisonContractVersion: comparisonEnabled ? DBF_STORE_MONTHLY_COMPARISON_CONTRACT : null, taxBasis: "net", fiscalMonth: payload.fiscalMonth,
    role: scope.mode === "own" ? "store_manager" : scope.mode === "assigned" ? "area_manager" : "representative",
    audience: scope.mode === "own" ? "store_manager" : "executive", scopeLabel: `${stores.length}店舗`,
    stores: Object.freeze(stores), priorityActions: Object.freeze([]), businessDrivers: Object.freeze({}),
    executiveSummary: Object.freeze({ narrative: confirmed ? `${confirmed}店舗のDBF月次確定値を表示しています。` : "正式データを準備しています。", metrics: Object.freeze([]) }),
    accounting: Object.freeze({ confirmationState: confirmed === stores.length ? "confirmed" : "preparing", confirmedThroughPeriod: confirmed ? payload.fiscalMonth : null, reflectedStoreCount: confirmed, totalStoreCount: stores.length, lastUpdatedAt: null }),
    readiness: Object.freeze({ ...payload.readiness }), monthlyTrend: Object.freeze(monthlyTrend)
  });
}

export function createDbfStoreMonthlyAdapter(config, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const getSessionToken = dependencies.getSessionToken || (() => "");
  let controller = null;
  return Object.freeze({
    mode: config.mode,
    async loadDashboard({ period }) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(String(period || ""))) throw new ProjectionRequestError("INVALID_PERIOD", "営業対象月を確認してください。", 422);
      const token = String(await getSessionToken() || "").trim();
      if (!token) throw new ProjectionRequestError("UNAUTHORIZED", "セッションの有効期限が切れました。", 401);
      controller?.abort(); controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), config.timeoutMs);
      let response;
      try {
        response = await fetchImpl(config.endpoint, {
          method: "POST", credentials: "omit", cache: "no-store", signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", "X-Contract-Version": DBF_STORE_MONTHLY_CONTRACT },
          body: JSON.stringify({ action: "storeMonthlyActualProjectionV1", payload: { selectedMonth: period } })
        });
      } catch (cause) {
        if (cause?.name === "AbortError") throw new ProjectionRequestError("TIMEOUT", "通信に時間がかかっています。", 408, true);
        throw new ProjectionRequestError("NETWORK_ERROR", "一時的に取得できません。", 503, true);
      } finally { clearTimeout(timeout); controller = null; }
      let body;
      try { body = await response.json(); } catch { throw new ProjectionRequestError("MALFORMED_JSON", "データ確認が必要です。", 422); }
      if (!response.ok || body?.ok !== true) {
        const [code, message, retryable] = STATUS_ERRORS[response.status] || STATUS_ERRORS[500];
        throw new ProjectionRequestError(code, message, response.status, retryable);
      }
      return validateDbfStoreMonthlyProjection(body.data);
    },
    clear() { controller?.abort(); controller = null; }
  });
}
