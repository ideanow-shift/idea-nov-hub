import { PORTAL_CONFIG } from "./firebase-config.js";
import { getIdToken } from "./auth.js";

let currentAuth = { authType: "firebase" };

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
  const response = await fetch(PORTAL_CONFIG.gasApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  const responseText = await response.text();
  if (!response.ok) {
    const error = new Error(`APIへの接続に失敗しました (${response.status})`);
    error.code = "HTTP_ERROR";
    error.detail = responseText.slice(0, 240);
    throw error;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (cause) {
    const error = new Error("GAS APIからJSON以外のレスポンスが返されました。");
    error.code = "INVALID_API_RESPONSE";
    error.detail = responseText.slice(0, 240);
    error.cause = cause;
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
