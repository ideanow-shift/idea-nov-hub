import { PORTAL_CONFIG } from "./firebase-config.js?v=fddfcae502dc";
import { getIdToken } from "./auth.js";

let currentAuth = { authType: "firebase" };
const API_TIMEOUT_MS = 18000;
const THANKS_COIN_ANALYTICS_PERIODS = new Set([
  "CURRENT_MONTH", "PREVIOUS_MONTH", "CURRENT_FISCAL_YEAR", "ROLLING_12_MONTHS"
]);
const THANKS_COIN_ANALYTICS_CATEGORIES = new Set([
  "READY", "INVALID_REQUEST", "UNAUTHORIZED", "REQUEST_LIMIT_REACHED", "QUERY_FAILED", "OUTPUT_CONTRACT_FAILED"
]);
const EDGE_ACTIONS = new Set([
  "bootstrap",
  "announcements",
  "ideaLinkTimelineRead",
  "ideaLinkMyPageRead",
  "ideaLinkAdminSummaryRead",
  "ideaLinkOrganizationHealthMonitoringRead",
  "ideaLinkActivityFollowupSave",
  "ideaLinkMonthlyMvpPreviewRead",
  "novHubNotifications",
  "ideaLinkPostCreate",
  "ideaLinkNotificationPreview",
  "ideaLinkGate52PreviewReview",
  "ideaLinkNotificationEnqueue",
  "ideaLinkNotificationSendScoped",
  "ideaLinkRecipientSearch",
  "ideaLinkStoreOptions",
  "createIdeaLinkHandoff",
  "exchangeIdeaLinkHandoff",
  "decisionListApplications",
  "decisionGetApplicationDetail",
  "decisionListComments",
  "decisionListApproverCandidates",
  "decisionSaveDraftApplication",
  "managementFinanceSummary",
  "managementStoresSummary",
  "managementDataopsStatus",
  "markNovHubNotificationRead",
  "changeOwnPin",
  "log",
  "masterBootstrap",
  "masterListEmployees",
  "masterListCorporations",
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
  "masterUpdateCorporation",
  "masterUpdateStore",
  "masterUpdatePortalApp",
  "masterCreatePortalApp"
]);
const DECISION_READONLY_ACTIONS = new Set([
  "decisionListApplications",
  "decisionGetApplicationDetail",
  "decisionListComments",
  "decisionListApproverCandidates"
]);
const DECISION_DRAFT_ACTIONS = new Set(["decisionSaveDraftApplication"]);

export function setPinAuth(email, pin) {
  currentAuth = { authType: "pin", email: String(email || "").trim(), pin: String(pin || "").trim() };
}

export function setFirebaseAuth() {
  currentAuth = { authType: "firebase" };
}

export function setFirebaseTokenAuth(token) {
  const idToken = String(token || "").trim();
  if (!idToken) throw new Error("Firebase ID token is missing.");
  currentAuth = { authType: "firebase_token", token: idToken };
}

export function setHubSessionAuth(sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) throw new Error("HUB session is missing.");
  currentAuth = { authType: "hub_session", sessionToken: token };
}

export function setIdeaLinkSessionAuth(sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) throw new Error("IDEA LINK session is missing.");
  currentAuth = { authType: "idea_link_session", sessionToken: token };
}

export function clearIdeaLinkSessionAuth() {
  if (currentAuth.authType === "idea_link_session") {
    currentAuth = { authType: "firebase" };
  }
}

export function clearApiAuth() {
  currentAuth = { authType: "firebase" };
}

async function postToApi(action, payload = {}) {
  const useDecisionReadonlyApi = DECISION_READONLY_ACTIONS.has(action) && currentAuth.authType === "hub_session";
  const useDecisionDraftApi = DECISION_DRAFT_ACTIONS.has(action) && currentAuth.authType === "hub_session";
  const useDecisionDedicatedApi = useDecisionReadonlyApi || useDecisionDraftApi;
  const requestPayload = useDecisionDedicatedApi
    ? { ...payload }
    : currentAuth.authType === "idea_link_session"
    ? { authType: "idea_link_session", ...payload }
    : currentAuth.authType === "hub_session"
      ? { authType: "hub_session", ...payload }
      : currentAuth.authType === "firebase_token"
        ? { authType: "firebase", ...payload }
        : { ...currentAuth, ...payload };
  const token = useDecisionDedicatedApi
    ? ""
    : currentAuth.authType === "pin"
    ? ""
    : currentAuth.authType === "idea_link_session"
      ? currentAuth.sessionToken
      : currentAuth.authType === "hub_session"
        ? currentAuth.sessionToken
        : currentAuth.authType === "firebase_token"
          ? currentAuth.token
          : await getIdToken();
  const bodyValues = {
    action,
    payload: JSON.stringify(requestPayload)
  };
  if (!useDecisionDraftApi) bodyValues.token = token;
  const body = new URLSearchParams(bodyValues);
  const endpoint = getApiEndpoint(action);
  if (!endpoint) {
    throw new Error("NOV HUB Edge API endpoint is not configured for this action.");
  }
  return await postToEndpoint(endpoint, body, useDecisionDedicatedApi
    ? { Authorization: `Bearer ${currentAuth.sessionToken}` }
    : {});
}

function getApiEndpoint(action) {
  if (
    DECISION_READONLY_ACTIONS.has(action) &&
    currentAuth.authType === "hub_session"
  ) {
    return PORTAL_CONFIG.decisionHubReadonlyApiUrl || "";
  }
  if (
    DECISION_DRAFT_ACTIONS.has(action) &&
    currentAuth.authType === "hub_session"
  ) {
    return PORTAL_CONFIG.decisionHubWriteApiUrl || "";
  }
  const useEdge = PORTAL_CONFIG.apiMode === "edge"
    && PORTAL_CONFIG.edgeApiUrl
    && EDGE_ACTIONS.has(action)
    && (currentAuth.authType !== "pin" || PORTAL_CONFIG.edgePinEnabled === true);
  return useEdge ? PORTAL_CONFIG.edgeApiUrl : "";
}

async function postToEndpoint(endpoint, body, extraHeaders = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", ...extraHeaders },
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
    const responseError = data?.error && typeof data.error === "object" ? data.error : data;
    const error = new Error(responseError.message || `APIへの接続に失敗しました (${response.status})`);
    error.code = responseError.code || "HTTP_ERROR";
    error.stage = data.stage || "";
    error.detail = responseError.detail || responseText.slice(0, 240);
    error.status = response.status;
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

export async function callThanksCoinAnalytics(periodCategory) {
  const period = String(periodCategory || "").trim();
  if (!THANKS_COIN_ANALYTICS_PERIODS.has(period)) {
    throw Object.assign(new Error("分析期間を確認できません。"), { code: "INVALID_REQUEST" });
  }
  if (currentAuth.authType !== "idea_link_session" || !currentAuth.sessionToken) {
    throw Object.assign(new Error("IDEA LINKの認証期限が切れました。"), { code: "UNAUTHORIZED" });
  }
  if (PORTAL_CONFIG.apiMode !== "edge" || !PORTAL_CONFIG.edgeApiUrl) {
    throw Object.assign(new Error("分析APIを利用できません。"), { code: "API_NOT_CONFIGURED" });
  }
  const endpoint = new URL(PORTAL_CONFIG.edgeApiUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/idea-link/thanks-coin/analytics`;
  endpoint.search = new URLSearchParams({ periodCategory: period }).toString();
  endpoint.hash = "";
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(endpoint.href, {
      method: "GET",
      headers: { Authorization: `Bearer ${currentAuth.sessionToken}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit"
    });
  } catch (_error) {
    throw Object.assign(new Error("分析APIへ接続できませんでした。"), { code: "NETWORK_ERROR" });
  } finally {
    window.clearTimeout(timeoutId);
  }
  let envelope;
  try {
    envelope = await response.json();
  } catch (_error) {
    throw Object.assign(new Error("分析応答を安全に確認できません。"), { code: "INVALID_API_RESPONSE" });
  }
  const keys = envelope && typeof envelope === "object" && !Array.isArray(envelope)
    ? Object.keys(envelope).sort() : [];
  if (keys.join("|") !== "category|data" || !THANKS_COIN_ANALYTICS_CATEGORIES.has(envelope.category)) {
    throw Object.assign(new Error("分析応答を安全に確認できません。"), { code: "INVALID_API_RESPONSE" });
  }
  const expectedStatus = envelope.category === "READY" ? 200
    : envelope.category === "INVALID_REQUEST" ? 400
    : envelope.category === "UNAUTHORIZED" ? 403
    : 502;
  if (response.status !== expectedStatus) {
    throw Object.assign(new Error("分析応答を安全に確認できません。"), { code: "INVALID_API_RESPONSE" });
  }
  return envelope;
}

export async function createIdeaLinkHandoff({ hubSessionToken = "", targetView = "home" } = {}) {
  const sessionToken = String(hubSessionToken || "").trim();
  const authType = sessionToken ? "hub_session" : "firebase";
  const token = sessionToken || await getIdToken();
  if (!token) throw new Error("HUB authentication is missing.");
  const endpoint = getApiEndpoint("createIdeaLinkHandoff");
  if (!endpoint) throw new Error("NOV HUB Edge API endpoint is not configured for IDEA LINK handoff.");
  return await postToEndpoint(endpoint, new URLSearchParams({
    action: "createIdeaLinkHandoff",
    token,
    payload: JSON.stringify({ authType, targetView: String(targetView || "home") })
  }));
}

export async function exchangeIdeaLinkHandoff(handoffCode) {
  const code = String(handoffCode || "").trim();
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(code)) {
    throw new Error("IDEA LINK handoff code is invalid.");
  }
  const endpoint = getApiEndpoint("exchangeIdeaLinkHandoff");
  if (!endpoint) throw new Error("NOV HUB Edge API endpoint is not configured for IDEA LINK handoff.");
  return await postToEndpoint(endpoint, new URLSearchParams({
    action: "exchangeIdeaLinkHandoff",
    token: "",
    payload: JSON.stringify({ handoffCode: code })
  }));
}

export function writeAccessLog(action, details = {}) {
  return postToApi("log", { action, ...details });
}
