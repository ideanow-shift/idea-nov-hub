const REQUIRED_AUDIENCE = "nov_hub";
const SUMMARY_FIELDS = Object.freeze([
  "contacts",
  "lineRegistrations",
  "salonTours",
  "interviews",
  "passed",
  "offers",
  "expectedJoiners"
]);

const METRIC_LABELS = Object.freeze({
  contacts: "接点数",
  lineRegistrations: "LINE登録",
  salonTours: "サロン見学",
  interviews: "面接",
  passed: "通過",
  offers: "内定",
  expectedJoiners: "入社予定"
});

const SAFE_MESSAGES = Object.freeze({
  runtime_config_unavailable: "設定確認中です",
  auth_required: "ログイン状態を確認できません",
  invalid_response: "集計形式を確認できません",
  api_error: "集計を取得できません",
  duplicate_startup_prevented: "集計取得はすでに開始済みです",
  ready: "集計を表示しました"
});

const SUCCESS_ENVELOPE_KEYS = Object.freeze(["data", "meta", "ok"]);
const ERROR_ENVELOPE_KEYS = Object.freeze(["message", "ok", "requestId", "safeCode"]);
const DATA_KEYS = Object.freeze(["config", "fiscalYear", "payloadMode", "summary"]);
const CONFIG_KEYS = Object.freeze(["appName"]);
const META_KEYS = Object.freeze(["generatedAt", "requestId", "source", "version"]);

export function readTalentRuntime({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = globalObject.NOV_HUB_SESSION_CONTRACT
} = {}) {
  const config = globalObject.NOV_TALENT_CONFIG;
  if (config?.readonlyApiEnabled !== true) return null;
  if (hubContract?.audience !== REQUIRED_AUDIENCE) return null;
  if (!hubSessionHelper || typeof hubSessionHelper.getSessionToken !== "function") return null;

  const apiBaseUrl = String(config?.readonlyApiBaseUrl || "").trim();
  if (!isHttpsUrl(apiBaseUrl)) return null;
  return Object.freeze({ apiBaseUrl: sanitizeBaseUrl(apiBaseUrl), hubSessionHelper });
}

export function createDashboardSummaryExact1Executor({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = globalObject.NOV_HUB_SESSION_CONTRACT,
  fetchImpl = globalObject.fetch,
  fiscalYear = "current"
} = {}) {
  const runtime = readTalentRuntime({ globalObject, hubSessionHelper, hubContract });
  if (!runtime || typeof fetchImpl !== "function") return null;

  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented", { duplicatePrevented: true });
      consumed = true;

      let requestSent = false;
      try {
        const headers = await buildAuthHeaders(runtime.hubSessionHelper);
        const url = new URL("/api/talent/v1/dashboard/summary", `${runtime.apiBaseUrl}/`);
        url.searchParams.set("fiscalYear", fiscalYear);
        requestSent = true;
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", ...headers },
          credentials: "omit"
        });
        const envelope = await readJsonEnvelope(response);
        const data = unwrapSummaryEnvelope(envelope);
        return Object.freeze({
          ...safeResult("ready", {
            executed: true,
            httpRequestSent: true,
            httpStatus: normalizeHttpStatus(response.status),
            okBoolean: true,
            requestCount: 1
          }),
          data,
          viewModel: buildDashboardSummaryViewModel(data)
        });
      } catch (error) {
        return safeResult(error?.safeCategory || "api_error", {
          executed: requestSent,
          httpRequestSent: requestSent,
          requestCount: requestSent ? 1 : 0,
          httpStatus: normalizeHttpStatus(error?.httpStatus)
        });
      }
    }
  });
}

export function buildDashboardSummaryViewModel(data) {
  const metrics = data?.summary || {};
  return SUMMARY_FIELDS.map((key) => {
    const value = metrics[key];
    if (!Number.isInteger(value) || value < 0) throw safeError("invalid_response");
    return Object.freeze({ key, label: METRIC_LABELS[key], value });
  });
}

function unwrapSummaryEnvelope(envelope) {
  if (!isPlainObject(envelope)) throw safeError("invalid_response");
  if (envelope.ok !== true) {
    assertExactKeys(envelope, ERROR_ENVELOPE_KEYS);
    throw safeError("api_error");
  }
  assertExactKeys(envelope, SUCCESS_ENVELOPE_KEYS);
  if (envelope.meta !== undefined) validateMeta(envelope.meta);
  const data = envelope.data;
  if (!isPlainObject(data)) throw safeError("invalid_response");
  assertExactKeys(data, DATA_KEYS);
  if (data.config !== undefined) {
    if (!isPlainObject(data.config)) throw safeError("invalid_response");
    assertExactKeys(data.config, CONFIG_KEYS);
  }
  if (data.payloadMode !== "summary") throw safeError("invalid_response");
  if (!isPlainObject(data.summary)) throw safeError("invalid_response");
  assertExactKeys(data.summary, SUMMARY_FIELDS);
  SUMMARY_FIELDS.forEach((field) => {
    if (!Number.isInteger(data.summary[field]) || data.summary[field] < 0) {
      throw safeError("invalid_response");
    }
  });
  return data;
}

async function buildAuthHeaders(hubSessionHelper) {
  let token = null;
  try {
    token = await hubSessionHelper.getSessionToken();
  } catch {
    throw safeError("auth_required", { httpRequestSent: false });
  }
  if (typeof token !== "string" || token.trim().length < 20) {
    throw safeError("auth_required", { httpRequestSent: false });
  }
  return Object.freeze({ Authorization: `Bearer ${token.trim()}` });
}

async function readJsonEnvelope(response) {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw safeError("invalid_response", { httpStatus: response?.status });
  }
  try {
    return await response.json();
  } catch {
    throw safeError("invalid_response", { httpStatus: response?.status });
  }
}

function validateMeta(meta) {
  if (!isPlainObject(meta)) throw safeError("invalid_response");
  assertExactKeys(meta, META_KEYS);
  ["generatedAt", "requestId", "source", "version"].forEach((key) => {
    if (meta[key] !== undefined && typeof meta[key] !== "string") throw safeError("invalid_response");
  });
}

function assertExactKeys(value, allowedKeys) {
  if (!isPlainObject(value)) throw safeError("invalid_response");
  const allowed = new Set(allowedKeys);
  if (!Object.keys(value).every((key) => allowed.has(key))) throw safeError("invalid_response");
}

function safeResult(stopCategory, overrides = {}) {
  return Object.freeze({
    executed: false,
    httpRequestSent: false,
    httpStatus: 0,
    okBoolean: false,
    stopCategory,
    safeMessage: SAFE_MESSAGES[stopCategory] || SAFE_MESSAGES.api_error,
    requestCount: 0,
    retryCount: 0,
    duplicatePrevented: false,
    rawResponseReturned: false,
    tokenValueReturned: false,
    authorizationHeaderReturned: false,
    rawClaimsReturned: false,
    employeeIdentityReturned: false,
    studentRowsReturned: false,
    forbiddenExposureDetected: false,
    ...overrides
  });
}

function safeError(safeCategory, fields = {}) {
  const error = new Error("safe_stop");
  error.name = "TalentSafeError";
  error.safeCategory = safeCategory;
  Object.assign(error, fields);
  return error;
}

function isHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeBaseUrl(value) {
  const url = new URL(String(value || ""));
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeHttpStatus(value) {
  const status = Number.parseInt(value, 10);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
}
