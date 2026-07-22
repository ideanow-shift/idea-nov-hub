export const IDEA_LINK_LAUNCH_CATEGORIES = Object.freeze({
  READY: "READY",
  AUTH_CONTEXT_MISSING: "AUTH_CONTEXT_MISSING",
  HANDOFF_CREATE_FAILURE: "HANDOFF_CREATE_FAILURE",
  HANDOFF_RESPONSE_INVALID: "HANDOFF_RESPONSE_INVALID",
  DESTINATION_VALIDATION_FAILURE: "DESTINATION_VALIDATION_FAILURE",
  POPUP_CREATE_FAILURE: "POPUP_CREATE_FAILURE",
  POPUP_PREPARATION_FAILURE: "POPUP_PREPARATION_FAILURE",
  NAVIGATION_FAILURE: "NAVIGATION_FAILURE",
  RESULT_SCHEMA_INVALID: "RESULT_SCHEMA_INVALID",
  UNCLASSIFIED_FAIL_CLOSED: "UNCLASSIFIED_FAIL_CLOSED"
});

export const IDEA_LINK_LAUNCH_STAGES = Object.freeze({
  NONE: "NONE",
  AUTH_CONTEXT: "AUTH_CONTEXT",
  POPUP_CREATE: "POPUP_CREATE",
  POPUP_PREPARATION: "POPUP_PREPARATION",
  HANDOFF_CREATE: "HANDOFF_CREATE",
  HANDOFF_RESPONSE: "HANDOFF_RESPONSE",
  DESTINATION_VALIDATION: "DESTINATION_VALIDATION",
  NAVIGATION: "NAVIGATION",
  RESULT_PROPAGATION: "RESULT_PROPAGATION"
});

export const IDEA_LINK_POPUP_CATEGORIES = Object.freeze({
  NOT_ATTEMPTED: "NOT_ATTEMPTED",
  READY: "READY",
  SAME_TAB_FALLBACK: "SAME_TAB_FALLBACK"
});

export const IDEA_LINK_CLEANUP_CATEGORIES = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  POPUP_CLOSED: "POPUP_CLOSED",
  POPUP_CLEANUP_FAILURE: "POPUP_CLEANUP_FAILURE"
});

export const IDEA_LINK_ACCESS_LOG_CATEGORIES = Object.freeze({
  NOT_REACHED: "NOT_REACHED",
  PENDING_NONBLOCKING: "PENDING_NONBLOCKING",
  READY: "READY",
  ACCESS_LOG_FAILURE: "ACCESS_LOG_FAILURE"
});

const IDEA_LINK_AUDIENCE = "idea_link";
const IDEA_LINK_TARGET_PATH = "/idea-link-app/";
const IDEA_LINK_TARGET_VIEW = "home";
const HANDOFF_CODE_PATTERN = /^[A-Za-z0-9_-]{40,60}$/;
const FIXED_PRIMARY_CATEGORIES = new Set(Object.values(IDEA_LINK_LAUNCH_CATEGORIES));
const FIXED_ERROR_CATEGORIES = new Set(
  Object.values(IDEA_LINK_LAUNCH_CATEGORIES)
    .filter((category) => category !== IDEA_LINK_LAUNCH_CATEGORIES.READY)
);
const FIXED_STAGES = new Set(Object.values(IDEA_LINK_LAUNCH_STAGES));
const FIXED_POPUP_CATEGORIES = new Set(Object.values(IDEA_LINK_POPUP_CATEGORIES));
const FIXED_CLEANUP_CATEGORIES = new Set(Object.values(IDEA_LINK_CLEANUP_CATEGORIES));
const FIXED_ACCESS_LOG_CATEGORIES = new Set(Object.values(IDEA_LINK_ACCESS_LOG_CATEGORIES));
const RESULT_KEYS = Object.freeze([
  "accessLogCategory",
  "category",
  "cleanupCategory",
  "failedStage",
  "ok",
  "popupCategory"
]);

const FAILURE_STAGE_BY_CATEGORY = Object.freeze({
  [IDEA_LINK_LAUNCH_CATEGORIES.AUTH_CONTEXT_MISSING]: IDEA_LINK_LAUNCH_STAGES.AUTH_CONTEXT,
  [IDEA_LINK_LAUNCH_CATEGORIES.POPUP_CREATE_FAILURE]: IDEA_LINK_LAUNCH_STAGES.POPUP_CREATE,
  [IDEA_LINK_LAUNCH_CATEGORIES.POPUP_PREPARATION_FAILURE]: IDEA_LINK_LAUNCH_STAGES.POPUP_PREPARATION,
  [IDEA_LINK_LAUNCH_CATEGORIES.HANDOFF_CREATE_FAILURE]: IDEA_LINK_LAUNCH_STAGES.HANDOFF_CREATE,
  [IDEA_LINK_LAUNCH_CATEGORIES.HANDOFF_RESPONSE_INVALID]: IDEA_LINK_LAUNCH_STAGES.HANDOFF_RESPONSE,
  [IDEA_LINK_LAUNCH_CATEGORIES.DESTINATION_VALIDATION_FAILURE]: IDEA_LINK_LAUNCH_STAGES.DESTINATION_VALIDATION,
  [IDEA_LINK_LAUNCH_CATEGORIES.NAVIGATION_FAILURE]: IDEA_LINK_LAUNCH_STAGES.NAVIGATION,
  [IDEA_LINK_LAUNCH_CATEGORIES.RESULT_SCHEMA_INVALID]: IDEA_LINK_LAUNCH_STAGES.RESULT_PROPAGATION,
  [IDEA_LINK_LAUNCH_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED]: IDEA_LINK_LAUNCH_STAGES.RESULT_PROPAGATION
});

function invalidResult() {
  return Object.freeze({
    ok: false,
    category: IDEA_LINK_LAUNCH_CATEGORIES.RESULT_SCHEMA_INVALID,
    failedStage: IDEA_LINK_LAUNCH_STAGES.RESULT_PROPAGATION,
    popupCategory: IDEA_LINK_POPUP_CATEGORIES.NOT_ATTEMPTED,
    cleanupCategory: IDEA_LINK_CLEANUP_CATEGORIES.NOT_REQUIRED,
    accessLogCategory: IDEA_LINK_ACCESS_LOG_CATEGORIES.NOT_REACHED
  });
}

export function getIdeaLinkLaunchFailureStage(category) {
  return FAILURE_STAGE_BY_CATEGORY[String(category || "")]
    || IDEA_LINK_LAUNCH_STAGES.RESULT_PROPAGATION;
}

export function validateIdeaLinkLaunchResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalidResult();
  const keys = Object.keys(value).sort();
  if (keys.join("|") !== RESULT_KEYS.join("|")) return invalidResult();
  if (
    typeof value.ok !== "boolean" ||
    !FIXED_PRIMARY_CATEGORIES.has(value.category) ||
    !FIXED_STAGES.has(value.failedStage) ||
    !FIXED_POPUP_CATEGORIES.has(value.popupCategory) ||
    !FIXED_CLEANUP_CATEGORIES.has(value.cleanupCategory) ||
    !FIXED_ACCESS_LOG_CATEGORIES.has(value.accessLogCategory)
  ) return invalidResult();
  if (value.ok !== (
    value.category === IDEA_LINK_LAUNCH_CATEGORIES.READY &&
    value.failedStage === IDEA_LINK_LAUNCH_STAGES.NONE
  )) return invalidResult();
  return Object.freeze({ ...value });
}

export function createIdeaLinkLaunchResult(overrides = {}) {
  return validateIdeaLinkLaunchResult({
    ok: false,
    category: IDEA_LINK_LAUNCH_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED,
    failedStage: IDEA_LINK_LAUNCH_STAGES.RESULT_PROPAGATION,
    popupCategory: IDEA_LINK_POPUP_CATEGORIES.NOT_ATTEMPTED,
    cleanupCategory: IDEA_LINK_CLEANUP_CATEGORIES.NOT_REQUIRED,
    accessLogCategory: IDEA_LINK_ACCESS_LOG_CATEGORIES.NOT_REACHED,
    ...overrides
  });
}

export function createIdeaLinkLaunchError(category) {
  const fixedCategory = FIXED_ERROR_CATEGORIES.has(category)
    ? category
    : IDEA_LINK_LAUNCH_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED;
  return Object.assign(new Error("IDEA LINK launch preparation failed."), { code: fixedCategory });
}

export function getIdeaLinkLaunchFailureCategory(error) {
  const category = String(error?.code || "");
  return FIXED_ERROR_CATEGORIES.has(category)
    ? category
    : IDEA_LINK_LAUNCH_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED;
}

export function buildValidatedIdeaLinkLaunchUrl(response, currentHref, appUrl) {
  const handoff = response?.handoff;
  const handoffCode = String(handoff?.handoffCode || "").trim();
  if (
    !handoff ||
    !HANDOFF_CODE_PATTERN.test(handoffCode) ||
    String(handoff.audience || "") !== IDEA_LINK_AUDIENCE ||
    String(handoff.targetPath || "") !== IDEA_LINK_TARGET_PATH ||
    String(handoff.targetView || "") !== IDEA_LINK_TARGET_VIEW
  ) {
    throw createIdeaLinkLaunchError(IDEA_LINK_LAUNCH_CATEGORIES.HANDOFF_RESPONSE_INVALID);
  }

  let currentUrl;
  let destinationUrl;
  let expectedDestinationUrl;
  try {
    currentUrl = new URL(currentHref);
    destinationUrl = new URL(appUrl, currentUrl);
    expectedDestinationUrl = new URL(`.${IDEA_LINK_TARGET_PATH}`, currentUrl);
  } catch (_error) {
    throw createIdeaLinkLaunchError(IDEA_LINK_LAUNCH_CATEGORIES.DESTINATION_VALIDATION_FAILURE);
  }

  if (
    destinationUrl.origin !== currentUrl.origin ||
    destinationUrl.origin !== expectedDestinationUrl.origin ||
    destinationUrl.pathname !== expectedDestinationUrl.pathname ||
    destinationUrl.username ||
    destinationUrl.password ||
    destinationUrl.hash
  ) {
    throw createIdeaLinkLaunchError(IDEA_LINK_LAUNCH_CATEGORIES.DESTINATION_VALIDATION_FAILURE);
  }

  destinationUrl.searchParams.set("handoff_code", handoffCode);
  return destinationUrl.toString();
}

export async function captureIdeaLinkAccessLog(writeAccessLog, details) {
  try {
    await writeAccessLog("openApp", details);
    return IDEA_LINK_ACCESS_LOG_CATEGORIES.READY;
  } catch (_error) {
    return IDEA_LINK_ACCESS_LOG_CATEGORIES.ACCESS_LOG_FAILURE;
  }
}
