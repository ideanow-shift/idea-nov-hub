import { PORTAL_CONFIG } from "./firebase-config.js";
import { getIdToken } from "./auth.js";

async function postToApi(action, payload = {}) {
  const body = new URLSearchParams({
    action,
    token: await getIdToken(),
    payload: JSON.stringify(payload)
  });
  const response = await fetch(PORTAL_CONFIG.gasApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  if (!response.ok) throw new Error(`APIへの接続に失敗しました (${response.status})`);
  const data = await response.json();
  if (!data.ok) {
    const error = new Error(data.message || "処理に失敗しました。");
    error.code = data.code || "API_ERROR";
    throw error;
  }
  return data;
}

export function fetchPortalData() {
  return postToApi("bootstrap");
}

export function writeAccessLog(action, details = {}) {
  return postToApi("log", { action, ...details });
}
