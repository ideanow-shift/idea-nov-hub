import { clearIdeaLinkSessionAuth, exchangeIdeaLinkHandoff, setIdeaLinkSessionAuth } from "./api.js?v=idea-link-module-sync-20260712-1";

export const IDEA_LINK_SESSION_STORAGE_KEY = "ideaNov.ideaLink.appSession.v1";
export const IDEA_LINK_HANDOFF_QUERY_KEY = "handoff_code";
export const IDEA_LINK_ALLOWED_TARGET_VIEWS = new Set(["home", "send", "timeline", "my-page"]);
export const IDEA_LINK_TARGET_PATH = "/idea-link-app/";

export const IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES = Object.freeze({
  READY: "READY",
  NO_HANDOFF_SESSION: "NO_HANDOFF_SESSION",
  URL_REDACTION_FAILED: "URL_REDACTION_FAILED",
  EXCHANGE_REQUEST_FAILED: "EXCHANGE_REQUEST_FAILED",
  EXCHANGE_RESPONSE_INVALID: "EXCHANGE_RESPONSE_INVALID",
  TARGET_CONTRACT_INVALID: "TARGET_CONTRACT_INVALID",
  SESSION_VALIDATION_FAILED: "SESSION_VALIDATION_FAILED",
  SESSION_PERSIST_FAILED: "SESSION_PERSIST_FAILED",
  API_AUTH_BIND_FAILED: "API_AUTH_BIND_FAILED",
  STARTUP_AUTH_FAILURE: "STARTUP_AUTH_FAILURE",
  RESULT_SCHEMA_INVALID: "RESULT_SCHEMA_INVALID",
  UNCLASSIFIED_FAIL_CLOSED: "UNCLASSIFIED_FAIL_CLOSED"
});

export const IDEA_LINK_HANDOFF_RUNTIME_STAGES = Object.freeze({
  NONE: "NONE",
  HANDOFF_CODE_CAPTURE: "HANDOFF_CODE_CAPTURE",
  URL_REDACTION: "URL_REDACTION",
  EXCHANGE_REQUEST: "EXCHANGE_REQUEST",
  EXCHANGE_RESPONSE: "EXCHANGE_RESPONSE",
  TARGET_CONTRACT: "TARGET_CONTRACT",
  SESSION_VALIDATION: "SESSION_VALIDATION",
  SESSION_PERSIST: "SESSION_PERSIST",
  API_AUTH_BIND: "API_AUTH_BIND",
  SESSION_RESTORE: "SESSION_RESTORE",
  STARTUP_AUTH: "STARTUP_AUTH",
  RESULT_PROPAGATION: "RESULT_PROPAGATION"
});

const IDEA_LINK_AUDIENCE = "idea_link";
const HUB_URL = "../";
const RESULT_KEYS = Object.freeze(["category", "failedStage", "ok", "session", "targetPath", "targetView"]);
const FIXED_CATEGORIES = new Set(Object.values(IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES));
const FIXED_STAGES = new Set(Object.values(IDEA_LINK_HANDOFF_RUNTIME_STAGES));

let memorySession = null;

function sanitizeSession(value) {
  if (!value || typeof value !== "object") return null;
  return Object.freeze({
    audience: String(value.audience || ""),
    expiresAt: String(value.expiresAt || ""),
    targetPath: String(value.targetPath || ""),
    targetView: String(value.targetView || "")
  });
}

function invalidRuntimeResult() {
  return Object.freeze({
    ok: false,
    category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.RESULT_SCHEMA_INVALID,
    failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.RESULT_PROPAGATION,
    session: null,
    targetPath: "",
    targetView: ""
  });
}

export function validateIdeaLinkHandoffRuntimeResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalidRuntimeResult();
  if (Object.keys(value).sort().join("|") !== RESULT_KEYS.join("|")) return invalidRuntimeResult();
  if (
    typeof value.ok !== "boolean" ||
    !FIXED_CATEGORIES.has(value.category) ||
    !FIXED_STAGES.has(value.failedStage) ||
    (value.session !== null && (typeof value.session !== "object" || Array.isArray(value.session))) ||
    typeof value.targetPath !== "string" ||
    typeof value.targetView !== "string"
  ) return invalidRuntimeResult();
  const safeSession = sanitizeSession(value.session);
  const ready = value.category === IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.READY
    && value.failedStage === IDEA_LINK_HANDOFF_RUNTIME_STAGES.NONE
    && safeSession !== null
    && safeSession.audience === IDEA_LINK_AUDIENCE
    && safeSession.targetPath === value.targetPath
    && safeSession.targetView === value.targetView
    && Number.isFinite(Date.parse(safeSession.expiresAt))
    && Date.parse(safeSession.expiresAt) > Date.now()
    && value.targetPath === IDEA_LINK_TARGET_PATH
    && IDEA_LINK_ALLOWED_TARGET_VIEWS.has(value.targetView);
  if (value.ok !== ready) return invalidRuntimeResult();
  return Object.freeze({ ...value, session: safeSession });
}

export function createIdeaLinkHandoffRuntimeResult(overrides = {}) {
  return validateIdeaLinkHandoffRuntimeResult({
    ok: false,
    category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED,
    failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.RESULT_PROPAGATION,
    session: null,
    targetPath: "",
    targetView: "",
    ...overrides
  });
}

function isUsableSession(value) {
  if (!value || typeof value !== "object") return false;
  if (String(value.audience || "") !== IDEA_LINK_AUDIENCE) return false;
  if (String(value.targetPath || "") !== IDEA_LINK_TARGET_PATH) return false;
  if (!IDEA_LINK_ALLOWED_TARGET_VIEWS.has(String(value.targetView || ""))) return false;
  if (!String(value.sessionToken || "").trim()) return false;
  const expiresAt = Date.parse(String(value.expiresAt || ""));
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function removeHandoffCodeFromUrl(url = window.location.href) {
  const safeUrl = new URL(url);
  safeUrl.searchParams.delete(IDEA_LINK_HANDOFF_QUERY_KEY);
  window.history.replaceState({}, document.title, safeUrl.toString());
}

function clearStoredSession(storage = sessionStorage) {
  try {
    storage.removeItem(IDEA_LINK_SESSION_STORAGE_KEY);
  } catch (_error) {
    // Fail closed without exposing storage details.
  }
}

export function establishIdeaLinkSession(value, options = {}) {
  const storage = options.storage || sessionStorage;
  const bindAuth = options.bindAuth || setIdeaLinkSessionAuth;
  const clearAuth = options.clearAuth || clearIdeaLinkSessionAuth;
  const session = {
    sessionToken: String(value?.sessionToken || ""),
    expiresAt: String(value?.expiresAt || ""),
    audience: String(value?.audience || ""),
    targetPath: String(value?.targetPath || ""),
    targetView: String(value?.targetView || "")
  };
  if (!isUsableSession(session)) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.SESSION_VALIDATION_FAILED,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.SESSION_VALIDATION
    });
  }
  try {
    storage.setItem(IDEA_LINK_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (_error) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.SESSION_PERSIST_FAILED,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.SESSION_PERSIST,
      targetPath: session.targetPath,
      targetView: session.targetView
    });
  }
  try {
    bindAuth(session.sessionToken);
  } catch (_error) {
    clearStoredSession(storage);
    try { clearAuth(); } catch (_clearError) { /* fail closed */ }
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.API_AUTH_BIND_FAILED,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.API_AUTH_BIND,
      targetPath: session.targetPath,
      targetView: session.targetView
    });
  }
  memorySession = session;
  const safeSession = sanitizeSession(session);
  return createIdeaLinkHandoffRuntimeResult({
    ok: true,
    category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.READY,
    failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.NONE,
    session: safeSession,
    targetPath: session.targetPath,
    targetView: session.targetView
  });
}

export function restoreIdeaLinkSession() {
  if (isUsableSession(memorySession)) {
    try {
      setIdeaLinkSessionAuth(memorySession.sessionToken);
      return sanitizeSession(memorySession);
    } catch (_error) {
      clearIdeaLinkSession();
      return null;
    }
  }
  let stored = null;
  try {
    stored = JSON.parse(sessionStorage.getItem(IDEA_LINK_SESSION_STORAGE_KEY) || "null");
  } catch (_error) {
    stored = null;
  }
  if (!isUsableSession(stored)) {
    clearIdeaLinkSession();
    return null;
  }
  const result = establishIdeaLinkSession(stored);
  return result.ok ? result.session : null;
}

export async function initializeIdeaLinkHandoff(url = window.location.href, options = {}) {
  let targetUrl;
  try {
    targetUrl = new URL(url);
  } catch (_error) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.HANDOFF_CODE_CAPTURE
    });
  }
  const handoffCode = String(targetUrl.searchParams.get(IDEA_LINK_HANDOFF_QUERY_KEY) || "").trim();
  if (!handoffCode) {
    const restored = (options.restoreSession || restoreIdeaLinkSession)();
    return restored
      ? createIdeaLinkHandoffRuntimeResult({
        ok: true,
        category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.READY,
        failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.NONE,
        session: restored,
        targetPath: restored.targetPath,
        targetView: restored.targetView
      })
      : createIdeaLinkHandoffRuntimeResult({
        category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.NO_HANDOFF_SESSION,
        failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.SESSION_RESTORE
      });
  }

  try {
    (options.redactUrl || removeHandoffCodeFromUrl)(targetUrl.toString());
  } catch (_error) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.URL_REDACTION_FAILED,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.URL_REDACTION
    });
  }

  let response;
  try {
    response = await (options.exchange || exchangeIdeaLinkHandoff)(handoffCode);
  } catch (_error) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.EXCHANGE_REQUEST_FAILED,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.EXCHANGE_REQUEST
    });
  }
  const handoff = response?.handoff;
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.EXCHANGE_RESPONSE_INVALID,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.EXCHANGE_RESPONSE
    });
  }
  const targetPath = String(handoff.targetPath || "");
  const targetView = String(handoff.targetView || "");
  if (
    String(handoff.audience || "") !== IDEA_LINK_AUDIENCE ||
    targetPath !== IDEA_LINK_TARGET_PATH ||
    !IDEA_LINK_ALLOWED_TARGET_VIEWS.has(targetView)
  ) {
    return createIdeaLinkHandoffRuntimeResult({
      category: IDEA_LINK_HANDOFF_RUNTIME_CATEGORIES.TARGET_CONTRACT_INVALID,
      failedStage: IDEA_LINK_HANDOFF_RUNTIME_STAGES.TARGET_CONTRACT,
      targetPath,
      targetView
    });
  }
  return (options.establishSession || establishIdeaLinkSession)({
    sessionToken: handoff.ideaLinkSession,
    expiresAt: handoff.expiresAt,
    audience: handoff.audience,
    targetPath,
    targetView
  });
}

export function clearIdeaLinkSession() {
  memorySession = null;
  clearStoredSession();
  clearIdeaLinkSessionAuth();
}

export function returnToHub() {
  clearIdeaLinkSession();
  window.location.replace(HUB_URL);
}
