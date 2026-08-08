import { NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";
import {
  validateWorkspaceResponse,
  WORKSPACE_CONTRACT_VERSION
} from "./generated/workspace-contract-v1.mjs?v=20260809-selection-confirm-dialog-1";
import {
  validateSelectionCoverageResponse
} from "./generated/selection-coverage-contract-v1.mjs?v=20260809-selection-confirm-dialog-1";

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
const DATA_KEYS = Object.freeze(["config", "fiscalYear", "partialStatus", "payloadMode", "summary"]);
const CONFIG_KEYS = Object.freeze(["appName"]);
const META_KEYS = Object.freeze(["generatedAt", "requestId", "source", "version"]);
const PARTIAL_STATUS_KEYS = Object.freeze(["retryCount", "state", "unavailableViews"]);
const AUDIT_ENTRY_KEYS = Object.freeze(["action", "changedFields", "profileVersion", "occurredAt"]);
const STAGING_AUDIT_ENTRY_KEYS = Object.freeze(["action", "changedFields", "supplementVersion", "occurredAt"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const AUDIT_FIELDS = Object.freeze([
  "displayName", "kana", "school", "phone", "email", "preferredStore",
  "currentStatus", "nextActionAt", "offerDate", "expectedJoinDate", "plannedStore"
]);

export function readTalentRuntime({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT
} = {}) {
  const config = globalObject.NOV_TALENT_CONFIG;
  if (config?.readonlyApiEnabled !== true) return null;
  if (config?.workspaceContractVersion !== WORKSPACE_CONTRACT_VERSION) return null;
  if (hubContract?.audience !== REQUIRED_AUDIENCE) return null;
  if (!hubSessionHelper || typeof hubSessionHelper.getSessionToken !== "function") return null;

  const apiBaseUrl = String(config?.readonlyApiBaseUrl || "").trim();
  if (!isHttpsUrl(apiBaseUrl)) return null;
  return Object.freeze({
    apiBaseUrl: sanitizeBaseUrl(apiBaseUrl),
    hubSessionHelper,
    allowLegacyWorkspaceV0: config?.workspaceContractCompatibility === "legacy-v0-read"
  });
}

export function createDashboardSummaryExact1Executor({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT,
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
        const url = new URL("./api/talent/v1/dashboard/summary", `${runtime.apiBaseUrl}/`);
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

export function createTalentWorkspaceExact1Executor({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT,
  fetchImpl = globalObject.fetch,
  fiscalYear = "2027"
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
        const url = new URL("./api/talent/v1/workspace", `${runtime.apiBaseUrl}/`);
        url.searchParams.set("fiscalYear", fiscalYear);
        requestSent = true;
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", ...headers },
          credentials: "omit"
        });
        const envelope = await readJsonEnvelope(response);
        const data = unwrapWorkspaceEnvelope(envelope, response.status, runtime.allowLegacyWorkspaceV0);
        return Object.freeze({
          ...safeResult("ready", {
            executed: true,
            httpRequestSent: true,
            httpStatus: normalizeHttpStatus(response.status),
            okBoolean: true,
            requestCount: 1,
            studentRowsReturned: true
          }),
          data
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

export function createSelectionCoverageExact1Executor({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT,
  fetchImpl = globalObject.fetch
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
        const url = new URL("./api/talent/v1/selection-coverage", `${runtime.apiBaseUrl}/`);
        requestSent = true;
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", ...headers },
          credentials: "omit"
        });
        const envelope = await readJsonEnvelope(response);
        if (!response.ok || envelope?.ok !== true) throw safeError("api_error", { httpStatus: response.status });
        const contract = validateSelectionCoverageResponse(envelope);
        if (!contract.ok) throw safeError("invalid_response", { httpStatus: response.status });
        return Object.freeze({
          ...safeResult("ready", { executed: true, httpRequestSent: true, httpStatus: response.status, okBoolean: true, requestCount: 1 }),
          data: Object.freeze({ ...contract.value.data, metrics: Object.freeze(contract.value.data.metrics.map((row) => Object.freeze({ ...row }))) })
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

export function createTalentWorkforceSummaryExact1Executor({
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT,
  fetchImpl = globalObject.fetch
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
        const url = new URL("./api/talent/v1/workforce/summary", `${runtime.apiBaseUrl}/`);
        requestSent = true;
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", ...headers },
          credentials: "omit"
        });
        const envelope = await readJsonEnvelope(response);
        const data = unwrapWorkforceSummaryEnvelope(envelope);
        return Object.freeze({
          ...safeResult("ready", {
            executed: true,
            httpRequestSent: true,
            httpStatus: normalizeHttpStatus(response.status),
            okBoolean: true,
            requestCount: 1
          }),
          data
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

export function createTalentStudentProfileAuditExact1Executor({
  applicationNo,
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT,
  fetchImpl = globalObject.fetch
} = {}) {
  const runtime = readTalentRuntime({ globalObject, hubSessionHelper, hubContract });
  if (!runtime || typeof fetchImpl !== "function" || !/^NT-[0-9]{4}-[0-9]{6}$/u.test(String(applicationNo || ""))) return null;

  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented", { duplicatePrevented: true });
      consumed = true;
      let requestSent = false;
      try {
        const headers = await buildAuthHeaders(runtime.hubSessionHelper);
        const url = new URL("./api/talent/v1/students/profile-audit", `${runtime.apiBaseUrl}/`);
        url.searchParams.set("applicationNo", String(applicationNo));
        requestSent = true;
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", ...headers },
          credentials: "omit"
        });
        const envelope = await readJsonEnvelope(response);
        const data = unwrapProfileAuditEnvelope(envelope, String(applicationNo));
        return Object.freeze({
          ...safeResult("ready", {
            executed: true,
            httpRequestSent: true,
            httpStatus: normalizeHttpStatus(response.status),
            okBoolean: true,
            requestCount: 1
          }),
          data
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

export function createTalentStagingSupplementAuditExact1Executor({
  stagingRecordId,
  globalObject = globalThis,
  hubSessionHelper = globalObject.NovHubSession,
  hubContract = NOV_HUB_SESSION_CONTRACT,
  fetchImpl = globalObject.fetch
} = {}) {
  const normalizedRecordId = String(stagingRecordId || "").trim();
  const runtime = readTalentRuntime({ globalObject, hubSessionHelper, hubContract });
  if (!runtime || typeof fetchImpl !== "function" || !UUID_PATTERN.test(normalizedRecordId)) return null;

  let consumed = false;
  return Object.freeze({
    async run() {
      if (consumed) return safeResult("duplicate_startup_prevented", { duplicatePrevented: true });
      consumed = true;
      let requestSent = false;
      try {
        const headers = await buildAuthHeaders(runtime.hubSessionHelper);
        const url = new URL("./api/talent/v1/staging/supplement-audit", `${runtime.apiBaseUrl}/`);
        url.searchParams.set("stagingRecordId", normalizedRecordId);
        requestSent = true;
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json", ...headers },
          credentials: "omit"
        });
        const envelope = await readJsonEnvelope(response);
        const data = unwrapStagingSupplementAuditEnvelope(envelope, normalizedRecordId);
        return Object.freeze({
          ...safeResult("ready", {
            executed: true,
            httpRequestSent: true,
            httpStatus: normalizeHttpStatus(response.status),
            okBoolean: true,
            requestCount: 1
          }),
          data
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

function unwrapProfileAuditEnvelope(envelope, applicationNo) {
  if (!isPlainObject(envelope) || envelope.ok !== true) throw safeError("invalid_response");
  assertExactKeys(envelope, SUCCESS_ENVELOPE_KEYS);
  validateMeta(envelope.meta);
  const data = envelope.data;
  if (!isPlainObject(data)
    || Object.keys(data).length !== 2
    || data.applicationNo !== applicationNo
    || !Array.isArray(data.entries)
    || data.entries.length > 20) throw safeError("invalid_response");
  data.entries.forEach((entry) => {
    assertExactKeys(entry, AUDIT_ENTRY_KEYS);
    if (!["CREATE", "UPDATE"].includes(entry.action)
      || !Number.isInteger(entry.profileVersion) || entry.profileVersion < 1
      || !/^\d{4}-\d{2}-\d{2}T/u.test(String(entry.occurredAt))
      || !Array.isArray(entry.changedFields)
      || entry.changedFields.length < 1 || entry.changedFields.length > AUDIT_FIELDS.length
      || entry.changedFields.some((field) => !AUDIT_FIELDS.includes(field))) {
      throw safeError("invalid_response");
    }
  });
  return Object.freeze({
    applicationNo,
    entries: Object.freeze(data.entries.map((entry) => Object.freeze({
      ...entry,
      changedFields: Object.freeze([...entry.changedFields])
    })))
  });
}

function unwrapStagingSupplementAuditEnvelope(envelope, stagingRecordId) {
  if (!isPlainObject(envelope) || envelope.ok !== true) throw safeError("invalid_response");
  assertExactKeys(envelope, SUCCESS_ENVELOPE_KEYS);
  validateMeta(envelope.meta);
  const data = envelope.data;
  if (!isPlainObject(data)
    || Object.keys(data).length !== 2
    || data.stagingRecordId !== stagingRecordId
    || !Array.isArray(data.entries)
    || data.entries.length > 20) throw safeError("invalid_response");
  data.entries.forEach((entry) => {
    assertExactKeys(entry, STAGING_AUDIT_ENTRY_KEYS);
    if (!["CREATE", "UPDATE"].includes(entry.action)
      || !Number.isInteger(entry.supplementVersion) || entry.supplementVersion < 1
      || !/^\d{4}-\d{2}-\d{2}T/u.test(String(entry.occurredAt))
      || !Array.isArray(entry.changedFields)
      || entry.changedFields.length < 1 || entry.changedFields.length > AUDIT_FIELDS.length
      || entry.changedFields.some((field) => !AUDIT_FIELDS.includes(field))) {
      throw safeError("invalid_response");
    }
  });
  return Object.freeze({
    stagingRecordId,
    entries: Object.freeze(data.entries.map((entry) => Object.freeze({
      ...entry,
      changedFields: Object.freeze([...entry.changedFields])
    })))
  });
}

function unwrapWorkforceSummaryEnvelope(envelope) {
  if (!isPlainObject(envelope) || envelope.ok !== true) throw safeError("invalid_response");
  assertExactKeys(envelope, SUCCESS_ENVELOPE_KEYS);
  validateMeta(envelope.meta);
  const data = envelope.data;
  const keys = [
    "activeEmployeeCount", "onboardingCount", "leaveCount", "retirementCount",
    "transferAvailable", "transferCount", "asOfDate", "procedureQueues"
  ];
  if (!isPlainObject(data) || Object.keys(data).length !== keys.length
    || !keys.every((key) => Object.hasOwn(data, key))
    || ![data.activeEmployeeCount, data.onboardingCount, data.leaveCount, data.retirementCount]
      .every((value) => Number.isInteger(value) && value >= 0)
    || typeof data.transferAvailable !== "boolean"
    || (data.transferCount !== null && (!Number.isInteger(data.transferCount) || data.transferCount < 0))
    || (data.transferAvailable && data.transferCount === null)
    || !/^\d{4}-\d{2}-\d{2}$/u.test(String(data.asOfDate))
    || !isWorkforceProcedureQueues(data.procedureQueues)) {
    throw safeError("invalid_response");
  }
  return Object.freeze({
    ...data,
    procedureQueues: Object.freeze(Object.fromEntries(Object.entries(data.procedureQueues).map(([key, rows]) => [
      key,
      Object.freeze(rows.map((row) => Object.freeze({ ...row })))
    ])))
  });
}

function isWorkforceProcedureQueues(value) {
  const keys = ["onboarding", "leave", "retirement"];
  return isPlainObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Array.isArray(value[key])
    && value[key].length <= 100 && value[key].every((row) => isPlainObject(row)
      && Object.keys(row).length === 3
      && ["displayName", "effectiveDate", "detail"].every((field) => Object.hasOwn(row, field))
      && typeof row.displayName === "string" && row.displayName.length > 0 && row.displayName.length <= 120
      && /^\d{4}-\d{2}-\d{2}$/u.test(row.effectiveDate)
      && typeof row.detail === "string" && row.detail.length > 0 && row.detail.length <= 120));
}

export function buildDashboardSummaryViewModel(data) {
  const metrics = data?.summary || {};
  return SUMMARY_FIELDS.map((key) => {
    const value = metrics[key];
    if (!Number.isInteger(value) || value < 0) throw safeError("invalid_response");
    return Object.freeze({ key, label: METRIC_LABELS[key], value });
  });
}

export function validateDashboardSummaryContract(summary) {
  if (!isPlainObject(summary)) throw safeError("invalid_response");
  assertExactKeys(summary, SUMMARY_FIELDS);
  SUMMARY_FIELDS.forEach((field) => {
    if (!Number.isInteger(summary[field]) || summary[field] < 0) {
      throw safeError("invalid_response");
    }
  });
  return summary;
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
  validateDashboardSummaryContract(data.summary);
  validatePartialStatus(data.partialStatus);
  return data;
}

function unwrapWorkspaceEnvelope(envelope, httpStatus = 0, allowLegacyWorkspaceV0 = false) {
  if (!isPlainObject(envelope)) throw safeError("invalid_response");
  if (envelope.ok !== true) {
    assertExactKeys(envelope, ERROR_ENVELOPE_KEYS);
    const category = envelope.safeCode === "AUTH_REQUIRED"
      ? "auth_required"
      : envelope.safeCode === "FORBIDDEN"
        ? "forbidden"
        : "api_error";
    throw safeError(category, { httpStatus });
  }
  const contract = validateWorkspaceResponse(envelope, { allowLegacyV0: allowLegacyWorkspaceV0 });
  if (!contract.ok) throw safeError("invalid_response");
  const data = contract.value.data;
  if (data.canWrite !== (data.accessProfile !== "executive")) throw safeError("invalid_response");
  if (data.overview.total !== data.students.length) throw safeError("invalid_response");
  return Object.freeze({
    ...data,
    overview: Object.freeze({ ...data.overview }),
    schoolMasters: Object.freeze(data.schoolMasters.map((row) => Object.freeze({ ...row }))),
    fairMasters: Object.freeze(data.fairMasters.map((row) => Object.freeze({ ...row }))),
    students: Object.freeze(data.students.map((student) => Object.freeze({
      ...student,
      reasonLabels: Object.freeze([...student.reasonLabels]),
      contactHistory: Object.freeze(student.contactHistory.map((item) => Object.freeze({ ...item }))),
      eventHistory: Object.freeze(student.eventHistory.map((item) => Object.freeze({ ...item }))),
      nextActions: Object.freeze(student.nextActions.map((item) => Object.freeze({ ...item }))),
      selectionHistory: Object.freeze(student.selectionHistory.map((item) => Object.freeze({ ...item })))
    })))
  });
}

function validatePartialStatus(partialStatus) {
  if (!isPlainObject(partialStatus)) throw safeError("invalid_response");
  assertExactKeys(partialStatus, PARTIAL_STATUS_KEYS);
  if (!["complete", "partial"].includes(partialStatus.state)
    || !Number.isInteger(partialStatus.retryCount) || partialStatus.retryCount < 0 || partialStatus.retryCount > 8
    || !Array.isArray(partialStatus.unavailableViews)
    || partialStatus.unavailableViews.some((view) => typeof view !== "string" || !view)) {
    throw safeError("invalid_response");
  }
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
