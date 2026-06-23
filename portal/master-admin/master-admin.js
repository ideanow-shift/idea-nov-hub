import { signInWithGoogle, signOutUser } from "../js/auth.js";
import { callApiAction, clearApiAuth, setFirebaseAuth } from "../js/api.js";

const state = {
  view: "employees",
  selectedId: "",
  employees: [],
  stores: [],
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
  "detail-panel", "toast"
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

function setBootstrapData(data) {
  state.employees = data.employees || [];
  state.stores = data.stores || [];
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
  state.selectedId = "";
  render();
  showMode("app");
}

function getRows() {
  const query = normalizeSearch(elements.search.value);
  const rows = state.view === "employees" ? state.employees : state.stores;
  if (!query) return rows;
  return rows.filter((row) => normalizeSearch(Object.values(row).join(" ")).includes(query));
}

function render() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
  elements.viewTitle.textContent = state.view === "employees" ? "社員マスタ" : "店舗マスタ";
  renderTable();
  renderDetail();
}

function renderTable() {
  const rows = getRows();
  elements.resultCount.textContent = `${rows.length}件`;
  if (state.view === "employees") {
    elements.tableHead.innerHTML = `
      <tr>
        <th>社員番号</th>
        <th>氏名</th>
        <th>所属</th>
        <th>役職</th>
        <th>メール</th>
        <th>状態</th>
      </tr>`;
    elements.tableBody.replaceChildren(...rows.map(renderEmployeeRow));
    return;
  }

  elements.tableHead.innerHTML = `
    <tr>
      <th>店舗No</th>
      <th>店舗ID</th>
      <th>店舗名</th>
      <th>事業</th>
      <th>状態</th>
    </tr>`;
  elements.tableBody.replaceChildren(...rows.map(renderStoreRow));
}

function renderEmployeeRow(employee) {
  const tr = document.createElement("tr");
  tr.className = employee.id === state.selectedId ? "selected" : "";
  tr.innerHTML = `
    <td>${escapeHtml(employee.employee_id)}</td>
    <td>${escapeHtml(employee.full_name)}</td>
    <td>${escapeHtml(employee.store_name || employee.department_name || employee.source_assigned_location || "")}</td>
    <td>${escapeHtml(employee.position_name || employee.source_position_name || "")}</td>
    <td>${escapeHtml(employee.email || "")}</td>
    <td>${formatActive(employee.is_active)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = employee.id;
    render();
  });
  return tr;
}

function renderStoreRow(store) {
  const tr = document.createElement("tr");
  tr.className = store.id === state.selectedId ? "selected" : "";
  tr.innerHTML = `
    <td>${escapeHtml(store.store_no)}</td>
    <td>${escapeHtml(store.store_id)}</td>
    <td>${escapeHtml(store.store_name)}</td>
    <td>${escapeHtml(store.business_unit_name || "")}</td>
    <td>${formatActive(store.is_active)}</td>`;
  tr.addEventListener("click", () => {
    state.selectedId = store.id;
    render();
  });
  return tr;
}

function renderDetail() {
  const row = (state.view === "employees" ? state.employees : state.stores).find((item) => item.id === state.selectedId);
  if (!row) {
    elements.detailPanel.innerHTML = `<div class="empty-detail">左の一覧から編集対象を選んでください。</div>`;
    return;
  }
  if (state.view === "employees") renderEmployeeDetail(row);
  else renderStoreDetail(row);
}

function renderEmployeeDetail(employee) {
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(employee.full_name)}</h3>
    <p class="detail-meta">社員番号: ${escapeHtml(employee.employee_id)} / Firebase: ${employee.firebase_uid ? "連携済み" : "未連携"}</p>
    <p class="detail-note">社員番号とFirebase UIDはこの画面では変更しません。変更が必要な場合は管理者確認後に個別対応します。</p>
    <form class="form-grid" id="detail-form">
      ${fieldInput("email", "メール", employee.email || "", "email")}
      ${fieldSelect("corporation_id", "法人", state.masters.corporations, employee.corporation_id, "corporation_name")}
      ${fieldSelect("store_id", "所属店舗", state.stores, employee.store_id, "store_name")}
      ${fieldSelect("department_id", "部署", state.masters.departments, employee.department_id, "department_name")}
      ${fieldSelect("position_id", "役職", state.masters.positions, employee.position_id, "position_name")}
      ${fieldInput("employment_type", "雇用形態", employee.employment_type || "")}
      ${fieldInput("employment_status", "現職/退職", employee.employment_status || "")}
      ${fieldCheckbox("is_active", "有効", employee.is_active)}
      <div class="save-row"><button class="button button-primary" type="submit">保存</button></div>
    </form>`;
  document.querySelector("#detail-form").addEventListener("submit", saveEmployee);
}

function renderStoreDetail(store) {
  elements.detailPanel.innerHTML = `
    <h3>${escapeHtml(store.store_name)}</h3>
    <p class="detail-meta">店舗ID: ${escapeHtml(store.store_id)} / 店舗No: ${escapeHtml(store.store_no)}</p>
    <p class="detail-note">店舗IDと店舗Noは固定項目です。通常運用では店舗名・法人・事業部門・有効状態のみ変更します。</p>
    <form class="form-grid" id="detail-form">
      ${fieldInput("store_name", "店舗名", store.store_name || "")}
      ${fieldSelect("corporation_id", "法人", state.masters.corporations, store.corporation_id, "corporation_name")}
      ${fieldSelect("business_unit_id", "事業部門", state.masters.businessUnits, store.business_unit_id, "business_unit_name")}
      ${fieldCheckbox("is_active", "有効", store.is_active)}
      <div class="save-row"><button class="button button-primary" type="submit">保存</button></div>
    </form>`;
  document.querySelector("#detail-form").addEventListener("submit", saveStore);
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

async function saveEmployee(event) {
  event.preventDefault();
  const button = event.submitter;
  try {
    const payload = collectFormPayload();
    payload.id = state.selectedId;
    payload.is_active = document.querySelector("#is_active").checked;
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      showToast("メールアドレスの形式を確認してください。");
      return;
    }
    button.disabled = true;
    await callApiAction("masterUpdateEmployee", payload);
    showToast("社員情報を保存しました。");
    await refreshEmployees();
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
  try {
    const payload = collectFormPayload();
    payload.id = state.selectedId;
    payload.is_active = document.querySelector("#is_active").checked;
    if (!payload.store_name?.trim()) {
      showToast("店舗名は必須です。");
      return;
    }
    button.disabled = true;
    await callApiAction("masterUpdateStore", payload);
    showToast("店舗情報を保存しました。");
    await refreshStores();
  } catch (error) {
    console.error(error);
    showToast(getErrorMessage(error));
  } finally {
    button.disabled = false;
  }
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
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.selectedId = "";
    elements.search.value = "";
    render();
  });
});

showMode("auth");
