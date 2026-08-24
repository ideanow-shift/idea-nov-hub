import { PORTAL_CONFIG } from "./firebase-config.js";

const STAGING_ENDPOINT = "https://zgkoofphhivesclehrom.supabase.co/functions/v1/nov-hub-api";

if (PORTAL_CONFIG.edgeApiUrl !== STAGING_ENDPOINT) {
  throw new Error("STAGING_ENDPOINT_INVALID");
}

async function post(action, token, payload) {
  const response = await fetch(STAGING_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ action, token: String(token || ""), payload: JSON.stringify(payload || {}) })
  });
  const data = await response.json().catch(() => ({ ok: false, code: "INVALID_RESPONSE" }));
  if (!response.ok || data?.ok !== true) {
    const error = new Error(String(data?.message || data?.error?.message || "NOV HUB Stagingへ接続できませんでした。"));
    error.code = String(data?.code || data?.error?.code || "STAGING_API_ERROR");
    throw error;
  }
  return data;
}

export async function bridgeWithFirebase(firebaseIdToken, enrollmentChallenge = "") {
  const response = await fetch(STAGING_ENDPOINT, {
    method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
    headers: { "Authorization": `Bearer ${String(firebaseIdToken || "")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "novHubStagingAuth01SubjectBridgeV1", payload: enrollmentChallenge ? { enrollmentChallenge } : {} })
  });
  const data = await response.json().catch(() => ({ ok: false, code: "INVALID_RESPONSE" }));
  if (!response.ok || data?.ok !== true) {
    const error = new Error(String(data?.message || "NOV HUB Stagingへ接続できませんでした。"));
    error.code = String(data?.code || "STAGING_API_ERROR");
    throw error;
  }
  return data;
}

export async function issueStoreOperationsHandoff(sessionToken, request) {
  const token = String(sessionToken || "").trim();
  if (!token || !request) throw new Error("STAGING_HUB_SESSION_REQUIRED");
  return post("storeOperationsHandoffIssueV1", token, {
    authType: "hub_session",
    state: request.state,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: "S256"
  });
}
