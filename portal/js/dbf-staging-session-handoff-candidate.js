export const DBF_STAGING_SESSION_KEY = "ideaNov.dbfStaging.session.v1";
export const DBF_STAGING_SESSION_AUDIENCE = "dbf_staging_session_v1";

function readFragment(url) {
  const params = new URL(url).hash.startsWith("#")
    ? new URLSearchParams(new URL(url).hash.slice(1))
    : new URLSearchParams();
  return {
    handoffCode: String(params.get("handoff_code") || ""),
    state: String(params.get("state") || "")
  };
}

function clearFragment(url) {
  const safe = new URL(url);
  safe.hash = "";
  window.history.replaceState({}, document.title, safe.toString());
}

function validSession(session) {
  return session?.audience === DBF_STAGING_SESSION_AUDIENCE
    && Boolean(session.sessionToken)
    && Date.parse(session.expiresAt) > Date.now()
    && session.capability?.businessDataAdmin === true
    && session.runtimeImport === "DISABLED"
    && session.productionWrite === "DISABLED";
}

export function restoreDbfStagingSession() {
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(DBF_STAGING_SESSION_KEY) || "null"); } catch (_) { session = null; }
  if (!validSession(session)) {
    sessionStorage.removeItem(DBF_STAGING_SESSION_KEY);
    return null;
  }
  return session;
}

export async function initializeDbfStagingSession({ url = window.location.href, exchange }) {
  const { handoffCode, state } = readFragment(url);
  if (!handoffCode) return restoreDbfStagingSession();
  clearFragment(url);
  const session = await exchange({ handoffCode, state });
  if (!validSession(session)) throw new Error("DBF Staging session or capability is invalid.");
  sessionStorage.setItem(DBF_STAGING_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function exchangeDbfStagingHandoffViaBff({ handoffCode, state }, fetchImpl = fetch) {
  const response = await fetchImpl("/session/handoff/exchange", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handoffCode, state })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.code || "DBF_HANDOFF_EXCHANGE_FAILED");
    error.status = response.status;
    throw error;
  }
  return body;
}

export function clearDbfStagingSession() {
  sessionStorage.removeItem(DBF_STAGING_SESSION_KEY);
}
