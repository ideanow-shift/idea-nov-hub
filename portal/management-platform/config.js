window.MANAGEMENT_API_BASE_URL = "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/management-environment";

const MANAGEMENT_TOKEN_KEY = "ideaNov.management.firebaseIdToken";
const MANAGEMENT_CONTEXT_KEY = "ideaNov.management.hubContext";

function readManagementToken() {
  const sessionToken = sessionStorage.getItem(MANAGEMENT_TOKEN_KEY);
  if (sessionToken) return sessionToken;

  try {
    const stored = JSON.parse(localStorage.getItem(MANAGEMENT_TOKEN_KEY) || "{}");
    if (stored.token && Number(stored.expiresAt || 0) > Date.now()) {
      sessionStorage.setItem(MANAGEMENT_TOKEN_KEY, stored.token);
      return stored.token;
    }
    localStorage.removeItem(MANAGEMENT_TOKEN_KEY);
  } catch (error) {
    localStorage.removeItem(MANAGEMENT_TOKEN_KEY);
  }
  return "";
}

function decodeUrlHubContext() {
  const encoded = new URLSearchParams(window.location.search).get("hub_context");
  if (!encoded) return null;
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    console.warn("hub_context could not be decoded", error);
    return null;
  }
}

function readManagementHubContext() {
  const urlContext = decodeUrlHubContext();
  if (urlContext) {
    const serialized = JSON.stringify(urlContext);
    sessionStorage.setItem(MANAGEMENT_CONTEXT_KEY, serialized);
    localStorage.setItem(MANAGEMENT_CONTEXT_KEY, serialized);
    return urlContext;
  }

  for (const storage of [sessionStorage, localStorage]) {
    try {
      const context = JSON.parse(storage.getItem(MANAGEMENT_CONTEXT_KEY) || "{}");
      if (context && Object.keys(context).length) return context;
    } catch (error) {
      storage.removeItem(MANAGEMENT_CONTEXT_KEY);
    }
  }
  return {};
}

window.MANAGEMENT_FIREBASE_TOKEN_PROVIDER = async function () {
  return readManagementToken();
};

window.MANAGEMENT_HUB_CONTEXT_PROVIDER = function () {
  return readManagementHubContext();
};

window.MANAGEMENT_DEFAULT_STORE_ID = "";
window.MANAGEMENT_DEFAULT_CHECK_ITEM_ID = "e1b0e35b-a45b-400f-85b5-966c52e3aca7";
