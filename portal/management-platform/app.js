const STORAGE_KEY = "ideaNovManagementPlatform.environmentRecords";
const managementApiBaseUrl = (window.MANAGEMENT_API_BASE_URL || "").replace(/\/$/, "");
const firebaseTokenProvider = window.MANAGEMENT_FIREBASE_TOKEN_PROVIDER;
const hubContextProvider = window.MANAGEMENT_HUB_CONTEXT_PROVIDER;
const defaultCheckItemId = window.MANAGEMENT_DEFAULT_CHECK_ITEM_ID || "";
let trustedActor = null;

const dashboardCards = [
  { title: "現在地", key: "phase", value: "Phase 1", note: "環境整備チェックの入力導線を構築中。", status: "status-ok" },
  { title: "課題", key: "issues", value: "0件", note: "スコア3以下の記録を課題候補として扱います。", status: "status-warn" },
  { title: "改善", key: "actions", value: "0件", note: "コメントから次の行動を抽出して管理します。", status: "status-ok" },
  { title: "成長", key: "growth", value: "履歴作成中", note: "履歴が増えるほど比較・AI分析が可能になります。", status: "status-ok" }
];
const MANAGEMENT_ADMIN_ROLE_KEYS = new Set([
  "super_admin",
  "executive",
  "backoffice",
  "department_manager",
  "area_manager",
  "store_manager"
]);

function hasApiConfig() {
  return Boolean(managementApiBaseUrl && typeof firebaseTokenProvider === "function");
}

function getHubContext() {
  if (typeof hubContextProvider !== "function") return {};
  return hubContextProvider() || {};
}

function getDefaultStoreId() {
  const context = getHubContext();
  if (trustedActor?.storeId) return trustedActor.storeId;
  return context.primaryStoreId || context.storeId || context.store_id || window.MANAGEMENT_DEFAULT_STORE_ID || "";
}

function getRoleKeys() {
  if (trustedActor?.roles?.length) return trustedActor.roles.map(String);
  const context = getHubContext();
  return Array.isArray(context.roleKeys) ? context.roleKeys.map(String) : [];
}

function isManagementAdmin() {
  return getRoleKeys().some((roleKey) => MANAGEMENT_ADMIN_ROLE_KEYS.has(roleKey));
}

function getDisplayName() {
  const context = getHubContext();
  return context.displayName || context.fullName || context.name || "ログインユーザー";
}

function getStoreLabel() {
  const context = getHubContext();
  if (trustedActor?.storeId) return `店舗ID: ${trustedActor.storeId}`;
  return context.primaryStoreName || context.storeName || context.store || "所属店舗";
}

function getLocalRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function setLocalRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId() {
  return `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toRecord(form) {
  const formData = new FormData(form);
  const now = new Date().toISOString();
  return {
    record_id: createId(),
    store: formData.get("store"),
    target_user: formData.get("targetUser"),
    role: formData.get("role"),
    management_category: formData.get("managementCategory"),
    checked_at: now,
    evaluator: formData.get("evaluator"),
    score: Number(formData.get("score")),
    comment: formData.get("comment"),
    photo_url: formData.get("photoUrl"),
    status: "active",
    created_at: now,
    created_by: formData.get("evaluator"),
    version: 1
  };
}

function toCategoryId(name) {
  const map = {
    "成果を上げる": "performance",
    "人的資産の維持・活用": "human_asset",
    "人材育成": "development",
    "チーム機能化": "team_function"
  };
  return map[name] || "performance";
}

function fromCategoryId(id) {
  const map = {
    performance: "成果を上げる",
    human_asset: "人的資産の維持・活用",
    development: "人材育成",
    team_function: "チーム機能化"
  };
  return map[id] || id;
}

function fromApiCheck(row) {
  return {
    record_id: row.id,
    store: row.store_id,
    target_user: row.submitted_by_employee_id,
    role: "",
    management_category: "",
    checked_at: row.check_date,
    evaluator: row.submitted_by_employee_id,
    score: row.overall_score,
    comment: row.summary_comment || row.next_action || "",
    photo_url: "",
    status: row.status,
    created_at: row.submitted_at || row.check_date,
    created_by: "",
    version: 1
  };
}

function saveLocalRecord(record) {
  const records = getLocalRecords();
  records.unshift(record);
  setLocalRecords(records);
}

async function saveRemoteRecord(record) {
  if (!hasApiConfig()) return { ok: false, reason: "management-api-not-configured" };
  const storeId = getDefaultStoreId();
  if (!storeId || !defaultCheckItemId) return { ok: false, reason: "store-or-check-item-not-configured" };

  const payload = {
    storeId,
    checkDate: record.checked_at.slice(0, 10),
    checkScope: "store",
    summaryComment: record.comment,
    nextAction: record.comment,
    results: [{
      checkItemId: defaultCheckItemId,
      score: record.score,
      comment: record.comment,
      photos: record.photo_url ? [{ photoUrl: record.photo_url, photoType: "evidence" }] : []
    }]
  };

  const response = await apiRequest("/checks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function loadRemoteRecords() {
  if (!hasApiConfig()) return null;
  const params = new URLSearchParams({ limit: "100" });
  const response = await apiRequest(`/checks?${params.toString()}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "Management API load failed");
  return (json.checks || []).map(fromApiCheck);
}

async function loadCurrentActor() {
  if (!hasApiConfig()) return null;
  const response = await apiRequest("/me");
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "Management API actor load failed");
  trustedActor = json.actor || null;
  applyRoleBasedView();
  return trustedActor;
}

function renderScoreControls() {
  const row = document.getElementById("scoreRow") || document.getElementById("checkItems");
  if (!row) return;
  row.innerHTML = [1, 2, 3, 4, 5].map((score) => `
    <label class="score-choice">
      <input type="radio" name="score" value="${score}" ${score === 3 ? "checked" : ""}>
      <span>${score}</span>
    </label>
  `).join("");
}

function summarize(records) {
  const issueCount = records.filter((record) => Number(record.score) <= 3).length;
  const actionCount = records.filter((record) => record.comment && record.comment.trim()).length;
  return {
    phase: "Phase 1",
    issues: `${issueCount}件`,
    actions: `${actionCount}件`,
    growth: `${records.length}件`
  };
}

function renderDashboard() {
  const records = getLocalRecords();
  const summary = summarize(records);
  const grid = document.getElementById("dashboardGrid");
  grid.innerHTML = dashboardCards.map((card) => `
    <article class="card">
      <h3>${card.title}</h3>
      <div class="value ${card.status}">${summary[card.key] || card.value}</div>
      <p class="note">${card.note}</p>
    </article>
  `).join("");

  const nextAction = document.getElementById("todayActionTitle");
  const nextNote = document.getElementById("todayActionNote");
  if (!isManagementAdmin()) {
    nextAction.textContent = "自分のマネジメントチェックを確認する";
    nextNote.textContent = `${getDisplayName()}さんの所属店舗・自身に紐づく履歴を表示します。`;
    return;
  }
  if (records.length === 0) {
    nextAction.textContent = "環境整備チェックを1件登録する";
    nextNote.textContent = "最初の履歴を作ることで、写真管理・AIコメント・改善履歴へつながります。";
    return;
  }
  const latest = records[0];
  nextAction.textContent = Number(latest.score) <= 3 ? `${latest.store} の改善アクションを決める` : `${latest.store} の良い状態を継続する`;
  nextNote.textContent = latest.comment || "次に取る行動をコメントに残してください。";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderRecords(records = getLocalRecords()) {
  const body = document.getElementById("recordsBody");
  if (records.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell">まだ履歴がありません。</td></tr>`;
    return;
  }
  body.innerHTML = records.map((record) => `
    <tr>
      <td>${formatDate(record.checked_at)}</td>
      <td>${escapeHtml(record.store)}</td>
      <td>${escapeHtml(record.target_user)}</td>
      <td>${escapeHtml(record.management_category)}</td>
      <td><strong>${record.score}</strong></td>
      <td>${escapeHtml(record.comment)}</td>
    </tr>
  `).join("");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[char]));
}

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${name}`);
  });
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
}

function setStatusMessage(message) {
  const status = document.getElementById("authStatus");
  if (status && message) status.textContent = message;
}

function setApiStatus(message, kind = "info") {
  const status = document.getElementById("apiStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

async function updateAuthStatus() {
  const status = document.getElementById("authStatus");
  if (!status) return;
  if (!managementApiBaseUrl) {
    status.textContent = "Management API未設定です。NOV HUB連携まではローカル保存で動作します。";
    return;
  }
  if (typeof firebaseTokenProvider !== "function") {
    status.textContent = "Firebase ID token provider未設定です。NOV HUBログイン連携後にAPI保存できます。";
    return;
  }
  const token = await firebaseTokenProvider();
  if (token) {
    try {
      await loadCurrentActor();
      setApiStatus(`API接続OK: ${getDisplayName()} / ${getRoleKeys().join(", ") || "role未設定"}`, "ok");
    } catch (error) {
      console.warn("Management API actor load skipped or failed", error);
      setApiStatus(`API本人確認エラー: ${error.message || error}`, "error");
    }
  }
  const mode = isManagementAdmin() ? "管理者モード" : "スタッフ閲覧モード";
  status.textContent = token
    ? `Management API設定済みです。${mode} / ${getStoreLabel()} / ${getDisplayName()}`
    : "Firebase ID tokenが見つかりません。NOV HUBから開き直してください。";
}

async function handleLogin(event) {
  event.preventDefault();
  await updateAuthStatus();
  await refreshRecords();
  showView("dashboard");
}

async function handleLogout() {
  await updateAuthStatus();
  renderRecords();
  renderDashboard();
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const record = toRecord(form);
  saveLocalRecord(record);
  try {
    await saveRemoteRecord(record);
  } catch (error) {
    console.warn("Management API save skipped or failed", error);
  }
  form.reset();
  renderScoreControls();
  renderDashboard();
  renderRecords();
  showView("records");
}

async function refreshRecords() {
  try {
    setApiStatus("履歴を読み込み中です...", "loading");
    await loadCurrentActor();
    const remoteRecords = await loadRemoteRecords();
    if (remoteRecords) {
      setLocalRecords(remoteRecords);
      renderRecords(remoteRecords);
      setApiStatus(`履歴読込OK: ${remoteRecords.length}件`, "ok");
    } else {
      renderRecords();
      setApiStatus("API未接続のためローカル履歴を表示しています。", "info");
    }
  } catch (error) {
    console.warn("Management API load skipped or failed", error);
    setStatusMessage(`履歴読込エラー: ${error.message || error}`);
    setApiStatus(`履歴読込エラー: ${error.message || error}`, "error");
    renderRecords();
  }
  renderDashboard();
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.getElementById("refreshBtn").addEventListener("click", refreshRecords);
  document.getElementById("loadRecordsBtn").addEventListener("click", refreshRecords);
  document.getElementById("environmentForm").addEventListener("submit", handleSubmit);
  document.getElementById("clearFormBtn").addEventListener("click", () => {
    document.getElementById("environmentForm").reset();
    renderScoreControls();
  });
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
}

function applyRoleBasedView() {
  const admin = isManagementAdmin();
  const environmentButton = document.querySelector('[data-view="environment"]');
  if (environmentButton) environmentButton.hidden = !admin;
  const environmentView = document.getElementById("view-environment");
  if (environmentView) environmentView.hidden = !admin;
  const authButton = document.querySelector('[data-view="auth"]');
  if (authButton) authButton.textContent = "接続状態";
  if (!admin) {
    const recordsButton = document.querySelector('[data-view="records"]');
    if (recordsButton) recordsButton.textContent = "自分の履歴";
  }
}

renderScoreControls();
bindEvents();
applyRoleBasedView();
updateAuthStatus();
renderDashboard();
renderRecords();

async function apiRequest(path, options = {}) {
  const token = await firebaseTokenProvider();
  if (!token) throw new Error("Firebase ID token is missing");
  const response = await fetch(`${managementApiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-request-id": createId(),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      detail = parsed.error || parsed.message || body;
    } catch (_error) {
      detail = body;
    }
    throw new Error(`Management API failed: ${response.status}${detail ? ` / ${detail}` : ""}`);
  }
  return response;
}
