import { clearIdeaLinkSessionAuth, exchangeIdeaLinkHandoff, setIdeaLinkSessionAuth } from "./api.js";

export const IDEA_LINK_SESSION_STORAGE_KEY = "ideaNov.ideaLink.appSession.v1";
export const IDEA_LINK_HANDOFF_QUERY_KEY = "handoff_code";
export const IDEA_LINK_ALLOWED_TARGET_VIEWS = new Set(["home", "send", "timeline", "my-page"]);
const IDEA_LINK_AUDIENCE = "idea_link";
const HUB_URL = "../";

let memorySession = null;

function normalizeTargetView(value) {
  const targetView = String(value || "home").trim();
  return IDEA_LINK_ALLOWED_TARGET_VIEWS.has(targetView) ? targetView : "home";
}

function isUsableSession(value) {
  if (!value || typeof value !== "object") return false;
  if (String(value.audience || "") !== IDEA_LINK_AUDIENCE) return false;
  if (!String(value.sessionToken || "").trim()) return false;
  const expiresAt = Date.parse(String(value.expiresAt || ""));
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function removeHandoffCodeFromUrl(url = window.location.href) {
  const safeUrl = new URL(url);
  safeUrl.searchParams.delete(IDEA_LINK_HANDOFF_QUERY_KEY);
  window.history.replaceState({}, document.title, safeUrl.toString());
}

function persistSession(value) {
  if (String(value?.audience || "") !== IDEA_LINK_AUDIENCE) {
    throw new Error("IDEA LINK session audience is invalid.");
  }
  const session = {
    sessionToken: String(value.sessionToken || ""),
    expiresAt: String(value.expiresAt || ""),
    audience: IDEA_LINK_AUDIENCE,
    targetView: normalizeTargetView(value.targetView)
  };
  if (!isUsableSession(session)) throw new Error("IDEA LINK session is invalid or expired.");
  memorySession = session;
  sessionStorage.setItem(IDEA_LINK_SESSION_STORAGE_KEY, JSON.stringify(session));
  setIdeaLinkSessionAuth(session.sessionToken);
  return { ...session, sessionToken: undefined };
}

export function restoreIdeaLinkSession() {
  if (isUsableSession(memorySession)) {
    setIdeaLinkSessionAuth(memorySession.sessionToken);
    return { ...memorySession, sessionToken: undefined };
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
  return persistSession(stored);
}

export async function initializeIdeaLinkHandoff(url = window.location.href) {
  const targetUrl = new URL(url);
  const handoffCode = String(targetUrl.searchParams.get(IDEA_LINK_HANDOFF_QUERY_KEY) || "").trim();
  if (!handoffCode) return restoreIdeaLinkSession();

  removeHandoffCodeFromUrl(targetUrl.toString());
  const response = await exchangeIdeaLinkHandoff(handoffCode);
  const handoff = response?.handoff || null;
  return persistSession({
    sessionToken: handoff?.ideaLinkSession,
    expiresAt: handoff?.expiresAt,
    audience: handoff?.audience,
    targetView: handoff?.targetView
  });
}

export function clearIdeaLinkSession() {
  memorySession = null;
  sessionStorage.removeItem(IDEA_LINK_SESSION_STORAGE_KEY);
  clearIdeaLinkSessionAuth();
}

export function returnToHub() {
  clearIdeaLinkSession();
  window.location.replace(HUB_URL);
}
