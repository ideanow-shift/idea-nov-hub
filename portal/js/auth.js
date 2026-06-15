import { PORTAL_CONFIG, isFirebaseConfigured } from "./firebase-config.js";

let firebaseAuth = null;
let firebaseSdk = null;

async function loadFirebase() {
  if (firebaseSdk) return firebaseSdk;
  const [appModule, authModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
  ]);
  const app = appModule.initializeApp(PORTAL_CONFIG.firebase);
  firebaseAuth = authModule.getAuth(app);
  firebaseSdk = authModule;
  return authModule;
}

export async function signInWithGoogle() {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase設定が未完了です。firebase-config.jsを更新してください。");
  }
  const sdk = await loadFirebase();
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await sdk.signInWithPopup(firebaseAuth, provider);
  return result.user;
}

export async function getIdToken() {
  return firebaseAuth?.currentUser ? firebaseAuth.currentUser.getIdToken() : "";
}

export async function signOutUser() {
  if (firebaseAuth && firebaseSdk) await firebaseSdk.signOut(firebaseAuth);
}

export function authIsConfigured() {
  return isFirebaseConfigured();
}
