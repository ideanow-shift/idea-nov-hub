import { NOV_HUB_SESSION_CONTRACT } from "../js/nov-hub-session-candidate.js";

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
const WORKSPACE_DATA_KEYS = Object.freeze([
  "accessProfile", "canWrite", "dashboard", "fiscalYear", "overview", "payloadMode",
  "fairMasters", "schoolMasters", "students", "todayTasks", "unlinkedSelectionHistory"
]);
const WORKSPACE_OVERVIEW_KEYS = Object.freeze([
  "contacts",
  "entries",
  "exactLinkSuggestions",
  "mapped",
  "manual",
  "offers",
  "ownerReview",
  "primaryCandidates",
  "quarantined",
  "remainingManual",
  "total"
]);
const STUDENT_KEYS = Object.freeze([
  "applicationNo",
  "businessDate",
  "classification",
  "classificationLabel",
  "displayName",
  "email",
  "faculty",
  "graduationYear",
  "kana",
  "lineIdentifier",
  "lineRegistrationDate",
  "legacyNoPresent",
  "mappingStatus",
  "nextActionAt",
  "nextActionLabel",
  "offerDate",
  "expectedJoinDate",
  "plannedStore",
  "phone",
  "acquisitionSource",
  "assignee",
  "notes",
  "preferredStore",
  "primaryEligible",
  "profileVersion",
  "supplementVersion",
  "reasonLabels",
  "recordId",
  "schoolId",
  "fairId",
  "school",
  "sourceCode",
  "sourceLabel",
  "sourceKeyStatus",
  "status",
  "statusCode",
  "suggestedTargetRecordId",
  "suggestionCategory",
  "contactHistory", "eventHistory", "nextActions", "selectionHistory"
]);
const DASHBOARD_KEYS = Object.freeze([
  "availability", "candidateCount", "entries", "eventCount", "fairCount", "graduation2027",
  "graduation2028", "interviewHistory", "interviewPlanned", "lineRegistrations", "offeredElsewhere",
  "offers", "rejected", "salonTourCompleted", "salonTourPlanned", "schoolCount",
  "selectionHistoryCount", "todayActions", "undatedActions", "unlinkedInterviewHistoryCount", "withdrawals"
]);
const DASHBOARD_AVAILABILITY_KEYS = Object.freeze([
  "candidateCount", "entries", "eventCount", "fairCount", "graduation2027", "graduation2028",
  "interviewHistory", "interviewPlanned", "lineRegistrations", "offeredElsewhere", "offers", "rejected",
  "salonTourCompleted", "salonTourPlanned", "schoolCount", "todayActions", "withdrawals"
]);
const SELECTION_HISTORY_KEYS = Object.freeze([
  "active", "assignedTo", "code", "date", "id", "label", "notes", "version"
]);
const EVENT_HISTORY_KEYS = Object.freeze([
  "active", "assignedTo", "code", "content", "date", "id", "label", "notes", "state", "version"
]);
const NEXT_ACTION_KEYS = Object.freeze([
  "active", "assignedTo", "code", "completedAt", "date", "id", "label", "notes", "state", "version"
]);
const TODAY_TASK_KEYS = Object.freeze(["assignedTo", "candidateId", "dueDate", "label"]);
const UNLINKED_SELECTION_KEYS = Object.freeze(["code", "date", "label", "sourceRowNo", "sourceType", "version"]);
const SCHOOL_MASTER_KEYS = Object.freeze([
  "assigned_to", "faculty_name", "is_active", "school_id", "school_name", "version"
]);
const FAIR_MASTER_KEYS = Object.freeze([
  "assigned_to", "contact_count", "event_date", "fair_id", "fair_name", "hire_count",
  "interview_count", "is_active", "line_registration_count", "offer_count", "participant_count",
  "participation_fee", "salon_tour_count", "venue", "version"
]);
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
  if (hubContract?.audience !== REQUIRED_AUDIENCE) return null;
  if (!hubSessionHelper || typeof hubSessionHelper.getSessionToken !== "function") return null;

  const apiBaseUrl = String(config?.readonlyApiBaseUrl || "").trim();
  if (!isHttpsUrl(apiBaseUrl)) return null;
  return Object.freeze({ apiBaseUrl: sanitizeBaseUrl(apiBaseUrl), hubSessionHelper });
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
        const data = unwrapWorkspaceEnvelope(envelope, response.status);
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

function unwrapWorkspaceEnvelope(envelope, httpStatus = 0) {
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
  assertExactKeys(envelope, SUCCESS_ENVELOPE_KEYS);
  validateMeta(envelope.meta);
  const data = envelope.data;
  if (!isPlainObject(data)) throw safeError("invalid_response");
  assertExactKeys(data, WORKSPACE_DATA_KEYS);
  if (data.payloadMode !== "workspace" || !["2027", "2028", "all"].includes(data.fiscalYear)) {
    throw safeError("invalid_response");
  }
  if (!isPlainObject(data.overview)) throw safeError("invalid_response");
  assertExactKeys(data.overview, WORKSPACE_OVERVIEW_KEYS);
  WORKSPACE_OVERVIEW_KEYS.forEach((key) => {
    if (!Number.isInteger(data.overview[key]) || data.overview[key] < 0) {
      throw safeError("invalid_response");
    }
  });
  if (!Array.isArray(data.students) || data.students.length > 1000) {
    throw safeError("invalid_response");
  }
  if (!["executive", "full", "recruiter"].includes(data.accessProfile)
    || typeof data.canWrite !== "boolean"
    || data.canWrite !== (data.accessProfile !== "executive")) {
    throw safeError("invalid_response");
  }
  validateTodayTasks(data.todayTasks);
  validateUnlinkedSelectionHistory(data.unlinkedSelectionHistory);
  validateSchoolMasters(data.schoolMasters);
  validateFairMasters(data.fairMasters);
  validateDashboard(data.dashboard);
  data.students.forEach(validateStudent);
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
      selectionHistory: Object.freeze(student.selectionHistory.map((item) => Object.freeze({ ...item })))
    })))
  });
}

function validateDashboard(dashboard) {
  if (!isPlainObject(dashboard)) throw safeError("invalid_response");
  assertExactKeys(dashboard, DASHBOARD_KEYS);
  const numeric = DASHBOARD_KEYS.filter((key) => !["availability"].includes(key));
  if (numeric.some((key) => !Number.isInteger(dashboard[key]) || dashboard[key] < 0)) throw safeError("invalid_response");
  if (!isPlainObject(dashboard.availability)) throw safeError("invalid_response");
  assertExactKeys(dashboard.availability, DASHBOARD_AVAILABILITY_KEYS);
  if (DASHBOARD_AVAILABILITY_KEYS.some((key) => typeof dashboard.availability[key] !== "boolean")) throw safeError("invalid_response");
}

function validateStudent(student) {
  if (!isPlainObject(student)) throw safeError("invalid_response");
  assertExactKeys(student, STUDENT_KEYS);
  const requiredStrings = [
    "recordId", "displayName", "sourceCode", "sourceLabel", "classification",
    "classificationLabel", "mappingStatus", "sourceKeyStatus", "status", "suggestionCategory"
  ];
  if (requiredStrings.some((key) => typeof student[key] !== "string" || !student[key])) {
    throw safeError("invalid_response");
  }
  const optionalStrings = [
    "applicationNo", "businessDate", "email", "kana", "lineRegistrationDate", "nextActionAt",
    "offerDate", "expectedJoinDate", "plannedStore",
    "phone", "preferredStore", "school", "schoolId", "fairId", "statusCode", "suggestedTargetRecordId", "nextActionLabel",
    "faculty", "lineIdentifier", "acquisitionSource", "assignee", "notes"
  ];
  if (optionalStrings.some((key) => student[key] !== undefined && student[key] !== null && typeof student[key] !== "string")) {
    throw safeError("invalid_response");
  }
  if (["offerDate", "expectedJoinDate"].some((key) => student[key] !== null
    && !/^\d{4}-\d{2}-\d{2}$/u.test(student[key]))) {
    throw safeError("invalid_response");
  }
  if (!Array.isArray(student.reasonLabels)
    || student.reasonLabels.length > 6
    || student.reasonLabels.some((value) => typeof value !== "string")) {
    throw safeError("invalid_response");
  }
  validateActivityRows(student.contactHistory, EVENT_HISTORY_KEYS, { dateOptional: false });
  validateActivityRows(student.eventHistory, EVENT_HISTORY_KEYS, { dateOptional: false });
  validateActivityRows(student.selectionHistory, SELECTION_HISTORY_KEYS, { dateOptional: false });
  validateActivityRows(student.nextActions, NEXT_ACTION_KEYS, { dateOptional: true });
  if ((student.graduationYear !== undefined && (!Number.isInteger(student.graduationYear) || student.graduationYear < 2026 || student.graduationYear > 2035))
    || typeof student.legacyNoPresent !== "boolean"
    || typeof student.primaryEligible !== "boolean"
    || (student.profileVersion !== null && (!Number.isInteger(student.profileVersion) || student.profileVersion < 1))
    || (student.supplementVersion !== null && (!Number.isInteger(student.supplementVersion) || student.supplementVersion < 1))
    || !["NONE", "EXACT1", "AMBIGUOUS"].includes(student.suggestionCategory)) {
    throw safeError("invalid_response");
  }
}

function validateSchoolMasters(rows) {
  if (!Array.isArray(rows) || rows.length > 1000) throw safeError("invalid_response");
  for (const row of rows) {
    if (!isPlainObject(row)) throw safeError("invalid_response");
    assertExactKeys(row, SCHOOL_MASTER_KEYS);
    if (!UUID_PATTERN.test(String(row.school_id || ""))
      || typeof row.school_name !== "string" || !row.school_name
      || !Number.isInteger(row.version) || row.version < 1
      || typeof row.is_active !== "boolean") throw safeError("invalid_response");
    for (const key of ["faculty_name", "assigned_to"]) {
      if (row[key] !== null && row[key] !== undefined && typeof row[key] !== "string") throw safeError("invalid_response");
    }
  }
}

function validateFairMasters(rows) {
  if (!Array.isArray(rows) || rows.length > 1000) throw safeError("invalid_response");
  for (const row of rows) {
    if (!isPlainObject(row)) throw safeError("invalid_response");
    assertExactKeys(row, FAIR_MASTER_KEYS);
    if (!UUID_PATTERN.test(String(row.fair_id || ""))
      || typeof row.fair_name !== "string" || !row.fair_name
      || !/^\d{4}-\d{2}-\d{2}$/u.test(String(row.event_date || ""))
      || !Number.isInteger(row.version) || row.version < 1
      || typeof row.is_active !== "boolean") throw safeError("invalid_response");
    for (const key of ["venue", "assigned_to"]) {
      if (row[key] !== null && row[key] !== undefined && typeof row[key] !== "string") throw safeError("invalid_response");
    }
    for (const key of ["participant_count", "contact_count", "line_registration_count", "salon_tour_count", "interview_count", "offer_count", "hire_count"]) {
      if (!Number.isInteger(row[key]) || row[key] < 0) throw safeError("invalid_response");
    }
    if (!Number.isFinite(Number(row.participation_fee)) || Number(row.participation_fee) < 0) throw safeError("invalid_response");
  }
}

function validateActivityRows(rows, keys, { dateOptional }) {
  if (!Array.isArray(rows) || rows.length > 100) throw safeError("invalid_response");
  for (const item of rows) {
    if (!isPlainObject(item)) throw safeError("invalid_response");
    assertExactKeys(item, keys);
    if (!UUID_PATTERN.test(String(item.id || ""))
      || !Number.isInteger(item.version) || item.version < 1
      || typeof item.code !== "string" || !item.code
      || typeof item.label !== "string" || !item.label
      || typeof item.active !== "boolean") {
      throw safeError("invalid_response");
    }
    if (item.date === null ? !dateOptional : !/^\d{4}-\d{2}-\d{2}$/u.test(String(item.date))) {
      throw safeError("invalid_response");
    }
    for (const key of keys.filter((key) => ["assignedTo", "completedAt", "content", "notes", "state"].includes(key))) {
      if (item[key] !== null && item[key] !== undefined && typeof item[key] !== "string") throw safeError("invalid_response");
    }
  }
}

function validateTodayTasks(rows) {
  if (!Array.isArray(rows) || rows.length > 5) throw safeError("invalid_response");
  for (const item of rows) {
    if (!isPlainObject(item)) throw safeError("invalid_response");
    assertExactKeys(item, TODAY_TASK_KEYS);
    if (!UUID_PATTERN.test(String(item.candidateId || ""))
      || !/^\d{4}-\d{2}-\d{2}$/u.test(String(item.dueDate || ""))
      || typeof item.label !== "string" || !item.label
      || (item.assignedTo !== null && item.assignedTo !== undefined && typeof item.assignedTo !== "string")) {
      throw safeError("invalid_response");
    }
  }
}

function validateUnlinkedSelectionHistory(rows) {
  if (!Array.isArray(rows) || rows.length > 100) throw safeError("invalid_response");
  for (const item of rows) {
    if (!isPlainObject(item)) throw safeError("invalid_response");
    assertExactKeys(item, UNLINKED_SELECTION_KEYS);
    if (typeof item.sourceType !== "string" || !item.sourceType
      || !Number.isInteger(item.sourceRowNo) || item.sourceRowNo < 1
      || typeof item.code !== "string" || !item.code
      || typeof item.label !== "string" || !item.label
      || !/^\d{4}-\d{2}-\d{2}$/u.test(String(item.date || ""))
      || !Number.isInteger(item.version) || item.version < 1) {
      throw safeError("invalid_response");
    }
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
