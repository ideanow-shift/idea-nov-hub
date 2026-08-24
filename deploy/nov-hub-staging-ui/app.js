import { beginGoogleLogin, completeGoogleRedirect, signOutUser } from "./auth-staging.js";
import { bridgeWithFirebase, issueStoreOperationsHandoff } from "./api-client.js";

const STORE_OPERATIONS_ORIGIN = "https://idea-nov-store-operations-staging-ui-787968950888.asia-northeast1.run.app";
const state = { hubSession: null };
const login = document.querySelector("#login");
const portal = document.querySelector("#portal");
const status = document.querySelector("#status");

function launchRequest() {
  const params = new URLSearchParams(location.search);
  const value = {
    state: String(params.get("store_operations_state") || ""),
    codeChallenge: String(params.get("code_challenge") || ""),
    codeChallengeMethod: String(params.get("code_challenge_method") || ""),
    callbackPath: String(params.get("callback_path") || "")
  };
  return /^[A-Za-z0-9_-]{22,128}$/u.test(value.state)
    && /^[A-Za-z0-9_-]{43}$/u.test(value.codeChallenge)
    && value.codeChallengeMethod === "S256"
    && value.callbackPath === "/auth/callback" ? value : null;
}

function setStatus(message) {
  status.textContent = message;
}

function takeEnrollmentChallenge() {
  const fragment = new URLSearchParams(location.hash.replace(/^#/u, ""));
  const challenge = String(fragment.get("enrollment") || "");
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
  return /^[A-Za-z0-9_-]{43}$/u.test(challenge) ? challenge : "";
}

function acceptBootstrap(data) {
  const session = data?.hubSession || {};
  if (session.audience !== "nov_hub" || !session.sessionToken || !Number.isFinite(Date.parse(session.expiresAt))) {
    throw new Error("STAGING_HUB_SESSION_INVALID");
  }
  state.hubSession = session;
  login.hidden = true;
  portal.hidden = false;
  setStatus("Staging NOV HUBへログインしました。");
}

async function launchStoreOperations() {
  const request = launchRequest();
  if (!request || !state.hubSession) throw new Error("Store Operationsから開き直してください。");
  setStatus("店舗営業管理へ接続しています。");
  const result = await issueStoreOperationsHandoff(state.hubSession.sessionToken, request);
  state.hubSession = null;
  const handoffCode = String(result?.handoff?.handoffCode || "");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(handoffCode)) throw new Error("HANDOFF_ISSUE_FAILED");
  const callback = new URL("/auth/callback", STORE_OPERATIONS_ORIGIN);
  callback.hash = new URLSearchParams({ handoff_code: handoffCode, state: request.state }).toString();
  location.replace(callback.toString());
}

document.querySelector("#google-login").addEventListener("click", async () => {
  try {
    setStatus("Googleログインを確認しています。");
    const token = await beginGoogleLogin();
    setStatus("社員情報を確認しています。");
    acceptBootstrap(await bridgeWithFirebase(token, enrollmentChallenge));
  } catch (error) {
    await signOutUser().catch(() => {});
    setStatus(error.message || "ログインできませんでした。");
  }
});

document.querySelector("#launch").addEventListener("click", () => launchStoreOperations().catch((error) => setStatus(error.message || "起動できませんでした。")));
document.querySelector("#logout").addEventListener("click", async () => {
  state.hubSession = null;
  await signOutUser().catch(() => {});
  portal.hidden = true;
  login.hidden = false;
  setStatus("ログアウトしました。");
});

const request = launchRequest();
const enrollmentChallenge = request ? takeEnrollmentChallenge() : "";

if (!request) {
  for (const control of document.querySelectorAll("button,input")) control.disabled = true;
  setStatus("Store Operationsの正式起動導線から開いてください。");
}

if (request) {
  completeGoogleRedirect().then(async (token) => {
    if (!token) return;
    setStatus("社員情報を確認しています。");
    acceptBootstrap(await bridgeWithFirebase(token, enrollmentChallenge));
  }).catch(async (error) => {
    if (error.code !== "STORE_OPERATIONS_EXTERNAL_SUBJECT_DENIED") await signOutUser().catch(() => {});
    setStatus(error.message || "ログインできませんでした。");
  });
}
