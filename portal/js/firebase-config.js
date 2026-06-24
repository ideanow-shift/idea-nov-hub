export const PORTAL_CONFIG = {
  authMode: "firebase",
  gasApiUrl: "https://script.google.com/macros/s/AKfycbxiKxF9ag8lkTu5A6yh3rCaRgNpb0E0h0pEHldyrV46m2Sdu7DQIgxuYF5tcCKW4TUr/exec",
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
    && Boolean(PORTAL_CONFIG.gasApiUrl);
}
