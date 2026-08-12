export const PORTAL_CONFIG = Object.freeze({
  novNaviDashboardEnabled: false,
  authMode: "firebase",
  apiMode: "edge",
  edgePinEnabled: false,
  edgeApiUrl: "https://zgkoofphhivesclehrom.supabase.co/functions/v1/nov-hub-api",
  decisionHubReadonlyApiUrl: "",
  shiftApiUrl: "",
  hubUrl: "/",
  firebase: Object.freeze({
    apiKey: "AIzaSyBJAPJbAG_SdFmJqO0dIKh8v4Sd0tI0Vkc",
    authDomain: "idea-nov-group-portal.firebaseapp.com",
    projectId: "idea-nov-group-portal",
    storageBucket: "idea-nov-group-portal.firebasestorage.app",
    messagingSenderId: "664629515628",
    appId: "1:664629515628:web:3684ed10cc62cbdd178f49",
    measurementId: "G-TQKXXSW803",
  }),
});

export function isFirebaseConfigured() {
  return PORTAL_CONFIG.apiMode === "edge"
    && PORTAL_CONFIG.edgeApiUrl.startsWith("https://zgkoofphhivesclehrom.supabase.co/");
}
