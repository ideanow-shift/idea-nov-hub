window.MANAGEMENT_API_BASE_URL = "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/management-environment";

// NOV HUBが同一オリジンのsessionStorageに保存したFirebase ID tokenを読む。
window.MANAGEMENT_FIREBASE_TOKEN_PROVIDER = async function () {
  return sessionStorage.getItem("ideaNov.management.firebaseIdToken") || "";
};

window.MANAGEMENT_HUB_CONTEXT_PROVIDER = function () {
  try {
    return JSON.parse(sessionStorage.getItem("ideaNov.management.hubContext") || "{}");
  } catch (error) {
    return {};
  }
};

// storeIdはHUB contextのprimaryStoreId/storeIdを優先。これは開発用fallback。
window.MANAGEMENT_DEFAULT_STORE_ID = "replace-with-core-db-stores-id";
window.MANAGEMENT_DEFAULT_CHECK_ITEM_ID = "e1b0e35b-a45b-400f-85b5-966c52e3aca7";
