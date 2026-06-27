import { signInWithGoogle, signOutUser } from "../js/auth.js";
import { callApiAction, clearApiAuth, setFirebaseAuth } from "../js/api.js";

const NEW_EMPLOYEE_ID = "__new_employee__";

const state = {
  view: "employees",
  employeeStatus: "active",
  employeeIssueFilter: "",
  storeStatus: "active",
  selectedId: "",
  recentlyCreatedEmployeeId: "",
  employees: [],
  stores: [],
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
    positions: []
  }
};

const elements = Object.fromEntries([
  "auth-panel", "loading-panel", "admin-app", "sign-in", "sign-out", "add-employee", "refresh",
  "view-title", "search", "quality-summary", "result-count", "table-head", "table-body",
  "detail-panel", "employee-status-filter", "store-status-filter", "toast"
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
  accounting: "経理"
};

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3600);
}

function getErrorMessage(error) {
  const parts = [
    error?.message || "処理に失敗しました。",
    error?.code ? `code: ${error.code}` : "",
    error?.stage ? `stage: ${error.stage}` : "",
    error?.detail ? `detail: ${error.detail}` : ""
  ].filter(Boolean);
  return parts.join(" / ");
}

function showMode(mode) {
  elements.authPanel.hidden = mode !== "auth";
  elements.loadingPanel.hidden = mode !== "loading";
  elements.adminApp.hidden = mode !== "app";
  elements.signOut.hidden = mode === "auth";
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
  state.stores = data.stores || [];
  state.permissions = data.permissions || { canView: false, canEdit: false, roleKeys: [] };
  state.masters = {
    corporations: data.corporations || [],
    businessUnits: data.businessUnits || [],
    departments: data.departments || [],
    positions: data.positions || []
  };
}

async function loadData() {
  showMode("loading");
  const response = await callApiAction("masterBootstrap");
  setBootstrapData(response.data || {});
  state.logs = [];
  state.logsLoaded = false;
  state.selectedId = "";
  render();
  showMode("app");
}

function getRows() {
  const query = normalizeSearch(elements.search.value);
  let rows = getStoresByStatus();
  if (state.view === "employees") rows = getEmployeesByStatus();
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

function getSearchText(row) {
  const values = Object.entries(row)
    .filter(([, value]) => value === null || typeof value !== "object")
    .map(([, value]) => value);
  if ("employee_id" in row) {
    values.push(...getEmployeeIssues(row), formatEmployeeAffiliation(row), getEmployeeStatusLabel(row));
    if (isCurrentEmployee(row) && !row.firebase_uid) values.push("Firebase未連携", "Firebase");
    if (Array.isArray(row.role_keys)) {
      values.push(...row.role_keys, ...row.role_keys.map(formatRoleLabel));
    }
  }
  if ("store_no" in row) {
    values.push(...getStoreIssues(row), row.is_active ? "有効" : "無効");
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
  if (!String(employee.email || "").trim()) issues.push("メール");
  if (!hasLocation) issues.push("所属");
  if (!employee.position_id && !employee.source_position_name) issues.push("役職");
  if (!Array.isArray(employee.role_keys) || !employee.role_keys.length) issues.push("HUB権限");
  if (!getEmployeeCredential(employee).pin_set) issues.push("PIN");
  if (!String(employee.employment_type || "").trim()) issues.push("雇用形態");
  if (!String(employee.employment_status || "").trim()) issues.push("現職/休職/退職");
  return issues;
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

function getStoresByStatus() {
  if (state.view !== "stores") return state.stores;
  if (state.storeStatus === "all") return state.stores;
  if (state.storeStatus === "missing") return state.stores.filter((store) => store.is_active && getStoreIssues(store).length);
  if (state.storeStatus === "inactive") return state.stores.filter((store) => !store.is_active);
  return state.stores.filter((store) => store.is_active);
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
  const storeCounts = getStoreStatusCounts();
  const viewCounts = {
    employees: state.employees.length,
    stores: state.stores.length,
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

function render() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  elements.employeeStatusFilter.hidden = state.view !== "employees";
  elements.storeStatusFilter.hidden = state.view !== "stores";
  document.querySelectorAll("[data-employee-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.employeeStatus === state.employeeStatus);
  });
  document.querySelectorAll("[data-store-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.storeStatus === state.storeStatus);
  });
  updateNavigationCounts();
  elements.addEmployee.hidden = state.view !== "employees" || !state.permissions.canEdit;
  elements.viewTitle.textContent = {
    employees: "社員マスタ",
    stores: "店舗マスタ",
    firebase: "Firebase未連携",
    logs: "変更履歴",
    readiness: "HUB連携準備"
  }[state.view];
  renderTable();
  renderDetail();
}

function renderTable() {
  const rows = getRows();
  renderQualitySummary();
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
        <th>未設定</th>
        <th>状態</th>
      </tr>`;
    elements.tableBody.replaceChildren(...rows.map(renderEmployeeRow));
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
    elements.tableBody.replaceChildren(...rows.map(renderLogRow));
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
    elements.tableBody.replaceChildren(...rows.map(renderReadinessRow));
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
  elements.tableBody.replaceChildren(...rows.map(renderStoreRow));
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
  if (label === "メール未設定") return "メール";
  if (label === "所属未設定") return "所属";
  if (label === "役職未設定") return "役職";
  if (label === "HUB権限未設定") return "HUB権限";
  if (label === "PIN未設定") return "PIN";
  if (label === "法人未設定") return "法人";
  if (label === "雇用形態未設定") return "雇用形態";
  if (label === "状態未設定") return "状態";
  return "";
}

function getSummarySearchValue(label) {
  return label
    .replace("Firebase未連携", "Firebase")
    .replace("HUB権限未設定", "HUB権限")
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
      { label: "メール未設定", count: issueCounts["メール"] || 0, tone: "warning" },
      { label: "所属未設定", count: issueCounts["所属"] || 0, tone: "warning" },
      { label: "役職未設定", count: issueCounts["役職"] || 0, tone: "warning" },
      { label: "HUB権限未設定", count: issueCounts["HUB権限"] || 0, tone: "warning" },
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
  if (state.view === "firebase") {
    return [
      { label: "連携待ち", count: state.employees.filter((employee) => isCurrentEmployee(employee) && !employee.firebase_uid).length, tone: "warning" },
      { label: "メール未設定", count: state.employees.filter((employee) => isCurrentEmployee(employee) && !String(employee.email || "").trim()).length, tone: "warning" }
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
  const employeeEmailMissingCount = currentEmployees.filter((employee) => !String(employee.email || "").trim()).length;
  const employeeRoleMissingCount = currentEmployees.filter((employee) => !Array.isArray(employee.role_keys) || !employee.role_keys.length).length;
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
      detail: "メール、所属、役職、HUB権限、雇用形態、現職/休職/退職の未設定を確認します。",
      nextAction: employeeIssueCount ? "社員タブの未設定ありを確認" : "HUB連携に利用可能"
    },
    {
      readiness_key: "employee_email",
      status: employeeEmailMissingCount ? "要確認" : "OK",
      label: "ログイン用メール",
      count: `${employeeEmailMissingCount}件`,
      detail: "Firebase Auth と社員マスタを紐づけるため、現職者のメールを確認します。",
      nextAction: employeeEmailMissingCount ? "メール未設定を確認" : "Firebase照合に利用可能"
    },
    {
      readiness_key: "employee_roles",
      status: employeeRoleMissingCount ? "要確認" : "OK",
      label: "HUB表示権限",
      count: `${employeeRoleMissingCount}件`,
      detail: "NOV HUBのアプリ表示・管理画面閲覧に使うCore DB権限です。",
      nextAction: employeeRoleMissingCount ? "社員タブでHUB権限未設定を確認" : "HUBメニュー制御に利用可能"
    },
    {
      readiness_key: "firebase_link",
      status: firebaseMissingCount ? "準備中" : "OK",
      label: "Firebase UID連携",
      count: `${firebaseMissingCount}件`,
      detail: "HUBでログインユーザー本人を社員台帳へ紐づけるためのUID連携です。",
      nextAction: firebaseMissingCount ? "Firebase未連携タブで順次連携" : "HUB権限判定へ進行可能"
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
    <td>${formatEmployeeIssues(employee, issues)}</td>
    <td>${formatEmployeeStatus(employee)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = employee.id;
    render();
  });
  return tr;
}

function formatEmployeeEmail(employee) {
  const email = String(employee.email || "").trim();
  if (email) return escapeHtml(email);
  const label = isCurrentEmployee(employee) ? "未設定" : "空欄";
  const className = isCurrentEmployee(employee) ? "status-pill warning" : "status-muted";
  return `<span class="${className}">${label}</span>`;
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

  const sourceRows = state.view === "stores" ? state.stores : state.employees;
  const row = sourceRows.find((item) => item.id === state.selectedId);
  if (!row) {
    elements.detailPanel.innerHTML = `<div class="empty-detail">左の一覧から編集対象を選んでください。</div>`;
    return;
  }
  if (state.view === "employees" || state.view === "firebase") renderEmployeeDetail(row);
  else renderStoreDetail(row);
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
          <li>メール未設定を埋める</li>
          <li>所属・役職・HUB権限の未設定を確認する</li>
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
    employee_email: ["employees", "メール", "社員タブでメール未設定を見る"],
    employee_roles: ["employees", "HUB権限", "社員タブでHUB権限未設定を見る"],
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
      if (query === "HUB権限") {
        setEmployeeIssueFilter("HUB権限");
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
    assign_staff_role: "HUB権限付与",
    auto_assign_staff_role: "HUB権限自動付与",
    create_login_credential: "ログイン設定作成",
    update_login_credential: "ログイン設定更新",
    change_own_pin: "本人PIN変更"
  }[actionType] || "更新";
}

function getLogTypeLabel(log) {
  if (log.table_name === "employee_store_assignments") return "店舗所属";
  if (log.table_name === "employee_roles") return "HUB権限";
  if (log.table_name === "employee_login_credentials") return "ログイン設定";
  if (log.table_name === "stores") return "店舗情報";
  if (log.table_name === "employees") return "社員情報";
  return log.table_name || "変更履歴";
}

function getLogTypeClass(log) {
  if (log.table_name === "employee_store_assignments") return "store-assignment";
  if (log.table_name === "employee_roles") return "role";
  if (log.table_name === "employee_login_credentials") return "login";
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
    hub_role: "HUB権限",
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
    store_id: "主店舗",
    store_assignment_2: "サブ店舗",
    store_assignment_3: "第3店舗",
    department_id: "部署",
    position_id: "役職",
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
      <p class="form-note">社員番号と氏名は必須です。メール未発行の入社予定者は空欄で追加し、発行後に「メール未設定」から追記します。社員番号なし退職者は LEGACY-0001 形式で登録します。</p>
      ${fieldInput("employee_id", "社員番号", "", { required: true, placeholder: "例: 9999 / LEGACY-0001" })}
      ${fieldInput("full_name", "氏名", "", { required: true, placeholder: "例: 山田 太郎" })}
      ${fieldInput("email", "メール", "", "email")}
      ${fieldInput("birth_date", "誕生日", "", "date")}
      ${fieldInput("joined_on", "入社日", "", "date")}
      ${fieldInput("retired_on", "退職日", "", "date")}
      ${fieldInput("leave_start_date", "休職開始日", "", "date")}
      ${fieldInput("leave_end_date", "休職終了日・復職日", "", "date")}
      ${fieldStaticSelect("leave_type", "休職区分", [
        ["", "未設定"],
        ["産休", "産休"],
        ["育休", "育休"],
        ["産休・育休", "産休・育休"],
        ["休職", "休職"],
        ["その他", "その他"]
      ], "")}
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
      ${fieldStaticSelect("employment_type", "雇用形態", [
        ["正社員", "正社員"],
        ["パート", "パート"],
        ["アルバイト", "アルバイト"],
        ["業務委託", "業務委託"],
        ["役員", "役員"],
        ["その他", "その他"]
      ], "正社員")}
      ${fieldStaticSelect("employment_status", "現職/休職/退職", [
        ["現職", "現職"],
        ["休職", "休職"],
        ["退職", "退職"]
      ], "現職")}
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
  const hasHubRole = Array.isArray(employee.role_keys) && employee.role_keys.filter(Boolean).length > 0;
  return `
    <section class="created-employee-panel">
      <strong>社員を追加しました</strong>
      <p>社員台帳への登録は完了しています。月初更新では、次の4点だけ確認すると後続アプリへつなげやすくなります。</p>
      <ul>
        <li class="${hasEmail ? "done" : "pending"}">メール: ${hasEmail ? "設定済み" : "未設定。発行後に追記します。"}</li>
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
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(employee.full_name)}</h3>
    <p class="detail-meta">社員番号: ${escapeHtml(employee.employee_id)} / Firebase: ${employee.firebase_uid ? "連携済み" : "未連携"}${employee.updated_at ? ` / 最終更新: ${escapeHtml(formatDateTime(employee.updated_at))}` : ""}</p>
    <p class="detail-note">${readonly ? "閲覧専用モードです。編集権限がある管理者のみ保存できます。" : "社員番号とFirebase UIDはこの画面では変更しません。変更が必要な場合は管理者確認後に個別対応します。"}</p>
    ${loginPanel}
    <form class="form-grid" id="detail-form">
      ${createdPanel}
      ${issuePanel}
      ${renderEmployeeRolePanel(employee)}
      ${firebaseLinkPanel}
      ${fieldInput("email", "メール", employee.email || "", "email")}
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
      ${fieldValueSelect("employment_type", "雇用形態", getUniqueValues(state.employees, "employment_type"), employee.employment_type || "")}
      ${fieldStaticSelect("employment_status", "現職/休職/退職", [
        ["現職", "現職"],
        ["休職", "休職"],
        ["産休", "産休"],
        ["育休", "育休"],
        ["退職", "退職"]
      ], employee.employment_status || "")}
      <section class="leave-fields">
        <div>
          <strong>休職・産休・育休</strong>
          <p>休職中の社員だけ入力します。復職済みの場合は終了日を入れておくと履歴確認に使えます。</p>
        </div>
        ${fieldStaticSelect("leave_type", "休職区分", [
          ["", "未設定"],
          ["休職", "休職"],
          ["産休", "産休"],
          ["育休", "育休"]
        ], employee.leave_type || "")}
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
      <div class="save-row">
        <span class="save-status" id="employee-save-status" aria-live="polite"></span>
        ${readonly ? `<span class="readonly-label">閲覧専用</span>` : `<button class="button button-primary save-button" type="submit">保存</button>`}
      </div>
    </form>`;
  setReadonlyState(readonly);
  if (!readonly) {
    const form = document.querySelector("#detail-form");
    form.addEventListener("submit", saveEmployee);
    setupDirtyForm("employee");
  }
  document.querySelector("#retire-employee")?.addEventListener("click", retireEmployee);
  document.querySelector("#link-firebase-uid")?.addEventListener("click", linkFirebaseUid);
  document.querySelector("#assign-staff-role")?.addEventListener("click", assignStaffRole);
  document.querySelector("#save-login-credential")?.addEventListener("click", saveEmployeeLoginCredential);
}

function renderEmployeeLoginPanel(employee, readonly) {
  const credential = getEmployeeCredential(employee);
  const loginEmail = credential.login_email || employee.email || "";
  const pinLabel = credential.pin_set
    ? `設定済み${credential.pin_updated_at ? ` / 更新: ${formatDateTime(credential.pin_updated_at)}` : ""}`
    : "未設定";
  const lockLabel = credential.locked
    ? `ロック中: ${formatDateTime(credential.locked_until)}まで`
    : "ロックなし";
  return `
    <section class="login-credential-panel">
      <div class="login-credential-heading">
        <div>
          <strong>ログイン / PIN管理</strong>
          <p>HUB・IDEA LINK共通のログイン情報です。PINは保存時にbackend側でhash化され、画面には表示しません。</p>
        </div>
        <span class="status-pill${credential.login_enabled === false ? " inactive" : credential.pin_set ? "" : " warning"}">${credential.login_enabled === false ? "ログイン停止" : credential.pin_set ? "ログイン可" : "PIN未設定"}</span>
      </div>
      <div class="login-credential-grid">
        <label class="form-field" for="login_email">
          <span>ログインメール</span>
          <input class="form-input" id="login_email" type="email" value="${escapeHtml(loginEmail)}"${readonly ? " disabled" : ""}>
        </label>
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
        <button class="button button-secondary" id="save-login-credential" type="button">ログイン設定を保存</button>
      </div>`}
    </section>`;
}

function renderEmployeeRolePanel(employee) {
  const roleKeys = Array.isArray(employee.role_keys) ? employee.role_keys.filter(Boolean) : [];
  if (!roleKeys.length) {
    return `
      <div class="role-panel missing">
        <strong>HUB権限</strong>
        <p>未設定です。HUBでは基本表示のみ、または権限判定で意図しない表示になる可能性があります。</p>
      </div>`;
  }
  const chips = roleKeys
    .map((roleKey) => `<span class="role-chip">${escapeHtml(formatRoleLabel(roleKey))}<small>${escapeHtml(roleKey)}</small></span>`)
    .join("");
  return `
    <div class="role-panel">
      <strong>HUB権限</strong>
      <div class="role-chip-list">${chips}</div>
    </div>`;
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
    if (issues.includes("メール")) hints.push("メール未発行の場合は空欄のまま保存できます。発行後に「メール未設定」から追記してください。");
    if (issues.includes("所属")) hints.push("主店舗または部署のどちらかを設定すると、所属未設定が解消します。");
    if (issues.includes("HUB権限")) hints.push("HUB権限はアプリ表示・管理画面の閲覧範囲に使います。");
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

function renderStoreDetail(store) {
  const readonly = !state.permissions.canEdit;
  const issues = getStoreIssues(store);
  const issuePanel = renderStoreIssuePanel(store, issues);
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(store.store_name)}</h3>
    <p class="detail-meta">店舗ID: ${escapeHtml(store.store_id)} / 店舗No: ${escapeHtml(store.store_no)}${store.updated_at ? ` / 最終更新: ${escapeHtml(formatDateTime(store.updated_at))}` : ""}</p>
    <p class="detail-note">${readonly ? "閲覧専用モードです。編集権限がある管理者のみ保存できます。" : "店舗IDと店舗Noは固定項目です。通常運用では店舗名・法人・事業部門・有効状態のみ変更します。"}</p>
    <form class="form-grid" id="detail-form">
      ${issuePanel}
      ${fieldInput("store_name", "店舗名", store.store_name || "")}
      ${fieldSelect("corporation_id", "法人", state.masters.corporations, store.corporation_id, "corporation_name")}
      ${fieldSelect("business_unit_id", "事業部門", state.masters.businessUnits, store.business_unit_id, "business_unit_name")}
      ${fieldValueSelect("area", "エリア", getUniqueValues(state.stores, "area"), store.area || "")}
      ${fieldValueSelect("store_type", "店舗種別", getUniqueValues(state.stores, "store_type"), store.store_type || "")}
      ${fieldCheckbox("is_active", "有効", store.is_active)}
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
  const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : "";
  return `
    <div class="form-field">
      <label for="${escapeHtml(name)}">${escapeHtml(label)}</label>
      <input class="form-input" id="${escapeHtml(name)}" name="${escapeHtml(name)}" type="${escapeHtml(inputType)}" value="${escapeHtml(value || "")}"${placeholder}${required}>
    </div>`;
}

function fieldSelect(name, label, rows, value, labelKey) {
  const options = [`<option value="">未設定</option>`].concat(rows.map((row) => {
    const selected = row.id === value ? " selected" : "";
    return `<option value="${escapeHtml(row.id)}"${selected}>${escapeHtml(row[labelKey])}</option>`;
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
  payload.is_active = document.querySelector("#is_active").checked;
  return payload;
}

function collectStorePayload() {
  const payload = collectFormPayload();
  payload.is_active = document.querySelector("#is_active").checked;
  return payload;
}

function setupDirtyForm(type) {
  const form = document.querySelector("#detail-form");
  const status = document.querySelector(type === "employee" ? "#employee-save-status" : "#store-save-status");
  const button = form?.querySelector(".save-button");
  if (!form || !button) return;
  state.formSnapshot = getFormSnapshot(type);
  updateDirtyState(type, status, button);
  form.addEventListener("input", () => updateDirtyState(type, status, button));
  form.addEventListener("change", () => updateDirtyState(type, status, button));
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
  const payload = type === "employee" ? collectEmployeePayload() : collectStorePayload();
  delete payload.id;
  return JSON.stringify(Object.keys(payload).sort().map((key) => [key, normalizeSnapshotValue_(payload[key])]));
}

function normalizeSnapshotValue_(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "").trim();
}

function markCurrentFormSaved(type, message = "保存しました。変更履歴にも反映済みです。") {
  const form = document.querySelector("#detail-form");
  const status = document.querySelector(type === "employee" ? "#employee-save-status" : "#store-save-status");
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
  const status = document.querySelector(type === "employee" ? "#employee-save-status" : "#store-save-status");
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
    if (getFormSnapshot("employee") === state.formSnapshot) {
      setSaveStatus(status, "変更なし・保存済みです", "success");
      showToast("変更はありません。");
      return;
    }
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
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
  const employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const confirmed = window.confirm(`${employee.full_name}さんにHUB基本権限（staff）を付与します。\n\nstaffは管理者権限ではありません。`);
  if (!confirmed) return;
  const button = event.currentTarget;
  const originalText = button.textContent;
  try {
    button.disabled = true;
    button.textContent = "付与中...";
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

async function saveEmployeeLoginCredential(event) {
  const employee = state.employees.find((item) => item.id === state.selectedId);
  if (!employee) return;
  const button = event.currentTarget;
  const status = document.querySelector("#login-credential-save-status");
  const loginEmail = document.querySelector("#login_email")?.value.trim() || "";
  const newPin = document.querySelector("#new_pin")?.value.trim() || "";
  const loginEnabled = document.querySelector("#login_enabled")?.checked || false;
  const mustChangePin = document.querySelector("#must_change_pin")?.checked || false;
  const clearLock = document.querySelector("#clear_login_lock")?.checked || false;

  if (!loginEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    setSaveStatus(status, "ログインメールの形式を確認してください。", "error");
    showToast("ログインメールの形式を確認してください。");
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

async function refreshEmployees() {
  const response = await callApiAction("masterListEmployees");
  state.employees = response.employees || [];
  render();
}

async function refreshStores() {
  const response = await callApiAction("masterListStores");
  state.stores = response.stores || [];
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
  showMode("auth");
}

elements.signIn.addEventListener("click", handleSignIn);
elements.signOut.addEventListener("click", handleSignOut);
elements.refresh.addEventListener("click", loadData);
elements.addEmployee.addEventListener("click", startCreateEmployee);
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

showMode("auth");
