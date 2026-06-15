export const PORTAL_CONFIG = {
  authMode: "firebase",
  gasApiUrl: "https://script.google.com/macros/s/AKfycbwN4OfUZob_rHpbtxs5xjxY2e1GuSYgnQIT28Lu6I3zJMop-3rde_MQJHR8SYUsNhVr/exec",
  firebase: {
    apiKey: "AIzaSyBJAPJbAG_SdFmJq00dIKh8v4Sd0tI0Vkc",
    authDomain: "idea-nov-group-portal.firebaseapp.com",
    projectId: "idea-nov-group-portal",
    appId: "1:664629515628:web:1f289c4bf22f2d0c178f49"
  }
};

export function isFirebaseConfigured() {
  return PORTAL_CONFIG.authMode === "firebase"
    && Object.values(PORTAL_CONFIG.firebase).every(Boolean)
    && Boolean(PORTAL_CONFIG.gasApiUrl);
}
