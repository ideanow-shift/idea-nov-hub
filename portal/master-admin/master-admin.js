import { signInWithGoogle, signOutUser } from "../js/auth.js";
import { callApiAction, clearApiAuth, setFirebaseAuth } from "../js/api.js";

const state = {
  view: "employees",
  employeeStatus: "active",
  storeStatus: "active",
  selectedId: "",
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
  "auth-panel", "loading-panel", "admin-app", "sign-in", "sign-out", "refresh",
  "view-title", "search", "result-count", "table-head", "table-body",
  "detail-panel", "employee-status-filter", "store-status-filter", "toast"
].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.querySelector(`#${id}`)]));

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
  if (!query) return rows;
  return rows.filter((row) => normalizeSearch(getSearchText(row)).includes(query));
}

function getSearchText(row) {
  const values = Object.entries(row)
    .filter(([, value]) => value === null || typeof value !== "object")
    .map(([, value]) => value);
  if (Array.isArray(row.store_assignments)) {
    values.push(...row.store_assignments.flatMap((assignment) => [
      assignment.store_name,
      assignment.store_code,
      assignment.assignment_type,
      assignment.assignment_order
    ]));
  }
  if (row.change_payload && typeof row.change_payload === "object") {
    values.push(row.change_summary, row.action_type, row.target_name, row.table_name);
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
  if (!String(employee.employment_type || "").trim()) issues.push("雇用形態");
  if (!String(employee.employment_status || "").trim()) issues.push("現職/休職/退職");
  return issues;
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
    logs: state.logsLoaded ? state.logs.length : ""
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
  elements.viewTitle.textContent = {
    employees: "社員マスタ",
    stores: "店舗マスタ",
    firebase: "Firebase未連携",
    logs: "変更履歴"
  }[state.view];
  renderTable();
  renderDetail();
}

function renderTable() {
  const rows = getRows();
  elements.resultCount.textContent = `${rows.length}件`;
  if (state.view === "employees" || state.view === "firebase") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>社員番号</th>
        <th>氏名</th>
        <th>所属</th>
        <th>役職</th>
        <th>メール</th>
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
    <td>${escapeHtml(employee.email || "")}</td>
    <td>${formatEmployeeIssues(employee, issues)}</td>
    <td>${formatEmployeeStatus(employee)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = employee.id;
    render();
  });
  return tr;
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
  tr.innerHTML = `
    <td>${escapeHtml(formatDateTime(log.created_at))}</td>
    <td>${escapeHtml(targetLabel)}</td>
    <td>${escapeHtml(log.changed_by_email || "")}</td>
    <td><span class="log-action">${escapeHtml(actionLabel)}</span>${escapeHtml(summary)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = log.id;
    render();
  });
  return tr;
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
  if (state.view === "logs") {
    renderLogDetail();
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

function renderLogDetail() {
  const log = state.logs.find((item) => item.id === state.selectedId);
  if (!log) {
    elements.detailPanel.innerHTML = `<div class="empty-detail">左の一覧から履歴を選んでください。</div>`;
    return;
  }
  const helperText = log.table_name === "employee_store_assignments"
    ? "社員本体の更新とは別に、主店舗・サブ店舗・第3店舗の所属変更として記録しています。"
    : "社員・店舗マスタ本体の変更として記録しています。";
  elements.detailPanel.innerHTML = `
    <h3>変更履歴</h3>
    <p class="detail-meta">${escapeHtml(formatDateTime(log.created_at))}</p>
    <p class="detail-note">${escapeHtml(helperText)}</p>
    <div class="log-detail">
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
    update: "更新",
    link_firebase_uid: "Firebase UID連携",
    update_store_assignments: "店舗所属更新"
  }[actionType] || "更新";
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
  return `<div class="change-list">${rows}</div>`;
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
    birth_date: "誕生日",
    joined_on: "入社日",
    retired_on: "退職日",
    leave_type: "休職区分",
    leave_start_date: "休職開始日",
    leave_end_date: "休職終了日・復職日",
    employment_status: "現職/休職/退職",
    employment_type: "雇用形態",
    corporation_id: "法人",
    store_id: "主店舗",
    department_id: "部署",
    position_id: "役職",
    business_unit_id: "事業部門",
    store_name: "店舗名",
    area: "エリア",
    store_type: "店舗種別",
    firebase_uid: "Firebase UID",
    is_active: "有効状態"
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

function renderEmployeeDetail(employee) {
  const retired = !employee.is_active || employee.employment_status === "退職";
  const storeAssignments = getStoreAssignmentsByOrder(employee.store_assignments || []);
  const readonly = !state.permissions.canEdit;
  const issues = getEmployeeIssues(employee);
  const issuePanel = renderEmployeeIssuePanel(employee, issues);
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
    <form class="form-grid" id="detail-form">
      ${issuePanel}
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
    return `
      <div class="issue-panel">
        <strong>未設定項目</strong>
        <p>${escapeHtml(issues.join("・"))} を確認してください。</p>
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
  return `
    <div class="form-field">
      <label for="${name}">${label}</label>
      <input class="form-input" id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}">
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
  if (!hasChanges) {
    button.textContent = "保存";
    setSaveStatus(status, "変更はありません", "");
  } else {
    setSaveStatus(status, "未保存の変更があります", "pending");
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

function markCurrentFormSaved(type, message = "保存しました") {
  const form = document.querySelector("#detail-form");
  const status = document.querySelector(type === "employee" ? "#employee-save-status" : "#store-save-status");
  const button = form?.querySelector(".save-button");
  if (!form || !button) return;
  state.formSnapshot = getFormSnapshot(type);
  button.disabled = true;
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
  try {
    setSaveStatus(status, "");
    const payload = collectEmployeePayload();
    payload.id = state.selectedId;
    if (getFormSnapshot("employee") === state.formSnapshot) {
      setSaveStatus(status, "変更はありません", "");
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
    button.textContent = "保存中...";
    await callApiAction("masterUpdateEmployee", payload);
    button.textContent = "保存しました";
    setSaveStatus(status, "保存しました", "success");
    showToast("社員情報を保存しました。");
    await refreshEmployees();
    markCurrentFormSaved("employee");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
  } finally {
    window.setTimeout(() => {
      restoreSaveButtonState("employee", button);
    }, 700);
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

async function saveStore(event) {
  event.preventDefault();
  const button = event.submitter;
  const status = document.querySelector("#store-save-status");
  try {
    setSaveStatus(status, "");
    const payload = collectStorePayload();
    payload.id = state.selectedId;
    if (getFormSnapshot("store") === state.formSnapshot) {
      setSaveStatus(status, "変更はありません", "");
      showToast("変更はありません。");
      return;
    }
    if (!payload.store_name?.trim()) {
      showToast("店舗名は必須です。");
      return;
    }
    button.disabled = true;
    button.textContent = "保存中...";
    await callApiAction("masterUpdateStore", payload);
    button.textContent = "保存しました";
    setSaveStatus(status, "保存しました", "success");
    showToast("店舗情報を保存しました。");
    await refreshStores();
    markCurrentFormSaved("store");
  } catch (error) {
    console.error(error);
    setSaveStatus(status, getErrorMessage(error), "error");
    showToast(getErrorMessage(error));
  } finally {
    window.setTimeout(() => {
      restoreSaveButtonState("store", button);
    }, 700);
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

async function refreshLogs() {
  try {
    const response = await callApiAction("masterListChangeLogs");
    state.logs = response.logs || [];
    state.logsLoaded = true;
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
  } finally {
    render();
  }
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
elements.search.addEventListener("input", renderTable);
document.querySelectorAll("[data-employee-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.employeeStatus = button.dataset.employeeStatus;
    state.selectedId = "";
    render();
  });
});
document.querySelectorAll("[data-store-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.storeStatus = button.dataset.storeStatus;
    state.selectedId = "";
    render();
  });
});
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
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
