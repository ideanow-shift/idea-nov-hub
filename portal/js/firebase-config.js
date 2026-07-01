export const PORTAL_CONFIG = {
  authMode: "firebase",
  apiMode: "edge",
  edgePinEnabled: false,
  edgeApiUrl: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api",
  gasApiUrl: "https://script.google.com/macros/s/AKfycbxhw4yy64GUn5K-3cvynOLqdTDThP1L_L-U6ViqNf9SOj5PEg9XUv7mTgyjGhe9i-V3/exec",
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
