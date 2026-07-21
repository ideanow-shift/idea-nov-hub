export const IDEA_LINK_LAUNCH_CATEGORIES = Object.freeze({
  READY: "READY",
  ACCESS_LOG_FAILURE: "ACCESS_LOG_FAILURE",
  HANDOFF_CREATE_FAILURE: "HANDOFF_CREATE_FAILURE",
  HANDOFF_RESPONSE_INVALID: "HANDOFF_RESPONSE_INVALID",
  DESTINATION_VALIDATION_FAILURE: "DESTINATION_VALIDATION_FAILURE",
  POPUP_PREPARATION_FAILURE: "POPUP_PREPARATION_FAILURE",
  NAVIGATION_FAILURE: "NAVIGATION_FAILURE",
  UNCLASSIFIED_FAIL_CLOSED: "UNCLASSIFIED_FAIL_CLOSED"
});

const IDEA_LINK_AUDIENCE = "idea_link";
const IDEA_LINK_TARGET_PATH = "/idea-link-app/";
const IDEA_LINK_TARGET_VIEW = "home";
const HANDOFF_CODE_PATTERN = /^[A-Za-z0-9_-]{40,60}$/;
const FIXED_FAILURE_CATEGORIES = new Set(Object.values(IDEA_LINK_LAUNCH_CATEGORIES));

export function createIdeaLinkLaunchError(category) {
  const fixedCategory = FIXED_FAILURE_CATEGORIES.has(category)
    ? category
    : IDEA_LINK_LAUNCH_CATEGORIES.UNCLASSIFIED_FAIL_CLOSED;
  return Object.assign(new Error("IDEA LINK launch preparation failed."), { code: fixedCategory });
}

export function getIdeaLinkLaunchFailureCategory(error) {
  const category = String(error?.code || "");
  return FIXED_FAILURE_CATEGORIES.has(category)
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
    return IDEA_LINK_LAUNCH_CATEGORIES.READY;
  } catch (_error) {
    return IDEA_LINK_LAUNCH_CATEGORIES.ACCESS_LOG_FAILURE;
  }
}
