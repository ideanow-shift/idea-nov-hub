import { PORTAL_CONFIG } from "./firebase-config.js?v=shift-session-contract-20260712-1";
import { authIsConfigured, getIdToken, signInWithGoogle, signOutUser } from "./auth.js";
import { callApiAction, clearApiAuth, createIdeaLinkHandoff, fetchPortalData, setFirebaseAuth, setPinAuth, writeAccessLog } from "./api.js?v=idea-link-handoff-launch-20260712-6";
import { DEMO_EMPLOYEES, getDemoEmployee } from "./employees.js";
import { CATEGORY_ORDER, DEMO_APPS, getVisibleApps, loadAppIconRegistry, resolveAppIcon } from "./apps.js?v=thanks-coin-display-label-20260717-1";
import { clearHubEmployeeContext, encodeHubContextForUrl, getHubEmployeeContextSummary, saveHubEmployeeContext } from "./hub-context.js";
import {
  renderNovNaviDashboard,
  shouldEnableLocalNovNaviDemo,
  shouldEnableNovNaviDashboard
} from "./nov-navi-dashboard.js?v=thanks-coin-display-label-20260717-1";
import {
  clearNovHubSession,
  restoreNovHubSession,
  setNovHubSession,
  setNovHubSessionMemoryProvider
} from "./nov-hub-session-candidate.js?v=hub-helper-runtime-20260713-2";
import { installManagementDataopsOneShotDiagnostic } from "./management-dataops-one-shot-diagnostic.js?v=5ebe57e4f757c72d";

const state = {
  employee: null,
  hubSession: null,
  apps: [],
  announcements: [],
  notifications: [],
  mode: PORTAL_CONFIG.authMode,
  authType: null,
  appSearch: "",
  selectedCategory: "all"
};
let managementDataopsDiagnostic = null;
state.hubSession = restoreNovHubSession();
setNovHubSessionMemoryProvider(() => state.hubSession);
const MANAGEMENT_HUB_CONTEXT_KEY = "ideaNov.management.hubContext";
const MANAGEMENT_FIREBASE_TOKEN_KEY = "ideaNov.management.firebaseIdToken";
const MANAGEMENT_HUB_SESSION_KEY = "ideaNov.management.hubSession.v1";
const MANAGEMENT_APP_IDS = new Set(["management-check", "management-platform"]);
const MANAGEMENT_WEB_APP_IDS = new Set(["keiei", "management-system"]);
const SHIFT_APP_IDS = new Set(["shift"]);
const TALENT_APP_IDS = new Set(["human-capital-investment"]);
const TALENT_APP_URL = "./talent/";
const MANAGEMENT_APP_URL = "./management-platform/";
const CORE_MASTER_ADMIN_APP_URL = "./master-admin-stable/?v=master-admin-auth-label-20260717-1";
const IDEA_LINK_APP_URL = "./idea-link-app/?v=idea-link-module-sync-20260712-1";
const EDUCATION_APP_URL = "./education-app/";
const DEVELOPMENT_APP_VIEWER_ROLE_KEYS = new Set(["super_admin", "executive"]);
const HR_RELEASED_APP_VIEWER_ROLE_KEYS = new Set(["backoffice", "hr.staff", "hr.admin"]);
const BACKOFFICE_RELEASED_APP_IDS = new Set([
  "core-master-admin",
  "master-admin",
  "jinnjibu",
  "human-capital-investment"
]);
const MANAGEMENT_ALLOWED_ROLE_KEYS = new Set([
  "super_admin",
  "executive",
  "backoffice",
  "department_manager",
  "area_manager",
  "store_manager",
  "staff"
]);
const MANAGEMENT_WEB_ALLOWED_ROLE_KEYS = new Set([
  "super_admin",
  "executive",
  "backoffice",
  "accounting",
  "area_manager",
  "store_manager"
]);
const elements = Object.fromEntries([
  "header-user", "user-name", "user-store", "navi-notification-hint", "navi-notification-count", "login-screen", "loading-screen",
  "denied-screen", "portal-screen", "google-login", "pin-login-form", "pin-email", "pin-code", "demo-controls", "demo-employee",
  "demo-login", "logout-button", "denied-message", "denied-back", "welcome-title", "user-context",
  "announcements", "featured-apps", "category-apps", "visible-app-count", "app-search", "category-filter", "pin-change-panel", "pin-change-form",
  "pin-change-new", "pin-change-confirm", "pin-change-status", "concierge-form", "concierge-question", "toast"
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.querySelector(`#${id}`)]));

function showScreen(name) {
  ["login", "loading", "denied", "portal"].forEach((screenName) => {
    elements[`${screenName}Screen`].hidden = screenName !== name;
  });
  elements.headerUser.hidden = name !== "portal";
  if (name !== "portal") resetHeaderNotificationHint();
}

function unreadNotificationCount(notifications) {
  if (!Array.isArray(notifications)) return 0;
  const count = notifications.reduce((total, item) => total + (item?.unread === true ? 1 : 0), 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function resetHeaderNotificationHint() {
  if (!elements.naviNotificationHint || !elements.naviNotificationCount) return;
  elements.naviNotificationCount.textContent = "";
  elements.naviNotificationHint.hidden = true;
}

function renderHeaderNotificationHint() {
  resetHeaderNotificationHint();
  const dashboard = document.querySelector("#nov-navi-dashboard");
  if (!state.employee || elements.portalScreen.hidden || !dashboard || dashboard.hidden) return;
  const count = unreadNotificationCount(state.notifications);
  if (count === 0) return;
  elements.naviNotificationCount.textContent = count > 99 ? "99+" : String(count);
  elements.naviNotificationHint.hidden = false;
}

function removeManagementDataopsDiagnostic() {
  managementDataopsDiagnostic?.remove();
  managementDataopsDiagnostic = null;
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

function getAppDisplayName(app) {
  return isIdeaLinkApp(app) ? "サンクスコイン" : app.appName;
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
  const displayName = getAppDisplayName(app);
  const icon = createAppIcon(app);
  const info = document.createElement("span");
  info.className = "app-info";
  info.innerHTML = `
    <span class="app-title-row">
      <span class="app-title">${escapeHtml(displayName)}</span>
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
  const url = new URL("./concierge/", window.location.href);
  if (query) url.searchParams.set("q", query);
  window.location.assign(url.toString());
}

function redirectRootHubContextToManagementPlatform() {
  const path = window.location.pathname;
  const isHubRoot = path === "/"
    || path.endsWith("/index.html")
    || path.endsWith("/idea-nov-hub/")
    || path.endsWith("/idea-nov-hub/index.html");
  if (!isHubRoot) return false;
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
  const notices = [
    ...state.notifications.map(toNotificationNotice),
    ...state.announcements
  ];
  elements.announcements.replaceChildren(...(notices.length ? notices : fallback).map((notice) => {
    const article = document.createElement("article");
    article.className = `notice${notice.type === "important" ? " notice-important" : ""}${notice.unread ? " notice-unread" : ""}`;
    const meta = buildNoticeMeta(notice);
    article.innerHTML = `
      <span class="notice-icon" aria-hidden="true">${notice.type === "important" ? "!" : "i"}</span>
      <div>
        <h3 class="notice-title">${escapeHtml(notice.title)}</h3>
        <p class="notice-body">${escapeHtml(notice.body)}</p>
        ${meta ? `<p class="notice-meta">${escapeHtml(meta)}</p>` : ""}
      </div>`;
    if (notice.url || isExpenseHubNotice(notice)) {
      article.classList.add("notice-clickable");
      article.tabIndex = 0;
      article.addEventListener("click", () => openNotification(notice));
      article.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openNotification(notice);
        }
      });
    }
    return article;
  }));
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function getAppSearchText(app) {
  return normalizeSearchText([
    getAppDisplayName(app),
    app.appName,
    app.description,
    app.category,
    app.appId,
    ...(app.allowedTags || []),
    ...(app.targetDepartment || []),
    ...(app.targetPosition || [])
  ].filter(Boolean).join(" "));
}

function getFilteredApps() {
  const query = normalizeSearchText(state.appSearch);
  return state.apps.filter((app) => {
    const category = app.category || "社内アプリ";
    const categoryMatched = state.selectedCategory === "all" || category === state.selectedCategory;
    const queryMatched = !query || getAppSearchText(app).includes(query);
    return categoryMatched && queryMatched;
  });
}

function getAppCategories() {
  const dynamicCategories = [...new Set(state.apps.map((app) => app.category || "社内アプリ"))]
    .filter((category) => !CATEGORY_ORDER.includes(category));
  return [...CATEGORY_ORDER, ...dynamicCategories].filter((category) => (
    state.apps.some((app) => (app.category || "社内アプリ") === category)
  ));
}

function renderCategoryFilter() {
  const categories = getAppCategories();
  const buttons = [
    { key: "all", label: "すべて", count: state.apps.length },
    ...categories.map((category) => ({
      key: category,
      label: category,
      count: state.apps.filter((app) => (app.category || "社内アプリ") === category).length
    }))
  ].map(({ key, label, count }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-chip" + (state.selectedCategory === key ? " active" : "");
    button.textContent = `${label} ${count}`;
    button.addEventListener("click", () => {
      state.selectedCategory = key;
      renderApps();
    });
    return button;
  });
  elements.categoryFilter.replaceChildren(...buttons);
}

function toNotificationNotice(notification) {
  return {
    id: notification.id || "",
    type: notification.type || "info",
    title: notification.title || "経費精算管理システム通知",
    body: notification.body || "",
    url: notification.url || "",
    moduleKey: notification.moduleKey || "",
    unread: Boolean(notification.unread),
    actionLabel: notification.actionLabel || "",
    targetModule: notification.targetModule || "",
    targetView: notification.targetView || "",
    targetQuery: notification.targetQuery || {},
    createdAt: notification.createdAt || ""
  };
}

async function openNotification(notice) {
  if (notice.url) {
    const context = refreshHubEmployeeContext();
    await markNotificationRead(notice);
    window.location.assign(buildAppLaunchUrl(notice.url, context));
    return;
  }
  if (isExpenseHubNotice(notice)) {
    const expenseHub = state.apps.find((app) => app.appId === "expense_hub" || app.appId === "expense-hub");
    if (expenseHub) {
      const appUrl = buildExpenseHubNoticeUrl(expenseHub.url, notice);
      await markNotificationRead(notice);
      openApp({ ...expenseHub, appId: "expense_hub", url: appUrl });
    }
  }
}

function isExpenseHubNotice(notice) {
  return notice?.moduleKey === "finance.expense"
    && (notice?.targetModule === "expense_hub" || notice?.actionLabel === "Expense Hub" || notice?.actionLabel === "経費精算管理システム");
}

function buildExpenseHubNoticeUrl(baseUrl, notice) {
  const url = new URL(baseUrl || "https://ideanow-shift.github.io/idea-nov-expense-hub/", window.location.href);
  if (notice.targetView) url.searchParams.set("target_view", notice.targetView);
  Object.entries(notice.targetQuery || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function markNotificationRead(notice) {
  if (!notice?.id || !notice.unread) return;
  try {
    await callApiAction("markNovHubNotificationRead", { notificationIds: [notice.id] });
    state.notifications = state.notifications.map((notification) => (
      notification.id === notice.id ? { ...notification, unread: false } : notification
    ));
  } catch (error) {
    console.warn("NOV HUB notification read mark failed", error);
  }
}

function buildNoticeMeta(notice) {
  const parts = [];
  if (notice.unread) parts.push("未読");
  if (notice.actionLabel) parts.push(notice.actionLabel);
  if (notice.createdAt) parts.push(formatDateTime(notice.createdAt));
  return parts.join(" / ");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderApps() {
  renderCategoryFilter();
  const filteredApps = getFilteredApps();
  const featured = filteredApps.filter((app) => app.isFeatured);
  elements.featuredApps.replaceChildren(...(featured.length ? featured.map(createAppCard) : [createEmptyState("よく使うアプリはまだありません。")]));
  const categories = getAppCategories().map((category) => ({
    category,
    apps: filteredApps.filter((app) => (app.category || "社内アプリ") === category)
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
  elements.visibleAppCount.textContent = state.appSearch || state.selectedCategory !== "all"
    ? `${filteredApps.length}/${state.apps.length}件`
    : `${state.apps.length}件`;
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
      icon: "management-check",
      requiredLevel: 1,
      allowedTags: []
    };
  });
}

function normalizeAppTextKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[＿_\-ー－・/／（）()\[\]［］]/g, "")
    .toLowerCase();
}

function normalizeAppUrlKey(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("#")) return "";
  try {
    const url = new URL(raw, window.location.href);
    url.searchParams.delete("hub_context");
    url.hash = "";
    const params = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    params.forEach(([key, val]) => url.searchParams.set(key, val));
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${path}${url.search}`;
  } catch {
    return raw.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function canonicalAppGroupKey(app) {
  const id = normalizeAppTextKey(app.appId);
  const name = normalizeAppTextKey(app.appName);
  const urlKey = normalizeAppUrlKey(app.url);
  if (id) return `app:${id}`;
  if (urlKey) return `url:${urlKey}`;
  return `name:${name}`;
}

function appDedupeScore(app) {
  let score = Number(app.priority || 999);
  if (!normalizeAppUrlKey(app.url)) score += 500;
  return score;
}

function dedupePortalApps(apps = []) {
  const byKey = new Map();
  apps.forEach((app) => {
    if (!app) return;
    const key = canonicalAppGroupKey(app);
    const current = byKey.get(key);
    if (!current || appDedupeScore(app) < appDedupeScore(current)) {
      byKey.set(key, app);
    }
  });
  return [...byKey.values()];
}

function sortPortalApps(apps = []) {
  return dedupePortalApps(normalizeManagementPlatformApps(apps))
    .filter((app) => app && app.isActive !== false)
    .sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999));
}

function renderPortal() {
  const query = new URLSearchParams(window.location.search);
  const employeeContext = refreshHubEmployeeContext();
  elements.userName.textContent = state.employee.name;
  elements.userStore.textContent = state.employee.store || state.employee.department || "";
  elements.userContext.textContent = getHubEmployeeContextSummary(employeeContext);
  elements.welcomeTitle.textContent = `${state.employee.name.split(/[\s　]/)[0]}さん、お疲れさまです`;
  elements.pinChangePanel.hidden = !(state.authType === "pin" && state.employee?.mustChangePin);
  elements.pinChangeStatus.textContent = "";
  renderAnnouncements();
  renderApps();
  renderNovNaviDashboard({
    enabled: shouldEnableNovNaviDashboard({
      featureEnabled: PORTAL_CONFIG.novNaviDashboardEnabled,
      hostname: window.location.hostname,
      search: window.location.search
    }),
    employee: state.employee,
    apps: state.apps,
    onOpenApp: openApp,
    onOpenSupport: openConcierge
  });
  showScreen("portal");
  renderHeaderNotificationHint();
}

function resetAppFilters() {
  state.appSearch = "";
  state.selectedCategory = "all";
  if (elements.appSearch) elements.appSearch.value = "";
}

function runAfterPaint(callback) {
  window.requestAnimationFrame(() => {
    window.setTimeout(callback, 0);
  });
}

function writeLoginAccessLogAfterPaint(data) {
  runAfterPaint(() => {
    writeAccessLog("login", {
      result: "success",
      bootstrapPerformance: data?.performance || null
    }).catch((error) => console.warn("Login access log failed", error));
  });
}

function loadNovHubNotificationsAfterPaint() {
  runAfterPaint(() => {
    callApiAction("novHubNotifications")
      .then((data) => {
        state.notifications = Array.isArray(data.notifications) ? data.notifications : [];
        renderAnnouncements();
        renderHeaderNotificationHint();
      })
      .catch((error) => console.warn("NOV HUB notifications load failed", error));
  });
}

function loadAnnouncementsAfterPaint() {
  runAfterPaint(() => {
    callApiAction("announcements")
      .then((data) => {
        state.announcements = Array.isArray(data.announcements) ? data.announcements : [];
        renderAnnouncements();
      })
      .catch((error) => console.warn("Portal announcements load failed", error));
  });
}

function saveManagementAuthContextAfterPaint(context) {
  runAfterPaint(() => {
    saveManagementPlatformAuthContext(context)
      .catch((error) => console.warn("Management Platform auth context save failed", error));
  });
}


function refreshHubEmployeeContext() {
  if (!state.employee) return null;
  return saveHubEmployeeContext(state.employee, state.authType);
}

function encodeHubContextForAppUrl(context) {
  return encodeHubContextForUrl(context);
}

function buildAppLaunchUrl(appUrl, context) {
  const rawUrl = String(appUrl || "").trim();
  if (!rawUrl || rawUrl.startsWith("#")) return rawUrl || "#";
  const encodedContext = encodeHubContextForAppUrl(context);
  if (!encodedContext) return rawUrl;
  try {
    const url = new URL(rawUrl, window.location.href);
    url.searchParams.set("hub_context", encodedContext);
    return url.toString();
  } catch (error) {
    console.warn("Failed to append HUB context to app URL", error);
    return rawUrl;
  }
}

async function buildIdeaLinkLaunchUrl() {
  const hubSessionToken = state.authType === "pin"
    ? String(state.hubSession?.sessionToken || "").trim()
    : "";
  if (state.authType === "pin" && !hubSessionToken) {
    throw new Error("HUB session is missing.");
  }
  const response = await createIdeaLinkHandoff({ hubSessionToken, targetView: "home" });
  const handoffCode = String(response?.handoff?.handoffCode || "").trim();
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(handoffCode)) {
    throw new Error("IDEA LINK handoff could not be created.");
  }
  const url = new URL(IDEA_LINK_APP_URL, window.location.href);
  url.searchParams.set("handoff_code", handoffCode);
  return url.toString();
}

function isManagementPlatformApp(app) {
  const compact = (value) => String(value || "").toLowerCase().replace(/[\s　・/_-]/g, "");
  const appId = compact(app.appId);
  const appName = compact(app.appName);
  const icon = compact(app.icon);
  const description = compact(app.description);
  const url = String(app.url || "").toLowerCase();

  return MANAGEMENT_APP_IDS.has(appId)
    || MANAGEMENT_APP_IDS.has(icon)
    || appName === "managementplatform"
    || appName === "マネジメントチェック"
    || description.includes("店舗のマネジメント状況のチェック")
    || description.includes("管理者育成")
    || url.includes("/management-platform/");
}

function isManagementWebApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  const appName = String(app?.appName || "").trim().replace(/\s+/g, "");
  return MANAGEMENT_WEB_APP_IDS.has(appId)
    || appName === "経営管理システム"
    || String(app?.url || "").includes("/management-app/");
}

function canLaunchManagementWeb(context) {
  const roles = new Set((context?.roleKeys || []).map((value) => String(value || "").trim().toLowerCase()));
  return [...roles].some((roleKey) => MANAGEMENT_WEB_ALLOWED_ROLE_KEYS.has(roleKey));
}

async function ensureManagementWebHubSession() {
  const current = state.hubSession || restoreNovHubSession();
  if (current?.sessionToken) {
    state.hubSession = current;
    return current;
  }
  const refreshed = await fetchPortalData();
  const session = refreshed?.hubSession || null;
  if (!setNovHubSession(session)) {
    throw new Error("HUB sessionを再取得できませんでした。再ログインしてください。");
  }
  state.hubSession = session;
  return session;
}

function isShiftApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  return SHIFT_APP_IDS.has(appId);
}

function canLaunchManagementPlatform(context) {
  const roles = new Set((context?.roleKeys || []).map(String));
  return [...roles].some((roleKey) => MANAGEMENT_ALLOWED_ROLE_KEYS.has(roleKey));
}

function isCoreMasterAdminApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  const appName = String(app?.appName || "").trim().replace(/\s+/g, "");
  const appUrl = String(app?.url || "").toLowerCase();
  return appId === "core-master-admin"
    || appId === "master-admin"
    || appName === "社員・店舗マスタ管理"
    || appName === "社員店舗マスタ管理"
    || appUrl.includes("/master-admin/");
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

function saveManagementHubSessionAuthContext(context) {
  const session = state.hubSession || {};
  const token = String(session.sessionToken || "").trim();
  const expiresAt = String(session.expiresAt || "").trim();
  const audience = String(session.audience || "").trim();
  if (!token || audience !== "nov_hub" || !Number.isFinite(Date.parse(expiresAt))) {
    throw new Error("HUB sessionを取得できませんでした。再ログインしてください。");
  }
  sessionStorage.setItem(MANAGEMENT_HUB_SESSION_KEY, JSON.stringify({
    sessionToken: token,
    expiresAt,
    audience
  }));
  sessionStorage.setItem(MANAGEMENT_HUB_CONTEXT_KEY, JSON.stringify(context || {}));
}

async function prepareManagementPlatformLaunch(app, context) {
  if (!isManagementPlatformApp(app) && !isCoreMasterAdminApp(app)) return;
  if (state.authType === "pin") {
    saveManagementHubSessionAuthContext(context);
    return;
  }
  await saveManagementPlatformAuthContext(context);
}

function isIdeaLinkApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  const appName = String(app?.appName || "").trim().toLowerCase().replaceAll(" ", "");
  const appUrl = String(app?.url || "");
  return appId === "idea-link"
    || appName === "idealink"
    || appName === "サンクスコイン"
    || /(?:^|\/)idea-link\/?(?:[?#].*)?$/.test(appUrl);
}

function isEducationApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  const appName = String(app?.appName || "").trim().toLowerCase().replace(/\s+/g, "");
  const icon = String(app?.icon || "").trim().toLowerCase().replaceAll("_", "-");
  const category = String(app?.category || "").trim().toLowerCase();
  return appId === "education-web"
    || appId === "edu"
    || icon === "education-web"
    || icon === "education"
    || appName.includes("education")
    || appName.includes("edu")
    || appName.includes("教育")
    || category.includes("教育");
}

function isTalentApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  return TALENT_APP_IDS.has(appId);
}

function isBackofficeReleasedApp(app) {
  const appId = String(app?.appId || "").trim().toLowerCase().replaceAll("_", "-");
  return BACKOFFICE_RELEASED_APP_IDS.has(appId) || isCoreMasterAdminApp(app);
}

function selectReleasedAppsForEmployee(employee, apps) {
  const roleKeys = new Set([
    ...(Array.isArray(employee?.roleKeys) ? employee.roleKeys : []),
    ...(Array.isArray(employee?.roles) ? employee.roles.map((role) => role?.roleKey || role?.role_key) : []),
    ...(Array.isArray(employee?.tags) ? employee.tags : [])
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
  if ([...DEVELOPMENT_APP_VIEWER_ROLE_KEYS].some((roleKey) => roleKeys.has(roleKey))) return apps;
  if ([...HR_RELEASED_APP_VIEWER_ROLE_KEYS].some((roleKey) => roleKeys.has(roleKey))) {
    return apps.filter((app) => isIdeaLinkApp(app) || isBackofficeReleasedApp(app));
  }
  return apps.filter(isIdeaLinkApp);
}

async function openApp(app) {
  if (state.authType === "pin" && state.employee?.mustChangePin) {
    showToast("初回PIN変更を完了してからアプリを開いてください。");
    elements.pinChangeNew?.focus();
    return;
  }
  const employeeContext = refreshHubEmployeeContext();
  const appUrl = isManagementPlatformApp(app)
    ? MANAGEMENT_APP_URL
    : isManagementWebApp(app)
      ? "./management-app/"
    : isCoreMasterAdminApp(app)
      ? CORE_MASTER_ADMIN_APP_URL
    : isIdeaLinkApp(app)
      ? IDEA_LINK_APP_URL
    : isEducationApp(app)
      ? EDUCATION_APP_URL
      : isTalentApp(app)
        ? TALENT_APP_URL
        : app.url;
  const launchUrl = isIdeaLinkApp(app) ? "" : buildAppLaunchUrl(appUrl, employeeContext);
  if (state.authType === "firebase" || state.authType === "pin") {
    if (isManagementWebApp(app)) {
      if (!canLaunchManagementWeb(employeeContext)) {
        showToast("経営管理システムの利用権限がありません。");
        return;
      }
      try {
        await ensureManagementWebHubSession();
        await writeAccessLog("openApp", { appId: app.appId, appName: app.appName, result: "success" });
        window.location.assign(launchUrl);
      } catch (error) {
        showToast("経営管理システムを開けませんでした。再ログインしてお試しください。");
        console.error(error);
      }
      return;
    }
    if (isShiftApp(app)) {
      try {
        await writeAccessLog("openApp", { appId: app.appId, appName: app.appName, result: "success" });
        window.location.assign(launchUrl);
      } catch (error) {
        showToast("シフト作成を開けませんでした。再ログインしてお試しください。");
        console.error(error);
      }
      return;
    }
    if (isManagementPlatformApp(app) || isCoreMasterAdminApp(app)) {
      try {
        if (isManagementPlatformApp(app) && !canLaunchManagementPlatform(employeeContext)) {
          showToast("Management Platformの利用権限がありません。");
          return;
        }
        await prepareManagementPlatformLaunch(app, employeeContext);
        writeAccessLog("openApp", { appId: app.appId, appName: app.appName, result: "success" })
          .catch((error) => console.warn("Management Platform access log failed", error));
        window.location.assign(launchUrl);
      } catch (error) {
        showToast("Management Platformを開けませんでした。再ログインしてお試しください。");
        console.error(error);
      }
      return;
    }

    const target = window.open("about:blank", "_blank");
    if (target) target.opener = null;
    try {
      await prepareManagementPlatformLaunch(app, employeeContext);
      await writeAccessLog("openApp", { appId: app.appId, appName: app.appName, result: "success" });
      const resolvedLaunchUrl = isIdeaLinkApp(app) ? await buildIdeaLinkLaunchUrl() : launchUrl;
      if (target) target.location = resolvedLaunchUrl;
      else window.location.assign(resolvedLaunchUrl);
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

async function changeOwnPin(event) {
  event.preventDefault();
  const newPin = elements.pinChangeNew.value.trim();
  const confirmPin = elements.pinChangeConfirm.value.trim();
  const submitButton = elements.pinChangeForm.querySelector("button[type='submit']");
  elements.pinChangeStatus.textContent = "";

  if (!/^\d{4,12}$/.test(newPin)) {
    elements.pinChangeStatus.textContent = "PINは4〜12桁の数字で入力してください。";
    return;
  }
  if (newPin !== confirmPin) {
    elements.pinChangeStatus.textContent = "確認用PINが一致しません。";
    return;
  }

  submitButton.disabled = true;
  try {
    const data = await callApiAction("changeOwnPin", { new_pin: newPin });
    state.employee = {
      ...state.employee,
      mustChangePin: false,
      loginCredential: data.credential || state.employee.loginCredential || null
    };
    setPinAuth(state.employee.email || elements.pinEmail.value, newPin);
    elements.pinChangeNew.value = "";
    elements.pinChangeConfirm.value = "";
    showToast("PINを変更しました。");
    renderPortal();
  } catch (error) {
    console.error("PIN change failed", error);
    elements.pinChangeStatus.textContent = error.message || "PIN変更に失敗しました。";
  } finally {
    submitButton.disabled = false;
  }
}

async function loginWithFirebase() {
  showScreen("loading");
  try {
    setFirebaseAuth();
    await signInWithGoogle();
    const data = await fetchPortalData();
    state.authType = "firebase";
    state.employee = data.employee;
    state.hubSession = data.hubSession || null;
    if (!setNovHubSession(state.hubSession)) {
      throw new Error("HUB sessionを保存できませんでした。再ログインしてください。");
    }
    state.apps = selectReleasedAppsForEmployee(state.employee, sortPortalApps(data.apps || []));
    state.announcements = data.announcements || [];
    state.notifications = [];
    resetAppFilters();
    renderPortal();
    writeLoginAccessLogAfterPaint(data);
    loadAnnouncementsAfterPaint();
    loadNovHubNotificationsAfterPaint();
    saveManagementAuthContextAfterPaint(refreshHubEmployeeContext());
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
    state.hubSession = data.hubSession || null;
    if (!setNovHubSession(state.hubSession)) {
      throw new Error("HUB sessionを保存できませんでした。再ログインしてください。");
    }
    removeManagementDataopsDiagnostic();
    managementDataopsDiagnostic = installManagementDataopsOneShotDiagnostic({
      isPinAuthenticated: () => state.authType === "pin" && Boolean(state.employee),
      isAuthorizedForDiagnostic: () => canLaunchManagementWeb(state.employee),
      getCurrentPinSession: () => state.authType === "pin" ? state.hubSession : null
    });
    state.apps = selectReleasedAppsForEmployee(state.employee, sortPortalApps(data.apps || []));
    state.announcements = data.announcements || [];
    state.notifications = [];
    elements.pinCode.value = "";
    resetAppFilters();
    renderPortal();
    writeLoginAccessLogAfterPaint(data);
    loadAnnouncementsAfterPaint();
    loadNovHubNotificationsAfterPaint();
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
  if (!shouldEnableLocalNovNaviDemo({ hostname: window.location.hostname, search: window.location.search })) {
    return;
  }
  const employee = getDemoEmployee(elements.demoEmployee.value);
  if (!employee || employee.status !== "active") {
    elements.deniedMessage.textContent = "このアカウントは社内ポータルの利用権限がありません。管理者へお問い合わせください。";
    showScreen("denied");
    return;
  }
  state.employee = employee;
  state.apps = selectReleasedAppsForEmployee(employee, getVisibleApps(employee, DEMO_APPS));
  state.announcements = [];
  state.notifications = [];
  state.authType = "demo";
  removeManagementDataopsDiagnostic();
  state.hubSession = null;
  clearNovHubSession();
  resetAppFilters();
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
  removeManagementDataopsDiagnostic();
  clearHubEmployeeContext();
  clearNovHubSession();
  sessionStorage.removeItem(MANAGEMENT_FIREBASE_TOKEN_KEY);
  sessionStorage.removeItem(MANAGEMENT_HUB_CONTEXT_KEY);
  sessionStorage.removeItem(MANAGEMENT_HUB_SESSION_KEY);
  localStorage.removeItem(MANAGEMENT_FIREBASE_TOKEN_KEY);
  localStorage.removeItem(MANAGEMENT_HUB_CONTEXT_KEY);
  state.employee = null;
  state.hubSession = null;
  state.apps = [];
  state.announcements = [];
  state.notifications = [];
  state.authType = null;
  resetAppFilters();
  showScreen("login");
}

async function initialize() {
  if (redirectRootHubContextToManagementPlatform()) return;
  await loadAppIconRegistry();
  const firebaseReady = authIsConfigured();
  const query = new URLSearchParams(window.location.search);
  const localDemoEnabled = shouldEnableLocalNovNaviDemo({
    hostname: window.location.hostname,
    search: window.location.search
  });
  if (localDemoEnabled) {
    DEMO_EMPLOYEES.forEach((employee) => {
      const option = document.createElement("option");
      option.value = employee.email;
      option.textContent = `${employee.name}（権限${employee.roleLevel}${employee.status === "inactive" ? "・停止中" : ""}）`;
      elements.demoEmployee.append(option);
    });
  }
  elements.googleLogin.hidden = !firebaseReady;
  elements.demoControls.hidden = !localDemoEnabled;
  elements.googleLogin.addEventListener("click", loginWithFirebase);
  elements.pinLoginForm.addEventListener("submit", loginWithPin);
  elements.pinChangeForm.addEventListener("submit", changeOwnPin);
  elements.appSearch.addEventListener("input", () => {
    state.appSearch = elements.appSearch.value;
    renderApps();
  });
  elements.conciergeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    openConcierge(elements.conciergeQuestion.value);
  });
  document.querySelectorAll(".concierge-chip-row [data-question]").forEach((button) => {
    button.addEventListener("click", () => openConcierge(button.dataset.question));
  });
  if (localDemoEnabled) {
    elements.demoLogin.addEventListener("click", loginDemo);
  }
  elements.logoutButton.addEventListener("click", logout);
  elements.deniedBack.addEventListener("click", () => {
    clearApiAuth();
    showScreen("login");
  });
  if (state.mode === "firebase" && !firebaseReady) {
    elements.deniedMessage.textContent = "FirebaseまたはNOV HUB APIの設定が未完了です。firebase-config.jsを確認してください。";
    showScreen("denied");
  } else {
    showScreen("login");
  }
}

initialize();
