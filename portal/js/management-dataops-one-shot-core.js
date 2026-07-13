const ACTION = "managementDataopsStatus";
const GATE_ID = "management-gate-c7-dataops-smoke";
const WORKFLOW_STATUS_ALLOWLIST = new Set(["ready", "waiting"]);
const STOPPED_LABEL_ALLOWLIST = new Set([
  "SalonAnswer raw import",
  "classification approved update",
  "production recalculation"
]);
const PENDING_COUNT_KEYS = Object.freeze(["imports", "mappings", "approvals"]);
const STATUS_COUNT_KEYS = Object.freeze([
  "sourceDocuments", "accountingRawRows", "classificationDraft", "classificationReview"
]);
const FORBIDDEN_KEYS = new Set([
  "employeeid", "storeid", "scopeid", "corporationid", "firebaseuid", "token",
  "sessiontoken", "secret", "servicerole", "pinhash", "hubcontext", "authorization",
  "bearer", "cookie", "rawresponse", "path", "url", "signature", "name", "email", "phone"
]);

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function containsForbiddenExposure(value, seen = new Set()) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    return /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(value)
      || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
      || /(?:\+81|0)\d{1,4}-?\d{1,4}-?\d{3,4}/.test(value)
      || /^Bearer\s+/i.test(value);
  }
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) return true;
    if (containsForbiddenExposure(child, seen)) return true;
  }
  return false;
}

function numericMap(value, keys, { exact = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (exact) {
    const actualKeys = Object.keys(value).sort();
    const expectedKeys = [...keys].sort();
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) return null;
  }
  const result = {};
  for (const key of keys) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number < 0) return null;
    result[key] = number;
  }
  return Object.freeze(result);
}

function validateWorkflow(value) {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const statuses = value.map((item) => String(item?.status || ""));
  return statuses.every((status) => WORKFLOW_STATUS_ALLOWLIST.has(status)) ? Object.freeze(statuses) : null;
}

function validateStoppedLabels(value) {
  if (!Array.isArray(value) || value.length !== STOPPED_LABEL_ALLOWLIST.size) return null;
  const labels = value.map((item) => String(item || ""));
  if (!labels.every((label) => STOPPED_LABEL_ALLOWLIST.has(label))) return null;
  if (new Set(labels).size !== STOPPED_LABEL_ALLOWLIST.size) return null;
  return Object.freeze(labels);
}

function safeFailure(code, executionCount, status = 0, forbiddenExposure = false) {
  const result = {
    safeStop: true,
    code: String(code || "SAFE_STOP"),
    forbiddenExposure: forbiddenExposure === true,
    mutationExecuted: false,
    managementActionExecutionCount: executionCount
  };
  if (Number.isInteger(status) && status >= 400 && status <= 599) result.httpStatus = status;
  return Object.freeze(result);
}

function sanitizeResolvedResponse(body, executionCount) {
  if (containsForbiddenExposure(body)) {
    return safeFailure("FORBIDDEN_EXPOSURE", executionCount, 0, true);
  }
  if (!body || typeof body !== "object" || body.ok !== true
    || body.endpoint !== "dataops.status" || body.productionEnabled !== true
    || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return safeFailure("CONTRACT_MISMATCH", executionCount);
  }

  const pendingCounts = numericMap(body.data.pendingCounts, PENDING_COUNT_KEYS, { exact: true });
  const statusCounts = numericMap(body.data.statusCounts, STATUS_COUNT_KEYS, { exact: true });
  const workflowStatuses = validateWorkflow(body.data.workflow);
  const stoppedLabels = validateStoppedLabels(body.data.stoppedItems);
  if (!pendingCounts || !statusCounts || !workflowStatuses || !stoppedLabels) {
    return safeFailure("CONTRACT_MISMATCH", executionCount);
  }

  return Object.freeze({
    transportStatus: "resolved_ok",
    ok: true,
    endpoint: "dataops.status",
    productionEnabled: true,
    pendingCounts,
    statusCounts,
    workflowStatuses,
    stoppedLabels,
    forbiddenExposure: false,
    mutationExecuted: false,
    managementActionExecutionCount: executionCount
  });
}

function styleReviewControl(control, rightPx) {
  control.type = "button";
  control.tabIndex = -1;
  Object.assign(control.style, {
    position: "fixed",
    right: `${rightPx}px`,
    top: "24px",
    width: "16px",
    height: "16px",
    margin: "0",
    padding: "0",
    border: "0",
    opacity: "0.05",
    overflow: "hidden",
    pointerEvents: "auto",
    zIndex: "2147483647"
  });
}

export function createTrustedOneShotReviewControl({ documentRef, onTrustedAttempt }) {
  const control = documentRef.createElement("button");
  control.id = "management-c7-dataops-one-shot-control";
  control.setAttribute("data-review-control", "management-c7-dataops-one-shot");
  styleReviewControl(control, 24);
  let consumed = false;
  const listener = (event) => {
    if (event?.isTrusted !== true || consumed) return;
    consumed = true;
    control.removeEventListener("click", listener);
    control.remove();
    onTrustedAttempt(event);
  };
  control.addEventListener("click", listener);
  return control;
}

export function createTrustedResultCleanupControl({ documentRef, onTrustedCleanup }) {
  const control = documentRef.createElement("button");
  control.id = "management-c7-dataops-result-cleanup";
  control.setAttribute("data-review-control", "management-c7-dataops-result-cleanup");
  styleReviewControl(control, 44);
  const listener = (event) => {
    if (event?.isTrusted !== true) return;
    control.removeEventListener("click", listener);
    control.remove();
    onTrustedCleanup();
  };
  control.addEventListener("click", listener);
  return control;
}

export function createManagementDataopsOneShotDiagnostic(deps) {
  let attempted = false;
  let executionCount = 0;

  const publish = (value) => {
    deps.publishSanitizedResult(Object.freeze({ ...value }));
    return value;
  };

  async function handleTrustedClick(event) {
    if (event?.isTrusted !== true) return publish(safeFailure("UNTRUSTED_EVENT", executionCount));
    if (attempted) return publish(safeFailure("EXECUTION_LIMIT", executionCount));
    attempted = true;

    const gateValid = deps.buildGate?.enabled === true
      && deps.buildGate?.id === GATE_ID
      && deps.buildGate?.executionCountMax === 1;
    if (!gateValid) return publish(safeFailure("GATE_DISABLED", executionCount));
    if (deps.isPinAuthenticated() !== true) return publish(safeFailure("PIN_AUTH_REQUIRED", executionCount));

    let session = deps.getCurrentPinSession();
    const expiry = Date.parse(String(session?.expiresAt || ""));
    if (!session?.sessionToken || session?.audience !== "nov_hub" || !Number.isFinite(expiry) || expiry <= Date.now()) {
      session = null;
      return publish(safeFailure("SESSION_INVALID", executionCount));
    }

    let sessionToken = session.sessionToken;
    executionCount += 1;
    let body = null;
    try {
      deps.setHubSessionAuth(sessionToken);
      body = await deps.callApiAction(ACTION, { responseProfile: "diagnostic-sanitized-v1" });
      return publish(sanitizeResolvedResponse(body, executionCount));
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status === 401 || status === 403) deps.clearSessionOnAuthFailure(status);
      return publish(safeFailure(error?.code || "REQUEST_FAILED", executionCount, status));
    } finally {
      deps.clearApiAuth();
      body = null;
      sessionToken = null;
      session = null;
    }
  }

  return Object.freeze({ handleTrustedClick });
}

export const MANAGEMENT_DATAOPS_ONE_SHOT_CONTRACT = Object.freeze({
  action: ACTION,
  gateId: GATE_ID,
  executionCountMax: 1,
  sessionBoundary: "main.js current PIN session closure only",
  transportBoundary: "setHubSessionAuth -> callApiAction -> clearApiAuth",
  financeActionCount: 0,
  storesActionCount: 0
});
