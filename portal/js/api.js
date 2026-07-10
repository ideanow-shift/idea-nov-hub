import { PORTAL_CONFIG } from "./firebase-config.js";
import { getIdToken } from "./auth.js";

let currentAuth = { authType: "firebase" };
const API_TIMEOUT_MS = 18000;
const EDGE_ACTIONS = new Set([
  "bootstrap",
  "announcements",
  "ideaLinkTimelineRead",
  "ideaLinkMyPageRead",
  "ideaLinkAdminSummaryRead",
  "novHubNotifications",
  "ideaLinkPostCreate",
  "ideaLinkRecipientSearch",
  "ideaLinkStoreOptions",
  "decisionListApplications",
  "decisionGetApplicationDetail",
  "decisionListComments",
  "markNovHubNotificationRead",
  "changeOwnPin",
  "log",
  "masterBootstrap",
  "masterListEmployees",
  "masterListStores",
  "masterListPortalApps",
  "masterListChangeLogs",
  "masterCreateEmployee",
  "masterUpdateEmployee",
  "masterAssignDefaultStaffRole",
  "masterUpdateEmployeeAppRoles",
  "masterLinkFirebaseUid",
  "masterUpdateEmployeeLoginCredential",
  "masterUploadEmployeeProfileImage",
  "masterUpsertEmployeeLineWorksDestination",
  "masterCreateCorporation",
  "masterUpdateStore",
  "masterUpdatePortalApp",
  "masterCreatePortalApp"
]);

export function setPinAuth(email, pin) {
  currentAuth = { authType: "pin", email: String(email || "").trim(), pin: String(pin || "").trim() };
}

export function setFirebaseAuth() {
  currentAuth = { authType: "firebase" };
}

export function clearApiAuth() {
  currentAuth = { authType: "firebase" };
}

async function postToApi(action, payload = {}) {
  const requestPayload = { ...currentAuth, ...payload };
  const body = new URLSearchParams({
    action,
    token: currentAuth.authType === "pin" ? "" : await getIdToken(),
    payload: JSON.stringify(requestPayload)
  });
  const endpoint = getApiEndpoint(action);
  if (!endpoint) {
    throw new Error("NOV HUB Edge API endpoint is not configured for this action.");
  }
  return await postToEndpoint(endpoint, body);
}

function getApiEndpoint(action) {
  const useEdge = PORTAL_CONFIG.apiMode === "edge"
    && PORTAL_CONFIG.edgeApiUrl
    && EDGE_ACTIONS.has(action)
    && (currentAuth.authType !== "pin" || PORTAL_CONFIG.edgePinEnabled === true);
  return useEdge ? PORTAL_CONFIG.edgeApiUrl : "";
}

async function postToEndpoint(endpoint, body) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
      signal: controller.signal
    });
  } catch (cause) {
    const error = new Error(cause?.name === "AbortError"
      ? "社員情報の確認に時間がかかっています。通信状況を確認して、もう一度お試しください。"
      : "NOV HUB APIへ接続できませんでした。通信状況を確認して、もう一度お試しください。");
    error.code = cause?.name === "AbortError" ? "API_TIMEOUT" : "NETWORK_ERROR";
    error.cause = cause;
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (cause) {
    if (!response.ok) {
      const error = new Error(`APIへの接続に失敗しました (${response.status})`);
      error.code = "HTTP_ERROR";
      error.detail = responseText.slice(0, 240);
      error.cause = cause;
      throw error;
    }
    const error = new Error("NOV HUB APIからJSON以外のレスポンスが返されました。");
    error.code = "INVALID_API_RESPONSE";
    error.detail = responseText.slice(0, 240);
    error.cause = cause;
    throw error;
  }

  if (!response.ok && !data?.ok) {
    const error = new Error(data.message || `APIへの接続に失敗しました (${response.status})`);
    error.code = data.code || "HTTP_ERROR";
    error.stage = data.stage || "";
    error.detail = data.detail || responseText.slice(0, 240);
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`APIへの接続に失敗しました (${response.status})`);
    error.code = "HTTP_ERROR";
    error.detail = responseText.slice(0, 240);
    throw error;
  }

  if (!data.ok) {
    const error = new Error(data.message || "処理に失敗しました。");
    error.code = data.code || "API_ERROR";
    error.stage = data.stage || "";
    error.detail = data.detail || "";
    throw error;
  }
  return data;
}

export function fetchPortalData() {
  return postToApi("bootstrap");
}

export function callApiAction(action, payload = {}) {
  return postToApi(action, payload);
}

export function writeAccessLog(action, details = {}) {
  return postToApi("log", { action, ...details });
}
