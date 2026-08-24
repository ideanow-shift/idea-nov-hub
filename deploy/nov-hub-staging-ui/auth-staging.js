import { PORTAL_CONFIG, isFirebaseConfigured } from "./firebase-config.js";

let firebaseAuth = null;
let firebaseSdk = null;

async function loadFirebase() {
  if (firebaseSdk) return firebaseSdk;
  const [appModule, authModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
  ]);
  const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(PORTAL_CONFIG.firebase);
  firebaseAuth = authModule.getAuth(app);
  firebaseSdk = authModule;
  return authModule;
}

function provider(sdk) {
  const value = new sdk.GoogleAuthProvider();
  value.setCustomParameters({ prompt: "select_account" });
  return value;
}

export async function beginGoogleLogin() {
  if (!isFirebaseConfigured()) throw new Error("Firebase設定が未完了です。");
  const sdk = await loadFirebase();
  const result = await sdk.signInWithPopup(firebaseAuth, provider(sdk));
  if (!result?.user) throw new Error("Googleログインを確認できませんでした。");
  return result.user.getIdToken(true);
}

export async function completeGoogleRedirect() {
  if (!isFirebaseConfigured()) throw new Error("Firebase設定が未完了です。");
  const sdk = await loadFirebase();
  await sdk.getRedirectResult(firebaseAuth);
  await firebaseAuth.authStateReady();
  return firebaseAuth.currentUser ? firebaseAuth.currentUser.getIdToken(true) : "";
}

export async function signOutUser() {
  if (firebaseAuth && firebaseSdk) await firebaseSdk.signOut(firebaseAuth);
}
