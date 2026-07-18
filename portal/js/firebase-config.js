export const PORTAL_CONFIG = {
  novNaviDashboardEnabled: true,
  authMode: "firebase",
  apiMode: "edge",
  edgePinEnabled: true,
  edgeApiUrl: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api",
  decisionHubReadonlyApiUrl: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/decision-hub-readonly-api",
  decisionHubWriteApiUrl: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/decision-hub-write-api",
  shiftApiUrl: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/shift-api",
  hubUrl: "https://ideanow-shift.github.io/idea-nov-hub/",
  firebase: {
    apiKey: "AIzaSyBJAPJbAG_SdFmJqO0dIKh8v4Sd0tI0Vkc",
    authDomain: "idea-nov-group-portal.firebaseapp.com",
    projectId: "idea-nov-group-portal",
    storageBucket: "idea-nov-group-portal.firebasestorage.app",
    messagingSenderId: "664629515628",
    appId: "1:664629515628:web:3684ed10cc62cbdd178f49",
    measurementId: "G-TQKXXSW803"
  }
};

export function isFirebaseConfigured() {
  return PORTAL_CONFIG.authMode === "firebase"
    && Object.values(PORTAL_CONFIG.firebase).every(Boolean)
    && PORTAL_CONFIG.apiMode === "edge"
    && Boolean(PORTAL_CONFIG.edgeApiUrl);
}
