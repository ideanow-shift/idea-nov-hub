import { signInWithGoogle, signOutUser } from "../js/auth.js";
import { callApiAction, clearApiAuth, setFirebaseAuth, setFirebaseTokenAuth, setHubSessionAuth } from "../js/api.js?v=master-admin-safe-detail-20260711-13";

const NEW_EMPLOYEE_ID = "__new_employee__";
const NEW_CORPORATION_ID = "__new_corporation__";
const NEW_PORTAL_APP_ID = "__new_portal_app__";
const MANAGEMENT_FIREBASE_TOKEN_KEY = "ideaNov.management.firebaseIdToken";
const MANAGEMENT_HUB_SESSION_KEY = "ideaNov.management.hubSession.v1";
const MASTER_ADMIN_BOOTSTRAP_TIMEOUT_MS = 12000;
const MASTER_ADMIN_FALLBACK_TIMEOUT_MS = 9000;
const MASTER_ADMIN_RECOVERY_LABEL = "UI復旧版 v14";
const EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED = false;
const IDEA_LINK_ROLE_KEYS = ["idea_link.staff", "idea_link.manager", "idea_link.admin"];
const APP_ROLE_KEY_PREFIXES = ["idea_link."];
const APP_ROLE_GROUPS = [
  {
    appKey: "idea_link",
    appName: "IDEA LINK",
    description: "サンクスコイン・理念浸透システム",
    roleKeys: IDEA_LINK_ROLE_KEYS
  }
];
const EMPLOYMENT_TYPE_OPTIONS = [
  ["役員", "役員"],
  ["正社員", "正社員"],
  ["パート・アルバイト", "パート・アルバイト"],
  ["業務委託", "業務委託"],
  ["その他", "その他"]
];
const EMPLOYMENT_STATUS_OPTIONS = [
  ["現職", "現職"],
  ["休職", "休職"],
  ["退職", "退職"],
  ["出向", "出向"]
];
const LEAVE_TYPE_OPTIONS = [
  ["", "未設定"],
  ["産休", "産休"],
  ["育休", "育休"],
  ["傷病", "傷病"],
  ["介護", "介護"],
  ["その他", "その他"]
];

const FORBIDDEN_EMPLOYEE_ATTRIBUTE_LABELS = new Set(["会長夫人", "創業者夫人", "夫人"]);
const FORMAL_EMPLOYEE_POSITION_LABELS = new Set([
  "相談役",
  "会長",
  "社長",
  "副社長",
  "取締役",
  "執行役員",
  "部長",
  "課長",
  "係長",
  "エリアマネージャー",
  "店長",
  "店長見習い",
  "副店長",
  "FCオーナー",
  "FCオーナー見習い",
  "一般スタッフ"
]);
const EMPLOYMENT_TYPE_ALIASES = {
  "パート": "パート・アルバイト",
  "アルバイト": "パート・アルバイト",
  "レセプション": "パート・アルバイト",
  "レセプションパート": "パート・アルバイト"
};
const LINE_WORKS_NUMERIC_ONLY_PATTERN = /^\d+$/;

const state = {
  view: "employees",
  employeeStatus: "active",
  employeeIssueFilter: "",
  safeSearch: "",
  corporationStatus: "active",
  storeStatus: "active",
  appStatus: "active",
  selectedId: "",
  recentlyCreatedEmployeeId: "",
  employees: [],
  corporations: [],
  stores: [],
  portalApps: [],
  logs: [],
  logsLoaded: false,
  permissions: {
    canView: false,
    canEdit: false,
    roleKeys: []
  },
  formSnapshot: "",
  masters: {
    corporations: [],
    businessUnits: [],
    departments: [],
    positions: [],
    jobTypes: []
  }
};

const elements = Object.fromEntries([
  "auth-panel", "loading-panel", "admin-app", "sign-in", "sign-out", "add-employee", "add-corporation", "add-portal-app", "refresh",
  "view-title", "search", "employee-csv-tools", "export-employees-csv", "import-employees-csv", "quality-summary", "result-count", "table-head", "table-body",
  "detail-panel", "employee-status-filter", "corporation-status-filter", "store-status-filter", "app-status-filter", "toast"
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.querySelector(`#${id}`)]));

const ROLE_LABELS = {
  super_admin: "最高管理者",
  executive: "経営層",
  department_manager: "部門管理者",
  area_manager: "エリア管理者",
  store_manager: "店舗管理者",
  staff: "スタッフ",
  fc_owner: "FCオーナー",
  trainer: "教育担当",
  backoffice: "総務人事",
  accounting: "経理",
  "idea_link.staff": "IDEA LINK スタッフ",
  "idea_link.manager": "IDEA LINK マネージャー",
  "idea_link.admin": "IDEA LINK 管理者"
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3600);
}

function parseStoredJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function isFutureIso(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) && time > Date.now();
}

function restoreHubSessionAuth() {
  const session = parseStoredJson(sessionStorage.getItem(MANAGEMENT_HUB_SESSION_KEY));
  if (!session?.sessionToken || session.audience !== "nov_hub" || !isFutureIso(session.expiresAt)) {
    sessionStorage.removeItem(MANAGEMENT_HUB_SESSION_KEY);
    return false;
  }
  setHubSessionAuth(session.sessionToken);
  return true;
}

function restoreFirebaseTokenAuth() {
  const sessionToken = String(sessionStorage.getItem(MANAGEMENT_FIREBASE_TOKEN_KEY) || "").trim();
  if (sessionToken) {
    setFirebaseTokenAuth(sessionToken);
    return true;
  }
  const stored = parseStoredJson(localStorage.getItem(MANAGEMENT_FIREBASE_TOKEN_KEY));
  if (stored?.token && Number(stored.expiresAt || 0) > Date.now()) {
    setFirebaseTokenAuth(stored.token);
    return true;
  }
  localStorage.removeItem(MANAGEMENT_FIREBASE_TOKEN_KEY);
  return false;
}

function restoreLaunchAuth() {
  return restoreHubSessionAuth() || restoreFirebaseTokenAuth();
}

function clearStoredLaunchAuth() {
  sessionStorage.removeItem(MANAGEMENT_HUB_SESSION_KEY);
  sessionStorage.removeItem(MANAGEMENT_FIREBASE_TOKEN_KEY);
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function setStyles(element, styles) {
  if (!element) return;
  Object.entries(styles).forEach(([property, value]) => {
    const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    element.style.setProperty(cssProperty, value, "important");
  });
}

function installRuntimeLayoutStyles() {
  let style = document.querySelector("#master-admin-runtime-layout");
  if (!style) {
    style = document.createElement("style");
    style.id = "master-admin-runtime-layout";
    document.head.append(style);
  }
  style.textContent = `
    [hidden] { display: none !important; }
    body { margin: 0 !important; background: #fafafa !important; color: #111827 !important; font-family: system-ui, -apple-system, "Segoe UI", sans-serif !important; }
    .admin-app:not([hidden]) { display: block !important; width: 100% !important; }
    .auth-panel:not([hidden]), .loading-panel:not([hidden]) { display: grid !important; }
    .toolbar { display: flex !important; flex-wrap: wrap !important; align-items: flex-start !important; justify-content: space-between !important; gap: 16px !important; }
    .toolbar-actions, .status-filter, .quality-summary, .csv-tools { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; align-items: center !important; }
    .button, .segmented, .filter-chip, button { display: inline-flex !important; align-items: center !important; justify-content: center !important; min-height: 38px !important; border: 1px solid #e5e7eb !important; border-radius: 12px !important; background: #fff !important; color: #111827 !important; font: inherit !important; padding: 0 14px !important; text-decoration: none !important; }
    .segmented.active, .filter-chip.active, .button-primary { border-color: #e8b4b8 !important; background: #fff1f2 !important; font-weight: 700 !important; }
    .workspace { display: grid !important; grid-template-columns: minmax(0, 1fr) 380px !important; gap: 16px !important; align-items: start !important; }
    .list-panel, .detail-panel { display: block !important; border: 1px solid #e5e7eb !important; border-radius: 14px !important; background: #fff !important; box-sizing: border-box !important; }
    .auth-panel, .loading-panel { border: 1px solid #e5e7eb !important; border-radius: 14px !important; background: #fff !important; box-sizing: border-box !important; }
    .auth-panel:not([hidden]), .loading-panel:not([hidden]) { display: grid !important; }
    .table-wrap { display: block !important; overflow: auto !important; max-height: calc(100vh - 230px) !important; }
    table { display: table !important; width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; font-size: 13px !important; }
    thead { display: table-header-group !important; }
    tbody { display: table-row-group !important; }
    tr { display: table-row !important; }
    th, td { display: table-cell !important; border-bottom: 1px solid #e5e7eb !important; padding: 11px 10px !important; text-align: left !important; white-space: nowrap !important; vertical-align: middle !important; }
    #master-admin-safe-view { position: fixed !important; inset: 88px 0 0 0 !important; z-index: 5000 !important; display: block !important; overflow: auto !important; background: #fafafa !important; padding: 22px !important; box-sizing: border-box !important; }
    .safe-master-shell { width: min(100%, 1180px) !important; margin: 0 auto !important; display: grid !important; grid-template-columns: minmax(0, 1fr) 340px !important; gap: 16px !important; align-items: start !important; }
    .safe-master-card { border: 1px solid #e5e7eb !important; border-radius: 14px !important; background: #fff !important; padding: 16px !important; box-sizing: border-box !important; }
    .safe-master-header { display: flex !important; flex-wrap: wrap !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; margin-bottom: 14px !important; }
    .safe-master-title { display: grid !important; gap: 3px !important; }
    .safe-master-title strong { font-size: 20px !important; }
    .safe-master-note { color: #6b7280 !important; font-size: 12px !important; line-height: 1.6 !important; }
    .safe-master-controls { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; align-items: center !important; margin: 12px 0 !important; }
    .safe-master-search { min-height: 42px !important; min-width: min(100%, 320px) !important; border: 1px solid #e5e7eb !important; border-radius: 12px !important; padding: 10px 12px !important; font: inherit !important; }
    .safe-master-table-wrap { display: block !important; overflow: auto !important; max-height: calc(100vh - 260px) !important; border: 1px solid #eef2f7 !important; border-radius: 12px !important; }
    .safe-master-table { display: table !important; width: 100% !important; border-collapse: collapse !important; background: #fff !important; font-size: 13px !important; }
    .safe-master-table thead { display: table-header-group !important; position: sticky !important; top: 0 !important; z-index: 1 !important; background: #f9fafb !important; }
    .safe-master-table tbody { display: table-row-group !important; }
    .safe-master-table tr { display: table-row !important; cursor: pointer !important; }
    .safe-master-table th, .safe-master-table td { display: table-cell !important; border-bottom: 1px solid #edf0f4 !important; padding: 10px 11px !important; white-space: nowrap !important; text-align: left !important; vertical-align: middle !important; }
    .safe-master-table tr.selected, .safe-master-table tr:hover { background: #fff7f7 !important; }
    .safe-master-pill { display: inline-flex !important; align-items: center !important; justify-content: center !important; min-width: 52px !important; border-radius: 999px !important; background: #f3f4f6 !important; color: #374151 !important; font-size: 12px !important; font-weight: 700 !important; padding: 3px 8px !important; }
    .safe-master-detail { position: sticky !important; top: 106px !important; max-height: calc(100vh - 130px) !important; overflow: auto !important; }
    .safe-master-detail-section { display: grid !important; gap: 6px !important; margin: 14px 0 !important; }
    .safe-master-detail-section-title { margin: 0 0 2px !important; color: #111827 !important; font-size: 13px !important; font-weight: 800 !important; }
    .safe-master-detail-grid { display: grid !important; gap: 8px !important; }
    .safe-master-detail-row { display: grid !important; grid-template-columns: 96px minmax(0, 1fr) !important; gap: 10px !important; align-items: baseline !important; border-bottom: 1px solid #f1f5f9 !important; padding: 8px 0 !important; }
    .safe-master-detail-label { color: #6b7280 !important; font-size: 12px !important; }
    .safe-master-detail-value { min-width: 0 !important; overflow-wrap: anywhere !important; font-size: 13px !important; }
    @media (max-width: 900px) {
      #master-admin-safe-view { top: 78px !important; padding: 14px !important; }
      .safe-master-shell { grid-template-columns: 1fr !important; }
      .safe-master-detail { position: static !important; max-height: none !important; }
    }
  `;
}

function applyStableLayoutStyles() {
  installRuntimeLayoutStyles();
  setStyles(document.body, {
    margin: "0",
    background: "#fafafa",
    color: "#111827",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
  });
  setStyles(document.querySelector(".admin-header"), {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "center",
    gap: "16px",
    borderBottom: "1px solid #e5e7eb",
    background: "rgba(255,255,255,.96)",
    padding: "14px 24px"
  });
  setStyles(document.querySelector(".admin-shell"), {
    width: "min(100%, 1180px)",
    margin: "0 auto",
    padding: "24px",
    boxSizing: "border-box"
  });
  setStyles(document.querySelector(".toolbar"), {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px"
  });
  setStyles(document.querySelector(".toolbar-actions"), {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    justifyContent: "flex-end",
    alignItems: "center"
  });
  document.querySelectorAll(".segmented, .filter-chip, .button").forEach((button) => {
    setStyles(button, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "38px",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      background: "#fff",
      color: "#111827",
      cursor: "pointer",
      font: "inherit",
      padding: "0 14px",
      textDecoration: "none"
    });
  });
  document.querySelectorAll(".segmented.active, .filter-chip.active, .button-primary").forEach((button) => {
    setStyles(button, {
      borderColor: "#e8b4b8",
      background: "#fff1f2",
      fontWeight: "700"
    });
  });
  setStyles(document.querySelector(".workspace"), {
    display: "grid",
    gridTemplateColumns: window.matchMedia("(max-width: 900px)").matches ? "1fr" : "minmax(0, 1fr) 380px",
    gap: "16px",
    alignItems: "start"
  });
  document.querySelectorAll(".list-panel, .detail-panel, .auth-panel, .loading-panel").forEach((panel) => {
    setStyles(panel, {
      border: "1px solid #e5e7eb",
      borderRadius: "14px",
      background: "#fff",
      boxSizing: "border-box"
    });
  });
  setStyles(document.querySelector(".list-panel"), {
    minWidth: "0",
    padding: "16px"
  });
  setStyles(document.querySelector(".detail-panel"), {
    position: window.matchMedia("(max-width: 900px)").matches ? "static" : "sticky",
    top: "88px",
    maxHeight: window.matchMedia("(max-width: 900px)").matches ? "none" : "calc(100vh - 112px)",
    overflow: "auto",
    padding: "18px"
  });
  document.querySelectorAll(".status-filter, .quality-summary, .csv-tools").forEach((row) => {
    setStyles(row, {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      alignItems: "center"
    });
  });
  document.querySelectorAll(".search-input, .form-input, .form-select, textarea").forEach((input) => {
    setStyles(input, {
      minHeight: "42px",
      width: "100%",
      border: "1px solid #e5e7eb",
      borderRadius: "12px",
      background: "#fff",
      color: "#111827",
      boxSizing: "border-box",
      font: "inherit",
      padding: "10px 12px"
    });
  });
  setStyles(document.querySelector(".table-wrap"), {
    overflow: "auto",
    maxHeight: "calc(100vh - 230px)"
  });
  setStyles(document.querySelector("table"), {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px"
  });
  document.querySelectorAll("th, td").forEach((cell) => {
    setStyles(cell, {
      borderBottom: "1px solid #e5e7eb",
      padding: "11px 10px",
      textAlign: "left",
      whiteSpace: "nowrap",
      verticalAlign: "middle"
    });
  });
  showRecoveryVersionMarker();
}

function showRecoveryVersionMarker() {
  let marker = document.querySelector("#master-admin-recovery-version");
  if (!marker) {
    marker = document.createElement("div");
    marker.id = "master-admin-recovery-version";
    marker.textContent = MASTER_ADMIN_RECOVERY_LABEL;
    document.body.append(marker);
  }
  setStyles(marker, {
    position: "fixed",
    right: "12px",
    bottom: "12px",
    zIndex: "9999",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "rgba(255,255,255,.94)",
    color: "#374151",
    fontSize: "11px",
    fontWeight: "700",
    padding: "6px 10px",
    boxShadow: "0 4px 16px rgba(0,0,0,.08)"
  });
}

function renderFallbackRow(row, columnCount, message) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${escapeHtml(row?.employee_id || row?.store_no || row?.corporation_no || row?.appId || "")}</td>
    <td colspan="${Math.max(1, columnCount - 1)}">${escapeHtml(message || "この行の表示を確認しています。")}</td>`;
  return tr;
}

function renderRowsSafely(rows, renderer, columnCount) {
  return rows.map((row) => {
    try {
      return renderer(row);
    } catch (error) {
      console.warn("master admin row render fallback", { code: error?.name || "row_render_error" });
      return renderFallbackRow(row, columnCount, "一部項目の表示形式を確認しています。");
    }
  });
}

function appendRecoveryCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  row.append(cell);
}

function getRecoveryAffiliation(employee) {
  return employee?.store_name || employee?.department_name || employee?.corporation_name || "";
}

function getRecoveryEmail(employee) {
  return employee?.email || employee?.contact_email || employee?.work_email || "任意未入力";
}

function getRecoveryLoginStatus(employee) {
  const credential = employee?.credential || employee?.login_credential || {};
  if (credential?.login_enabled === false || employee?.login_enabled === false) return "停止";
  if (credential?.pin_set || credential?.has_pin || employee?.pin_set || employee?.has_pin) return "利用可";
  return "PIN未設定";
}

function getRecoveryNotificationStatus(employee) {
  const destination = employee?.notification_destination || employee?.line_works_destination || {};
  if (
    destination?.has_value ||
    destination?.hasValue ||
    destination?.masked_value ||
    destination?.maskedValue ||
    employee?.line_works_user_id ||
    employee?.lineworks_user_id ||
    employee?.line_works_channel_id
  ) {
    return "設定済み";
  }
  return "未設定";
}

function getRecoveryEmployeeStatus(employee) {
  const value = String(employee?.employment_status || employee?.status || "").toLowerCase();
  if (employee?.is_active === false || value.includes("retired") || value.includes("inactive") || value.includes("退職")) return "退職";
  if (value.includes("leave") || value.includes("休職")) return "休職";
  return "現職";
}

function buildRecoveryEmployeeRow(employee) {
  const tr = document.createElement("tr");
  tr.className = employee?.id === state.selectedId ? "selected" : "";
  appendRecoveryCell(tr, employee?.employee_id || "");
  appendRecoveryCell(tr, employee?.full_name || "");
  appendRecoveryCell(tr, getRecoveryAffiliation(employee));
  appendRecoveryCell(tr, employee?.position_name || employee?.source_position_name || "");
  appendRecoveryCell(tr, getRecoveryEmail(employee));
  appendRecoveryCell(tr, getRecoveryLoginStatus(employee));
  appendRecoveryCell(tr, getRecoveryNotificationStatus(employee));
  appendRecoveryCell(tr, getRecoveryEmployeeStatus(employee));
  tr.addEventListener("click", () => {
    state.selectedId = employee?.id || "";
    render();
  });
  return tr;
}

function maskEmailForSafeView(value) {
  const email = String(value || "").trim();
  if (!email || email === "任意未入力") return "任意未入力";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "設定あり";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

function getSafeEmployeeRows() {
  const query = normalizeSearch(state.safeSearch || "");
  return (state.employees || []).filter((employee) => {
    if (state.employeeStatus === "active" && !isCurrentEmployee(employee)) return false;
    if (state.employeeStatus === "leave" && !isLeaveEmployee(employee)) return false;
    if (state.employeeStatus === "inactive" && !isRetiredEmployee(employee)) return false;
    if (state.employeeStatus === "missing" && !getEmployeeIssueValue(employee)) return false;
    if (!query) return true;
    const haystack = normalizeSearch([
      employee?.employee_id,
      employee?.full_name,
      employee?.store_name,
      employee?.department_name,
      employee?.position_name,
      employee?.email
    ].filter(Boolean).join(" "));
    return haystack.includes(query);
  });
}

function getSafeStatusLabel(employee) {
  const status = getRecoveryEmployeeStatus(employee);
  return status || "現職";
}

function appendSafeDetailRow(parent, label, value) {
  const row = document.createElement("div");
  row.className = "safe-master-detail-row";
  const term = document.createElement("span");
  term.className = "safe-master-detail-label";
  term.textContent = label;
  const detail = document.createElement("strong");
  detail.className = "safe-master-detail-value";
  detail.textContent = value == null || value === "" ? "未設定" : String(value);
  row.append(term, detail);
  parent.append(row);
  return row;
}

function appendSafeDetailSection(parent, titleText, rows) {
  const section = document.createElement("section");
  section.className = "safe-master-detail-section";
  const title = document.createElement("h4");
  title.className = "safe-master-detail-section-title";
  title.textContent = titleText;
  const grid = document.createElement("div");
  grid.className = "safe-master-detail-grid";
  rows.forEach(([label, value]) => appendSafeDetailRow(grid, label, value));
  section.append(title, grid);
  parent.append(section);
  return section;
}

function createSafeCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  row.append(cell);
  return cell;
}

function renderSafeMasterAdminView() {
  if (state.view !== "employees" && state.view !== "firebase") {
    document.querySelector("#master-admin-safe-view")?.remove();
    return;
  }

  installRuntimeLayoutStyles();

  let safeView = document.querySelector("#master-admin-safe-view");
  if (!safeView) {
    safeView = document.createElement("section");
    safeView.id = "master-admin-safe-view";
    safeView.setAttribute("aria-label", "社員マスタ復旧ビュー");
    document.body.append(safeView);
  }

  const rows = getSafeEmployeeRows();
  const selected = (state.employees || []).find((employee) => employee?.id === state.selectedId) || rows[0] || null;

  safeView.replaceChildren();

  const shell = document.createElement("div");
  shell.className = "safe-master-shell";

  const listCard = document.createElement("section");
  listCard.className = "safe-master-card";

  const header = document.createElement("div");
  header.className = "safe-master-header";
  const title = document.createElement("div");
  title.className = "safe-master-title";
  const titleStrong = document.createElement("strong");
  titleStrong.textContent = "社員マスタ";
  const titleNote = document.createElement("span");
  titleNote.className = "safe-master-note";
  titleNote.textContent = "P0復旧ビューです。社員一覧・検索・選択・確認表示を優先して復旧しています。";
  title.append(titleStrong, titleNote);

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "button button-secondary";
  refreshButton.textContent = "再読み込み";
  refreshButton.addEventListener("click", () => elements.refresh?.click());
  header.append(title, refreshButton);

  const controls = document.createElement("div");
  controls.className = "safe-master-controls";
  const search = document.createElement("input");
  search.className = "safe-master-search";
  search.type = "search";
  search.placeholder = "氏名・社員番号・店舗名で検索";
  search.value = state.safeSearch || "";
  search.addEventListener("input", () => {
    state.safeSearch = search.value;
    renderSafeMasterAdminView();
  });
  controls.append(search);

  [
    ["active", "現職"],
    ["missing", "未設定あり"],
    ["leave", "休職"],
    ["inactive", "退職者"],
    ["all", "全員"]
  ].forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.employeeStatus === value ? " active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      state.employeeStatus = value;
      renderSafeMasterAdminView();
    });
    controls.append(button);
  });

  const count = document.createElement("div");
  count.className = "result-count";
  count.textContent = `${rows.length}件`;

  const tableWrap = document.createElement("div");
  tableWrap.className = "safe-master-table-wrap";
  const table = document.createElement("table");
  table.className = "safe-master-table";
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>社員番号</th>
      <th>氏名</th>
      <th>所属</th>
      <th>役職</th>
      <th>メール</th>
      <th>ログイン</th>
      <th>通知先</th>
      <th>状態</th>
    </tr>`;
  const tbody = document.createElement("tbody");

  rows.forEach((employee) => {
    const tr = document.createElement("tr");
    if (employee?.id === state.selectedId) tr.classList.add("selected");
    createSafeCell(tr, employee?.employee_id || "");
    createSafeCell(tr, employee?.full_name || "");
    createSafeCell(tr, getRecoveryAffiliation(employee));
    createSafeCell(tr, employee?.position_name || employee?.source_position_name || "");
    createSafeCell(tr, maskEmailForSafeView(getRecoveryEmail(employee)));
    createSafeCell(tr, getRecoveryLoginStatus(employee));
    createSafeCell(tr, getRecoveryNotificationStatus(employee));
    const statusCell = createSafeCell(tr, "");
    const pill = document.createElement("span");
    pill.className = "safe-master-pill";
    pill.textContent = getSafeStatusLabel(employee);
    statusCell.append(pill);
    tr.addEventListener("click", () => {
      state.selectedId = employee?.id || "";
      renderSafeMasterAdminView();
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  tableWrap.append(table);
  listCard.append(header, controls, count, tableWrap);

  const detailCard = document.createElement("aside");
  detailCard.className = "safe-master-card safe-master-detail";
  if (selected) {
    const detailTitle = document.createElement("h3");
    detailTitle.textContent = selected.full_name || "社員詳細";
    const meta = document.createElement("p");
    meta.className = "safe-master-note";
    meta.textContent = [
      selected.employee_id ? `社員番号: ${selected.employee_id}` : "",
      getRecoveryAffiliation(selected),
      selected.position_name || selected.source_position_name || "",
      getSafeStatusLabel(selected)
    ].filter(Boolean).join(" / ");

    const details = document.createElement("div");
    details.className = "safe-master-detail-sections";
    appendSafeDetailSection(details, "基本情報", [
      ["社員番号", selected.employee_id || ""],
      ["所属", getRecoveryAffiliation(selected)],
      ["役職", selected.position_name || selected.source_position_name || ""],
      ["雇用形態", selected.employment_type || selected.job_type_name || ""],
      ["状態", getSafeStatusLabel(selected)]
    ]);
    appendSafeDetailSection(details, "HUBログイン", [
      ["メール", maskEmailForSafeView(getRecoveryEmail(selected))],
      ["ログイン", getRecoveryLoginStatus(selected)],
      ["Firebase", selected.firebase_uid || selected.firebaseUid ? "連携済み" : "未連携"]
    ]);
    appendSafeDetailSection(details, "通知", [
      ["LINE WORKS", getRecoveryNotificationStatus(selected)],
      ["用途", "社員個人宛の通知先"],
      ["表示", "実値は伏せています"]
    ]);

    const note = document.createElement("p");
    note.className = "safe-master-note";
    note.textContent = "現在は復旧中のため、詳細は確認表示のみです。保存操作は通常詳細フォーム復旧後に再開します。";
    detailCard.append(detailTitle, meta, details, note);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-detail";
    empty.textContent = "左の一覧から編集対象を選んでください。";
    detailCard.append(empty);
  }

  shell.append(listCard, detailCard);
  safeView.append(shell);
}

function forceRecoveryEmployeeTable(rows) {
  if (state.view !== "employees" && state.view !== "firebase") return;
  if (!Array.isArray(rows) || !rows.length) return;
  const tableWrap = document.querySelector(".table-wrap");
  const table = tableWrap?.querySelector("table") || document.querySelector("table");
  if (!table) return;
  let thead = table.querySelector("thead");
  let tbody = table.querySelector("tbody");
  if (!thead) {
    thead = document.createElement("thead");
    table.prepend(thead);
  }
  if (!tbody) {
    tbody = document.createElement("tbody");
    table.append(tbody);
  }
  thead.innerHTML = `
    <tr>
      <th>社員番号</th>
      <th>氏名</th>
      <th>所属</th>
      <th>役職</th>
      <th>メール</th>
      <th>ログイン</th>
      <th>通知先</th>
      <th>状態</th>
    </tr>`;
  tbody.replaceChildren(...rows.map((row) => {
    try {
      return buildRecoveryEmployeeRow(row);
    } catch {
      return renderFallbackRow(row, 8, "この行の表示を確認しています。");
    }
  }));
  setStyles(tableWrap, {
    display: "block",
    overflow: "auto",
    maxHeight: "calc(100vh - 230px)",
    marginTop: "12px"
  });
  setStyles(table, {
    display: "table",
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px"
  });
  setStyles(thead, { display: "table-header-group" });
  setStyles(tbody, { display: "table-row-group" });
  tbody.querySelectorAll("tr").forEach((row) => setStyles(row, { display: "table-row" }));
  table.querySelectorAll("th, td").forEach((cell) => {
    setStyles(cell, {
      display: "table-cell",
      borderBottom: "1px solid #e5e7eb",
      padding: "11px 10px",
      textAlign: "left",
      whiteSpace: "nowrap",
      verticalAlign: "middle"
    });
  });
}

function normalizeEmploymentType(value) {
  const normalized = String(value || "").trim();
  return EMPLOYMENT_TYPE_ALIASES[normalized] || normalized;
}

function normalizeEmploymentTypeForForm(value) {
  const normalized = normalizeEmploymentType(value);
  return EMPLOYMENT_TYPE_OPTIONS.some(([optionValue]) => optionValue === normalized) ? normalized : "";
}

function normalizeEmploymentStatus(value) {
  const normalized = String(value || "").trim();
  if (["産休", "育休", "産休・育休", "傷病", "介護"].includes(normalized)) return "休職";
  return EMPLOYMENT_STATUS_OPTIONS.some(([optionValue]) => optionValue === normalized) ? normalized : "";
}

function normalizeLineWorksUserIdInput(value) {
  return String(value || "").trim();
}

function getLineWorksUserIdValidationError(value) {
  const normalized = normalizeLineWorksUserIdInput(value);
  if (!normalized) return "User IDを入力してください。";
  if (LINE_WORKS_NUMERIC_ONLY_PATTERN.test(normalized)) {
    return "数字だけのIDはチャンネルIDです。User IDを入力してください。";
  }
  return "";
}

function normalizeLeaveType(value) {
  const normalized = String(value || "").trim();
  if (normalized === "休職") return "";
  if (normalized === "産休・育休") return "";
  return LEAVE_TYPE_OPTIONS.some(([optionValue]) => optionValue === normalized) ? normalized : "";
}

function getErrorMessage(error) {
  const message = error?.message || "処理に失敗しました。";
  const parts = [
    message,
    error?.code && error.code !== "INVALID_REQUEST" ? `code: ${error.code}` : "",
    error?.stage ? `stage: ${error.stage}` : ""
  ].filter(Boolean);
  return parts.join(" / ");
}

function showMode(mode) {
  elements.authPanel.hidden = mode !== "auth";
  elements.loadingPanel.hidden = mode !== "loading";
  elements.adminApp.hidden = mode !== "app";
  elements.signOut.hidden = mode === "auth";
  setStyles(elements.authPanel, { display: mode === "auth" ? "grid" : "none" });
  setStyles(elements.loadingPanel, { display: mode === "loading" ? "grid" : "none" });
  setStyles(elements.adminApp, { display: mode === "app" ? "block" : "none" });
  setStyles(elements.signOut, { display: mode === "auth" ? "none" : "inline-flex" });
  if (mode !== "app") {
    document.querySelector("#master-admin-safe-view")?.remove();
  }
  applyStableLayoutStyles();
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = String(value ?? "");
  return span.innerHTML;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function formatActive(isActive) {
  return `<span class="status-pill${isActive ? "" : " inactive"}">${isActive ? "有効" : "無効"}</span>`;
}

function formatEmployeeStatus(employee) {
  if (isLeaveEmployee(employee)) return `<span class="status-pill leave">休職</span>`;
  if (isRetiredEmployee(employee)) return `<span class="status-pill inactive">退職</span>`;
  return `<span class="status-pill">現職</span>`;
}

function getEmployeeStatusLabel(employee) {
  if (isLeaveEmployee(employee)) return "休職";
  if (isRetiredEmployee(employee)) return "退職";
  return "現職";
}

function setBootstrapData(data) {
  state.employees = data.employees || [];
  state.corporations = data.corporations || [];
  state.stores = data.stores || [];
  state.portalApps = data.portalApps || [];
  state.permissions = data.permissions || { canView: false, canEdit: false, roleKeys: [] };
  state.masters = {
    corporations: data.corporations || [],
    businessUnits: data.businessUnits || [],
    departments: data.departments || [],
    positions: data.positions || [],
    jobTypes: data.jobTypes || []
  };
}

async function loadData() {
  showMode("loading");
  let response;
  try {
    response = await withTimeout(
      callApiAction("masterBootstrap"),
      MASTER_ADMIN_BOOTSTRAP_TIMEOUT_MS,
      "マスタ情報の読み込みに時間がかかっています。HUBから開き直すか、再ログインしてください。"
    );
  } catch (error) {
    console.warn("Master admin bootstrap fallback started", {
      code: error.code || "BOOTSTRAP_STOPPED",
      stage: error.stage || ""
    });
    response = await loadDataFallback(error);
  }
  setBootstrapData(response.data || {});
  state.logs = [];
  state.logsLoaded = false;
  state.selectedId = "";
  showMode("app");
  render();
  requestAnimationFrame(() => {
    try {
      const rows = getRows();
      if ((state.view === "employees" || state.view === "firebase") && rows.length && !elements.tableBody.children.length) {
        forceRecoveryEmployeeTable(rows);
      }
      applyStableLayoutStyles();
    } catch {
      forceRecoveryEmployeeTable(state.employees || []);
    }
  });
}

async function safeFallbackAction(action) {
  try {
    return await withTimeout(
      callApiAction(action),
      MASTER_ADMIN_FALLBACK_TIMEOUT_MS,
      "マスタ情報の一部読み込みに時間がかかっています。"
    );
  } catch (error) {
    console.warn("Master admin fallback action stopped safely", {
      action,
      code: error.code || "FALLBACK_ACTION_STOPPED",
      stage: error.stage || ""
    });
    return null;
  }
}

async function loadDataFallback(primaryError) {
  const [employeesResponse, storesResponse, corporationsResponse, appsResponse] = await Promise.all([
    safeFallbackAction("masterListEmployees"),
    safeFallbackAction("masterListStores"),
    safeFallbackAction("masterListCorporations"),
    safeFallbackAction("masterListPortalApps")
  ]);
  const employees = Array.isArray(employeesResponse?.employees) ? employeesResponse.employees : [];
  if (!employees.length) throw primaryError;
  showToast("社員一覧を復旧表示しました。編集前に再読み込みしてください。");
  return {
    data: {
      permissions: { canView: true, canEdit: false, roleKeys: [] },
      employees,
      stores: Array.isArray(storesResponse?.stores) ? storesResponse.stores : [],
      corporations: Array.isArray(corporationsResponse?.corporations) ? corporationsResponse.corporations : [],
      portalApps: Array.isArray(appsResponse?.portalApps) ? appsResponse.portalApps : [],
      logs: [],
      businessUnits: [],
      departments: [],
      positions: [],
      jobTypes: []
    }
  };
}

function getRows() {
  const query = normalizeSearch(elements.search.value);
  let rows = getStoresByStatus();
  if (state.view === "employees") rows = getEmployeesByStatus();
  if (state.view === "corporations") rows = getCorporationsByStatus();
  if (state.view === "apps") rows = getPortalAppsByStatus();
  if (state.view === "permissions") rows = getAppPermissionRows();
  if (state.view === "firebase") rows = state.employees.filter((employee) => isCurrentEmployee(employee) && !employee.firebase_uid);
  if (state.view === "logs") rows = state.logs;
  if (state.view === "readiness") rows = getHubReadinessItems();
  rows = applyEmployeeIssueFilter(rows);
  rows = getSortedRows(rows);
  if (!query) return rows;
  return rows.filter((row) => normalizeSearch(getSearchText(row)).includes(query));
}

function applyEmployeeIssueFilter(rows) {
  if (state.view !== "employees" || !state.employeeIssueFilter) return rows;
  return rows.filter((employee) => getEmployeeIssues(employee).includes(state.employeeIssueFilter));
}

function setEmployeeIssueFilter(issue) {
  state.view = "employees";
  state.employeeStatus = "all";
  state.employeeIssueFilter = issue;
  state.selectedId = "";
  elements.search.value = "";
  render();
}

function getSortedRows(rows) {
  if (state.view === "employees" || state.view === "firebase") {
    return rows.slice().sort(compareEmployees);
  }
  if (state.view === "stores") {
    return rows.slice().sort(compareStores);
  }
  if (state.view === "corporations") {
    return rows.slice().sort(compareCorporations);
  }
  if (state.view === "apps") {
    return rows.slice().sort(comparePortalApps);
  }
  if (state.view === "readiness") {
    return rows.slice().sort(compareReadinessItems);
  }
  return rows;
}

function compareReadinessItems(left, right) {
  const leftRank = getReadinessStatusRank(left.status);
  const rightRank = getReadinessStatusRank(right.status);
  if (leftRank !== rightRank) return leftRank - rightRank;
  const leftCount = getReadinessCountNumber(left.count);
  const rightCount = getReadinessCountNumber(right.count);
  if (leftCount !== rightCount) return rightCount - leftCount;
  return String(left.label || "").localeCompare(String(right.label || ""), "ja");
}

function getReadinessStatusRank(status) {
  if (status === "要確認") return 0;
  if (status === "準備中") return 1;
  if (status === "OK") return 2;
  return 3;
}

function getReadinessCountNumber(count) {
  const matched = String(count || "").match(/\d+/);
  return matched ? Number(matched[0]) : 0;
}

function compareEmployees(left, right) {
  const leftKey = getEmployeeSortKey(left.employee_id);
  const rightKey = getEmployeeSortKey(right.employee_id);
  if (leftKey.group !== rightKey.group) return leftKey.group - rightKey.group;
  if (leftKey.number !== rightKey.number) return leftKey.number - rightKey.number;
  return String(left.employee_id || "").localeCompare(String(right.employee_id || ""), "ja", { numeric: true });
}

function getEmployeeSortKey(employeeId) {
  const value = String(employeeId || "").trim();
  const numeric = value.match(/^\d+$/);
  if (numeric) return { group: 0, number: Number(value) };
  const legacy = value.match(/^LEGACY-(\d+)$/i);
  if (legacy) return { group: 2, number: Number(legacy[1]) };
  return { group: 1, number: Number.MAX_SAFE_INTEGER };
}

function compareStores(left, right) {
  return String(left.store_no || "").localeCompare(String(right.store_no || ""), "ja", { numeric: true });
}

function compareCorporations(left, right) {
  return String(left.corporation_no || "").localeCompare(String(right.corporation_no || ""), "ja", { numeric: true });
}

function comparePortalApps(left, right) {
  const leftPriority = Number(left.priority || 999);
  const rightPriority = Number(right.priority || 999);
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  return String(left.appName || "").localeCompare(String(right.appName || ""), "ja", { numeric: true });
}

function getSearchText(row) {
  const values = Object.entries(row)
    .filter(([, value]) => value === null || typeof value !== "object")
    .map(([, value]) => value);
  if ("employee_id" in row) {
    values.push(...getEmployeeIssues(row), formatEmployeeAffiliation(row), getEmployeeStatusLabel(row), row.job_type_name);
    if (isCurrentEmployee(row) && !row.firebase_uid) values.push("Firebase未連携", "Firebase");
    if (Array.isArray(row.role_keys)) {
      values.push(...row.role_keys, ...row.role_keys.map(formatRoleLabel));
    }
  }
  if ("store_no" in row) {
    values.push(...getStoreIssues(row), row.is_active ? "有効" : "無効");
  }
  if ("corporation_no" in row) {
    const profile = row.business_profile || {};
    values.push(
      profile.formal_corporation_name,
      profile.corporation_number,
      profile.invoice_registration_number,
      profile.accounting_category,
      profile.operating_status,
      row.is_active ? "有効" : "無効"
    );
  }
  if ("appId" in row) {
    values.push(
      row.appId,
      row.appName,
      row.description,
      row.url,
      row.category,
      row.icon,
      row.isActive === false ? "inactive" : "active",
      row.isFeatured ? "featured" : "",
      ...(row.allowedTags || []),
      ...(row.targetDepartment || []),
      ...(row.targetPosition || [])
    );
  }
  if ("permission_key" in row) {
    values.push(row.appName, row.roleKey, row.roleLabel, row.description, row.count, row.activeCount);
  }
  if (Array.isArray(row.store_assignments)) {
    values.push(...row.store_assignments.flatMap((assignment) => [
      assignment.store_name,
      assignment.store_code,
      assignment.assignment_type,
      assignment.assignment_order
    ]));
  }
  if (row.login_credential) {
    values.push(
      row.login_credential.login_email,
      row.login_credential.pin_set ? "PIN設定済み" : "PIN未設定",
      row.login_credential.login_enabled ? "ログイン可" : "ログイン停止",
      row.login_credential.locked ? "ロック中" : "",
      row.login_credential.must_change_pin ? "初回変更必須" : ""
    );
  }
  if ("employee_id" in row) {
    values.push(formatEmployeeLineWorksDestinationStatus(row));
  }
  if (row.change_payload && typeof row.change_payload === "object") {
    values.push(row.change_summary, row.action_type, row.target_name, row.table_name);
  }
  if ("readiness_key" in row) {
    values.push(row.label, row.status, row.detail, row.nextAction);
  }
  return values.join(" ");
}

function getEmployeesByStatus() {
  if (state.employeeStatus === "all") return state.employees;
  if (state.employeeStatus === "missing") {
    return state.employees.filter((employee) => isCurrentEmployee(employee) && getEmployeeIssues(employee).length);
  }
  if (state.employeeStatus === "leave") {
    return state.employees.filter((employee) => isLeaveEmployee(employee));
  }
  if (state.employeeStatus === "inactive") {
    return state.employees.filter((employee) => isRetiredEmployee(employee));
  }
  return state.employees.filter((employee) => isCurrentEmployee(employee));
}

function getEmployeeIssues(employee) {
  if (!isCurrentEmployee(employee)) return [];
  const issues = [];
  const hasLocation = Boolean(employee.store_id || employee.department_id || employee.store_name || employee.department_name || employee.source_assigned_location);
  if (!employee.corporation_id) issues.push("法人");
  if (!hasLocation) issues.push("所属");
  if (!employee.position_id && !employee.source_position_name) issues.push("役職");
  if (state.masters.jobTypes.length && !employee.job_type_id && !employee.job_type_name) issues.push("職種");
  if (!getCommonRoleKeys(employee).length) issues.push("共通ロール");
  if (!getEmployeeCredential(employee).pin_set) issues.push("PIN");
  if (!String(employee.employment_type || "").trim()) issues.push("雇用形態");
  if (!String(employee.employment_status || "").trim()) issues.push("現職/休職/退職");
  return issues;
}

function isAppRoleKey(roleKey) {
  const key = String(roleKey || "");
  return APP_ROLE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function getCommonRoleKeys(employee) {
  return (Array.isArray(employee?.role_keys) ? employee.role_keys : [])
    .filter((roleKey) => roleKey && !isAppRoleKey(roleKey));
}

function getIdeaLinkRoleKeys(employee) {
  return (Array.isArray(employee?.role_keys) ? employee.role_keys : [])
    .filter((roleKey) => IDEA_LINK_ROLE_KEYS.includes(roleKey));
}

function getEmployeeCredential(employee) {
  return employee?.login_credential || {
    login_email: employee?.email || "",
    pin_set: false,
    login_enabled: true,
    must_change_pin: false,
    failed_attempts: 0,
    locked_until: "",
    locked: false,
    last_login_at: ""
  };
}

function getEmployeeLineWorksDestination(employee) {
  const destination = employee?.line_works_destination
    || employee?.lineWorksDestination
    || employee?.notification_destination
    || {};
  const rawValue = destination.lineWorksRecipientId
    || destination.lineWorksTargetId
    || destination.line_works_recipient_id
    || destination.line_works_target_id
    || destination.line_works_user_id
    || destination.channel_id
    || employee?.lineWorksRecipientId
    || employee?.line_works_recipient_id
    || "";
  const maskedValue = destination.lineWorksRecipientIdMasked
    || destination.lineWorksTargetIdMasked
    || destination.line_works_recipient_id_masked
    || destination.line_works_target_id_masked
    || "";
  const displayName = destination.displayName || destination.display_name || destination.channel_name || "";
  const configured = destination.configured ?? Boolean(rawValue || maskedValue);
  const isActive = destination.isActive ?? destination.is_active ?? configured;
  return {
    id: destination.id || destination.destination_id || "",
    value: String(rawValue || maskedValue || "").trim(),
    maskedValue: String(maskedValue || "").trim(),
    displayName: String(displayName || "").trim(),
    configured: Boolean(configured),
    isActive: Boolean(isActive)
  };
}

function hasEmployeeLineWorksDestination(employee) {
  const destination = getEmployeeLineWorksDestination(employee);
  return Boolean((destination.configured || destination.value) && destination.isActive);
}

function maskLineWorksRecipientId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return "設定済み";
  return `${text.slice(0, 4)}${"*".repeat(Math.min(8, Math.max(4, text.length - 8)))}${text.slice(-4)}`;
}

function formatEmployeeLineWorksDestinationStatus(employee) {
  return hasEmployeeLineWorksDestination(employee) ? "LINE WORKS個人通知先設定済み" : "LINE WORKS個人通知先未設定";
}

function formatEmployeeLineWorksDestination(employee) {
  const destination = getEmployeeLineWorksDestination(employee);
  if (!destination.value || !destination.isActive) return `<span class="status-muted">未設定</span>`;
  return `<span class="status-pill success" title="実値は一覧に表示しません">設定済み</span>`;
}

function getEmployeeContactEmail(employee) {
  const masterEmail = String(employee?.email || "").trim();
  if (masterEmail) return masterEmail;
  return String(getEmployeeCredential(employee).login_email || "").trim();
}

function hasEmployeeContactEmail(employee) {
  return Boolean(getEmployeeContactEmail(employee));
}

function getStoresByStatus() {
  if (state.view !== "stores") return state.stores;
  if (state.storeStatus === "all") return state.stores;
  if (state.storeStatus === "missing") return state.stores.filter((store) => store.is_active && getStoreIssues(store).length);
  if (state.storeStatus === "inactive") return state.stores.filter((store) => !store.is_active);
  return state.stores.filter((store) => store.is_active);
}

function getCorporationsByStatus() {
  if (state.corporationStatus === "all") return state.corporations;
  if (state.corporationStatus === "inactive") return state.corporations.filter((corporation) => corporation.is_active === false);
  return state.corporations.filter((corporation) => corporation.is_active !== false);
}

function getPortalAppsByStatus() {
  if (state.appStatus === "all") return state.portalApps;
  if (state.appStatus === "featured") return state.portalApps.filter((app) => app.isFeatured);
  if (state.appStatus === "inactive") return state.portalApps.filter((app) => app.isActive === false);
  return state.portalApps.filter((app) => app.isActive !== false);
}

function getAppPermissionRows() {
  return APP_ROLE_GROUPS.flatMap((group) => group.roleKeys.map((roleKey) => {
    const employees = getEmployeesWithRoleKey(roleKey);
    const activeEmployees = employees.filter(isCurrentEmployee);
    return {
      permission_key: `${group.appKey}:${roleKey}`,
      appKey: group.appKey,
      appName: group.appName,
      description: group.description,
      roleKey,
      roleLabel: formatRoleLabel(roleKey),
      count: employees.length,
      activeCount: activeEmployees.length
    };
  }));
}

function getEmployeesWithRoleKey(roleKey) {
  return state.employees.filter((employee) => (
    Array.isArray(employee.role_keys) && employee.role_keys.includes(roleKey)
  ));
}

function getStoreIssues(store) {
  if (!store.is_active) return [];
  const issues = [];
  if (!store.corporation_id) issues.push("法人");
  if (!store.business_unit_id) issues.push("事業部門");
  if (!String(store.area || "").trim()) issues.push("エリア");
  if (!String(store.store_type || "").trim()) issues.push("店舗種別");
  return issues;
}

function getUniqueValues(rows, key) {
  return Array.from(new Set(rows
    .map((row) => String(row[key] || "").trim())
    .filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "ja"));
}

function getEmployeeStatusCounts() {
  return {
    active: state.employees.filter((employee) => isCurrentEmployee(employee)).length,
    missing: state.employees.filter((employee) => isCurrentEmployee(employee) && getEmployeeIssues(employee).length).length,
    leave: state.employees.filter((employee) => isLeaveEmployee(employee)).length,
    inactive: state.employees.filter((employee) => isRetiredEmployee(employee)).length,
    all: state.employees.length
  };
}

function getStoreStatusCounts() {
  return {
    active: state.stores.filter((store) => store.is_active).length,
    missing: state.stores.filter((store) => store.is_active && getStoreIssues(store).length).length,
    inactive: state.stores.filter((store) => !store.is_active).length,
    all: state.stores.length
  };
}

function getCorporationStatusCounts() {
  return {
    active: state.corporations.filter((corporation) => corporation.is_active !== false).length,
    inactive: state.corporations.filter((corporation) => corporation.is_active === false).length,
    all: state.corporations.length
  };
}

function getPortalAppStatusCounts() {
  return {
    active: state.portalApps.filter((app) => app.isActive !== false).length,
    featured: state.portalApps.filter((app) => app.isFeatured).length,
    inactive: state.portalApps.filter((app) => app.isActive === false).length,
    all: state.portalApps.length
  };
}

function setButtonCount(button, count) {
  if (!button.dataset.baseLabel) {
    button.dataset.baseLabel = button.textContent.trim();
  }
  button.replaceChildren(document.createTextNode(button.dataset.baseLabel));
  if (count === "" || count === null || count === undefined) return;
  const badge = document.createElement("span");
  badge.className = "button-count";
  badge.textContent = String(count);
  button.appendChild(badge);
}

function updateNavigationCounts() {
  const employeeCounts = getEmployeeStatusCounts();
  const corporationCounts = getCorporationStatusCounts();
  const storeCounts = getStoreStatusCounts();
  const appCounts = getPortalAppStatusCounts();
  const viewCounts = {
    employees: state.employees.length,
    corporations: state.corporations.length,
    stores: state.stores.length,
    apps: state.portalApps.length,
    permissions: getAppPermissionRows().reduce((total, row) => total + row.activeCount, 0),
    firebase: state.employees.filter((employee) => isCurrentEmployee(employee) && !employee.firebase_uid).length,
    logs: state.logsLoaded ? state.logs.length : "",
    readiness: getHubReadinessItems().filter((item) => item.status !== "OK").length
  };
  document.querySelectorAll("[data-view]").forEach((button) => {
    setButtonCount(button, viewCounts[button.dataset.view]);
  });
  document.querySelectorAll("[data-employee-status]").forEach((button) => {
    setButtonCount(button, employeeCounts[button.dataset.employeeStatus]);
  });
  document.querySelectorAll("[data-store-status]").forEach((button) => {
    setButtonCount(button, storeCounts[button.dataset.storeStatus]);
  });
  document.querySelectorAll("[data-corporation-status]").forEach((button) => {
    setButtonCount(button, corporationCounts[button.dataset.corporationStatus]);
  });
  document.querySelectorAll("[data-app-status]").forEach((button) => {
    setButtonCount(button, appCounts[button.dataset.appStatus]);
  });
}

function isCurrentEmployee(employee) {
  return employee.is_active && !isRetiredEmployee(employee) && !isLeaveEmployee(employee);
}

function isLeaveEmployee(employee) {
  const status = String(employee.employment_status || "");
  return /休職|産休|育休/.test(status);
}

function isRetiredEmployee(employee) {
  const status = String(employee.employment_status || "");
  return /退職/.test(status) || (!employee.is_active && !isLeaveEmployee(employee));
}

function getStaffRoleBlockedReason(employee) {
  if (!employee?.id) return "社員情報を確認できません。";
  if (employee.is_active === false) return "有効をONにしてください。";
  if (isRetiredEmployee(employee)) return "退職者にはstaffを付与できません。復帰する場合は就労ステータスを現職にしてください。";
  if (isLeaveEmployee(employee)) return "休職・産休・育休中はstaff付与の対象外です。復帰時は就労ステータスを現職にしてください。";
  return "";
}

function render() {
  elements.adminApp.dataset.view = state.view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  elements.employeeStatusFilter.hidden = state.view !== "employees";
  elements.corporationStatusFilter.hidden = state.view !== "corporations";
  elements.storeStatusFilter.hidden = state.view !== "stores";
  elements.appStatusFilter.hidden = state.view !== "apps";
  document.querySelectorAll("[data-employee-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.employeeStatus === state.employeeStatus);
  });
  document.querySelectorAll("[data-store-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.storeStatus === state.storeStatus);
  });
  document.querySelectorAll("[data-corporation-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.corporationStatus === state.corporationStatus);
  });
  document.querySelectorAll("[data-app-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.appStatus === state.appStatus);
  });
  elements.viewTitle.textContent = {
    employees: "社員マスタ",
    stores: "店舗マスタ",
    corporations: "法人マスタ",
    apps: "アプリ管理",
    permissions: "アプリ別権限",
    firebase: "Firebase未連携",
    logs: "変更履歴",
    readiness: "HUB連携準備"
  }[state.view];
  renderTable();
  try {
    updateNavigationCounts();
  } catch (error) {
    console.warn("master admin navigation count fallback", { code: error?.name || "navigation_count_error" });
  }
  try {
    elements.addEmployee.hidden = state.view !== "employees" || !state.permissions.canEdit;
    elements.addCorporation.hidden = state.view !== "corporations" || !state.permissions.canEdit;
    elements.employeeCsvTools.hidden = state.view !== "employees";
    elements.addPortalApp.hidden = state.view !== "apps" || !state.permissions.canEdit;
  } catch (error) {
    console.warn("master admin action button fallback", { code: error?.name || "action_button_error" });
  }
  try {
    renderDetail();
  } catch (error) {
    console.warn("master admin detail fallback", { code: error?.name || "detail_render_error" });
    elements.detailPanel.innerHTML = `<div class="empty-detail">左の一覧から編集対象を選んでください。</div>`;
  }
  applyStableLayoutStyles();
  renderSafeMasterAdminView();
}

function renderTable() {
  let rows = [];
  try {
    rows = getRows();
  } catch (error) {
    console.warn("master admin row collection fallback", { code: error?.name || "row_collection_error" });
    rows = state.view === "employees" || state.view === "firebase" ? state.employees || [] : [];
  }
  try {
    renderQualitySummary();
  } catch (error) {
    console.warn("master admin summary fallback", { code: error?.name || "summary_render_error" });
    elements.qualitySummary.replaceChildren();
  }
  elements.resultCount.textContent = `${rows.length}件`;
  if (state.view === "employees" || state.view === "firebase") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>社員番号</th>
        <th>氏名</th>
        <th>所属</th>
        <th>役職</th>
        <th>メール</th>
        <th>ログイン</th>
        <th>通知先</th>
        <th>未設定</th>
        <th>状態</th>
      </tr>`;
    try {
      elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderEmployeeRow, 9));
    } catch (error) {
      console.warn("master admin employee table fallback", { code: error?.name || "employee_table_error" });
      elements.tableBody.replaceChildren();
    }
    if (rows.length && !elements.tableBody.children.length) {
      forceRecoveryEmployeeTable(rows);
    } else if (rows.length) {
      forceRecoveryEmployeeTable(rows);
    }
    applyStableLayoutStyles();
    return;
  }

  if (state.view === "logs") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>日時</th>
        <th>対象</th>
        <th>変更者</th>
        <th>変更内容</th>
      </tr>`;
    elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderLogRow, 4));
    applyStableLayoutStyles();
    return;
  }

  if (state.view === "corporations") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>法人No</th>
        <th>法人名</th>
        <th>正式名</th>
        <th>決算月</th>
        <th>状況</th>
        <th>有効</th>
      </tr>`;
    elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderCorporationRow, 6));
    applyStableLayoutStyles();
    return;
  }

  if (state.view === "apps") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>アプリID</th>
        <th>アプリ名</th>
        <th>カテゴリ</th>
        <th>必要権限</th>
        <th>表示</th>
        <th>優先度</th>
      </tr>`;
    elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderPortalAppRow, 6));
    applyStableLayoutStyles();
    return;
  }

  if (state.view === "permissions") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>アプリ</th>
        <th>権限</th>
        <th>role_key</th>
        <th>現職</th>
        <th>全員</th>
      </tr>`;
    elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderPermissionRow, 5));
    applyStableLayoutStyles();
    return;
  }

  if (state.view === "readiness") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>判定</th>
        <th>項目</th>
        <th>件数</th>
        <th>次の対応</th>
      </tr>`;
    elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderReadinessRow, 4));
    applyStableLayoutStyles();
    return;
  }

  elements.tableHead.innerHTML = `
    <tr>
      <th>店舗No</th>
      <th>店舗ID</th>
      <th>店舗名</th>
      <th>事業</th>
      <th>未設定</th>
      <th>状態</th>
    </tr>`;
  elements.tableBody.replaceChildren(...renderRowsSafely(rows, renderStoreRow, 6));
  applyStableLayoutStyles();
}

function renderQualitySummary() {
  const items = getQualitySummaryItems();
  elements.qualitySummary.replaceChildren(...items.map(({ label, count, tone }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    const issue = getSummaryIssueValue(label);
    const isActive = state.view === "employees" && issue && state.employeeIssueFilter === issue;
    chip.className = "summary-chip" + (tone ? " " + tone : "") + (isActive ? " active" : "");
    chip.textContent = label + ": " + count;
    chip.addEventListener("click", () => {
      if (label === "Firebase未連携") {
        state.view = "firebase";
        state.selectedId = "";
        state.employeeIssueFilter = "";
        elements.search.value = "";
        render();
        return;
      }
      if (state.view === "apps") {
        state.appStatus = label === "よく使う" ? "featured" : label === "非公開" ? "inactive" : "active";
        state.selectedId = "";
        elements.search.value = "";
        render();
        return;
      }
      if (issue) {
        setEmployeeIssueFilter(issue);
        return;
      }
      elements.search.value = getSummarySearchValue(label);
      state.employeeIssueFilter = "";
      renderTable();
    });
    return chip;
  }));
}

function getSummaryIssueValue(label) {
  if (label === "所属未設定") return "所属";
  if (label === "役職未設定") return "役職";
  if (label === "共通ロール未設定") return "共通ロール";
  if (label === "HUB権限未設定") return "共通ロール";
  if (label === "PIN未設定") return "PIN";
  if (label === "法人未設定") return "法人";
  if (label === "雇用形態未設定") return "雇用形態";
  if (label === "状態未設定") return "状態";
  return "";
}

function getSummarySearchValue(label) {
  return label
    .replace("Firebase未連携", "Firebase")
    .replace("メール任意未入力", "")
    .replace("共通ロール未設定", "共通ロール")
    .replace("HUB権限未設定", "共通ロール")
    .replace("PIN未設定", "PIN")
    .replace("状態未設定", "現職/休職/退職")
    .replace("未設定", "")
    .replace("連携待ち", "Firebase")
    .replace("無効店舗", "無効")
    .replace("表示中の履歴", "");
}

function getQualitySummaryItems() {
  if (state.view === "employees") {
    const currentEmployees = state.employees.filter((employee) => isCurrentEmployee(employee));
    const issueCounts = countIssueLabels(currentEmployees.flatMap(getEmployeeIssues));
    return [
      { label: "法人未設定", count: issueCounts["法人"] || 0, tone: "warning" },
      { label: "メール任意未入力", count: currentEmployees.filter((employee) => !hasEmployeeContactEmail(employee)).length, tone: "neutral" },
      { label: "所属未設定", count: issueCounts["所属"] || 0, tone: "warning" },
      { label: "役職未設定", count: issueCounts["役職"] || 0, tone: "warning" },
      { label: "共通ロール未設定", count: issueCounts["共通ロール"] || 0, tone: "warning" },
      { label: "PIN未設定", count: issueCounts["PIN"] || 0, tone: "warning" },
      { label: "ログイン停止", count: currentEmployees.filter((employee) => getEmployeeCredential(employee).login_enabled === false).length, tone: "neutral" },
      { label: "ロック中", count: currentEmployees.filter((employee) => getEmployeeCredential(employee).locked).length, tone: "warning" },
      { label: "雇用形態未設定", count: issueCounts["雇用形態"] || 0, tone: "warning" },
      { label: "状態未設定", count: issueCounts["現職/休職/退職"] || 0, tone: "warning" },
      { label: "Firebase未連携", count: currentEmployees.filter((employee) => !employee.firebase_uid).length, tone: "info" }
    ];
  }
  if (state.view === "stores") {
    const activeStores = state.stores.filter((store) => store.is_active);
    const issueCounts = countIssueLabels(activeStores.flatMap(getStoreIssues));
    return [
      { label: "事業部門未設定", count: issueCounts["事業部門"] || 0, tone: "warning" },
      { label: "エリア未設定", count: issueCounts["エリア"] || 0, tone: "warning" },
      { label: "店舗種別未設定", count: issueCounts["店舗種別"] || 0, tone: "warning" },
      { label: "無効店舗", count: state.stores.filter((store) => !store.is_active).length, tone: "neutral" }
    ];
  }
  if (state.view === "corporations") {
    return [
      { label: "有効法人", count: state.corporations.filter((corporation) => corporation.is_active !== false).length, tone: "info" },
      { label: "無効法人", count: state.corporations.filter((corporation) => corporation.is_active === false).length, tone: "neutral" },
      { label: "詳細あり", count: state.corporations.filter((corporation) => corporation.business_profile).length, tone: "info" }
    ];
  }
  if (state.view === "apps") {
    return [
      { label: "公開中", count: state.portalApps.filter((app) => app.isActive !== false).length, tone: "info" },
      { label: "よく使う", count: state.portalApps.filter((app) => app.isFeatured).length, tone: "info" },
      { label: "非公開", count: state.portalApps.filter((app) => app.isActive === false).length, tone: "neutral" }
    ];
  }
  if (state.view === "permissions") {
    const rows = getAppPermissionRows();
    return [
      { label: "IDEA LINK", count: rows.reduce((total, row) => total + row.activeCount, 0), tone: "info" },
      { label: "スタッフ", count: rows.find((row) => row.roleKey === "idea_link.staff")?.activeCount || 0, tone: "neutral" },
      { label: "マネージャー", count: rows.find((row) => row.roleKey === "idea_link.manager")?.activeCount || 0, tone: "neutral" },
      { label: "管理者", count: rows.find((row) => row.roleKey === "idea_link.admin")?.activeCount || 0, tone: "warning" }
    ];
  }
  if (state.view === "firebase") {
    return [
      { label: "連携待ち", count: state.employees.filter((employee) => isCurrentEmployee(employee) && !employee.firebase_uid).length, tone: "warning" },
      { label: "メール任意未入力", count: state.employees.filter((employee) => isCurrentEmployee(employee) && !hasEmployeeContactEmail(employee)).length, tone: "neutral" }
    ];
  }
  if (state.view === "logs") {
    return [
      { label: "表示中の履歴", count: state.logsLoaded ? state.logs.length : 0, tone: "neutral" }
    ];
  }
  if (state.view === "readiness") {
    const items = getHubReadinessItems();
    return [
      { label: "OK", count: items.filter((item) => item.status === "OK").length, tone: "info" },
      { label: "要確認", count: items.filter((item) => item.status === "要確認").length, tone: "warning" },
      { label: "準備中", count: items.filter((item) => item.status === "準備中").length, tone: "neutral" }
    ];
  }
  return [];
}

function countIssueLabels(labels) {
  return labels.reduce((counts, label) => {
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
}

function getHubReadinessItems() {
  const currentEmployees = state.employees.filter((employee) => isCurrentEmployee(employee));
  const activeStores = state.stores.filter((store) => store.is_active);
  const employeeIssueCount = currentEmployees.filter((employee) => getEmployeeIssues(employee).length).length;
  const employeeEmailMissingCount = currentEmployees.filter((employee) => !hasEmployeeContactEmail(employee)).length;
  const employeeRoleMissingCount = currentEmployees.filter((employee) => !getCommonRoleKeys(employee).length).length;
  const firebaseMissingCount = currentEmployees.filter((employee) => !employee.firebase_uid).length;
  const storeIssueCount = activeStores.filter((store) => getStoreIssues(store).length).length;
  const usableStoreCount = activeStores.filter((store) => store.store_id && store.store_name).length;
  const canReadLogs = state.logsLoaded && state.logs.length >= 0;
  return [
    {
      readiness_key: "employee_core",
      status: employeeIssueCount ? "要確認" : "OK",
      label: "現職社員の基幹項目",
      count: `${employeeIssueCount}件`,
      detail: "所属、役職、共通ロール、PIN、雇用形態、現職/休職/退職の未設定を確認します。メールは任意項目です。",
      nextAction: employeeIssueCount ? "社員タブの未設定ありを確認" : "HUB連携に利用可能"
    },
    {
      readiness_key: "employee_email",
      status: "OK",
      label: "メール任意登録",
      count: `${employeeEmailMissingCount}件未入力`,
      detail: "メールは任意です。Firebase Auth / OAuth / 外部連携が必要な社員から段階的に登録します。",
      nextAction: employeeEmailMissingCount ? "必要な社員だけ順次登録" : "メール登録済み"
    },
    {
      readiness_key: "employee_roles",
      status: employeeRoleMissingCount ? "要確認" : "OK",
      label: "HUB基本権限",
      count: `${employeeRoleMissingCount}件`,
      detail: "NOV HUBと各アプリの基本表示に使うCore DB共通ロールです。",
      nextAction: employeeRoleMissingCount ? "社員タブで共通ロール未設定を確認" : "HUBメニュー制御に利用可能"
    },
    {
      readiness_key: "firebase_link",
      status: firebaseMissingCount ? "準備中" : "OK",
      label: "Firebase UID連携",
      count: `${firebaseMissingCount}件`,
      detail: "HUBでログインユーザー本人を社員台帳へ紐づけるためのUID連携です。",
      nextAction: firebaseMissingCount ? "Firebase未連携タブで順次連携" : "共通ロール判定へ進行可能"
    },
    {
      readiness_key: "store_core",
      status: storeIssueCount ? "要確認" : "OK",
      label: "有効店舗の基幹項目",
      count: `${storeIssueCount}件`,
      detail: "有効店舗の事業部門、エリア、店舗種別を確認します。",
      nextAction: storeIssueCount ? "店舗タブの未設定ありを確認" : "店舗メニュー連携に利用可能"
    },
    {
      readiness_key: "store_reference",
      status: usableStoreCount ? "OK" : "要確認",
      label: "店舗参照データ",
      count: `${usableStoreCount}件`,
      detail: "HUBや各アプリが store_id / store_name を参照できる店舗数です。",
      nextAction: usableStoreCount ? "各アプリの店舗参照に利用可能" : "店舗マスタを確認"
    },
    {
      readiness_key: "change_logs",
      status: canReadLogs ? "OK" : "準備中",
      label: "変更履歴の閲覧",
      count: state.logsLoaded ? `${state.logs.length}件` : "未読込",
      detail: "社員・店舗マスタ更新時の監査ログを確認できる状態かを見ます。",
      nextAction: state.logsLoaded ? "監査ログとして利用可能" : "変更履歴タブを一度開いて確認"
    }
  ];
}

function renderEmployeeRow(employee) {
  const tr = document.createElement("tr");
  tr.className = employee.id === state.selectedId ? "selected" : "";
  const issues = getEmployeeIssues(employee);
  const affiliation = formatEmployeeAffiliation(employee);
  tr.innerHTML = `
    <td>${escapeHtml(employee.employee_id)}</td>
    <td>${escapeHtml(employee.full_name)}</td>
    <td title="${escapeHtml(affiliation)}">${escapeHtml(affiliation)}</td>
    <td>${escapeHtml(employee.position_name || employee.source_position_name || "")}</td>
    <td>${formatEmployeeEmail(employee)}</td>
    <td>${formatEmployeeLogin(employee)}</td>
    <td>${formatEmployeeLineWorksDestination(employee)}</td>
    <td>${formatEmployeeIssues(employee, issues)}</td>
    <td>${formatEmployeeStatus(employee)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = employee.id;
    render();
  });
  return tr;
}

function formatEmployeeEmail(employee) {
  const email = getEmployeeContactEmail(employee);
  if (email) {
    const isLoginOnly = !String(employee.email || "").trim() && String(getEmployeeCredential(employee).login_email || "").trim();
    const suffix = isLoginOnly ? ` <span class="status-muted">ログイン</span>` : "";
    return `${escapeHtml(email)}${suffix}`;
  }
  const label = isCurrentEmployee(employee) ? "任意未入力" : "空欄";
  return `<span class="status-muted">${label}</span>`;
}

function formatEmployeeLogin(employee) {
  const credential = getEmployeeCredential(employee);
  if (!isCurrentEmployee(employee)) return `<span class="status-muted">対象外</span>`;
  if (credential.locked) return `<span class="status-pill warning">ロック中</span>`;
  if (credential.login_enabled === false) return `<span class="status-pill inactive">停止</span>`;
  if (!credential.pin_set) return `<span class="status-pill warning">PIN未設定</span>`;
  if (credential.must_change_pin) return `<span class="status-pill warning">初回変更</span>`;
  return `<span class="status-pill">利用可</span>`;
}

function formatEmployeeAffiliation(employee) {
  const storeNames = Array.isArray(employee.store_assignments)
    ? employee.store_assignments
      .slice()
      .sort((left, right) => Number(left.assignment_order || 0) - Number(right.assignment_order || 0))
      .map((assignment) => assignment.store_name)
      .filter(Boolean)
    : [];
  const uniqueStoreNames = Array.from(new Set(storeNames));
  if (uniqueStoreNames.length) return uniqueStoreNames.join(" / ");
  return employee.store_name || employee.department_name || employee.source_assigned_location || "";
}

function renderStoreRow(store) {
  const tr = document.createElement("tr");
  tr.className = store.id === state.selectedId ? "selected" : "";
  const issues = getStoreIssues(store);
  tr.innerHTML = `
    <td>${escapeHtml(store.store_no)}</td>
    <td>${escapeHtml(store.store_id)}</td>
    <td>${escapeHtml(store.store_name)}</td>
    <td>${escapeHtml(store.business_unit_name || "")}</td>
    <td>${formatStoreIssues(issues)}</td>
    <td>${formatActive(store.is_active)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = store.id;
    render();
  });
  return tr;
}

function renderCorporationRow(corporation) {
  const tr = document.createElement("tr");
  tr.className = corporation.id === state.selectedId ? "selected" : "";
  const profile = corporation.business_profile || {};
  const fiscalMonth = profile.fiscal_year_end_month ? `${profile.fiscal_year_end_month}月` : "";
  tr.innerHTML = `
    <td>${escapeHtml(corporation.corporation_no)}</td>
    <td>${escapeHtml(corporation.corporation_name)}</td>
    <td>${escapeHtml(profile.formal_corporation_name || "")}</td>
    <td>${escapeHtml(fiscalMonth)}</td>
    <td>${escapeHtml(profile.operating_status || "")}</td>
    <td>${formatActive(corporation.is_active !== false)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = corporation.id;
    render();
  });
  return tr;
}

function renderPortalAppRow(app) {
  const tr = document.createElement("tr");
  const readonly = !state.permissions.canEdit;
  tr.className = app.id === state.selectedId ? "selected" : "";
  tr.innerHTML = `
    <td>${escapeHtml(app.appId)}</td>
    <td>${escapeHtml(app.appName)}</td>
    <td>${escapeHtml(app.category || "")}</td>
    <td>${escapeHtml(app.requiredLevel || 1)}</td>
    <td>${renderPortalAppStatusControls(app, readonly)}</td>
    <td>${renderPortalAppPriorityControls(app, readonly)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = app.id;
    render();
  });
  tr.querySelectorAll("[data-app-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handlePortalAppQuickAction(app, button.dataset.appAction);
    });
  });
  return tr;
}


function renderPermissionRow(permission) {
  const tr = document.createElement("tr");
  tr.className = permission.permission_key === state.selectedId ? "selected" : "";
  tr.innerHTML = `
    <td>
      <strong>${escapeHtml(permission.appName)}</strong>
      <div class="readiness-detail">${escapeHtml(permission.description || "")}</div>
    </td>
    <td>${escapeHtml(permission.roleLabel)}</td>
    <td><code>${escapeHtml(permission.roleKey)}</code></td>
    <td>${escapeHtml(permission.activeCount)}</td>
    <td>${escapeHtml(permission.count)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = permission.permission_key;
    render();
  });
  return tr;
}

function formatPortalAppStatus(app) {
  if (app.isActive === false) return `<span class="status-pill inactive">非公開</span>`;
  if (app.isFeatured) return `<span class="status-pill">公開中・よく使う</span>`;
  return `<span class="status-pill">公開中</span>`;
}

function renderPortalAppStatusControls(app, readonly) {
  const isActive = app.isActive !== false;
  const isFeatured = Boolean(app.isFeatured);
  return `
    <div class="app-row-actions">
      <button class="mini-action ${isActive ? "active" : "inactive"}" type="button" data-app-action="toggle-active" ${readonly ? "disabled" : ""}>
        ${isActive ? "公開" : "非公開"}
      </button>
      <button class="mini-action ${isFeatured ? "featured" : ""}" type="button" data-app-action="toggle-featured" ${readonly ? "disabled" : ""}>
        ${isFeatured ? "よく使う" : "通常"}
      </button>
    </div>`;
}

function renderPortalAppPriorityControls(app, readonly) {
  return `
    <div class="priority-control">
      <span class="priority-number">${escapeHtml(app.priority || 999)}</span>
      <button class="mini-action icon" type="button" data-app-action="move-up" title="上へ" ${readonly ? "disabled" : ""}>↑</button>
      <button class="mini-action icon" type="button" data-app-action="move-down" title="下へ" ${readonly ? "disabled" : ""}>↓</button>
    </div>`;
}


function formatEmployeeIssues(employee, issues) {
  if (!isCurrentEmployee(employee)) return `<span class="status-muted">対象外</span>`;
  return formatMasterIssues(issues);
}

function formatMasterIssues(issues) {
  if (!issues.length) return `<span class="status-pill">OK</span>`;
  return `<span class="status-pill warning">${escapeHtml(issues.join("・"))}</span>`;
}

function formatStoreIssues(issues) {
  return formatMasterIssues(issues);
}

function renderLogRow(log) {
  const tr = document.createElement("tr");
  tr.className = log.id === state.selectedId ? "selected" : "";
  const payload = log.change_payload || {};
  const changedKeys = Object.keys(payload).filter((key) => key !== "updated_at");
  const targetLabel = log.target_name || `${log.table_name} / ${log.record_id}`;
  const summary = log.change_summary || changedKeys.map(getFieldLabel).join(", ") || "変更内容なし";
  const actionLabel = formatActionType(log.action_type);
  const logType = getLogTypeLabel(log);
  tr.innerHTML = `
    <td>${escapeHtml(formatDateTime(log.created_at))}</td>
    <td>
      <div class="log-target">
        <strong>${escapeHtml(targetLabel)}</strong>
        <span>${escapeHtml(logType)}</span>
      </div>
    </td>
    <td>${escapeHtml(log.changed_by_email || "")}</td>
    <td>
      <div class="log-summary">
        <span class="log-action">${escapeHtml(actionLabel)}</span>
        <span>${escapeHtml(summary)}</span>
      </div>
    </td>`;
  tr.addEventListener("click", () => {
    state.selectedId = log.id;
    render();
  });
  return tr;
}

function renderReadinessRow(item) {
  const tr = document.createElement("tr");
  tr.className = item.readiness_key === state.selectedId ? "selected" : "";
  tr.innerHTML = `
    <td>${formatReadinessStatus(item.status)}</td>
    <td>
      <strong>${escapeHtml(item.label)}</strong>
      <div class="readiness-detail">${escapeHtml(item.detail)}</div>
    </td>
    <td>${escapeHtml(item.count)}</td>
    <td>${escapeHtml(item.nextAction)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = item.readiness_key;
    render();
  });
  return tr;
}

function formatReadinessStatus(status) {
  if (status === "OK") return `<span class="status-pill">OK</span>`;
  if (status === "準備中") return `<span class="status-pill inactive">準備中</span>`;
  return `<span class="status-pill warning">要確認</span>`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderDetail() {
  if (state.view === "permissions") {
    renderPermissionDetail();
    return;
  }
  if (state.view === "readiness") {
    renderReadinessDetail();
    return;
  }
  if (state.view === "logs") {
    renderLogDetail();
    return;
  }
  if (state.view === "employees" && state.selectedId === NEW_EMPLOYEE_ID) {
    renderNewEmployeeDetail();
    return;
  }
  if (state.view === "corporations" && state.selectedId === NEW_CORPORATION_ID) {
    renderNewCorporationDetail();
    return;
  }
  if (state.view === "apps" && state.selectedId === NEW_PORTAL_APP_ID) {
    renderNewPortalAppDetail();
    return;
  }

  const sourceRows = state.view === "corporations" ? state.corporations : state.view === "stores" ? state.stores : state.view === "apps" ? state.portalApps : state.employees;
  const row = sourceRows.find((item) => item.id === state.selectedId);
  if (!row) {
    elements.detailPanel.innerHTML = `<div class="empty-detail">左の一覧から編集対象を選んでください。</div>`;
    return;
  }
  if (state.view === "apps") renderPortalAppDetail(row);
  else if (state.view === "corporations") renderCorporationDetail(row);
  else if (state.view === "employees" || state.view === "firebase") renderEmployeeDetail(row);
  else renderStoreDetail(row);
}

function renderPermissionDetail() {
  const rows = getAppPermissionRows();
  const selected = rows.find((row) => row.permission_key === state.selectedId);
  if (!selected) {
    const total = rows.reduce((sum, row) => sum + row.activeCount, 0);
    elements.detailPanel.innerHTML = `
      <h3>アプリ別権限</h3>
      <p class="detail-meta">現在はIDEA LINK権限をCore DB employee_rolesで管理しています。</p>
      <p class="detail-note">左の一覧から権限を選ぶと、該当社員を確認できます。編集は社員詳細の「アプリ別権限」から行います。</p>
      <div class="permission-overview">
        ${rows.map((row) => `
          <button class="permission-card" data-permission-key="${escapeHtml(row.permission_key)}" type="button">
            <strong>${escapeHtml(row.roleLabel)}</strong>
            <span>${escapeHtml(row.roleKey)}</span>
            <b>${escapeHtml(row.activeCount)}人</b>
          </button>`).join("")}
      </div>
      <div class="issue-panel resolved">
        <strong>合計 ${escapeHtml(total)} 件</strong>
        <p>HUBから各アプリへ渡すroleKeysの正本は employee_roles です。</p>
      </div>`;
    setupPermissionDetailActions();
    return;
  }

  const employees = getEmployeesWithRoleKey(selected.roleKey)
    .slice()
    .sort(compareEmployees);
  const currentEmployees = employees.filter(isCurrentEmployee);
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(selected.appName)} / ${escapeHtml(selected.roleLabel)}</h3>
    <p class="detail-meta">${escapeHtml(selected.roleKey)} / 現職 ${escapeHtml(currentEmployees.length)}人 / 全員 ${escapeHtml(employees.length)}人</p>
    <p class="detail-note">IDEA LINK側はこのrole_keyをHUB Contextの roleKeys で受け取り、ログイン判定と表示分岐に使います。</p>
    <div class="permission-employee-list">
      ${employees.length ? employees.map((employee) => `
        <div class="permission-employee">
          <div>
            <strong>${escapeHtml(employee.full_name || employee.name || "")}</strong>
            <span>${escapeHtml(employee.employee_id || "")} / ${escapeHtml(formatEmployeeAffiliation(employee) || "所属未設定")} / ${escapeHtml(employee.position_name || employee.source_position_name || "")}</span>
          </div>
          <button class="button button-secondary permission-edit-employee" data-employee-id="${escapeHtml(employee.id)}" type="button">社員詳細で編集</button>
        </div>`).join("") : `<p class="empty-detail">この権限が付与されている社員はいません。</p>`}
    </div>`;
  setupPermissionDetailActions();
}

function setupPermissionDetailActions() {
  document.querySelectorAll("[data-permission-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.permissionKey || "";
      render();
    });
  });
  document.querySelectorAll(".permission-edit-employee").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = "employees";
      state.employeeStatus = "all";
      state.employeeIssueFilter = "";
      state.selectedId = button.dataset.employeeId || "";
      elements.search.value = "";
      render();
    });
  });
}

function renderReadinessDetail() {
  const item = getHubReadinessItems().find((candidate) => candidate.readiness_key === state.selectedId);
  const items = getHubReadinessItems();
  if (!item) {
    const remaining = items.filter((candidate) => candidate.status !== "OK").length;
    elements.detailPanel.innerHTML = `
      <h3>HUB連携準備</h3>
      <p class="detail-meta">要確認・準備中: ${escapeHtml(remaining)}項目</p>
      <p class="detail-note">左の一覧から項目を選ぶと、次に見るべきタブと対応内容を確認できます。</p>
      <div class="readiness-guide">
        <strong>月初運用の見る順番</strong>
        <ol>
          <li>所属・役職・共通ロールの未設定を確認する</li>
          <li>PINとログイン可否を確認する</li>
          <li>Firebase未連携を確認する</li>
          <li>店舗マスタと変更履歴を確認する</li>
        </ol>
      </div>
      <div class="issue-panel${remaining ? "" : " resolved"}">
        <strong>${remaining ? "まだ確認項目があります" : "HUB連携へ進めます"}</strong>
        <p>${remaining ? "要確認を上から潰すと、HUBトップとの連携開始判断がしやすくなります。" : "社員・店舗・履歴の基本条件は整っています。次はHUB側でログインユーザーの社員情報取得へ進めます。"}</p>
      </div>`;
    setupReadinessShortcut();
    return;
  }
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(item.label)}</h3>
    <p class="detail-meta">判定: ${escapeHtml(item.status)} / 件数: ${escapeHtml(item.count)}</p>
    <p class="detail-note">${escapeHtml(item.detail)}</p>
    <div class="issue-panel${item.status === "OK" ? " resolved" : item.status === "準備中" ? " neutral" : ""}">
      <strong>次の対応</strong>
      <p>${escapeHtml(item.nextAction)}</p>
    </div>
    ${renderReadinessShortcut(item)}`;
  setupReadinessShortcut();
}

function renderReadinessShortcut(item) {
  const target = {
    employee_core: ["employees", "missing", "社員タブの未設定ありを見る"],
    employee_email: ["employees", "", "社員タブを見る"],
    employee_roles: ["employees", "共通ロール", "社員タブで共通ロール未設定を見る"],
    firebase_link: ["firebase", "", "Firebase未連携を見る"],
    store_core: ["stores", "missing", "店舗タブの未設定ありを見る"],
    store_reference: ["stores", "", "店舗タブを見る"],
    change_logs: ["logs", "", "変更履歴を見る"]
  }[item.readiness_key];
  if (!target) return "";
  return `<button class="button button-secondary readiness-shortcut" data-readiness-target="${escapeHtml(target[0])}" data-readiness-query="${escapeHtml(target[1])}" type="button">${escapeHtml(target[2])}</button>`;
}

function setupReadinessShortcut() {
  document.querySelector(".readiness-shortcut")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const target = button.dataset.readinessTarget || "employees";
    const query = button.dataset.readinessQuery || "";
    state.view = target;
    state.selectedId = "";
    state.employeeIssueFilter = "";
    elements.search.value = "";
    if (target === "employees") {
      state.employeeStatus = query === "missing" ? "missing" : "active";
      if (query === "メール") {
        setEmployeeIssueFilter("メール");
        return;
      }
      if (query === "共通ロール" || query === "HUB権限") {
        setEmployeeIssueFilter("共通ロール");
        return;
      }
      if (query && query !== "missing") elements.search.value = query;
    }
    if (target === "stores") {
      state.storeStatus = query === "missing" ? "missing" : "active";
      if (query && query !== "missing") elements.search.value = query;
    }
    if (target === "logs") {
      render();
      refreshLogs();
      return;
    }
    render();
  });
}

function renderLogDetail() {
  const log = state.logs.find((item) => item.id === state.selectedId);
  if (!log) {
    elements.detailPanel.innerHTML = `<div class="empty-detail">左の一覧から履歴を選んでください。</div>`;
    return;
  }
  const helperText = log.table_name === "employee_store_assignments"
    ? "社員本体の更新とは別に、主店舗・サブ店舗・第3店舗の所属変更として記録しています。"
    : "社員・店舗マスタ本体の変更として記録しています。";
  const logType = getLogTypeLabel(log);
  elements.detailPanel.innerHTML = `
    <h3>変更履歴</h3>
    <p class="detail-meta">${escapeHtml(formatDateTime(log.created_at))}</p>
    <p class="detail-note">${escapeHtml(helperText)}</p>
    <div class="log-detail">
      <div class="log-detail-heading">
        <span class="log-type-badge ${escapeHtml(getLogTypeClass(log))}">${escapeHtml(logType)}</span>
        <strong>${escapeHtml(log.target_name || "対象名未設定")}</strong>
      </div>
      <dl>
        <dt>操作</dt>
        <dd>${escapeHtml(formatActionType(log.action_type))}</dd>
        <dt>対象名</dt>
        <dd>${escapeHtml(log.target_name || "")}</dd>
        <dt>対象テーブル</dt>
        <dd>${escapeHtml(log.table_name)}</dd>
        <dt>対象ID</dt>
        <dd>${escapeHtml(log.record_id)}</dd>
        <dt>変更者</dt>
        <dd>${escapeHtml(log.changed_by_email || "")}</dd>
        <dt>概要</dt>
        <dd>${escapeHtml(log.change_summary || "")}</dd>
      </dl>
      ${renderLogPayload(log)}
    </div>`;
}

function formatActionType(actionType) {
  return {
    create: "新規追加",
    update: "更新",
    link_firebase_uid: "Firebase UID連携",
    update_store_assignments: "店舗所属更新",
    assign_staff_role: "共通ロール付与",
    auto_assign_staff_role: "共通ロール自動付与",
    update_app_roles: "アプリ権限更新",
    update_profile_image: "プロフィール画像更新",
    create_login_credential: "ログイン設定作成",
    update_login_credential: "ログイン設定更新",
    update_corporation_business_profile: "法人詳細更新",
    change_own_pin: "本人PIN変更"
  }[actionType] || "更新";
}

function getLogTypeLabel(log) {
  if (log.action_type === "update_app_roles") return "アプリ権限";
  if (log.table_name === "employee_profile_images") return "プロフィール画像";
  if (log.table_name === "employee_store_assignments") return "店舗所属";
  if (log.table_name === "employee_roles") return "共通ロール";
  if (log.table_name === "employee_login_credentials") return "ログイン設定";
  if (log.table_name === "corporations") return "法人情報";
  if (log.table_name === "corporation_business_profiles") return "法人詳細";
  if (log.table_name === "stores") return "店舗情報";
  if (log.table_name === "employees") return "社員情報";
  return log.table_name || "変更履歴";
}

function getLogTypeClass(log) {
  if (log.action_type === "update_app_roles") return "role";
  if (log.table_name === "employee_store_assignments") return "store-assignment";
  if (log.table_name === "employee_roles") return "role";
  if (log.table_name === "employee_login_credentials") return "login";
  if (log.table_name === "corporations") return "corporation";
  if (log.table_name === "corporation_business_profiles") return "corporation";
  if (log.table_name === "stores") return "store";
  if (log.table_name === "employees") return "employee";
  return "";
}

function renderLogPayload(log) {
  const payload = log.change_payload || {};
  if (log.table_name === "employee_store_assignments") {
    return renderStoreAssignmentLog(payload);
  }
  const rows = Object.entries(payload)
    .filter(([key]) => key !== "updated_at")
    .map(([key, value]) => renderLogField(key, value))
    .join("");
  if (!rows) return `<p class="empty-detail">表示できる変更内容はありません。</p>`;
  return `
    <h4 class="change-section-title">更新された項目</h4>
    <div class="change-list">${rows}</div>`;
}

function renderLogField(key, value) {
  return `
    <div class="change-row">
      <span class="change-key">${escapeHtml(getFieldLabel(key))}</span>
      <span class="change-value">${escapeHtml(formatLogValue(key, value))}</span>
    </div>`;
}

function renderStoreAssignmentLog(payload) {
  const before = Array.isArray(payload.before) ? payload.before : [];
  const after = Array.isArray(payload.after) ? payload.after : [];
  return `
    <div class="store-assignment-log">
      <h4>変更前</h4>
      ${renderStoreAssignmentSnapshot(before)}
      <h4>変更後</h4>
      ${renderStoreAssignmentSnapshot(after)}
    </div>`;
}

function renderStoreAssignmentSnapshot(assignments) {
  if (!assignments.length) return `<p class="empty-detail">設定なし</p>`;
  const rows = assignments
    .slice()
    .sort((left, right) => Number(left.assignment_order || 0) - Number(right.assignment_order || 0))
    .map((assignment) => `
      <li>
        <span>${escapeHtml(getStoreAssignmentLabel(assignment.assignment_order))}</span>
        <strong>${escapeHtml(getStoreName(assignment.store_id))}</strong>
      </li>`)
    .join("");
  return `<ul>${rows}</ul>`;
}

function getStoreAssignmentLabel(order) {
  return {
    1: "主店舗",
    2: "サブ店舗",
    3: "第3店舗"
  }[Number(order)] || `${order}番目`;
}

function getFieldLabel(key) {
  return {
    email: "メール",
    hub_role: "共通ロール",
    scope_type: "権限範囲",
    birth_date: "誕生日",
    joined_on: "入社日",
    retired_on: "退職日",
    leave_start_date: "休職開始日",
    leave_end_date: "休職終了日・復職日",
    leave_type: "休職区分",
    employment_status: "現職/休職/退職",
    employment_type: "雇用形態",
    corporation_id: "法人",
    corporation_name: "法人名",
    formal_corporation_name: "正式名",
    corporation_number: "法人番号",
    invoice_registration_number: "インボイス番号",
    representative_name: "代表者",
    head_office_address: "所在地",
    phone_number: "電話番号",
    fiscal_year_end_month: "決算月",
    payroll_closing_day: "給与締日",
    payroll_payment_day: "給与支払日",
    accounting_category: "会計区分",
    social_insurance_status: "社会保険",
    labor_insurance_status: "労保",
    tax_accountant_label: "税理士",
    labor_consultant_label: "社労士",
    operating_status: "状況",
    established_on: "設立日",
    closed_on: "廃止日",
    corporation_feature_note: "法人備考",
    store_id: "主店舗",
    store_assignment_2: "サブ店舗",
    store_assignment_3: "第3店舗",
    department_id: "部署",
    position_id: "役職",
    job_type_id: "職種",
    business_unit_id: "事業部門",
    store_name: "店舗名",
    area: "エリア",
    store_type: "店舗種別",
    firebase_uid: "Firebase UID",
    login_email: "ログインメール",
    login_enabled: "ログイン可否",
    must_change_pin: "次回PIN変更",
    pin_changed: "PIN変更",
    lock_cleared: "ロック解除",
    is_active: "有効状態",
    is_legacy: "LEGACY区分",
    employee_id: "社員番号",
    full_name: "氏名"
  }[key] || key;
}

function formatLogValue(key, value) {
  if (value === null || value === undefined || value === "") return "未設定";
  if (key === "corporation_id") return getMasterName(state.masters.corporations, value, "corporation_name");
  if (key === "department_id") return getMasterName(state.masters.departments, value, "department_name");
  if (key === "position_id") return getMasterName(state.masters.positions, value, "position_name");
  if (key === "job_type_id") return getMasterName(state.masters.jobTypes, value, "job_type_name");
  if (key === "business_unit_id") return getMasterName(state.masters.businessUnits, value, "business_unit_name");
  if (key === "store_id") return getStoreName(value);
  if (key === "is_active") return value ? "有効" : "無効";
  if (["login_enabled", "must_change_pin", "pin_changed", "lock_cleared"].includes(key)) return value ? "はい" : "いいえ";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getMasterName(rows, id, labelKey) {
  const row = rows.find((item) => item.id === id);
  return row ? row[labelKey] : String(id || "");
}

function getStoreName(id) {
  const store = state.stores.find((item) => item.id === id);
  return store ? store.store_name : String(id || "");
}

function startCreateEmployee() {
  if (!state.permissions.canEdit) {
    showToast("編集権限がありません。", "error");
    return;
  }
  state.view = "employees";
  state.recentlyCreatedEmployeeId = "";
  state.selectedId = NEW_EMPLOYEE_ID;
  state.formSnapshot = null;
  render();
}

function renderNewEmployeeDetail() {
  const activeEmployeeCount = state.employees.filter((employee) => isActiveEmployee(employee)).length + 1;
  elements.detail.innerHTML = `
    <form class="detail-form" id="detail-form" data-form-kind="employee">
      <h2>新規社員追加</h2>
      <p class="form-note">社員番号と氏名は必須です。メールは任意です。Firebase Auth / OAuth / 外部連携が必要な社員から段階的に登録します。社員番号なし退職者は LEGACY-0001 形式で登録します。</p>
      ${fieldInput("employee_id", "社員番号", "", { required: true, placeholder: "例: 9999 / LEGACY-0001" })}
      ${fieldInput("full_name", "氏名", "", { required: true, placeholder: "例: 山田 太郎" })}
      ${fieldInput("email", "メール（任意）", "", "email")}
      ${fieldInput("birth_date", "誕生日", "", "date")}
      ${fieldInput("joined_on", "入社日", "", "date")}
      ${fieldInput("retired_on", "退職日", "", "date")}
      ${fieldInput("leave_start_date", "休職開始日", "", "date")}
      ${fieldInput("leave_end_date", "休職終了日・復職日", "", "date")}
      ${fieldStaticSelect("leave_type", "休職種別", LEAVE_TYPE_OPTIONS, "")}
      ${fieldSelect("corporation_id", "法人", state.masters.corporations, "", "corporation_name")}
      <div class="store-assignment-box">
        <strong>複数店舗所属</strong>
        <p>主店舗は社員マスタの所属店舗にも同期されます。サブ店舗・第3店舗は兼任先として保存します。</p>
        ${fieldSelect("store_id", "主店舗", state.masters.stores, "", "store_name")}
        ${fieldSelect("store_assignment_2", "サブ店舗", state.masters.stores, "", "store_name")}
        ${fieldSelect("store_assignment_3", "第3店舗", state.masters.stores, "", "store_name")}
      </div>
      ${fieldSelect("department_id", "部署", state.masters.departments, "", "department_name")}
      ${fieldSelect("position_id", "役職", state.masters.positions, "", "position_name")}
      ${renderJobTypeField("")}
      ${fieldStaticSelect("employment_type", "雇用形態", EMPLOYMENT_TYPE_OPTIONS, "正社員")}
      ${fieldStaticSelect("employment_status", "就労ステータス", EMPLOYMENT_STATUS_OPTIONS, "現職")}
      <label class="checkbox-row"><input type="checkbox" id="is_active" name="is_active" checked> 有効</label>
      <p class="form-note">追加後、必要に応じて社員一覧から選択して権限や詳細を調整してください。</p>
      <div class="detail-actions">
        <span id="employee-save-status" class="save-status"></span>
        <button class="button button-primary save-button" type="submit">社員を追加</button>
      </div>
    </form>
  `;
  const form = elements.detail.querySelector("#detail-form");
  form.addEventListener("submit", saveNewEmployee);
  setupDirtyForm("employee");
  elements.detail.scrollTop = 0;
}

function validateEmployeeFormPayload(payload) {
  const employeeId = String(payload.employee_id || "").trim();
  const fullName = String(payload.full_name || "").trim();
  if (!employeeId) {
    showToast("社員番号を入力してください。", "error");
    return false;
  }
  if (!fullName) {
    showToast("氏名を入力してください。", "error");
    return false;
  }
  if (state.employees.some((employee) => String(employee.employee_id) === employeeId)) {
    showToast("同じ社員番号がすでに存在します。", "error");
    return false;
  }
  return true;
}

async function saveNewEmployee(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const status = document.querySelector("#employee-save-status");
  const payload = collectEmployeePayload();
  payload.employee_id = String(payload.employee_id || "").trim();
  payload.full_name = String(payload.full_name || "").trim();

  const invalidField = getInvalidDateField(payload, [
    ["birth_date", "誕生日"],
    ["joined_on", "入社日"],
    ["retired_on", "退職日"],
    ["leave_start_date", "休職開始日"],
    ["leave_end_date", "休職終了日・復職日"]
  ]);
  if (invalidField) {
    showToast(`${invalidField}は 1993-08-01 の形式で入力してください。`, "error");
    return;
  }
  if (!isValidStoreSelection(form)) {
    showToast("主店舗・サブ店舗・第3店舗は重複しないように選択してください。", "error");
    return;
  }
  if (!validateEmployeeFormPayload(payload)) return;

  button.disabled = true;
  button.textContent = "追加中...";
  setSaveStatus(status, "社員を追加しています...", "pending");
  try {
    const result = await callApiAction("masterCreateEmployee", payload);
    const createdId = result?.employee?.id;
    showToast("社員を追加しました。", "success");
    await refreshEmployees();
    if (createdId) {
      state.selectedId = createdId;
      state.recentlyCreatedEmployeeId = createdId;
    }
    state.formSnapshot = null;
    render();
  } catch (error) {
    console.error(error);
    showToast(error.message || "社員追加に失敗しました。", "error");
    setSaveStatus(status, error.message || "社員追加に失敗しました。", "error");
    restoreSaveButtonState("employee", button);
  }
}
function renderEmployeeCreatedPanel(employee) {
  if (state.recentlyCreatedEmployeeId !== employee.id) return "";
  const hasEmail = Boolean(String(employee.email || "").trim());
  const hasLocation = Boolean(employee.store_id || employee.department_id);
  const hasPosition = Boolean(employee.position_id);
  const hasHubRole = getCommonRoleKeys(employee).length > 0;
  return `
    <section class="created-employee-panel">
      <strong>社員を追加しました</strong>
      <p>社員台帳への登録は完了しています。月初更新では、所属・役職・権限・PINを確認すると後続アプリへつなげやすくなります。メールは必要な社員だけ後から登録できます。</p>
      <ul>
        <li class="${hasEmail ? "done" : "pending"}">メール: ${hasEmail ? "設定済み" : "任意未入力。必要になったら追記します。"}</li>
        <li class="${hasLocation ? "done" : "pending"}">所属: ${hasLocation ? "設定済み" : "店舗または部署を設定してください。"}</li>
        <li class="${hasPosition ? "done" : "pending"}">役職: ${hasPosition ? "設定済み" : "必要に応じて設定してください。"}</li>
      </ul>
    </section>`;
}
function renderEmployeeDetail(employee) {
  const retired = !employee.is_active || employee.employment_status === "退職";
  const storeAssignments = getStoreAssignmentsByOrder(employee.store_assignments || []);
  const readonly = !state.permissions.canEdit;
  const issues = getEmployeeIssues(employee);
  const createdPanel = renderEmployeeCreatedPanel(employee);
  const issuePanel = renderEmployeeIssuePanel(employee, issues);
  const loginPanel = renderEmployeeLoginPanel(employee, readonly);
  const lineWorksPanel = renderEmployeeLineWorksDestinationPanel(employee, readonly);
  const firebaseLinkPanel = state.view === "firebase" && !readonly ? `
      <div class="firebase-link-panel">
        <div>
          <strong>Firebase UID連携</strong>
          <p>Firebase AuthenticationのユーザーUIDを貼り付けて、この社員にログイン権限を紐付けます。</p>
        </div>
        <label class="form-field" for="firebase_uid">
          <span>Firebase UID</span>
          <input class="form-input" id="firebase_uid" name="firebase_uid" type="text" autocomplete="off" placeholder="例: y8TtlfPT9nNr8KBIBdQ5w1YJASm2">
        </label>
        <button class="button button-secondary" id="link-firebase-uid" type="button">Firebase UIDを連携</button>
      </div>` : "";
  const employeeStatusLabel = getEmployeeStatusLabel(employee);
  const loginCredential = getEmployeeCredential(employee);
  const lineWorksStatus = hasEmployeeLineWorksDestination(employee) ? "通知先あり" : "通知先未設定";
  const basicIssueCount = getEmployeeBasicIssueCount(issues);
  const authIssueCount = loginCredential.pin_set ? 0 : 1;
  const commonRoleCount = getCommonRoleKeys(employee).length;
  elements.detailPanel.innerHTML = `
    <div class="employee-detail-header">
      <div>
        <h3>${escapeHtml(employee.full_name)}</h3>
        <p class="detail-meta">社員番号: ${escapeHtml(employee.employee_id)} / Firebase: ${employee.firebase_uid ? "連携済み" : "未連携"}${employee.updated_at ? ` / 最終更新: ${escapeHtml(formatDateTime(employee.updated_at))}` : ""}</p>
      </div>
      <div class="employee-detail-statuses" aria-label="社員状態">
        <span class="status-pill${retired ? " inactive" : isLeaveEmployee(employee) ? " leave" : " success"}">${escapeHtml(employeeStatusLabel)}</span>
        <span class="status-pill${loginCredential.login_enabled === false ? " inactive" : loginCredential.pin_set ? " success" : " warning"}">${escapeHtml(loginCredential.login_enabled === false ? "ログイン停止" : loginCredential.pin_set ? "PIN設定済み" : "PIN未設定")}</span>
        <span class="status-pill${hasEmployeeLineWorksDestination(employee) ? " success" : " neutral"}">${escapeHtml(lineWorksStatus)}</span>
      </div>
    </div>
    <p class="detail-note">${readonly ? "閲覧専用モードです。編集権限がある管理者のみ保存できます。" : "社員番号とFirebase UIDはこの画面では変更しません。変更が必要な場合は管理者確認後に個別対応します。"}</p>
    <div class="employee-detail-guide" aria-label="保存単位">
      <span>基本情報は下部保存</span>
      <span>ログイン/PINは別保存</span>
      <span>通知先保存は停止中</span>
    </div>
    <nav class="employee-detail-nav" aria-label="社員詳細メニュー">
      <button type="button" data-detail-section="employee-section-basic">基本</button>
      <button type="button" data-detail-section="employee-section-status">状態</button>
      <button type="button" data-detail-section="employee-section-auth">ログイン</button>
      <button type="button" data-detail-section="employee-section-permissions">権限</button>
      <button type="button" data-detail-section="employee-section-media">画像</button>
    </nav>
    ${createdPanel}
    ${issuePanel}
    <form class="employee-detail-form" id="detail-form">
    <details class="employee-detail-section" id="employee-section-basic" open>
      <summary>
        <span>
          <strong>基本情報・所属</strong>
          <small>法人、店舗、部署、役職、雇用情報</small>
        </span>
        ${renderSectionStatusBadge(basicIssueCount ? `${basicIssueCount}件確認` : "OK", basicIssueCount ? "warning" : "success")}
      </summary>
      <div class="form-grid employee-detail-section-body">
      ${fieldInput("birth_date", "誕生日", employee.birth_date || "", "date")}
      ${fieldInput("joined_on", "入社日", employee.joined_on || "", "date")}
      ${fieldInput("retired_on", "退職日", employee.retired_on || "", "date")}
      ${fieldSelect("corporation_id", "法人", state.masters.corporations, employee.corporation_id, "corporation_name")}
      <section class="store-assignments">
        <div>
          <strong>複数店舗所属</strong>
          <p>主店舗は社員マスタの所属店舗にも同期されます。サブ店舗・第3店舗は兼任先として保存します。</p>
        </div>
        ${fieldSelect("store_id", "主店舗", state.stores, storeAssignments[1] || employee.store_id, "store_name")}
        ${fieldSelect("store_assignment_2", "サブ店舗", state.stores, storeAssignments[2] || "", "store_name")}
        ${fieldSelect("store_assignment_3", "第3店舗", state.stores, storeAssignments[3] || "", "store_name")}
      </section>
      ${fieldSelect("department_id", "部署", state.masters.departments, employee.department_id, "department_name")}
      ${fieldSelect("position_id", "役職", state.masters.positions, employee.position_id, "position_name")}
      ${renderJobTypeField(employee.job_type_id || "")}
      ${fieldStaticSelect("employment_type", "雇用形態", EMPLOYMENT_TYPE_OPTIONS, normalizeEmploymentTypeForForm(employee.employment_type || ""))}
      ${fieldStaticSelect("employment_status", "就労ステータス", EMPLOYMENT_STATUS_OPTIONS, normalizeEmploymentStatus(employee.employment_status || ""))}
      </div>
    </details>
    <details class="employee-detail-section" id="employee-section-status">
      <summary>
        <span>
          <strong>休職・退職</strong>
          <small>休職期間、復職日、退職処理</small>
        </span>
        ${renderSectionStatusBadge(employeeStatusLabel, retired ? "inactive" : isLeaveEmployee(employee) ? "warning" : "success")}
      </summary>
      <div class="form-grid employee-detail-section-body">
      <section class="leave-fields">
        <div>
          <strong>休職・産休・育休</strong>
          <p>休職中の社員だけ入力します。復職済みの場合は終了日を入れておくと履歴確認に使えます。</p>
        </div>
        ${fieldStaticSelect("leave_type", "休職種別", LEAVE_TYPE_OPTIONS, normalizeLeaveType(employee.leave_type || ""))}
        ${fieldInput("leave_start_date", "休職開始日", employee.leave_start_date || "", "date")}
        ${fieldInput("leave_end_date", "休職終了日・復職日", employee.leave_end_date || "", "date")}
      </section>
      ${fieldCheckbox("is_active", "有効", employee.is_active)}
      ${readonly ? "" : `<div class="danger-zone">
        <div>
          <strong>退職処理</strong>
          <p>退職にして、NOV HUB側の有効状態も無効にします。</p>
        </div>
        <button class="button button-danger" id="retire-employee" type="button"${retired ? " disabled" : ""}>退職処理</button>
      </div>`}
      </div>
    </details>
    <div class="save-row">
      <span class="save-status" id="employee-save-status" aria-live="polite"></span>
      ${readonly ? `<span class="readonly-label">閲覧専用</span>` : `<button class="button button-primary save-button" type="submit">基本情報を保存</button>`}
    </div>
    </form>
    <details class="employee-detail-section" id="employee-section-auth" open>
      <summary>
        <span>
          <strong>ログイン・通知</strong>
          <small>PIN、ログイン可否、個人通知先</small>
        </span>
        ${renderSectionStatusBadge(authIssueCount ? "PIN未設定" : "OK", authIssueCount ? "warning" : "success")}
      </summary>
      <div class="employee-detail-section-body">
        ${loginPanel}
        ${lineWorksPanel}
      </div>
    </details>
    <details class="employee-detail-section" id="employee-section-permissions">
      <summary>
        <span>
          <strong>権限</strong>
          <small>HUB基本権限、アプリ別権限、Firebase連携</small>
        </span>
        ${renderSectionStatusBadge(commonRoleCount ? "OK" : "確認", commonRoleCount ? "success" : "warning")}
      </summary>
      <div class="employee-detail-section-body">
        ${renderEmployeeRolePanel(employee)}
        ${renderEmployeeAppRolePanel(employee, readonly)}
        ${firebaseLinkPanel}
      </div>
    </details>
    <details class="employee-detail-section" id="employee-section-media">
      <summary>
        <span>
          <strong>画像</strong>
          <small>プロフィール画像</small>
        </span>
        ${renderSectionStatusBadge(employee.profile_image_url ? "設定済み" : "任意", employee.profile_image_url ? "success" : "neutral")}
      </summary>
      <div class="employee-detail-section-body">
        ${renderEmployeeProfileImagePanel(employee, readonly)}
      </div>
    </details>`;
  setReadonlyState(readonly);
  if (!readonly) {
    const form = document.querySelector("#detail-form");
    form.addEventListener("submit", saveEmployee);
    setupDirtyForm("employee");
  }
  document.querySelector("#retire-employee")?.addEventListener("click", retireEmployee);
  document.querySelector("#link-firebase-uid")?.addEventListener("click", linkFirebaseUid);
  document.querySelector("#assign-staff-role")?.addEventListener("click", assignStaffRole);
  document.querySelector("#save-idea-link-roles")?.addEventListener("click", saveIdeaLinkRoles);
  document.querySelector("#save-login-credential")?.addEventListener("click", saveEmployeeLoginCredential);
  document.querySelector("#upload-profile-image")?.addEventListener("click", uploadEmployeeProfileImage);
  setupEmployeeDetailSectionNav();
  setupLoginCredentialDirtyState();
  setupLineWorksDestinationSaveState(employee, readonly);
}

function getEmployeeBasicIssueCount(issues) {
  const basicIssueLabels = new Set(["法人", "所属", "役職", "職種", "雇用形態", "現職/休職/退職"]);
  return issues.filter((issue) => basicIssueLabels.has(issue)).length;
}

function renderSectionStatusBadge(label, type = "neutral") {
  return `<span class="section-status-badge ${escapeHtml(type)}">${escapeHtml(label)}</span>`;
}

function setupEmployeeDetailSectionNav() {
  const buttons = Array.from(document.querySelectorAll("[data-detail-section]"));
  const setActiveButton = (sectionId) => {
    buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.detailSection === sectionId);
    });
  };
  buttons.forEach((button, index) => {
    if (index === 0) button.classList.add("active");
    button.addEventListener("click", () => {
      const section = document.querySelector(`#${button.dataset.detailSection}`);
      if (!section) return;
      section.open = true;
      setActiveButton(button.dataset.detailSection);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll(".employee-detail-section").forEach((section) => {
    section.addEventListener("toggle", () => {
      if (section.open) setActiveButton(section.id);
    });
  });
}

function renderEmployeeLoginPanel(employee, readonly) {
  const credential = getEmployeeCredential(employee);
  const loginEmail = employee.email || credential.login_email || "";
  const pinLabel = credential.pin_set
    ? "設定済み"
    : "未設定";
  const lockLabel = credential.locked
    ? "ロック中"
    : "ロックなし";
  return `
    <section class="login-credential-panel" id="login-credential-panel">
      <div class="login-credential-heading">
        <div>
          <strong>ログイン / PIN管理</strong>
          <p>HUB共通ログイン用。PINは表示しません。</p>
        </div>
        <span class="status-pill${credential.login_enabled === false ? " inactive" : credential.pin_set ? "" : " warning"}">${credential.login_enabled === false ? "ログイン停止" : credential.pin_set ? "ログイン可" : "PIN未設定"}</span>
      </div>
      <div class="login-credential-grid">
        ${fieldInput("email", "メールアドレス（任意）", loginEmail, { type: "email", placeholder: "必要な社員のみ入力", disabled: readonly })}
        <label class="form-field" for="new_pin">
          <span>新しいPIN</span>
          <input class="form-input" id="new_pin" type="password" inputmode="numeric" autocomplete="new-password" placeholder="${credential.pin_set ? "変更時のみ入力" : "4〜12桁の数字"}"${readonly ? " disabled" : ""}>
        </label>
        <label class="checkbox-row">
          <input id="login_enabled" type="checkbox"${credential.login_enabled !== false ? " checked" : ""}${readonly ? " disabled" : ""}>
          <span>ログインを許可</span>
        </label>
        <label class="checkbox-row">
          <input id="must_change_pin" type="checkbox"${credential.must_change_pin ? " checked" : ""}${readonly ? " disabled" : ""}>
          <span>次回PIN変更を必須にする</span>
        </label>
        <label class="checkbox-row">
          <input id="clear_login_lock" type="checkbox"${readonly || !credential.locked ? " disabled" : ""}>
          <span>ロックを解除</span>
        </label>
      </div>
      <div class="login-credential-meta">
        <span>PIN: ${escapeHtml(pinLabel)}</span>
        <span>${escapeHtml(lockLabel)}</span>
        <span>失敗回数: ${escapeHtml(credential.failed_attempts || 0)}</span>
        ${credential.last_login_at ? `<span>最終ログイン: ${escapeHtml(formatDateTime(credential.last_login_at))}</span>` : ""}
      </div>
      ${readonly ? "" : `<div class="login-credential-actions">
        <span class="save-status" id="login-credential-save-status" aria-live="polite"></span>
        <button class="button button-primary login-credential-save-button" id="save-login-credential" type="button">保存</button>
      </div>`}
    </section>`;
}

function renderEmployeeLineWorksDestinationPanel(employee, readonly) {
  const destination = getEmployeeLineWorksDestination(employee);
  const hasDestination = hasEmployeeLineWorksDestination(employee);
  const preview = hasDestination ? "設定済み（実ID非表示）" : "未設定";
  const lineWorksReadonly = readonly || !EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED;
  const saveStatusMessage = "個人通知先の保存はDB設計レビュー後に有効化します。";
  return `
    <section class="notification-destination-panel" id="line-works-destination-panel">
      <div class="notification-destination-heading">
        <div>
          <strong>LINE WORKS個人通知</strong>
          <p>実IDは表示しません。変更時のみ入力。</p>
        </div>
        <span class="status-pill ${hasDestination ? "success" : "neutral"}">${escapeHtml(hasDestination ? "設定済み" : "未設定")}</span>
      </div>
      <div class="notification-destination-grid">
        <label class="form-field" for="line_works_recipient_id">
          <span>LINE WORKS User ID</span>
          <input class="form-input" id="line_works_recipient_id" name="line_works_recipient_id" type="text" autocomplete="off" placeholder="${hasDestination ? "変更時のみ入力" : "User IDを入力"}" ${lineWorksReadonly ? "disabled" : ""}>
        </label>
        <p class="field-help">個人宛て専用。数字だけのチャンネルIDは保存できません。</p>
        <div class="notification-destination-meta">
          <span>現在: ${escapeHtml(preview)}</span>
        </div>
      </div>
      <div class="notification-destination-actions">
        <span class="save-status pending" id="line-works-destination-save-status">${escapeHtml(saveStatusMessage)}</span>
        <button class="button button-primary notification-destination-save-button" id="save-line-works-destination" type="button" disabled>設計レビュー待ち</button>
      </div>
    </section>`;
}

function setupLineWorksDestinationSaveState(employee, readonly) {
  const panel = document.querySelector("#line-works-destination-panel");
  const input = document.querySelector("#line_works_recipient_id");
  const button = document.querySelector("#save-line-works-destination");
  const status = document.querySelector("#line-works-destination-save-status");
  if (!panel || !input || !button || !status || readonly || !EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED) return;
  input.addEventListener("input", () => {
    const value = normalizeLineWorksUserIdInput(input.value);
    const validationError = getLineWorksUserIdValidationError(value);
    button.disabled = Boolean(validationError);
    setSaveStatus(
      status,
      validationError || "未保存の入力があります。",
      validationError ? "error" : "pending"
    );
  });
  button.addEventListener("click", () => saveEmployeeLineWorksDestination(employee));
}

async function saveEmployeeLineWorksDestination(employee) {
  if (!EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED) {
    showToast("LINE WORKS個人通知先の保存は設計レビュー後に有効化します。");
    return;
  }
  const input = document.querySelector("#line_works_recipient_id");
  const button = document.querySelector("#save-line-works-destination");
  const status = document.querySelector("#line-works-destination-save-status");
  const lineWorksRecipientId = normalizeLineWorksUserIdInput(input?.value);
  const validationError = getLineWorksUserIdValidationError(lineWorksRecipientId);
  if (!employee?.id || validationError) {
    setSaveStatus(status, validationError || "社員を選択してください。", "error");
    return;
  }
  try {
    button.disabled = true;
    button.textContent = "保存中...";
    setSaveStatus(status, "保存中です...", "pending");
    const response = await callApiAction("masterUpsertEmployeeLineWorksDestination", {
      employeeId: employee.id,
      lineWorksRecipientId,
      displayName: "LINE WORKS primary recipient",
      purpose: "primary"
    });
    if (JSON.stringify(response).includes(lineWorksRecipientId)) {
      throw new Error("LINE WORKS個人通知先User IDの実値がresponseに含まれました。保存確認を停止します。");
    }
    await refreshEmployees();
    await refreshLogsSilently();
    state.selectedId = employee.id;
    render();
    showToast("LINE WORKS個人通知先を保存しました。");
  } catch (error) {
    console.warn("LINE WORKS個人通知先User ID保存に失敗しました", {
      message: getErrorMessage(error)
    });
    setSaveStatus(status, getErrorMessage(error), "error");
    button.disabled = false;
    button.textContent = hasEmployeeLineWorksDestination(employee) ? "更新" : "保存";
  }
}

function renderEmployeeProfileImagePanel(employee, readonly) {
  const image = employee.profile_image || {};
  const imageUrl = image.profileImageUrl || image.avatarUrl || "";
  const updatedAt = image.profileImageUpdatedAt ? formatDateTime(image.profileImageUpdatedAt) : "";
  return `
    <section class="profile-image-panel">
      <div class="profile-image-preview">
        ${imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(employee.full_name || "社員")}のプロフィール画像">`
          : `<div class="profile-image-placeholder">${escapeHtml(String(employee.full_name || "?").slice(0, 1) || "?")}</div>`}
      </div>
      <div class="profile-image-body">
        <strong>プロフィール画像</strong>
        <p>IDEA NOV OS共通の社員画像です。IDEA LINKや他アプリもこの画像を参照します。</p>
        ${updatedAt ? `<small>更新: ${escapeHtml(updatedAt)}</small>` : `<small>未設定</small>`}
        ${readonly ? "" : `
          <label class="profile-image-upload" for="profile-image-file">
            <span>画像ファイル</span>
            <input id="profile-image-file" type="file" accept="image/png,image/jpeg,image/webp">
          </label>
          <div class="profile-image-actions">
            <span class="save-status" id="profile-image-save-status" aria-live="polite"></span>
            <button class="button button-secondary" id="upload-profile-image" type="button">画像を保存</button>
          </div>`}
      </div>
    </section>`;
}


function renderEmployeeRolePanel(employee) {
  const roleKeys = getCommonRoleKeys(employee);
  const canEdit = state.permissions.canEdit;
  const blockedReason = getStaffRoleBlockedReason(employee);
  if (!roleKeys.length) {
    return `
      <div class="role-panel missing">
        <strong>HUB基本権限</strong>
        <p>${blockedReason ? `${blockedReason} 保存後にstaffを付与してください。` : "共通ロールが未設定です。一般スタッフは staff を付与します。管理者・幹部権限ではありません。"}</p>
        ${canEdit && !blockedReason
          ? `<button class="button button-secondary" id="assign-staff-role" type="button">staffを付与</button>`
          : `<button class="button button-secondary" type="button" disabled>${canEdit ? "復職情報を先に保存" : "staffを付与（編集権限が必要）"}</button>`}
      </div>`;
  }
  const chips = roleKeys
    .map((roleKey) => `<span class="role-chip">${escapeHtml(formatRoleLabel(roleKey))}<small>${escapeHtml(roleKey)}</small></span>`)
    .join("");
  return `
    <div class="role-panel">
      <strong>HUB基本権限</strong>
      <div class="role-chip-list">${chips}</div>
    </div>`;
}

function renderEmployeeAppRolePanel(employee, readonly) {
  const selectedRoleKeys = getIdeaLinkRoleKeys(employee);
  const options = IDEA_LINK_ROLE_KEYS.map((roleKey) => `
    <label class="app-role-option">
      <input type="checkbox" data-idea-link-role="${escapeHtml(roleKey)}"${selectedRoleKeys.includes(roleKey) ? " checked" : ""}${readonly ? " disabled" : ""}>
      <span>
        <strong>${escapeHtml(formatRoleLabel(roleKey))}</strong>
        <small>${escapeHtml(roleKey)}</small>
      </span>
    </label>`).join("");
  return `
    <section class="app-role-panel">
      <div class="app-role-heading">
        <div>
          <strong>アプリ別権限</strong>
          <p>IDEA LINK側の独自マスタは作らず、Core DBの employee_roles を正本にします。</p>
        </div>
        <span class="status-pill${selectedRoleKeys.length ? "" : " warning"}">${selectedRoleKeys.length ? `${selectedRoleKeys.length}件` : "未設定"}</span>
      </div>
      <div class="app-role-group">
        <div>
          <strong>IDEA LINK</strong>
          <p>HUB context / employees.id / role_keys でログイン判定へ渡す権限です。</p>
        </div>
        <div class="app-role-options">${options}</div>
        ${readonly ? "" : `<div class="app-role-actions">
          <button class="button button-secondary" id="save-idea-link-roles" type="button">IDEA LINK権限を保存</button>
        </div>`}
      </div>
    </section>`;
}

function formatRoleLabel(roleKey) {
  return ROLE_LABELS[roleKey] || roleKey;
}

function renderEmployeeIssuePanel(employee, issues) {
  if (!isCurrentEmployee(employee)) {
    return `
      <div class="issue-panel neutral">
        <strong>未設定判定対象外</strong>
        <p>休職者・退職者は未設定ありの対象外です。</p>
      </div>`;
  }
  if (issues.length) {
    const hints = [];
    if (issues.includes("所属")) hints.push("主店舗または部署のどちらかを設定すると、所属未設定が解消します。");
    if (issues.includes("共通ロール")) hints.push("共通ロールはHUBと各アプリの基本表示に使います。一般スタッフは staff を付与します。");
    if (issues.includes("PIN")) hints.push("ログイン/PIN管理で初回PINを設定すると、HUBとIDEA LINK共通ログインに使えます。");
    const hintList = hints.length ? `<ul class="issue-hints">${hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("")}</ul>` : "";
    return `
      <div class="issue-panel">
        <strong>未設定項目</strong>
        <p>${escapeHtml(issues.join("・"))} を確認してください。</p>
        ${hintList}
      </div>`;
  }
  return `
      <div class="issue-panel resolved">
        <strong>未設定なし</strong>
        <p>社員マスタとして必要な項目は入力済みです。</p>
      </div>`;
}

function getStoreAssignmentsByOrder(assignments) {
  return assignments.reduce((index, assignment) => {
    index[Number(assignment.assignment_order)] = assignment.store_id || "";
    return index;
  }, {});
}

function renderCorporationDetail(corporation) {
  const readonly = !state.permissions.canEdit;
  const profile = corporation.business_profile || {};
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(corporation.corporation_name)}</h3>
    <p class="detail-meta">法人No: ${escapeHtml(corporation.corporation_no)}${profile.updated_at ? ` / 詳細更新: ${escapeHtml(formatDateTime(profile.updated_at))}` : ""}</p>
    <p class="detail-note">${readonly ? "閲覧専用モードです。編集権限がある管理者のみ保存できます。" : "法人No、法人名、経営判断に使う補足情報を更新できます。"}</p>
    <form class="form-grid store-detail-form" id="detail-form">
      ${fieldInput("corporation_no", "法人No", corporation.corporation_no || "", { required: true, placeholder: "例: 001" })}
      ${fieldInput("corporation_name", "法人名", corporation.corporation_name || "")}
      ${fieldCheckbox("is_active", "有効", corporation.is_active !== false)}
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>法人情報</strong>
            <p>登記・請求で使う情報</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("formal_corporation_name", "正式名", profile.formal_corporation_name || "", { placeholder: "例: 株式会社〇〇" })}
          ${fieldInput("corporation_number", "法人番号", profile.corporation_number || "", { placeholder: "13桁" })}
          ${fieldInput("invoice_registration_number", "インボイス番号", profile.invoice_registration_number || "", { placeholder: "T + 13桁" })}
          ${fieldInput("representative_name", "代表者", profile.representative_name || "")}
          <div class="store-detail-wide">${fieldInput("head_office_address", "所在地", profile.head_office_address || "")}</div>
          ${fieldInput("phone_number", "電話番号", profile.phone_number || "")}
        </div>
      </section>
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>会計・労務</strong>
            <p>決算・給与・保険</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("fiscal_year_end_month", "決算月", profile.fiscal_year_end_month ?? "", { type: "number", step: "1", min: "1", max: "12", placeholder: "1-12" })}
          ${fieldInput("accounting_category", "会計区分", profile.accounting_category || "", { placeholder: "例: 自社 / FC / 関連会社" })}
          ${fieldInput("payroll_closing_day", "給与締日", profile.payroll_closing_day || "", { placeholder: "例: 月末" })}
          ${fieldInput("payroll_payment_day", "給与支払日", profile.payroll_payment_day || "", { placeholder: "例: 翌月25日" })}
          ${fieldInput("social_insurance_status", "社会保険", profile.social_insurance_status || "")}
          ${fieldInput("labor_insurance_status", "労保", profile.labor_insurance_status || "")}
          ${fieldInput("tax_accountant_label", "税理士", profile.tax_accountant_label || "")}
          ${fieldInput("labor_consultant_label", "社労士", profile.labor_consultant_label || "")}
        </div>
      </section>
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>運用状態</strong>
            <p>設立・廃止・補足</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("operating_status", "状況", profile.operating_status || "", { placeholder: "運用中 / 休眠 / 廃止" })}
          ${fieldInput("established_on", "設立日", profile.established_on || "", "date")}
          ${fieldInput("closed_on", "廃止日", profile.closed_on || "", "date")}
          <div class="store-detail-wide">${fieldTextarea("corporation_feature_note", "備考", profile.corporation_feature_note || "")}</div>
          <p class="field-help store-detail-help">Secret、口座番号、税務資料本文は保存しません。</p>
        </div>
      </section>
      <div class="save-row">
        <span class="save-status" id="corporation-save-status" aria-live="polite"></span>
        ${readonly ? `<span class="readonly-label">閲覧専用</span>` : `<button class="button button-primary save-button" type="submit">保存</button>`}
      </div>
    </form>`;
  setReadonlyState(readonly);
  if (!readonly) {
    const form = document.querySelector("#detail-form");
    form.addEventListener("submit", saveCorporation);
    setupDirtyForm("corporation");
  }
}

function startCreateCorporation() {
  if (!state.permissions.canEdit) {
    showToast("編集権限がありません。", "error");
    return;
  }
  state.view = "corporations";
  state.selectedId = NEW_CORPORATION_ID;
  state.formSnapshot = null;
  render();
}

function renderNewCorporationDetail() {
  elements.detailPanel.innerHTML = `
    <h3>新規法人追加</h3>
    <p class="detail-meta">Core DB corporations に法人を追加します。</p>
    <p class="detail-note">法人名だけで仮登録できます。法人Noが空欄の場合は仮Noを自動発行し、後から編集できます。</p>
    <form class="form-grid store-detail-form" id="detail-form">
      ${fieldInput("corporation_no", "法人No", "", { placeholder: "空欄なら仮Noを自動発行" })}
      ${fieldInput("corporation_name", "法人名", "", { required: true, placeholder: "例: 株式会社〇〇" })}
      ${fieldCheckbox("is_active", "有効", true)}
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>法人情報</strong>
            <p>登記・請求で使う情報</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("formal_corporation_name", "正式名", "", { placeholder: "例: 株式会社〇〇" })}
          ${fieldInput("corporation_number", "法人番号", "", { placeholder: "13桁" })}
          ${fieldInput("invoice_registration_number", "インボイス番号", "", { placeholder: "T + 13桁" })}
          ${fieldInput("representative_name", "代表者", "")}
          <div class="store-detail-wide">${fieldInput("head_office_address", "所在地", "")}</div>
          ${fieldInput("phone_number", "電話番号", "")}
        </div>
      </section>
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>会計・労務</strong>
            <p>決算・給与・保険</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("fiscal_year_end_month", "決算月", "", { type: "number", step: "1", min: "1", max: "12", placeholder: "1-12" })}
          ${fieldInput("accounting_category", "会計区分", "", { placeholder: "例: 自社 / FC / 関連会社" })}
          ${fieldInput("payroll_closing_day", "給与締日", "", { placeholder: "例: 月末" })}
          ${fieldInput("payroll_payment_day", "給与支払日", "", { placeholder: "例: 翌月25日" })}
          ${fieldInput("social_insurance_status", "社会保険", "")}
          ${fieldInput("labor_insurance_status", "労保", "")}
          ${fieldInput("tax_accountant_label", "税理士", "")}
          ${fieldInput("labor_consultant_label", "社労士", "")}
        </div>
      </section>
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>運用状態</strong>
            <p>設立・廃止・補足</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("operating_status", "状況", "", { placeholder: "運用中 / 休眠 / 廃止" })}
          ${fieldInput("established_on", "設立日", "", "date")}
          ${fieldInput("closed_on", "廃止日", "", "date")}
          <div class="store-detail-wide">${fieldTextarea("corporation_feature_note", "備考", "")}</div>
          <p class="field-help store-detail-help">Secret、口座番号、税務資料本文は保存しません。</p>
        </div>
      </section>
      <div class="save-row">
        <span class="save-status" id="corporation-save-status" aria-live="polite"></span>
        <button class="button button-primary save-button" type="submit">法人を追加</button>
      </div>
    </form>`;
  const form = document.querySelector("#detail-form");
  form.addEventListener("submit", saveCorporation);
  setupDirtyForm("corporation");
  elements.detailPanel.scrollTop = 0;
}

function renderStoreDetail(store) {
  const readonly = !state.permissions.canEdit;
  const issues = getStoreIssues(store);
  const issuePanel = renderStoreIssuePanel(store, issues);
  const lineWorks = store.line_works_channel || {};
  const profile = store.business_profile || {};
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(store.store_name)}</h3>
    <p class="detail-meta">店舗ID: ${escapeHtml(store.store_id)} / 店舗No: ${escapeHtml(store.store_no)}${store.updated_at ? ` / 最終更新: ${escapeHtml(formatDateTime(store.updated_at))}` : ""}</p>
    <p class="detail-note">${readonly ? "閲覧専用モードです。編集権限がある管理者のみ保存できます。" : "店舗IDと店舗Noは固定項目です。店舗運営・経営判断に使う補足情報を更新できます。"}</p>
    <form class="form-grid store-detail-form" id="detail-form">
      ${issuePanel}
      ${fieldInput("store_name", "店舗名", store.store_name || "")}
      ${fieldSelect("corporation_id", "法人", state.masters.corporations, store.corporation_id, "corporation_name")}
      ${fieldSelect("business_unit_id", "事業部門", state.masters.businessUnits, store.business_unit_id, "business_unit_name")}
      ${fieldValueSelect("area", "エリア", getUniqueValues(state.stores, "area"), store.area || "")}
      ${fieldValueSelect("store_type", "店舗種別", getUniqueValues(state.stores, "store_type"), store.store_type || "")}
      ${fieldCheckbox("is_active", "有効", store.is_active)}
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>営業時間・開閉店</strong>
            <p>休業日と営業状態</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("regular_holiday_rule", "定休日", profile.regular_holiday_rule || "", { placeholder: "例: 火曜" })}
          ${fieldInput("operating_status", "状況", profile.operating_status || "", { placeholder: "営業中 / 準備中 / 閉店" })}
          ${fieldInput("weekday_business_hours", "平日", profile.weekday_business_hours || "", { placeholder: "10:00-20:00" })}
          ${fieldInput("saturday_business_hours", "土曜", profile.saturday_business_hours || "", { placeholder: "10:00-20:00" })}
          ${fieldInput("sunday_business_hours", "日曜", profile.sunday_business_hours || "", { placeholder: "10:00-19:00" })}
          ${fieldInput("holiday_business_hours", "祝日", profile.holiday_business_hours || "", { placeholder: "10:00-19:00" })}
          ${fieldInput("opened_on", "オープン日", profile.opened_on || "", "date")}
          ${fieldInput("closed_on", "閉店日", profile.closed_on || "", "date")}
          ${fieldInput("affiliation_label", "所属", profile.affiliation_label || "", { placeholder: "BASSA / FC / 本部" })}
        </div>
      </section>
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>面積・賃料</strong>
            <p>家賃は共益費込み</p>
          </div>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("floor_area_tsubo", "坪数", profile.floor_area_tsubo ?? "", { type: "number", step: "0.01", min: "0" })}
          ${fieldInput("floor_area_square_meter", "㎡", profile.floor_area_square_meter ?? "", { type: "number", step: "0.01", min: "0" })}
          ${fieldInput("monthly_rent_including_common_fee", "家賃", profile.monthly_rent_including_common_fee ?? "", { type: "number", step: "1", min: "0" })}
          ${fieldInput("rent_per_tsubo", "坪単価", profile.rent_per_tsubo ?? "", { type: "number", step: "1", min: "0" })}
          ${fieldInput("styling_seat_count", "セット面", profile.styling_seat_count ?? "", { type: "number", step: "1", min: "0" })}
          ${fieldInput("shampoo_station_count", "シャンプー台", profile.shampoo_station_count ?? "", { type: "number", step: "1", min: "0" })}
          ${fieldInput("rent_per_styling_seat", "席単価", profile.rent_per_styling_seat ?? "", { type: "number", step: "1", min: "0" })}
          <div class="store-detail-wide">${fieldTextarea("store_feature_note", "特徴", profile.store_feature_note || "")}</div>
          <p class="field-help store-detail-help">PASSやSecretは保存しません。</p>
        </div>
      </section>
      <section class="store-detail-section">
        <div class="store-detail-section-header">
          <div>
            <strong>店舗通知</strong>
            <p>店舗チャンネル宛て</p>
          </div>
          <span class="status-pill ${lineWorks.channel_id && lineWorks.is_active !== false ? "success" : "neutral"}">${lineWorks.channel_id && lineWorks.is_active !== false ? "設定済み" : "未設定"}</span>
        </div>
        <div class="store-detail-compact-grid">
          ${fieldInput("line_works_channel_id", "チャンネルID", lineWorks.channel_id || "", { placeholder: "例: 1234567890" })}
          ${fieldInput("line_works_channel_name", "表示名", lineWorks.channel_name || "", { placeholder: "例: BASSA野方店" })}
          <div class="store-detail-wide">${fieldCheckbox("line_works_channel_active", "通知を有効にする", lineWorks.is_active !== false && Boolean(lineWorks.channel_id))}</div>
          <p class="field-help store-detail-help">SecretはEdge側で管理します。</p>
        </div>
      </section>
      <div class="save-row">
        <span class="save-status" id="store-save-status" aria-live="polite"></span>
        ${readonly ? `<span class="readonly-label">閲覧専用</span>` : `<button class="button button-primary save-button" type="submit">保存</button>`}
      </div>
    </form>`;
  setReadonlyState(readonly);
  if (!readonly) {
    const form = document.querySelector("#detail-form");
    form.addEventListener("submit", saveStore);
    setupDirtyForm("store");
  }
}

function renderPortalAppDetail(app) {
  const readonly = !state.permissions.canEdit;
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(app.appName)}</h3>
    <p class="detail-meta">App ID: ${escapeHtml(app.appId)}${app.updatedAt ? ` / 最終更新: ${escapeHtml(formatDateTime(app.updatedAt))}` : ""}</p>
    <p class="detail-note">NOV HUBに表示するアプリカードを管理します。権限がないアプリはHUB上に表示されません。</p>
    <section class="app-detail-actions">
      <button class="button button-secondary" type="button" data-app-action="toggle-active" ${readonly ? "disabled" : ""}>
        ${app.isActive === false ? "公開する" : "非公開にする"}
      </button>
      <button class="button button-secondary" type="button" data-app-action="toggle-featured" ${readonly ? "disabled" : ""}>
        ${app.isFeatured ? "よく使うから外す" : "よく使うに入れる"}
      </button>
      <button class="button button-secondary" type="button" data-app-action="move-up" ${readonly ? "disabled" : ""}>上へ</button>
      <button class="button button-secondary" type="button" data-app-action="move-down" ${readonly ? "disabled" : ""}>下へ</button>
    </section>
    <form class="form-grid" id="detail-form">
      ${fieldInput("appId", "アプリID", app.appId || "", { required: true })}
      ${fieldInput("appName", "アプリ名", app.appName || "", { required: true })}
      ${fieldInput("description", "説明", app.description || "")}
      ${fieldInput("url", "URL", app.url || "")}
      ${fieldInput("category", "カテゴリ", app.category || "")}
      ${fieldInput("icon", "アイコンID", app.icon || "default")}
      ${fieldInput("priority", "優先度", app.priority || 999, "number")}
      ${fieldStaticSelect("requiredLevel", "必要権限レベル", [
        ["1", "1 全スタッフ"],
        ["2", "2 スタイリスト以上"],
        ["3", "3 SD・店長以上"],
        ["4", "4 Mgr・部長以上"],
        ["5", "5 役員・本部幹部"]
      ], String(app.requiredLevel || 1))}
      ${fieldTextarea("allowedTags", "許可タグ（カンマ区切り）", joinListForInput(app.allowedTags))}
      ${fieldTextarea("targetDepartment", "対象部署（カンマ区切り）", joinListForInput(app.targetDepartment))}
      ${fieldTextarea("targetPosition", "対象役職（カンマ区切り）", joinListForInput(app.targetPosition))}
      ${fieldCheckbox("isActive", "HUBに表示する", app.isActive !== false)}
      ${fieldCheckbox("isFeatured", "よく使うアプリに表示", app.isFeatured)}
      <div class="save-row">
        <span class="save-status" id="app-save-status" aria-live="polite"></span>
        ${readonly ? `<span class="readonly-label">閲覧専用</span>` : `<button class="button button-primary save-button" type="submit">保存</button>`}
      </div>
    </form>`;
  setReadonlyState(readonly);
  if (!readonly) {
    const form = document.querySelector("#detail-form");
    form.addEventListener("submit", savePortalApp);
    elements.detailPanel.querySelectorAll(".app-detail-actions [data-app-action]").forEach((button) => {
      button.addEventListener("click", () => handlePortalAppQuickAction(app, button.dataset.appAction));
    });
    setupDirtyForm("app");
  }
}

function startCreatePortalApp() {
  if (!state.permissions.canEdit) {
    showToast("編集権限がありません。", "error");
    return;
  }
  state.view = "apps";
  state.selectedId = NEW_PORTAL_APP_ID;
  state.formSnapshot = null;
  render();
}

function renderNewPortalAppDetail() {
  elements.detailPanel.innerHTML = `
    <h3>新規アプリ追加</h3>
    <p class="detail-meta">Supabase portal_apps に新しいHUBカードを追加します。</p>
    <p class="detail-note">アプリIDは英数字・ハイフン・アンダースコアで一意にしてください。非公開で作成してから公開すると安全です。</p>
    <form class="form-grid" id="detail-form">
      ${fieldInput("appId", "アプリID", "", { required: true, placeholder: "example-app" })}
      ${fieldInput("appName", "アプリ名", "", { required: true, placeholder: "例：シフト管理" })}
      ${fieldInput("description", "説明", "", { placeholder: "例：勤務予定・希望休の確認" })}
      ${fieldInput("url", "URL", "", { placeholder: "https://example.com/ または ./app/" })}
      ${fieldInput("category", "カテゴリ", "社内アプリ")}
      ${fieldInput("icon", "アイコンID", "default")}
      ${fieldInput("priority", "優先度", 999, "number")}
      ${fieldStaticSelect("requiredLevel", "必要権限レベル", [
        ["1", "1 全スタッフ"],
        ["2", "2 スタイリスト以上"],
        ["3", "3 SD・店長以上"],
        ["4", "4 Mgr・部長以上"],
        ["5", "5 役員・本部幹部"]
      ], "1")}
      ${fieldTextarea("allowedTags", "許可タグ（カンマ区切り）", "")}
      ${fieldTextarea("targetDepartment", "対象部署（カンマ区切り）", "")}
      ${fieldTextarea("targetPosition", "対象役職（カンマ区切り）", "")}
      ${fieldCheckbox("isActive", "HUBに表示する", true)}
      ${fieldCheckbox("isFeatured", "よく使うアプリに表示", false)}
      <div class="save-row">
        <span class="save-status" id="app-save-status" aria-live="polite"></span>
        <button class="button button-primary save-button" type="submit">追加</button>
      </div>
    </form>`;
  const form = document.querySelector("#detail-form");
  form.addEventListener("submit", savePortalApp);
  setupDirtyForm("app");
}

function renderStoreIssuePanel(store, issues) {
  if (!store.is_active) {
    return `
      <div class="issue-panel neutral">
        <strong>未設定判定対象外</strong>
        <p>無効店舗は未設定ありの対象外です。</p>
      </div>`;
  }
  if (issues.length) {
    return `
      <div class="issue-panel">
        <strong>未設定項目</strong>
        <p>${escapeHtml(issues.join("・"))} を確認してください。</p>
      </div>`;
  }
  return `
      <div class="issue-panel resolved">
        <strong>未設定なし</strong>
        <p>店舗マスタとして必要な項目は入力済みです。</p>
      </div>`;
}

function setReadonlyState(readonly) {
  if (!readonly) return;
  document.querySelectorAll("#detail-form input, #detail-form select, #detail-form textarea").forEach((field) => {
    field.disabled = true;
  });
}

function fieldInput(name, label, value, type = "text") {
  const options = typeof type === "object" && type ? type : { type };
  const inputType = options.type || "text";
  const required = options.required ? " required" : "";
  const disabled = options.disabled ? " disabled" : "";
  const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : "";
  const step = options.step ? ` step="${escapeHtml(options.step)}"` : "";
  const min = options.min !== undefined ? ` min="${escapeHtml(options.min)}"` : "";
  const max = options.max !== undefined ? ` max="${escapeHtml(options.max)}"` : "";
  return `
    <div class="form-field">
      <label for="${escapeHtml(name)}">${escapeHtml(label)}</label>
      <input class="form-input" id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(inputType)}" value="${escapeHtml(value ?? "")}"${placeholder}${step}${min}${max}${required}${disabled}>
    </div>`;
}

function fieldTextarea(name, label, value) {
  return `
    <div class="form-field">
      <label for="${escapeHtml(name)}">${escapeHtml(label)}</label>
      <textarea class="form-input" id="${escapeHtml(name)}" name="${escapeHtml(name)}" rows="3">${escapeHtml(value || "")}</textarea>
    </div>`;
}

function isForbiddenEmployeeAttributeLabel(row, labelKey) {
  return FORBIDDEN_EMPLOYEE_ATTRIBUTE_LABELS.has(String(row && row[labelKey] || "").trim());
}

function isAllowedPositionOption(row, labelKey) {
  return FORMAL_EMPLOYEE_POSITION_LABELS.has(String(row && row[labelKey] || "").trim());
}

function fieldSelect(name, label, rows, value, labelKey) {
  const normalizedValue = String(value || "");
  const visibleRows = rows.filter((row) => (
    !isForbiddenEmployeeAttributeLabel(row, labelKey)
    && (name !== "position_id" || isAllowedPositionOption(row, labelKey))
    && (row.is_active !== false || String(row.id || "") === normalizedValue)
  ));
  const options = [`<option value="">未設定</option>`].concat(visibleRows.map((row) => {
    const selected = String(row.id || "") === normalizedValue ? " selected" : "";
    const inactiveLabel = row.is_active === false ? "（非表示）" : "";
    return `<option value="${escapeHtml(row.id)}"${selected}>${escapeHtml(row[labelKey])}${inactiveLabel}</option>`;
  }));
  return `
    <div class="form-field">
      <label for="${name}">${label}</label>
      <select class="form-select" id="${name}" name="${name}">${options.join("")}</select>
    </div>`;
}

function fieldStaticSelect(name, label, options, value) {
  const htmlOptions = options.map(([optionValue, optionLabel]) => {
    const selected = optionValue === value ? " selected" : "";
    return `<option value="${escapeHtml(optionValue)}"${selected}>${escapeHtml(optionLabel)}</option>`;
  });
  return `
    <div class="form-field">
      <label for="${name}">${label}</label>
      <select class="form-select" id="${name}" name="${name}">${htmlOptions.join("")}</select>
    </div>`;
}

function renderJobTypeField(value) {
  if (!state.masters.jobTypes.length) return "";
  return fieldSelect("job_type_id", "職種", state.masters.jobTypes, value, "job_type_name");
}

function fieldValueSelect(name, label, values, value) {
  const normalizedValue = String(value || "").trim();
  const optionValues = Array.from(new Set(["", ...values, normalizedValue].filter((item, index) => index === 0 || item)));
  const htmlOptions = optionValues.map((optionValue) => {
    const selected = optionValue === normalizedValue ? " selected" : "";
    const optionLabel = optionValue || "未設定";
    return `<option value="${escapeHtml(optionValue)}"${selected}>${escapeHtml(optionLabel)}</option>`;
  });
  return `
    <div class="form-field">
      <label for="${name}">${label}</label>
      <select class="form-select" id="${name}" name="${name}">${htmlOptions.join("")}</select>
    </div>`;
}

function fieldCheckbox(name, label, checked) {
  return `
    <label class="checkbox-row">
      <input id="${name}" name="${name}" type="checkbox"${checked ? " checked" : ""}>
      <span>${label}</span>
    </label>`;
}

function collectFormPayload() {
  const form = document.querySelector("#detail-form");
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function collectEmployeePayload() {
  const payload = collectFormPayload();
  delete payload.firebase_uid;
  payload.email = getCurrentEmployeeEmailInputValue();
  payload.employment_type = normalizeEmploymentType(payload.employment_type);
  payload.employment_status = normalizeEmploymentStatus(payload.employment_status);
  payload.leave_type = normalizeLeaveType(payload.leave_type);
  payload.is_active = document.querySelector("#is_active").checked;
  return payload;
}

function collectStorePayload() {
  const payload = collectFormPayload();
  payload.is_active = document.querySelector("#is_active").checked;
  payload.line_works_channel_id = document.querySelector("#line_works_channel_id")?.value.trim() || "";
  payload.line_works_channel_name = document.querySelector("#line_works_channel_name")?.value.trim() || "";
  payload.line_works_channel_active = document.querySelector("#line_works_channel_active")?.checked || false;
  return payload;
}

function collectCorporationPayload() {
  const payload = collectFormPayload();
  payload.is_active = document.querySelector("#is_active").checked;
  return payload;
}

function collectPortalAppPayload() {
  const payload = collectFormPayload();
  payload.id = state.selectedId;
  payload.isActive = document.querySelector("#isActive")?.checked || false;
  payload.isFeatured = document.querySelector("#isFeatured")?.checked || false;
  payload.allowedTags = splitInputList(document.querySelector("#allowedTags")?.value);
  payload.targetDepartment = splitInputList(document.querySelector("#targetDepartment")?.value);
  payload.targetPosition = splitInputList(document.querySelector("#targetPosition")?.value);
  return payload;
}

function splitInputList(value) {
  return String(value || "")
    .split(/[,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinListForInput(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function setupDirtyForm(type) {
  const form = document.querySelector("#detail-form");
  const status = getSaveStatusElement(type);
  const button = form?.querySelector(".save-button");
  if (!form || !button) return;
  state.formSnapshot = getFormSnapshot(type);
  updateDirtyState(type, status, button);
  form.addEventListener("input", () => updateDirtyState(type, status, button));
  form.addEventListener("change", () => updateDirtyState(type, status, button));
}

function getSaveStatusElement(type) {
  return document.querySelector(
    type === "employee" ? "#employee-save-status"
      : type === "store" ? "#store-save-status"
      : type === "corporation" ? "#corporation-save-status"
      : "#app-save-status"
  );
}

function setupLoginCredentialDirtyState() {
  const panel = document.querySelector("#login-credential-panel");
  const button = document.querySelector("#save-login-credential");
  const status = document.querySelector("#login-credential-save-status");
  if (!panel || !button) return;
  const snapshot = getLoginCredentialSnapshot();
  button.dataset.snapshot = snapshot;
  updateLoginCredentialDirtyState(snapshot, status, button);
  panel.querySelectorAll("input").forEach((field) => {
    field.addEventListener("input", () => updateLoginCredentialDirtyState(snapshot, status, button));
    field.addEventListener("change", () => updateLoginCredentialDirtyState(snapshot, status, button));
  });
}

function getLoginCredentialSnapshot() {
  const payload = {
    login_email: getCurrentEmployeeEmailInputValue(),
    new_pin: document.querySelector("#new_pin")?.value.trim() || "",
    login_enabled: document.querySelector("#login_enabled")?.checked || false,
    must_change_pin: document.querySelector("#must_change_pin")?.checked || false,
    clear_lock: document.querySelector("#clear_login_lock")?.checked || false
  };
  return JSON.stringify(Object.keys(payload).sort().map((key) => [key, normalizeSnapshotValue_(payload[key])]));
}

function updateLoginCredentialDirtyState(snapshot, status, button) {
  const hasChanges = getLoginCredentialSnapshot() !== snapshot;
  button.disabled = !hasChanges;
  button.title = hasChanges
    ? "ログイン/PIN設定に未保存の変更があります。このボタンで保存してください。"
    : "ログイン/PIN設定に変更はありません。";
  if (hasChanges) {
    setSaveStatus(status, "ログイン/PIN設定に未保存の変更があります。", "pending");
  } else {
    const employee = state.employees.find((item) => item.id === state.selectedId);
    setSaveStatus(status, getLoginCredentialStatusMessage(employee), getLoginCredentialStatusTone(employee));
  }
}

function getLoginCredentialStatusMessage(employee) {
  const credential = getEmployeeCredential(employee);
  const loginEmail = getCurrentEmployeeEmailInputValue() || credential.login_email || employee?.email || "";
  if (!loginEmail && !credential.pin_set) return "初回PINを設定";
  if (!credential.pin_set) return "PIN未設定です。";
  if (!loginEmail) return "PIN設定済み";
  if (credential.login_enabled === false) return "ログイン停止中です。";
  if (credential.locked) return "ログインがロック中です。";
  if (credential.must_change_pin) return "次回ログイン時にPIN変更が必要です。";
  return "ログイン/PIN設定は保存済みです。";
}

function getLoginCredentialStatusTone(employee) {
  const credential = getEmployeeCredential(employee);
  const loginEmail = getCurrentEmployeeEmailInputValue() || credential.login_email || employee?.email || "";
  if (!credential.pin_set || credential.locked || credential.must_change_pin) return "pending";
  if (credential.login_enabled === false) return "error";
  return "success";
}

function getCurrentEmployeeEmailInputValue() {
  return document.querySelector("#email")?.value.trim() || "";
}

function normalizeEmployeeEmailInput(email) {
  return String(email || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmployeeEmail(email) {
  const value = normalizeEmployeeEmailInput(email);
  if (!value || value.length > 254) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart || localPart.length > 64) return false;
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false;
  if (!/^[^\s@]+$/.test(localPart)) return false;
  const labels = domainPart.toLowerCase().split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function updateDirtyState(type, status, button) {
  const hasChanges = getFormSnapshot(type) !== state.formSnapshot;
  button.disabled = !hasChanges;
  button.title = hasChanges ? "変更があります。保存できます。" : "変更がないため保存は不要です。";
  if (!hasChanges) {
    button.textContent = "保存";
    setSaveStatus(status, "変更なし・保存済みです", "success");
  } else {
    setSaveStatus(status, "未保存の変更があります。保存ボタンを押してください。", "pending");
  }
}

function getFormSnapshot(type) {
  const payload = type === "employee" ? collectEmployeePayload()
    : type === "store" ? collectStorePayload()
      : type === "corporation" ? collectCorporationPayload()
        : collectPortalAppPayload();
  delete payload.id;
  return JSON.stringify(Object.keys(payload).sort().map((key) => [key, normalizeSnapshotValue_(payload[key])]));
}

function normalizeSnapshotValue_(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "").trim();
}

function markCurrentFormSaved(type, message = "保存しました。変更履歴にも反映済みです。") {
  const form = document.querySelector("#detail-form");
  const status = getSaveStatusElement(type);
  const button = form?.querySelector(".save-button");
  if (!form || !button) return;
  state.formSnapshot = getFormSnapshot(type);
  button.disabled = true;
  button.title = "変更がないため保存は不要です。";
  button.textContent = "保存";
  setSaveStatus(status, message, "success");
}

function restoreSaveButtonState(type, button) {
  if (!button?.isConnected) return;
  const status = getSaveStatusElement(type);
  button.textContent = "保存";
  updateDirtyState(type, status, button);
}

async function saveEmployee(event) {
  event.preventDefault();
  const button = event.submitter;
  const status = document.querySelector("#employee-save-status");
  let saved = false;
  try {
    setSaveStatus(status, "");
    const payload = collectEmployeePayload();
    payload.id = state.selectedId;
    payload.email = normalizeEmployeeEmailInput(payload.email);
    if (getFormSnapshot("employee") === state.formSnapshot) {
      setSaveStatus(status, "変更なし・保存済みです", "success");
      showToast("変更はありません。");
      return;
    }
    if (payload.email && !isValidEmployeeEmail(payload.email)) {
      showToast("メールアドレスの形式を確認してください。");
      return;
    }
    const invalidDateField = getInvalidDateField(payload, [
      ["birth_date", "誕生日"],
      ["joined_on", "入社日"],
      ["retired_on", "退職日"],
      ["leave_start_date", "休職開始日"],
      ["leave_end_date", "休職終了日・復職日"]
    ]);
    if (invalidDateField) {
      showToast(`${invalidDateField}は 1993-08-01 の形式で入力してください。`);
      return;
    }
    const selectedStores = [payload.store_id, payload.store_assignment_2, payload.store_assignment_3].filter(Boolean);
    if (new Set(selectedStores).size !== selectedStores.length) {
      showToast("主店舗・サブ店舗・第3店舗に同じ店舗は選べません。");
      return;
    }
    button.disabled = true;
    button.title = "保存中です。";
    button.textContent = "保存中...";
    setSaveStatus(status, "保存中です...", "pending");
    await callApiAction("masterUpdateEmployee", payload);
    await refreshEmployees();
    const logsSynced = await refreshLogsSilently();
    saved = true;
    markCurrentFormSaved(
      "employee",
      logsSynced ? "保存しました。変更履歴にも反映済みです。" : "保存しました。変更履歴は後で再読み込みしてください。"
    );
    showToast(logsSynced ? "社員情報を保存し、変更履歴へ反映しました。" : "社員情報を保存しました。変更履歴は後で確認してください。");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
  } finally {
    if (!saved) {
      window.setTimeout(() => {
        restoreSaveButtonState("employee", button);
      }, 700);
    }
  }
}

function getInvalidDateField(payload, fields) {
  const invalid = fields.find(([key]) => {
    const value = String(payload[key] || "").trim();
    return value && !/^\d{4}-\d{2}-\d{2}$/.test(value);
  });
  return invalid ? invalid[1] : "";
}

async function retireEmployee(event) {
  const employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const confirmed = window.confirm(`${employee.full_name}さんを退職処理します。\n\nemployment_status を「退職」、is_active を false にします。`);
  if (!confirmed) return;
  const button = event.currentTarget;
  try {
    button.disabled = true;
    await callApiAction("masterUpdateEmployee", {
      id: employee.id,
      employment_status: "退職",
      is_active: false
    });
    showToast("退職処理を保存しました。");
    await refreshEmployees();
    state.employeeStatus = "inactive";
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
  } finally {
    button.disabled = false;
  }
}

async function assignStaffRole(event) {
  let employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const hasUnsavedEmployeeChanges = Boolean(document.querySelector("#detail-form"))
    && getFormSnapshot("employee") !== state.formSnapshot;
  const confirmed = window.confirm(`${employee.full_name}さんに共通ロール（staff）を付与します。\n\nstaffは管理者・幹部権限ではありません。${hasUnsavedEmployeeChanges ? "\n\n未保存の社員情報があるため、先に社員情報を保存してからstaffを付与します。" : ""}`);
  if (!confirmed) return;
  const button = event.currentTarget;
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = hasUnsavedEmployeeChanges ? "保存中..." : "付与中...";
    if (hasUnsavedEmployeeChanges) {
      employee = await saveEmployeeChangesBeforeRoleAssignment(employee);
      button.textContent = "付与中...";
    }
    const blockedReason = getStaffRoleBlockedReason(employee);
    if (blockedReason) {
      throw new Error(`${blockedReason} 保存後にstaffを付与してください。`);
    }
    await callApiAction("masterAssignDefaultStaffRole", { id: employee.id });
    showToast("staff権限を付与しました。", "success");
    await refreshEmployees();
    await refreshLogsSilently();
    state.selectedId = employee.id;
    render();
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
    button.disabled = false;
    button.textContent = originalText || "staff権限を付与";
  }
}

async function saveEmployeeChangesBeforeRoleAssignment(employee) {
  const payload = collectEmployeePayload();
  payload.id = employee.id;
  payload.email = normalizeEmployeeEmailInput(payload.email);

  if (payload.email && !isValidEmployeeEmail(payload.email)) {
    throw new Error("メールアドレスの形式を確認してください。");
  }
  const invalidDateField = getInvalidDateField(payload, [
    ["birth_date", "誕生日"],
    ["joined_on", "入社日"],
    ["retired_on", "退職日"],
    ["leave_start_date", "休職開始日"],
    ["leave_end_date", "休職終了日・復職日"]
  ]);
  if (invalidDateField) {
    throw new Error(`${invalidDateField}は 1993-08-01 の形式で入力してください。`);
  }
  const selectedStores = [payload.store_id, payload.store_assignment_2, payload.store_assignment_3].filter(Boolean);
  if (new Set(selectedStores).size !== selectedStores.length) {
    throw new Error("主店舗・サブ店舗・第3店舗に同じ店舗は選べません。");
  }

  await callApiAction("masterUpdateEmployee", payload);
  await refreshEmployees();
  await refreshLogsSilently();
  const updated = state.employees.find((item) => item.id === employee.id);
  if (!updated) throw new Error("社員情報の保存後に社員データを確認できませんでした。");
  return updated;
}

async function saveIdeaLinkRoles(event) {
  const employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const button = event.currentTarget;
  const originalText = button.textContent;
  const roleKeys = IDEA_LINK_ROLE_KEYS.filter((roleKey) => (
    document.querySelector(`[data-idea-link-role="${roleKey}"]`)?.checked
  ));
  try {
    button.disabled = true;
    button.textContent = "保存中...";
    await callApiAction("masterUpdateEmployeeAppRoles", {
      id: employee.id,
      appKey: "idea_link",
      roleKeys
    });
    await refreshEmployees();
    await refreshLogsSilently();
    state.selectedId = employee.id;
    render();
    showToast("IDEA LINK権限を保存しました。");
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
    button.disabled = false;
    button.textContent = originalText || "IDEA LINK権限を保存";
  }
}

async function linkFirebaseUid(event) {
  const employee = state.employees.find((item) => item.id === state.selectedId);
  const firebaseUid = document.querySelector("#firebase_uid")?.value.trim() || "";
  if (!employee) return;
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(firebaseUid)) {
    showToast("Firebase UIDの形式を確認してください。");
    return;
  }
  const confirmed = window.confirm(`${employee.full_name}さんにFirebase UIDを連携します。\n\n${firebaseUid}`);
  if (!confirmed) return;
  const button = event.currentTarget;
  try {
    button.disabled = true;
    await callApiAction("masterLinkFirebaseUid", {
      id: employee.id,
      firebase_uid: firebaseUid
    });
    showToast("Firebase UIDを連携しました。");
    await refreshEmployees();
    if (state.view === "firebase") state.selectedId = "";
    render();
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
  } finally {
    button.disabled = false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("ファイルを読み込めませんでした。")));
    reader.readAsDataURL(file);
  });
}

async function uploadEmployeeProfileImage(event) {
  const employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const input = document.querySelector("#profile-image-file");
  const status = document.querySelector("#profile-image-save-status");
  const button = event.currentTarget;
  const file = input?.files?.[0];
  if (!file) {
    showToast("画像ファイルを選択してください。");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showToast("画像はJPEG、PNG、WebPを選択してください。");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("画像は5MB以下にしてください。");
    return;
  }
  try {
    button.disabled = true;
    button.textContent = "保存中...";
    setSaveStatus(status, "画像を保存しています...", "pending");
    const dataUrl = await readFileAsDataUrl(file);
    await callApiAction("masterUploadEmployeeProfileImage", {
      id: employee.id,
      fileName: file.name,
      contentType: file.type,
      dataUrl
    });
    await refreshEmployees();
    state.selectedId = employee.id;
    await refreshLogsSilently();
    render();
    showToast("プロフィール画像を保存しました。");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
    button.disabled = false;
    button.textContent = "画像を保存";
  }
}


async function saveEmployeeLoginCredential(event) {
  const employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const button = event.currentTarget;
  const status = document.querySelector("#login-credential-save-status");
  const loginEmail = normalizeEmployeeEmailInput(getCurrentEmployeeEmailInputValue());
  const newPin = document.querySelector("#new_pin")?.value.trim() || "";
  const loginEnabled = document.querySelector("#login_enabled")?.checked || false;
  const mustChangePin = document.querySelector("#must_change_pin")?.checked || false;
  const clearLock = document.querySelector("#clear_login_lock")?.checked || false;

  if (loginEmail && !isValidEmployeeEmail(loginEmail)) {
    setSaveStatus(status, "メールアドレスの形式を確認してください。", "error");
    showToast("メールアドレスの形式を確認してください。");
    return;
  }
  if (newPin && !/^\d{4,12}$/.test(newPin)) {
    setSaveStatus(status, "PINは4〜12桁の数字で入力してください。", "error");
    showToast("PINは4〜12桁の数字で入力してください。");
    return;
  }
  if (!getEmployeeCredential(employee).pin_set && !newPin) {
    setSaveStatus(status, "初回はPINを入力してください。", "error");
    showToast("初回はPINを入力してください。");
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "保存中...";
    setSaveStatus(status, "ログイン設定を保存中です...", "pending");
    await callApiAction("masterUpdateEmployeeLoginCredential", {
      id: employee.id,
      login_email: loginEmail,
      new_pin: newPin,
      login_enabled: loginEnabled,
      must_change_pin: mustChangePin,
      clear_lock: clearLock
    });
    await refreshEmployees();
    await refreshLogsSilently();
    state.selectedId = employee.id;
    render();
    showToast("ログイン設定を保存しました。");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
    button.disabled = false;
    button.textContent = "ログイン設定を保存";
  }
}

function buildPortalAppUpdatePayload(app, patch = {}) {
  return {
    id: app.id,
    appId: app.appId,
    appName: app.appName,
    description: app.description || "",
    url: app.url || "",
    category: app.category || "",
    icon: app.icon || "default",
    priority: Number(app.priority || 999),
    requiredLevel: Number(app.requiredLevel || 1),
    allowedTags: Array.isArray(app.allowedTags) ? app.allowedTags : [],
    targetDepartment: Array.isArray(app.targetDepartment) ? app.targetDepartment : [],
    targetPosition: Array.isArray(app.targetPosition) ? app.targetPosition : [],
    isActive: app.isActive !== false,
    isFeatured: Boolean(app.isFeatured),
    ...patch
  };
}

async function updatePortalAppQuickly(app, patch, successMessage) {
  await callApiAction("masterUpdatePortalApp", buildPortalAppUpdatePayload(app, patch));
  await refreshPortalApps();
  await refreshLogsSilently();
  state.selectedId = app.id;
  render();
  showToast(successMessage);
}

async function movePortalApp(app, direction) {
  const ordered = state.portalApps.slice().sort(comparePortalApps);
  const currentIndex = ordered.findIndex((item) => item.id === app.id);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
    showToast("これ以上移動できません。");
    return;
  }
  const target = ordered[targetIndex];
  const currentPriority = Number(app.priority || 999);
  const targetPriority = Number(target.priority || 999);
  const nextCurrentPriority = currentPriority === targetPriority ? targetIndex + 1 : targetPriority;
  const nextTargetPriority = currentPriority === targetPriority ? currentIndex + 1 : currentPriority;
  await callApiAction("masterUpdatePortalApp", buildPortalAppUpdatePayload(app, { priority: nextCurrentPriority }));
  await callApiAction("masterUpdatePortalApp", buildPortalAppUpdatePayload(target, { priority: nextTargetPriority }));
  await refreshPortalApps();
  await refreshLogsSilently();
  state.selectedId = app.id;
  render();
  showToast("表示順を更新しました。");
}

async function handlePortalAppQuickAction(app, action) {
  if (!state.permissions.canEdit) {
    showToast("編集権限がありません。", "error");
    return;
  }
  try {
    if (action === "toggle-active") {
      const nextActive = app.isActive === false;
      await updatePortalAppQuickly(app, { isActive: nextActive }, nextActive ? "HUBに表示しました。" : "HUBで非表示にしました。");
      return;
    }
    if (action === "toggle-featured") {
      const nextFeatured = !app.isFeatured;
      await updatePortalAppQuickly(app, { isFeatured: nextFeatured }, nextFeatured ? "よく使うに表示しました。" : "よく使うから外しました。");
      return;
    }
    if (action === "move-up") {
      await movePortalApp(app, -1);
      return;
    }
    if (action === "move-down") {
      await movePortalApp(app, 1);
    }
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
  }
}

async function savePortalApp(event) {

  event.preventDefault();
  const button = event.submitter;
  const status = document.querySelector("#app-save-status");
  let saved = false;
  try {
    setSaveStatus(status, "");
    const payload = collectPortalAppPayload();
    if (getFormSnapshot("app") === state.formSnapshot) {
      setSaveStatus(status, "変更なし・保存済みです", "success");
      showToast("変更はありません。");
      return;
    }
    if (!payload.appId?.trim()) {
      showToast("アプリIDを入力してください。");
      return;
    }
    if (!payload.appName?.trim()) {
      showToast("アプリ名を入力してください。");
      return;
    }
    if (payload.url && !/^https?:\/\/|^\.\//.test(payload.url)) {
      showToast("URLは https:// または ./ から始めてください。");
      return;
    }
    button.disabled = true;
    button.textContent = "保存中...";
    setSaveStatus(status, "アプリ設定を保存中です...", "pending");
    const action = state.selectedId === NEW_PORTAL_APP_ID ? "masterCreatePortalApp" : "masterUpdatePortalApp";
    const response = await callApiAction(action, payload);
    await refreshPortalApps();
    if (action === "masterCreatePortalApp" && response.portalApp?.id) {
      state.selectedId = response.portalApp.id;
    }
    const logsSynced = await refreshLogsSilently();
    saved = true;
    markCurrentFormSaved(
      "app",
      logsSynced ? "保存しました。変更履歴にも反映済みです。" : "保存しました。変更履歴は後で再読み込みしてください。"
    );
    showToast(action === "masterCreatePortalApp" ? "アプリを追加しました。" : "アプリ設定を保存しました。");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
  } finally {
    if (!saved) {
      window.setTimeout(() => {
        restoreSaveButtonState("app", button);
      }, 700);
    }
  }
}

async function saveCorporation(event) {
  event.preventDefault();
  const button = event.submitter;
  const status = document.querySelector("#corporation-save-status");
  const isCreate = state.selectedId === NEW_CORPORATION_ID;
  let saved = false;
  try {
    setSaveStatus(status, "");
    const payload = collectCorporationPayload();
    if (!isCreate) payload.id = state.selectedId;
    if (getFormSnapshot("corporation") === state.formSnapshot) {
      setSaveStatus(status, "変更なし・保存済みです", "success");
      showToast("変更はありません。");
      return;
    }
    if (!payload.corporation_name?.trim()) {
      showToast("法人名は必須です。");
      return;
    }
    if (!isCreate && !payload.corporation_no?.trim()) {
      showToast("法人Noを入力してください。");
      return;
    }
    if (payload.corporation_no?.trim() && state.corporations.some((corporation) => (
      String(corporation.id || "") !== String(payload.id || "")
      && String(corporation.corporation_no || "").trim() === String(payload.corporation_no || "").trim()
    ))) {
      showToast("同じ法人Noが既に存在します。");
      return;
    }
    button.disabled = true;
    button.title = "保存中です。";
    button.textContent = "保存中...";
    setSaveStatus(status, "保存中です...", "pending");
    const response = await callApiAction(isCreate ? "masterCreateCorporation" : "masterUpdateCorporation", payload);
    await refreshCorporations();
    if (isCreate && response.corporation?.id) {
      state.selectedId = response.corporation.id;
      render();
    }
    const logsSynced = await refreshLogsSilently();
    saved = true;
    markCurrentFormSaved(
      "corporation",
      logsSynced ? "保存しました。変更履歴にも反映済みです。" : "保存しました。変更履歴は後で再読み込みしてください。"
    );
    showToast(isCreate ? "法人を追加しました。" : logsSynced ? "法人情報を保存し、変更履歴へ反映しました。" : "法人情報を保存しました。変更履歴は後で確認してください。");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
  } finally {
    if (!saved) {
      window.setTimeout(() => {
        restoreSaveButtonState("corporation", button);
      }, 700);
    }
  }
}

async function saveStore(event) {
  event.preventDefault();
  const button = event.submitter;
  const status = document.querySelector("#store-save-status");
  let saved = false;
  try {
    setSaveStatus(status, "");
    const payload = collectStorePayload();
    payload.id = state.selectedId;
    if (getFormSnapshot("store") === state.formSnapshot) {
      setSaveStatus(status, "変更なし・保存済みです", "success");
      showToast("変更はありません。");
      return;
    }
    if (!payload.store_name?.trim()) {
      showToast("店舗名は必須です。");
      return;
    }
    button.disabled = true;
    button.title = "保存中です。";
    button.textContent = "保存中...";
    setSaveStatus(status, "保存中です...", "pending");
    await callApiAction("masterUpdateStore", payload);
    await refreshStores();
    const logsSynced = await refreshLogsSilently();
    saved = true;
    markCurrentFormSaved(
      "store",
      logsSynced ? "保存しました。変更履歴にも反映済みです。" : "保存しました。変更履歴は後で再読み込みしてください。"
    );
    showToast(logsSynced ? "店舗情報を保存し、変更履歴へ反映しました。" : "店舗情報を保存しました。変更履歴は後で確認してください。");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
  } finally {
    if (!saved) {
      window.setTimeout(() => {
        restoreSaveButtonState("store", button);
      }, 700);
    }
  }
}

function setSaveStatus(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.className = `save-status${type ? ` ${type}` : ""}`;
}

function getEmployeeCsvRows() {
  const rows = state.view === "employees" ? getRows() : getSortedRows(getEmployeesByStatus());
  return rows.map((employee) => ({
    "社員DB_ID": employee.id || "",
    "社員番号": employee.employee_id || "",
    "氏名": employee.full_name || "",
    "メールアドレス": getEmployeeContactEmail(employee),
    "所属": formatEmployeeAffiliation(employee),
    "主店舗ID": employee.store_id || "",
    "主店舗名": employee.store_name || "",
    "部署": employee.department_name || "",
    "役職": employee.position_name || employee.source_position_name || "",
    "職種": employee.job_type_name || "",
    "雇用形態": normalizeEmploymentType(employee.employment_type || ""),
    "就労ステータス": normalizeEmploymentStatus(employee.employment_status || "") || getEmployeeStatusLabel(employee),
    "休職種別": normalizeLeaveType(employee.leave_type || ""),
    "有効": employee.is_active ? "TRUE" : "FALSE",
    "入社日": employee.joined_on || "",
    "退職日": employee.retired_on || "",
    "共通ロール": getCommonRoleKeys(employee).join(" "),
    "アプリ権限": getIdeaLinkRoleKeys(employee).join(" "),
    "Firebase UID": employee.firebase_uid || "",
    "LINE WORKS個人通知先": hasEmployeeLineWorksDestination(employee) ? "設定済み" : "未設定"
  }));
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(","))
  ];
  return lines.join("\r\n");
}

function exportEmployeesCsv() {
  const rows = getEmployeeCsvRows();
  if (!rows.length) {
    showToast("出力対象の社員がありません。");
    return;
  }
  const csv = `\uFEFF${buildCsv(rows)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join("");
  const link = document.createElement("a");
  link.href = url;
  link.download = `nov-hub-employees-core-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${rows.length}件の社員Core情報CSVを出力しました。`);
}

function parseCsv(text) {
  const normalized = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => String(item || "").trim()));
}

function normalizeCsvHeader(header) {
  return String(header || "").trim();
}

function readCsvRows(text) {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const headers = table[0].map(normalizeCsvHeader);
  return table.slice(1).map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ""])));
}

function getCsvEmployeeNumber(row) {
  return String(row["社員番号"] || row.employee_id || row["社員ID"] || "").trim();
}

function getCsvComparableFields(row) {
  return {
    email: String(row["メールアドレス"] || row.email || "").trim(),
    employment_type: normalizeEmploymentType(row["雇用形態"] || row.employment_type || ""),
    employment_status: normalizeEmploymentStatus(row["就労ステータス"] || row.employment_status || ""),
    leave_type: normalizeLeaveType(row["休職種別"] || row.leave_type || "")
  };
}

function getEmployeeComparableFields(employee) {
  return {
    email: getEmployeeContactEmail(employee),
    employment_type: normalizeEmploymentType(employee.employment_type || ""),
    employment_status: normalizeEmploymentStatus(employee.employment_status || "") || getEmployeeStatusLabel(employee),
    leave_type: normalizeLeaveType(employee.leave_type || "")
  };
}

function buildCsvImportPreview(rows) {
  const employeesByNumber = new Map(state.employees.map((employee) => [String(employee.employee_id || "").trim(), employee]));
  const previewRows = rows.map((row) => {
    const employeeNumber = getCsvEmployeeNumber(row);
    const employee = employeesByNumber.get(employeeNumber);
    if (!employee) return { row, employeeNumber, employee: null, changes: [] };
    const csvFields = getCsvComparableFields(row);
    const employeeFields = getEmployeeComparableFields(employee);
    const changes = Object.entries(csvFields)
      .filter(([, value]) => value)
      .filter(([key, value]) => value !== employeeFields[key])
      .map(([key, value]) => ({ key, before: employeeFields[key], after: value }));
    return { row, employeeNumber, employee, changes };
  });
  const matched = previewRows.filter((item) => item.employee).length;
  const changed = previewRows.filter((item) => item.changes.length).length;
  return {
    total: rows.length,
    matched,
    unmatched: rows.length - matched,
    changed,
    unchanged: matched - changed,
    rows: previewRows
  };
}

function renderCsvImportPreview(preview) {
  const changedRows = preview.rows.filter((item) => item.changes.length).slice(0, 30);
  const unmatchedRows = preview.rows.filter((item) => !item.employee).slice(0, 10);
  elements.detailPanel.innerHTML = `
    <h3>CSV入力プレビュー</h3>
    <p class="detail-note">まだ保存していません。Core社員情報の差分確認だけです。人事労務データはCSV入力対象外です。</p>
    <section class="csv-preview-summary">
      <span>読込: ${escapeHtml(preview.total)}件</span>
      <span>一致: ${escapeHtml(preview.matched)}件</span>
      <span>差分: ${escapeHtml(preview.changed)}件</span>
      <span>未一致: ${escapeHtml(preview.unmatched)}件</span>
    </section>
    ${changedRows.length ? `
      <section class="csv-preview-section">
        <strong>差分候補（先頭30件）</strong>
        <div class="csv-preview-list">
          ${changedRows.map((item) => `
            <div class="csv-preview-item">
              <b>${escapeHtml(item.employee.employee_id)} ${escapeHtml(item.employee.full_name)}</b>
              <ul>${item.changes.map((change) => `<li>${escapeHtml(change.key)}: ${escapeHtml(change.before || "空欄")} → ${escapeHtml(change.after)}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      </section>` : `<p class="status-muted">更新候補の差分はありません。</p>`}
    ${unmatchedRows.length ? `
      <section class="csv-preview-section warning">
        <strong>社員番号が一致しない行（先頭10件）</strong>
        <p>${unmatchedRows.map((item) => escapeHtml(item.employeeNumber || "社員番号なし")).join(" / ")}</p>
      </section>` : ""}
    <p class="field-help">保存更新機能は、SELECT preview・影響範囲・master_change_logs方針をOSレビューしてから追加します。</p>
  `;
}

async function previewEmployeeCsvImport(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const rows = readCsvRows(text);
    if (!rows.length) {
      showToast("CSVの内容を確認できませんでした。");
      return;
    }
    const preview = buildCsvImportPreview(rows);
    state.selectedId = "";
    renderCsvImportPreview(preview);
    showToast(`CSVを読み込みました。差分候補 ${preview.changed}件 / 未一致 ${preview.unmatched}件`);
  } catch (error) {
    console.error(error);
    showToast("CSVの読み込みに失敗しました。");
  }
}

async function refreshEmployees() {
  const response = await callApiAction("masterListEmployees");
  state.employees = response.employees || [];
  render();
}

async function refreshCorporations() {
  const response = await callApiAction("masterListCorporations");
  state.corporations = response.corporations || [];
  state.masters.corporations = state.corporations;
  render();
}

async function refreshStores() {
  const response = await callApiAction("masterListStores");
  state.stores = response.stores || [];
  render();
}

async function refreshPortalApps() {
  const response = await callApiAction("masterListPortalApps");
  state.portalApps = response.portalApps || [];
  render();
}

async function refreshLogsSilently() {
  try {
    const response = await callApiAction("masterListChangeLogs");
    state.logs = response.logs || [];
    state.logsLoaded = true;
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function refreshLogs() {
  const loaded = await refreshLogsSilently();
  if (!loaded) showToast("変更履歴の読み込みに失敗しました。");
  render();
}

async function handleSignIn() {
  try {
    showMode("loading");
    setFirebaseAuth();
    await signInWithGoogle();
    await loadData();
  } catch (error) {
    console.error(error);
    clearApiAuth();
    showMode("auth");
    showToast(error.message || "ログインまたは読み込みに失敗しました。");
  }
}

async function handleSignOut() {
  await signOutUser();
  clearApiAuth();
  clearStoredLaunchAuth();
  showMode("auth");
}

async function initializeMasterAdmin() {
  if (!restoreLaunchAuth()) {
    showMode("auth");
    return;
  }
  try {
    await loadData();
  } catch (error) {
    console.warn("Master admin bootstrap stopped safely", {
      code: error.code || "",
      stage: error.stage || ""
    });
    clearApiAuth();
    clearStoredLaunchAuth();
    showMode("auth");
    showToast(error.message || "マスタ情報の読み込みに失敗しました。HUBから開き直してください。");
  }
}

elements.signIn.addEventListener("click", handleSignIn);
elements.signOut.addEventListener("click", handleSignOut);
elements.refresh.addEventListener("click", loadData);
elements.addEmployee.addEventListener("click", startCreateEmployee);
elements.addCorporation.addEventListener("click", startCreateCorporation);
elements.addPortalApp.addEventListener("click", startCreatePortalApp);
elements.exportEmployeesCsv.addEventListener("click", exportEmployeesCsv);
elements.importEmployeesCsv.addEventListener("change", previewEmployeeCsvImport);
elements.search.addEventListener("input", () => {
  state.employeeIssueFilter = "";
  renderTable();
});
document.querySelectorAll("[data-employee-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.employeeStatus = button.dataset.employeeStatus;
    state.employeeIssueFilter = "";
    state.selectedId = "";
    render();
  });
});
document.querySelectorAll("[data-store-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.storeStatus = button.dataset.storeStatus;
    state.employeeIssueFilter = "";
    state.selectedId = "";
    render();
  });
});
document.querySelectorAll("[data-corporation-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.corporationStatus = button.dataset.corporationStatus;
    state.employeeIssueFilter = "";
    state.selectedId = "";
    render();
  });
});
document.querySelectorAll("[data-app-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.appStatus = button.dataset.appStatus;
    state.employeeIssueFilter = "";
    state.selectedId = "";
    render();
  });
});
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.employeeIssueFilter = "";
    state.selectedId = "";
    elements.search.value = "";
    if (state.view === "logs") {
      render();
      refreshLogs();
      return;
    }
    render();
  });
});

initializeMasterAdmin();
