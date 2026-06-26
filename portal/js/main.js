import { PORTAL_CONFIG } from "./firebase-config.js";
import { authIsConfigured, getIdToken, signInWithGoogle, signOutUser } from "./auth.js";
import { clearApiAuth, fetchPortalData, setFirebaseAuth, setPinAuth, writeAccessLog } from "./api.js";
import { DEMO_EMPLOYEES, getDemoEmployee } from "./employees.js";
import { CATEGORY_ORDER, DEMO_APPS, getVisibleApps, loadAppIconRegistry, resolveAppIcon } from "./apps.js";
import { clearHubEmployeeContext, getHubEmployeeContextSummary, saveHubEmployeeContext } from "./hub-context.js";

const state = { employee: null, apps: [], announcements: [], mode: PORTAL_CONFIG.authMode, authType: null };
const MANAGEMENT_HUB_CONTEXT_KEY = "ideaNov.management.hubContext";
const MANAGEMENT_FIREBASE_TOKEN_KEY = "ideaNov.management.firebaseIdToken";
const MANAGEMENT_APP_IDS = new Set(["management-check", "management-platform"]);
const MANAGEMENT_APP_URL = "./management-platform/";
const elements = Object.fromEntries([
  "header-user", "user-name", "user-store", "login-screen", "loading-screen",
  "denied-screen", "portal-screen", "google-login", "pin-login-form", "pin-email", "pin-code", "demo-controls", "demo-employee",
  "demo-login", "logout-button", "denied-message", "denied-back", "welcome-title", "user-context",
  "announcements", "featured-apps", "category-apps", "visible-app-count", "concierge-form", "concierge-question", "toast"
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.querySelector(`#${id}`)]));

function showScreen(name) {
  ["login", "loading", "denied", "portal"].forEach((screenName) => {
    elements[`${screenName}Screen`].hidden = screenName !== name;
  });
  elements.headerUser.hidden = name !== "portal";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = String(value ?? "");
  return span.innerHTML;
}

function getAudienceLabel(app) {
  if (app.targetDepartment?.length) return escapeHtml(app.targetDepartment.join("・"));
  const labels = { 1: "全スタッフ", 2: "スタイリスト以上", 3: "SD・店長以上", 4: "Mgr・部長以上", 5: "役員・本部幹部" };
  return labels[Number(app.requiredLevel || 1)] || "対象者";
}

function createAppIcon(app) {
  const wrapper = document.createElement("span");
  wrapper.className = "app-icon";
  wrapper.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.className = "app-icon-image";
  image.alt = "";
  image.src = resolveAppIcon(app);
  wrapper.append(image);
  return wrapper;
}

function createAppCard(app) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "app-card";
  button.dataset.appId = app.appId;
  const icon = createAppIcon(app);
  const info = document.createElement("span");
  info.className = "app-info";
  info.innerHTML = `
    <span class="app-title-row">
      <span class="app-title">${escapeHtml(app.appName)}</span>
      <span class="app-arrow" aria-hidden="true">›</span>
    </span>
    <span class="app-description">${escapeHtml(app.description || "")}</span>
    <span class="app-meta">
      <span class="label">${escapeHtml(app.category || "社内アプリ")}</span>
      <span class="label">${getAudienceLabel(app)}</span>
    </span>`;
  button.append(icon, info);
  button.addEventListener("click", () => openApp(app));
  return button;
}

function createEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function openConcierge(question = "") {
  const query = String(question || "").trim();
  const url = query ? `./concierge/?q=${encodeURIComponent(query)}` : "./concierge/";
  window.location.assign(url);
}

function redirectRootHubContextToManagementPlatform() {
  if (window.location.pathname !== "/" && !window.location.pathname.endsWith("/index.html")) return false;
  const params = new URLSearchParams(window.location.search);
  const hubContext = params.get("hub_context");
  if (!hubContext) return false;
  window.location.replace(`${MANAGEMENT_APP_URL}?hub_context=${encodeURIComponent(hubContext)}`);
  return true;
}

function renderAnnouncements() {
  const fallback = [
    { type: "important", title: "ポータル試験運用中", body: "掲載アプリや権限に誤りがある場合は管理者へご連絡ください。" },
    { type: "info", title: "スマートフォンのホーム画面に追加できます", body: "ブラウザの共有メニューから追加すると、毎日のアクセスが簡単になります。" }
  ];
  elements.announcements.replaceChildren(...(state.announcements.length ? state.announcements : fallback).map((notice) => {
    const article = document.createElement("article");
    article.className = `notice${notice.type === "important" ? " notice-important" : ""}`;
    article.innerHTML = `
      <span class="notice-icon" aria-hidden="true">${notice.type === "important" ? "!" : "i"}</span>
      <div><h3 class="notice-title">${escapeHtml(notice.title)}</h3><p class="notice-body">${escapeHtml(notice.body)}</p></div>`;
    return article;
  }));
}

function renderApps() {
  const featured = state.apps.filter((app) => app.isFeatured);
  elements.featuredApps.replaceChildren(...(featured.length ? featured.map(createAppCard) : [createEmptyState("よく使うアプリはまだありません。")]));
  const dynamicCategories = [...new Set(state.apps.map((app) => app.category || "社内アプリ"))]
    .filter((category) => !CATEGORY_ORDER.includes(category));
  const categories = [...CATEGORY_ORDER, ...dynamicCategories].map((category) => ({
    category,
    apps: state.apps.filter((app) => app.category === category)
  })).filter((group) => group.apps.length);
  elements.categoryApps.replaceChildren(...(categories.length ? categories.map(({ category, apps }) => {
    const section = document.createElement("section");
    section.className = "category-block";
    section.innerHTML = `<h3 class="category-title">${escapeHtml(category)}</h3>`;
    const grid = document.createElement("div");
    grid.className = "app-grid";
    grid.append(...apps.map(createAppCard));
    section.append(grid);
    return section;
  }) : [createEmptyState("現在利用できるアプリはありません。")]));
  elements.visibleAppCount.textContent = `${state.apps.length}件`;
}

function normalizeManagementPlatformApps(apps = []) {
  return apps.map((app) => {
    if (!isManagementPlatformApp(app)) return app;
    return {
      ...app,
      appId: "management-platform",
      appName: "Management Platform",
      description: app.description || "環境整備と管理者成長の履歴を確認",
      url: MANAGEMENT_APP_URL,
      category: app.category || "コンピテンシー",
      icon: app.icon || "management-check"
    };
  });
}

function renderPortal() {
  const employeeContext = refreshHubEmployeeContext();
  elements.userName.textContent = state.employee.name;
  elements.userStore.textContent = state.employee.store || state.employee.department || "";
  elements.userContext.textContent = getHubEmployeeContextSummary(employeeContext);
  elements.welcomeTitle.textContent = `${state.employee.name.split(/[\s　]/)[0]}さん、お疲れさまです`;
  renderAnnouncements();
  renderApps();
  showScreen("portal");
}


function refreshHubEmployeeContext() {
  if (!state.employee) return null;
  return saveHubEmployeeContext(state.employee, state.authType);
}

function encodeHubContextForAppUrl(context) {
  if (!context || typeof context !== "object") return "";
  try {
    const payload = {
      schema: context.schema,
      schemaVersion: context.schemaVersion,
      storedAt: context.storedAt,
      issuedAt: context.issuedAt,
      expiresAt: context.expiresAt,
      id: context.id,
      employeeId: context.employeeId,
      employeeNumber: context.employeeNumber,
      coreEmployeeId: context.coreEmployeeId,
      supabaseEmployeeId: context.supabaseEmployeeId,
      staffId: context.staffId,
      name: context.name,
      displayName: context.displayName,
      fullName: context.fullName,
      email: context.email,
      authEmail: context.authEmail,
      departmentName: context.departmentName,
      positionName: context.positionName,
      roleKeys: context.roleKeys,
      roles: context.roles,
      permissions: context.permissions,
      storeId: context.storeId,
      storeName: context.storeName,
      departmentId: context.departmentId,
      positionId: context.positionId,
      corporationId: context.corporationId,
      corporationName: context.corporationName,
      authType: context.authType
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch (error) {
    console.warn("Failed to encode HUB context for app URL", error);
    return "";
  }
}

function buildAppLaunchUrl(appUrl, context) {
  const encodedContext = encodeHubContextForAppUrl(context);
  if (!encodedContext) return appUrl;
  try {
    const url = new URL(appUrl, window.location.href);
    if (url.origin !== window.location.origin) return appUrl;
    url.searchParams.set("hub_context", encodedContext);
    return url.toString();
  } catch (error) {
    console.warn("Failed to append HUB context to app URL", error);
    return appUrl;
  }
}

function isManagementPlatformApp(app) {
  const candidates = [
    app.appId,
    app.appName,
    app.icon,
    app.url
  ].map((value) => String(value || "").toLowerCase());
  return candidates.some((value) => (
    MANAGEMENT_APP_IDS.has(value)
    || value.includes("management-platform")
    || value.includes("management-check")
    || value.includes("マネジメントチェック")
    || value.includes("管理者育成")
  ));
}

async function saveManagementPlatformAuthContext(context) {
  if (state.authType !== "firebase") return;
  const token = await getIdToken();
  if (!token) throw new Error("Firebase ID tokenを取得できませんでした。再ログインしてください。");
  sessionStorage.setItem(MANAGEMENT_FIREBASE_TOKEN_KEY, token);
  sessionStorage.setItem(MANAGEMENT_HUB_CONTEXT_KEY, JSON.stringify(context || {}));
  localStorage.setItem(MANAGEMENT_FIREBASE_TOKEN_KEY, JSON.stringify({
    token,
    expiresAt: Date.now() + 10 * 60 * 1000
  }));
  localStorage.setItem(MANAGEMENT_HUB_CONTEXT_KEY, JSON.stringify(context || {}));
}

async function prepareManagementPlatformLaunch(app, context) {
  if (!isManagementPlatformApp(app)) return;
  await saveManagementPlatformAuthContext(context);
}

async function openApp(app) {
  const employeeContext = refreshHubEmployeeContext();
  const appUrl = isManagementPlatformApp(app) ? MANAGEMENT_APP_URL : app.url;
  const launchUrl = buildAppLaunchUrl(appUrl, employeeContext);
  if (state.mode === "firebase") {
    const target = window.open("about:blank", "_blank");
    if (target) target.opener = null;
    try {
      await prepareManagementPlatformLaunch(app, employeeContext);
      await writeAccessLog("openApp", { appId: app.appId, appName: app.appName, result: "success" });
      if (target) target.location = launchUrl;
      else window.location.assign(launchUrl);
    } catch (error) {
      target?.close();
      showToast("アプリを開けませんでした。時間をおいて再度お試しください。");
      console.error(error);
    }
    return;
  }
  console.info("[demo log]", { action: "openApp", appId: app.appId, appName: app.appName, result: "success" });
  showToast(`デモ: 「${app.appName}」を開きます`);
}

async function loginWithFirebase() {
  showScreen("loading");
  try {
    setFirebaseAuth();
    await signInWithGoogle();
    const data = await fetchPortalData();
    state.authType = "firebase";
    state.employee = data.employee;
    state.apps = getVisibleApps(data.employee, normalizeManagementPlatformApps(data.apps || []));
    state.announcements = data.announcements || [];
    renderPortal();
    await saveManagementPlatformAuthContext(refreshHubEmployeeContext());
  } catch (error) {
    console.error("Portal login failed", {
      code: error.code || "",
      stage: error.stage || "",
      detail: error.detail || "",
      error
    });
    await signOutUser();
    clearApiAuth();
    elements.deniedMessage.textContent = error.code === "ACCESS_DENIED"
      ? "このアカウントは社内ポータルの利用権限がありません。管理者へお問い合わせください。"
      : `${error.message || "ログイン処理に失敗しました。"}${error.code ? `（${error.code}${error.stage ? ` / ${error.stage}` : ""}）` : ""}`;
    showScreen("denied");
  }
}

async function loginWithPin(event) {
  event.preventDefault();
  const email = elements.pinEmail.value;
  const pin = elements.pinCode.value;
  showScreen("loading");
  try {
    setPinAuth(email, pin);
    const data = await fetchPortalData();
    state.authType = "pin";
    state.employee = data.employee;
    state.apps = getVisibleApps(data.employee, normalizeManagementPlatformApps(data.apps || []));
    state.announcements = data.announcements || [];
    elements.pinCode.value = "";
    renderPortal();
  } catch (error) {
    console.error("PIN login failed", {
      code: error.code || "",
      stage: error.stage || "",
      detail: error.detail || "",
      error
    });
    clearApiAuth();
    elements.deniedMessage.textContent = error.code === "ACCESS_DENIED"
      ? "メールアドレスまたはPINが正しくありません。"
      : `${error.message || "ログイン処理に失敗しました。"}${error.code ? `（${error.code}${error.stage ? ` / ${error.stage}` : ""}）` : ""}`;
    showScreen("denied");
  }
}

function loginDemo() {
  const employee = getDemoEmployee(elements.demoEmployee.value);
  if (!employee || employee.status !== "active") {
    elements.deniedMessage.textContent = "このアカウントは社内ポータルの利用権限がありません。管理者へお問い合わせください。";
    showScreen("denied");
    return;
  }
  state.employee = employee;
  state.apps = getVisibleApps(employee, DEMO_APPS);
  state.announcements = [];
  state.authType = "demo";
  console.info("[demo log]", { action: "login", email: employee.email, result: "success" });
  renderPortal();
}

async function logout() {
  if (state.authType === "firebase" || state.authType === "pin") {
    try { await writeAccessLog("logout", { result: "success" }); } catch (error) { console.error(error); }
  }
  if (state.authType === "firebase") {
    await signOutUser();
  }
  clearApiAuth();
  clearHubEmployeeContext();
  sessionStorage.removeItem(MANAGEMENT_FIREBASE_TOKEN_KEY);
  sessionStorage.removeItem(MANAGEMENT_HUB_CONTEXT_KEY);
  localStorage.removeItem(MANAGEMENT_FIREBASE_TOKEN_KEY);
  localStorage.removeItem(MANAGEMENT_HUB_CONTEXT_KEY);
  state.employee = null;
  state.apps = [];
  state.authType = null;
  showScreen("login");
}

async function initialize() {
  if (redirectRootHubContextToManagementPlatform()) return;
  await loadAppIconRegistry();
  DEMO_EMPLOYEES.forEach((employee) => {
    const option = document.createElement("option");
    option.value = employee.email;
    option.textContent = `${employee.name}（権限${employee.roleLevel}${employee.status === "inactive" ? "・停止中" : ""}）`;
    elements.demoEmployee.append(option);
  });
  const firebaseReady = authIsConfigured();
  elements.googleLogin.hidden = !firebaseReady;
  elements.demoControls.hidden = state.mode === "firebase" && firebaseReady;
  elements.googleLogin.addEventListener("click", loginWithFirebase);
  elements.pinLoginForm.addEventListener("submit", loginWithPin);
  elements.conciergeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    openConcierge(elements.conciergeQuestion.value);
  });
  document.querySelectorAll(".concierge-chip-row [data-question]").forEach((button) => {
    button.addEventListener("click", () => openConcierge(button.dataset.question));
  });
  elements.demoLogin.addEventListener("click", loginDemo);
  elements.logoutButton.addEventListener("click", logout);
  elements.deniedBack.addEventListener("click", () => {
    clearApiAuth();
    showScreen("login");
  });
  if (state.mode === "firebase" && !firebaseReady) {
    elements.deniedMessage.textContent = "FirebaseまたはGAS APIの設定が未完了です。firebase-config.jsを確認してください。";
    showScreen("denied");
  } else {
    showScreen("login");
  }
}

initialize();

