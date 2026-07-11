const NOV_HUB_SESSION_STORAGE_KEY = "ideaNov.hub.session.v1";
const LEGACY_SESSION_STORAGE_KEYS = Object.freeze([
  "ideaNov.management.hubSession.v1",
  "ideaNov.decisionHub.readonlySession.v1"
]);
const REQUIRED_AUDIENCE = "nov_hub";

let memorySession = null;
let memoryProvider = null;

function getSessionStorage() {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function parseSession(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function normalizeSession(value) {
  const session = parseSession(value);
  if (!session || typeof session !== "object") return null;
  const sessionToken = String(session.sessionToken || "").trim();
  const audience = String(session.audience || "").trim();
  const expiresAt = String(session.expiresAt || "").trim();
  const expiry = Date.parse(expiresAt);
  if (!sessionToken || audience !== REQUIRED_AUDIENCE || !Number.isFinite(expiry) || expiry <= Date.now()) {
    return null;
  }
  return Object.freeze({ sessionToken, audience, expiresAt });
}

function removeStoredSession(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function readStoredSession(storage, key) {
  let raw = null;
  try {
    raw = storage?.getItem(key) || null;
  } catch {
    return null;
  }
  if (!raw) return null;
  const session = normalizeSession(raw);
  if (!session) removeStoredSession(storage, key);
  return session;
}

function readMemoryProvider() {
  if (typeof memoryProvider !== "function") return null;
  try {
    return normalizeSession(memoryProvider());
  } catch {
    return null;
  }
}

function resolveCurrentSession() {
  const provided = readMemoryProvider();
  if (provided) return provided;
  const inMemory = normalizeSession(memorySession);
  if (inMemory) return inMemory;

  const storage = getSessionStorage();
  const canonical = readStoredSession(storage, NOV_HUB_SESSION_STORAGE_KEY);
  if (canonical) return canonical;

  for (const key of LEGACY_SESSION_STORAGE_KEYS) {
    const legacy = readStoredSession(storage, key);
    if (legacy) return legacy;
  }
  return null;
}

export function setNovHubSession(session, options = {}) {
  const normalized = normalizeSession(session);
  if (!normalized) {
    clearNovHubSession();
    return false;
  }
  memorySession = normalized;
  if (options.persist !== false) {
    try {
      getSessionStorage()?.setItem(NOV_HUB_SESSION_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Memory remains the primary source when sessionStorage is unavailable.
    }
  }
  return true;
}

export function setNovHubSessionMemoryProvider(provider) {
  memoryProvider = typeof provider === "function" ? provider : null;
}

export function getNovHubSessionToken() {
  return resolveCurrentSession()?.sessionToken || null;
}

export function restoreNovHubSession() {
  const session = resolveCurrentSession();
  if (!session) return null;
  memorySession = session;
  return session;
}

export function clearNovHubSession() {
  memorySession = null;
  memoryProvider = null;
  const storage = getSessionStorage();
  removeStoredSession(storage, NOV_HUB_SESSION_STORAGE_KEY);
  LEGACY_SESSION_STORAGE_KEYS.forEach((key) => removeStoredSession(storage, key));
}

export function handleNovHubSessionAuthFailure(status) {
  const numericStatus = Number(status || 0);
  if (numericStatus === 401 || numericStatus === 403) {
    clearNovHubSession();
    return true;
  }
  return false;
}

if (typeof window !== "undefined" && !Object.getOwnPropertyDescriptor(window, "NovHubSession")) {
  Object.defineProperty(window, "NovHubSession", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      getSessionToken: getNovHubSessionToken
    })
  });
}

export const NOV_HUB_SESSION_CONTRACT = Object.freeze({
  audience: REQUIRED_AUDIENCE,
  storageKey: NOV_HUB_SESSION_STORAGE_KEY,
  legacyStorageKeys: LEGACY_SESSION_STORAGE_KEYS
});
