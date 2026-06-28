const STORAGE_KEY = "ideaNovManagementPlatform.environmentRecords";
const managementApiBaseUrl = (window.MANAGEMENT_API_BASE_URL || "").replace(/\/$/, "");
const firebaseTokenProvider = window.MANAGEMENT_FIREBASE_TOKEN_PROVIDER;
const hubContextProvider = window.MANAGEMENT_HUB_CONTEXT_PROVIDER;
const defaultCheckItemId = window.MANAGEMENT_DEFAULT_CHECK_ITEM_ID || "";
let trustedActor = null;
let checkItems = [];
let improvementActions = [];
let performanceSnapshots = [];
let performanceInitiatives = [];

const dashboardCards = [
  { title: "現在地", key: "current", value: "未登録", status: "status-ok" },
  { title: "課題", key: "issues", value: "0件", status: "status-warn" },
  { title: "改善", key: "actions", value: "0件", status: "status-ok" },
  { title: "成長", key: "growth", value: "履歴作成中", status: "status-ok" }
];
const MANAGEMENT_ADMIN_ROLE_KEYS = new Set([
  "super_admin",
  "executive",
  "backoffice",
  "department_manager",
  "area_manager",
  "store_manager"
]);
const SCORE_CHOICES = [0, 3, 5];
const CATEGORY_ORDER = ["performance", "human_asset", "development", "team_function"];

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
  if (trustedActor?.fullName) return trustedActor.fullName;
  return context.displayName || context.fullName || context.name || "ログインユーザー";
}

function getStoreLabel() {
  const context = getHubContext();
  if (trustedActor?.storeId) return `店舗ID: ${trustedActor.storeId}`;
  return context.primaryStoreName || context.storeName || context.store || "所属店舗";
}

function getContextStoreName() {
  const context = getHubContext();
  return context.primaryStoreName || context.storeName || context.store || "";
}

function inferRoleLabel() {
  const context = getHubContext();
  if (context.positionName) return context.positionName;
  const roles = getRoleKeys();
  if (roles.includes("store_manager")) return "店長";
  if (roles.includes("area_manager") || roles.includes("department_manager") || roles.includes("executive") || roles.includes("super_admin")) {
    return "本部管理者";
  }
  return "";
}

function setSelectValue(select, value) {
  if (!select || !value) return;
  const normalized = String(value).trim();
  if (!normalized) return;
  const existing = [...select.options].find((option) => option.value === normalized || option.textContent === normalized);
  if (existing) {
    select.value = existing.value;
    return;
  }
  const option = new Option(normalized, normalized);
  select.add(option);
  select.value = normalized;
}

function hydrateFormFromActor() {
  const form = document.getElementById("environmentForm");
  if (!form) return;
  const displayName = getDisplayName();
  if (form.elements.targetUser && !form.elements.targetUser.value) {
    form.elements.targetUser.value = displayName;
  }
  if (form.elements.evaluator && !form.elements.evaluator.value) {
    form.elements.evaluator.value = displayName;
  }
  setSelectValue(form.elements.store, getContextStoreName());
  setSelectValue(form.elements.role, inferRoleLabel());
}

function hydratePerformanceForm() {
  const form = document.getElementById("performanceForm");
  if (!form) return;
  if (form.elements.snapshotDate && !form.elements.snapshotDate.value) {
    form.elements.snapshotDate.value = getLocalDateString();
  }
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

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodFromDateString(value) {
  const [year, month] = String(value || "").split("-").map((part) => Number(part));
  return {
    periodYear: year,
    periodMonth: month
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toRecord(form) {
  const formData = new FormData(form);
  const now = new Date().toISOString();
  const results = getCheckResultsFromForm(formData);
  const scores = results.map((result) => result.score).filter((score) => Number.isFinite(score));
  const averageScore = scores.length
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
    : Number(formData.get("score"));
  return {
    record_id: createId(),
    store: formData.get("store"),
    target_user: formData.get("targetUser"),
    role: formData.get("role"),
    management_category: formData.get("managementCategory"),
    checked_at: now,
    evaluator: formData.get("evaluator"),
    score: averageScore,
    comment: formData.get("comment"),
    photo_url: formData.get("photoUrl"),
    photo_storage_path: form.dataset.photoStoragePath || null,
    results,
    status: "active",
    created_at: now,
    created_by: formData.get("evaluator"),
    version: 1
  };
}

function getCheckResultsFromForm(formData) {
  if (!checkItems.length) {
    return [{
      checkItemId: defaultCheckItemId,
      score: Number(formData.get("score")),
      comment: formData.get("comment")
    }];
  }

  return checkItems.map((item) => ({
    checkItemId: item.id,
    score: Number(formData.get(`score_${item.id}`)),
    comment: formData.get(`comment_${item.id}`) || null
  }));
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

function groupCheckItemsByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.management_category || "performance";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    const aIndex = CATEGORY_ORDER.indexOf(a);
    const bIndex = CATEGORY_ORDER.indexOf(b);
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

function getSelectedScores(form = document.getElementById("environmentForm")) {
  if (!form) return [];
  const formData = new FormData(form);
  if (!checkItems.length) {
    const score = Number(formData.get("score"));
    return Number.isFinite(score) ? [score] : [];
  }
  return checkItems
    .map((item) => Number(formData.get(`score_${item.id}`)))
    .filter((score) => Number.isFinite(score));
}

function getSelectedScoreMap(form = document.getElementById("environmentForm")) {
  const scores = new Map();
  if (!form || !checkItems.length) return scores;
  const formData = new FormData(form);
  for (const item of checkItems) {
    const score = Number(formData.get(`score_${item.id}`));
    if (Number.isFinite(score)) scores.set(item.id, score);
  }
  return scores;
}

function getMissingScoreItems(form = document.getElementById("environmentForm")) {
  if (!form || !checkItems.length) return [];
  const formData = new FormData(form);
  return checkItems.filter((item) => {
    const value = formData.get(`score_${item.id}`);
    return value === null || value === "";
  });
}

function clearMissingScoreMarkers() {
  document.querySelectorAll(".check-item.is-missing").forEach((item) => {
    item.classList.remove("is-missing");
  });
}

function markMissingScoreItems(items) {
  clearMissingScoreMarkers();
  for (const item of items) {
    const element = document.querySelector(`[data-check-item-id="${item.id}"]`);
    if (element) element.classList.add("is-missing");
  }
}

function validateEnvironmentForm(form) {
  clearMissingScoreMarkers();
  const missing = getMissingScoreItems(form);
  if (missing.length) {
    markMissingScoreItems(missing);
    const firstMissing = document.querySelector(`[data-check-item-id="${missing[0].id}"]`);
    if (firstMissing) firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
    setApiStatus(`未入力のチェック項目があります: ${missing.length}件`, "error");
    return false;
  }
  return form.reportValidity();
}

function renderScoreSummary() {
  const summary = document.getElementById("scoreSummary");
  if (!summary) return;
  const scores = getSelectedScores();
  const scoreMap = getSelectedScoreMap();
  const total = scores.length;
  const count0 = scores.filter((score) => score === 0).length;
  const count3 = scores.filter((score) => score === 3).length;
  const count5 = scores.filter((score) => score === 5).length;
  const average = total
    ? Math.round((scores.reduce((sum, score) => sum + score, 0) / total) * 10) / 10
    : 0;

  const totalHtml = [
    { label: "入力済み", value: `${total}/${checkItems.length || total || 1}項目`, tone: "ok" },
    { label: "0点", value: `${count0}件`, tone: count0 ? "danger" : "" },
    { label: "3点", value: `${count3}件`, tone: count3 ? "warn" : "" },
    { label: "5点", value: `${count5}件`, tone: count5 ? "ok" : "" },
    { label: "平均", value: average.toFixed(1), tone: average >= 4 ? "ok" : average <= 2 ? "danger" : "warn" }
  ].map((item) => `
    <div class="score-summary-item">
      <p class="score-summary-label">${item.label}</p>
      <p class="score-summary-value ${item.tone}">${item.value}</p>
    </div>
  `).join("");

  const categoryHtml = checkItems.length ? groupCheckItemsByCategory(checkItems).map(([category, items]) => {
    const categoryScores = items
      .map((item) => scoreMap.get(item.id))
      .filter((score) => Number.isFinite(score));
    const issueCount = categoryScores.filter((score) => score === 0 || score === 3).length;
    const categoryAverage = categoryScores.length
      ? Math.round((categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length) * 10) / 10
      : null;
    const tone = issueCount ? "warn" : categoryScores.length === items.length && categoryAverage >= 4 ? "ok" : "";
    return `
      <div class="category-summary-item">
        <p class="score-summary-label">${escapeHtml(fromCategoryId(category))}</p>
        <p class="score-summary-value ${tone}">${categoryAverage === null ? "-" : categoryAverage.toFixed(1)}</p>
        <p class="category-summary-note">入力 ${categoryScores.length}/${items.length} / 課題 ${issueCount}件</p>
      </div>
    `;
  }).join("") : "";

  summary.innerHTML = `
    <div class="score-summary-total">${totalHtml}</div>
    ${categoryHtml ? `<div class="category-summary">${categoryHtml}</div>` : ""}
  `;
}

function fromApiCheck(row) {
  const scoreBreakdown = row.score_breakdown || {};
  const hasScoreBreakdown = Boolean(row.score_breakdown);
  return {
    record_id: row.id,
    source_check_id: row.id,
    store_id: row.store_id,
    department_id: row.department_id || null,
    submitted_by_employee_id: row.submitted_by_employee_id || null,
    store: row.store_name || row.store_id,
    target_user: row.submitted_by_name || row.submitted_by_employee_id,
    role: "",
    management_category: "環境整備",
    checked_at: row.submitted_at || row.check_date,
    evaluator: row.submitted_by_employee_id,
    score: row.overall_score,
    comment: row.summary_comment || row.next_action || "",
    photo_url: "",
    photo_count: Number(row.photo_count || 0),
    result_count: Number(row.result_count || 0),
    score_breakdown: hasScoreBreakdown ? {
      score0: Number(scoreBreakdown.score0 || 0),
      score3: Number(scoreBreakdown.score3 || 0),
      score5: Number(scoreBreakdown.score5 || 0),
      other: Number(scoreBreakdown.other || 0)
    } : null,
    status: row.status,
    created_at: row.submitted_at || row.check_date,
    created_by: "",
    version: 1
  };
}

function fromApiCheckDetail(row) {
  const record = fromApiCheck(row);
  record.results = (row.results || []).map((result) => ({
    id: result.id,
    resultId: result.id,
    checkId: result.check_id,
    checkItemId: result.check_item_id,
    score: result.score,
    booleanValue: result.boolean_value,
    textValue: result.text_value,
    comment: result.comment,
    itemTitle: result.item_title,
    itemDescription: result.item_description,
    managementCategory: result.management_category,
    sortOrder: result.sort_order,
    photos: result.photos || []
  }));
  const firstPhoto = record.results.flatMap((result) => result.photos || [])[0];
  if (firstPhoto?.photo_url) record.photo_url = firstPhoto.photo_url;
  record.result_count = record.results.length || record.result_count;
  return record;
}

function fromApiImprovementAction(row) {
  return {
    id: row.id,
    sourceCheckId: row.source_check_id,
    sourceCheckResultId: row.source_check_result_id,
    storeId: row.store_id,
    store: row.store_name || row.store_id,
    departmentId: row.department_id,
    targetEmployeeId: row.target_employee_id,
    targetEmployeeName: row.target_employee_name,
    ownerEmployeeId: row.owner_employee_id,
    ownerEmployeeName: row.owner_employee_name,
    managementCategory: row.management_category,
    actionTitle: row.action_title,
    actionBody: row.action_body,
    priority: row.priority,
    status: row.status,
    scoreAtCreation: row.score_at_creation,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    completedByName: row.completed_by_name,
    completionComment: row.completion_comment,
    aiDraft: row.ai_draft || {},
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromApiPerformanceSnapshot(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    store: row.store_name || row.store_id || "-",
    departmentId: row.department_id,
    snapshotDate: row.snapshot_date,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    salesTotal: row.sales_total,
    technicalSales: row.technical_sales,
    productSales: row.product_sales,
    budgetSales: row.budget_sales,
    salesBudgetRate: row.sales_budget_rate,
    salesYearOverYearRate: row.sales_year_over_year_rate,
    contributionProductivity: row.contribution_productivity,
    approachRate: row.approach_rate,
    nps: row.nps,
    enps: row.enps,
    campaignKpi: row.campaign_kpi || {},
    sourceDetail: row.source_detail || {},
    aiSummary: row.ai_summary || {},
    status: row.status,
    importedAt: row.imported_at,
    importedByName: row.imported_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromApiPerformanceInitiative(row) {
  return {
    id: row.id,
    storeId: row.store_id,
    store: row.store_name || row.store_id || "-",
    departmentId: row.department_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    currentMonthInitiative: row.current_month_initiative,
    nextMonthInitiative: row.next_month_initiative,
    storeIssue: row.store_issue,
    performanceComment: row.performance_comment,
    ownerEmployeeId: row.owner_employee_id,
    ownerEmployeeName: row.owner_employee_name,
    relatedSnapshotId: row.related_snapshot_id,
    aiDraft: row.ai_draft || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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
  if (!storeId || !record.results?.length || record.results.some((result) => !result.checkItemId)) {
    return { ok: false, reason: "store-or-check-items-not-configured" };
  }

  const payload = {
    storeId,
    checkDate: getLocalDateString(new Date(record.checked_at)),
    checkScope: "store",
    summaryComment: record.comment,
    nextAction: record.comment,
    results: record.results.map((result, index) => ({
      checkItemId: result.checkItemId,
      score: result.score,
      comment: result.comment || record.comment,
      photos: index === 0 && (record.photo_url || record.photo_storage_path) ? [{
        photoUrl: record.photo_url || null,
        storagePath: record.photo_storage_path || null,
        photoType: "evidence"
      }] : []
    }))
  };

  const response = await apiRequest("/checks", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function uploadPhotoFile(file) {
  if (!hasApiConfig()) throw new Error("Management API未接続のため写真アップロードできません。");
  const storeId = getDefaultStoreId();
  if (!storeId) throw new Error("店舗IDが取得できないため写真アップロードできません。");
  const form = document.getElementById("environmentForm");
  const body = new FormData();
  body.append("file", file);
  body.append("storeId", storeId);
  body.append("checkDate", getLocalDateString());

  const response = await apiRequest("/photos/upload", {
    method: "POST",
    body
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "photo upload failed");
  if (form) {
    form.dataset.photoStoragePath = json.storagePath || "";
    form.elements.photoUrl.value = json.photoUrl || "";
  }
  return json;
}

async function loadRemoteRecords() {
  if (!hasApiConfig()) return null;
  const params = new URLSearchParams({ limit: "100" });
  const response = await apiRequest(`/checks?${params.toString()}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "Management API load failed");
  return (json.checks || []).map(fromApiCheck);
}

async function loadRemoteRecordDetail(recordId) {
  if (!hasApiConfig()) return null;
  const response = await apiRequest(`/checks/${encodeURIComponent(recordId)}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "Management check detail load failed");
  return fromApiCheckDetail(json.check);
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

async function saveRemoteImprovementAction(record) {
  if (!hasApiConfig()) throw new Error("Management API未接続のため改善履歴を保存できません。");
  const payload = buildImprovementActionPayload(record);
  const response = await apiRequest("/improvement-actions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "improvement action save failed");
  return json;
}

async function loadRemoteImprovementActions(status = "") {
  if (!hasApiConfig()) return [];
  const params = new URLSearchParams({ limit: "100" });
  if (status) params.set("status", status);
  const response = await apiRequest(`/improvement-actions?${params.toString()}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "improvement action load failed");
  return (json.actions || []).map(fromApiImprovementAction);
}

async function patchRemoteImprovementAction(actionId, payload) {
  if (!hasApiConfig()) throw new Error("Management API未接続のため改善アクションを更新できません。");
  const response = await apiRequest(`/improvement-actions/${encodeURIComponent(actionId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "improvement action update failed");
  return json;
}

async function loadRemotePerformanceSnapshots() {
  if (!hasApiConfig()) return [];
  const params = new URLSearchParams({ limit: "100" });
  const response = await apiRequest(`/performance/snapshots?${params.toString()}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "performance snapshot load failed");
  return (json.snapshots || []).map(fromApiPerformanceSnapshot);
}

async function loadRemotePerformanceInitiatives() {
  if (!hasApiConfig()) return [];
  const params = new URLSearchParams({ limit: "100" });
  const response = await apiRequest(`/performance/initiatives?${params.toString()}`);
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "performance initiative load failed");
  return (json.initiatives || []).map(fromApiPerformanceInitiative);
}

async function saveRemotePerformanceSnapshot(payload) {
  if (!hasApiConfig()) throw new Error("Management API未接続のため成果KPIを保存できません。");
  const response = await apiRequest("/performance/snapshots", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "performance snapshot save failed");
  return json;
}

async function saveRemotePerformanceInitiative(payload) {
  if (!hasApiConfig()) throw new Error("Management API未接続のため店舗取り組みを保存できません。");
  const response = await apiRequest("/performance/initiatives", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "performance initiative save failed");
  return json;
}

async function loadCheckItems() {
  if (!hasApiConfig()) return [];
  const response = await apiRequest("/check-items");
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || "Management check item load failed");
  checkItems = json.items || [];
  renderScoreControls();
  return checkItems;
}

function renderScoreControls() {
  const row = document.getElementById("scoreRow") || document.getElementById("checkItems");
  const meta = document.getElementById("checkItemsMeta");
  if (!row) return;

  if (checkItems.length) {
    if (meta) meta.textContent = `${checkItems.length}項目を読み込みました。点数は 0 / 3 / 5 で記録します。`;
    let itemNumber = 0;
    row.innerHTML = groupCheckItemsByCategory(checkItems).map(([category, items]) => `
      <section class="check-category" aria-label="${escapeHtml(fromCategoryId(category))}">
        <div class="check-category-title">
          <span>${escapeHtml(fromCategoryId(category))}</span>
          <span class="check-category-count">${items.length}項目</span>
        </div>
        ${items.map((item) => {
          itemNumber += 1;
          return `
            <section class="check-item" data-check-item-id="${item.id}">
              <div class="check-item-head">
                <div>
                  <h3 class="check-item-title"><span class="check-item-number">${itemNumber}.</span> ${escapeHtml(item.title)}</h3>
                  <p class="muted-text">${escapeHtml(item.description || "")}</p>
                </div>
                <span class="category-pill">${escapeHtml(fromCategoryId(item.management_category))}</span>
              </div>
              <div class="score-row" role="radiogroup" aria-label="${escapeHtml(item.title)}">
                ${SCORE_CHOICES.map((score) => `
                  <label class="score-choice">
                    <input type="radio" name="score_${item.id}" value="${score}" required>
                    <span>${score}</span>
                  </label>
                `).join("")}
              </div>
              <label>
                コメント
                <textarea name="comment_${item.id}" rows="2" placeholder="この項目の気づき・改善点"></textarea>
              </label>
            </section>
          `;
        }).join("")}
      </section>
    `).join("");
    renderScoreSummary();
    hydrateFormFromActor();
    return;
  }

  if (hasApiConfig()) {
    if (meta) meta.textContent = "チェック項目を読み込めませんでした。";
    row.innerHTML = `
      <div class="empty-cell check-items-empty">
        チェック項目を読み込めません。NOV HUBからManagement Platformを開き直してください。
      </div>
    `;
    return;
  }

  if (meta) meta.textContent = "API未接続のため、簡易スコア入力で動作します。";
  row.innerHTML = SCORE_CHOICES.map((score) => `
    <label class="score-choice">
      <input type="radio" name="score" value="${score}" required>
      <span>${score}</span>
    </label>
  `).join("");
  renderScoreSummary();
  hydrateFormFromActor();
}

function summarize(records) {
  return getDashboardSummary(records).values;
}

function getRecordBreakdown(record) {
  if (record.score_breakdown) return record.score_breakdown;
  const scores = (record.results || [])
    .map((result) => Number(result.score))
    .filter((score) => Number.isFinite(score));
  return {
    score0: scores.filter((score) => score === 0).length,
    score3: scores.filter((score) => score === 3).length,
    score5: scores.filter((score) => score === 5).length,
    other: scores.filter((score) => ![0, 3, 5].includes(score)).length
  };
}

function getDashboardSummary(records, actions = improvementActions) {
  const latest = records[0] || null;
  const latestBreakdown = latest ? getRecordBreakdown(latest) : null;
  const issueCount = latestBreakdown
    ? Number(latestBreakdown.score0 || 0) + Number(latestBreakdown.score3 || 0)
    : records.filter((record) => Number(record.score) <= 3).length;
  const openActionCount = actions.filter((action) => ["open", "in_progress"].includes(action.status)).length;
  const completedActionCount = actions.filter((action) => action.status === "completed").length;
  const photoRecordCount = records.filter(hasRecordPhotos).length;
  const photoCount = records.reduce((sum, record) => sum + getRecordPhotoCount(record), 0);
  const latestScore = latest && Number.isFinite(Number(latest.score)) ? Number(latest.score).toFixed(1) : "未登録";

  return {
    values: {
      current: latest ? latestScore : "未登録",
      issues: `${issueCount}件`,
      actions: `${openActionCount}件`,
      growth: photoCount ? `写真${photoCount}枚` : `${records.length}件`
    },
    notes: {
      current: latest ? `${latest.store || "店舗"} の最新平均スコアです。` : "最初の環境整備チェックを登録してください。",
      issues: latest ? "最新チェックの0点・3点を課題候補として扱います。" : "履歴作成後に課題候補を表示します。",
      actions: openActionCount ? `未完了の改善アクションです。完了済み ${completedActionCount}件。` : "履歴詳細から改善アクションを保存できます。",
      growth: photoCount ? `写真付き履歴 ${photoRecordCount}件。比較・AI分析の材料が増えています。` : records.length ? "履歴が増えるほど比較・AI分析が可能になります。" : "履歴が増えるほど成長推移を見られます。"
    }
  };
}

function getRecentActionRecords(records) {
  return records
    .filter((record) => record.comment && record.comment.trim())
    .slice(0, 3);
}

function getAiCommentAudience() {
  const roles = getRoleKeys();
  if (roles.includes("super_admin") || roles.includes("executive") || roles.includes("backoffice")) {
    return "global_manager";
  }
  if (roles.includes("area_manager") || roles.includes("department_manager")) {
    return "area_manager";
  }
  if (roles.includes("store_manager")) {
    return "store_manager";
  }
  return "staff";
}

function generateAiCommentDraft(record, records) {
  const breakdown = getRecordBreakdown(record);
  const score0 = Number(breakdown.score0 || 0);
  const score3 = Number(breakdown.score3 || 0);
  const photoCount = getRecordPhotoCount(record);
  const hasComment = Boolean(record.comment && record.comment.trim());
  const audience = getAiCommentAudience();
  const suggestions = [];

  if (audience === "staff") {
    if (score0 > 0) {
      suggestions.push(`0点の${score0}項目から、自分が今日改善できる行動を1つ選んでください。`);
    } else if (score3 > 0) {
      suggestions.push(`3点の${score3}項目を見て、次回5点に近づける行動を1つ決めてください。`);
    } else {
      suggestions.push("良い状態を維持できています。続けたい行動を1つ言語化してください。");
    }
  } else if (score0 > 0) {
    suggestions.push(`0点の${score0}項目を最優先で現場確認し、店舗としての原因を1つに絞ってください。`);
  } else if (score3 > 0) {
    suggestions.push(`3点の${score3}項目から、店舗で次回までに改善する項目を1つ選んでください。`);
  } else {
    suggestions.push("良い状態を維持するため、できている行動を店舗内で共有してください。");
  }

  if (photoCount > 0) {
    suggestions.push(`写真${photoCount}枚をBefore/After比較の材料として残せています。次回も同じ場所を撮影すると成長が見えます。`);
  } else {
    suggestions.push("写真を1枚残すと、次回の比較とAI分析に使いやすくなります。");
  }

  if (!hasComment) {
    suggestions.push(audience === "staff"
      ? "コメントに「自分の気づき」と「次にやること」を1文ずつ残してください。"
      : "コメントに「店舗の気づき」と「次の改善行動」を1文ずつ残してください。");
  }

  const titlePrefix = audience === "staff" ? "自分の" : audience === "store_manager" ? "自店の" : "担当範囲の";
  return {
    title: score0 > 0 ? `${titlePrefix}最優先課題を絞る` : score3 > 0 ? `${titlePrefix}次の改善行動を決める` : `${titlePrefix}良い状態を継続する`,
    summary: `これは評価ではなく、最新履歴${records.length}件をもとにした${audience === "staff" ? "成長" : "改善"}提案です。`,
    suggestions: suggestions.slice(0, 3)
  };
}

function renderAiCommentDraft(aiDraft) {
  return `
    <article class="focus-card focus-card-wide ai-comment-card">
      <p class="score-summary-label">AI改善コメント（案）</p>
      <h3>${escapeHtml(aiDraft.title)}</h3>
      <p class="focus-note">${escapeHtml(aiDraft.summary)}</p>
      <ul class="ai-comment-list">
        ${aiDraft.suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderFocusPanel(records) {
  const panel = document.getElementById("focusPanel");
  if (!panel) return;
  if (!records.length) {
    panel.innerHTML = `
      <div class="panel-head">
        <p class="section-label">Focus</p>
        <h2>改善フォーカス</h2>
        <p class="muted-text">最初の環境整備チェックを保存すると、0点・3点・コメントから次の行動を整理します。</p>
      </div>
    `;
    return;
  }

  const latest = records[0];
  const breakdown = getRecordBreakdown(latest);
  const score0 = Number(breakdown.score0 || 0);
  const score3 = Number(breakdown.score3 || 0);
  const issueCount = score0 + score3;
  const actions = getRecentActionRecords(records);
  const aiDraft = generateAiCommentDraft(latest, records);
  const priorityLabel = score0 > 0 ? "最優先" : issueCount > 0 ? "確認" : "維持";
  const priorityText = score0 > 0
    ? `0点が${score0}件あります。まず安全・衛生・導線に関わる項目から確認します。`
    : issueCount > 0
      ? `3点を含む課題候補が${issueCount}件あります。次回までの改善行動を1つ決めます。`
      : "最新チェックでは大きな課題候補はありません。良い状態を維持する行動を残します。";

  panel.innerHTML = `
    <div class="panel-head horizontal">
      <div>
        <p class="section-label">Focus</p>
        <h2>改善フォーカス</h2>
      </div>
      <span class="focus-badge">${priorityLabel}</span>
    </div>
    <div class="focus-grid">
      <article class="focus-card">
        <p class="score-summary-label">最新チェック</p>
        <h3>${escapeHtml(latest.store || "店舗")}</h3>
        <p class="focus-note">平均 ${Number(latest.score || 0).toFixed(1)} / 0点 ${score0}件 / 3点 ${score3}件</p>
      </article>
      <article class="focus-card">
        <p class="score-summary-label">優先判断</p>
        <h3>${issueCount}件</h3>
        <p class="focus-note">${priorityText}</p>
      </article>
      <article class="focus-card focus-card-wide">
        <p class="score-summary-label">次の行動メモ</p>
        <h3>${escapeHtml(latest.comment || "コメント未入力")}</h3>
        <p class="focus-note">${actions.length ? `${actions.length}件のコメント付き履歴があります。` : "コメントを残すと改善履歴として追いやすくなります。"}</p>
      </article>
      ${renderAiCommentDraft(aiDraft)}
    </div>
  `;
}

function getStoreSummaries(records) {
  const storeMap = new Map();
  for (const record of records) {
    const store = record.store || "店舗未設定";
    const current = storeMap.get(store) || {
      store,
      count: 0,
      scoreTotal: 0,
      scoreCount: 0,
      issueCount: 0,
      latestAt: null,
      latestComment: ""
    };
    const score = Number(record.score);
    const breakdown = getRecordBreakdown(record);
    current.count += 1;
    if (Number.isFinite(score)) {
      current.scoreTotal += score;
      current.scoreCount += 1;
    }
    current.issueCount += Number(breakdown.score0 || 0) + Number(breakdown.score3 || 0);
    const checkedAt = record.checked_at ? new Date(record.checked_at) : null;
    if (checkedAt && !Number.isNaN(checkedAt.getTime())) {
      const latestTime = current.latestAt ? new Date(current.latestAt).getTime() : 0;
      if (checkedAt.getTime() >= latestTime) {
        current.latestAt = record.checked_at;
        current.latestComment = record.comment || "";
      }
    }
    storeMap.set(store, current);
  }

  return [...storeMap.values()]
    .map((summary) => ({
      ...summary,
      averageScore: summary.scoreCount ? Math.round((summary.scoreTotal / summary.scoreCount) * 10) / 10 : null
    }))
    .sort((a, b) => {
      if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
      return String(a.store).localeCompare(String(b.store), "ja");
    });
}

function renderStoreSummaryPanel(records) {
  const panel = document.getElementById("storeSummaryPanel");
  if (!panel) return;
  const summaries = getStoreSummaries(records);
  if (!summaries.length) {
    panel.innerHTML = `
      <div class="panel-head">
        <p class="section-label">Store Summary</p>
        <h2>店舗別サマリー</h2>
        <p class="muted-text">履歴が登録されると、店舗別の平均スコア・課題数・最新チェック日を表示します。</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="panel-head">
      <p class="section-label">Store Summary</p>
      <h2>店舗別サマリー</h2>
      <p class="muted-text">課題数が多い店舗から確認できます。</p>
    </div>
    <div class="store-summary-list">
      ${summaries.map((summary) => `
        <article class="store-summary-row">
          <p class="store-summary-name">${escapeHtml(summary.store)}</p>
          <p class="store-summary-metric">平均<strong>${summary.averageScore === null ? "-" : summary.averageScore.toFixed(1)}</strong></p>
          <p class="store-summary-metric">課題<strong>${summary.issueCount}件</strong></p>
          <p class="store-summary-metric">履歴<strong>${summary.count}件</strong></p>
          <p class="store-summary-metric">最新<strong>${escapeHtml(formatDate(summary.latestAt))}</strong></p>
        </article>
      `).join("")}
    </div>
  `;
}

function getAiPriorityRecords(records) {
  return records
    .map((record) => {
      const breakdown = getRecordBreakdown(record);
      const score0 = Number(breakdown.score0 || 0);
      const score3 = Number(breakdown.score3 || 0);
      return {
        record,
        score0,
        score3,
        priorityScore: score0 * 2 + score3
      };
    })
    .filter((item) => item.priorityScore > 0 || (item.record.comment && item.record.comment.trim()))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return new Date(b.record.checked_at || 0).getTime() - new Date(a.record.checked_at || 0).getTime();
    })
    .slice(0, 3);
}

function renderAiPriorityPanel(records) {
  const panel = document.getElementById("aiPriorityPanel");
  if (!panel) return;
  const priorityRecords = getAiPriorityRecords(records);
  if (!priorityRecords.length) {
    panel.innerHTML = `
      <div class="panel-head">
        <p class="section-label">AI Priority</p>
        <h2>優先確認リスト</h2>
        <p class="muted-text">0点・3点・コメント付き履歴が増えると、確認すべき改善候補をここに表示します。</p>
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="panel-head">
      <p class="section-label">AI Priority</p>
      <h2>優先確認リスト</h2>
      <p class="muted-text">評価ではなく、次に見るべき改善候補を並べています。</p>
    </div>
    <div class="ai-priority-list">
      ${priorityRecords.map(({ record, score0, score3, priorityScore }) => {
        const aiDraft = generateAiCommentDraft(record, records);
        return `
          <article class="ai-priority-row">
            <div>
              <p class="store-summary-name">${escapeHtml(record.store || "店舗")}</p>
              <p class="focus-note">${escapeHtml(formatDate(record.checked_at))} / 0点 ${score0}件 / 3点 ${score3}件</p>
            </div>
            <div>
              <p class="score-summary-label">次の確認</p>
              <p class="ai-priority-action">${escapeHtml(aiDraft.title)}</p>
            </div>
            <div class="ai-priority-actions">
              <span class="focus-badge">優先度 ${priorityScore}</span>
              <button type="button" class="ghost-btn detail-btn ai-priority-detail-btn" data-record-id="${escapeHtml(record.record_id)}">詳細</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function getActionStatusLabel(status) {
  const map = {
    open: "未着手",
    in_progress: "進行中",
    completed: "完了",
    cancelled: "中止",
    archived: "アーカイブ"
  };
  return map[status] || status || "-";
}

function getActionPriorityLabel(priority) {
  const map = {
    high: "高",
    medium: "中",
    low: "低"
  };
  return map[priority] || priority || "-";
}

function getFilteredImprovementActions() {
  const statusFilter = document.getElementById("actionStatusFilter")?.value || "";
  return improvementActions.filter((action) => !statusFilter || action.status === statusFilter);
}

function renderImprovementActions() {
  const list = document.getElementById("improvementActionList");
  const status = document.getElementById("actionListStatus");
  if (!list) return;
  const filteredActions = getFilteredImprovementActions();
  if (status) {
    status.textContent = improvementActions.length
      ? `表示 ${filteredActions.length}/${improvementActions.length}件`
      : "改善アクションはまだありません。履歴詳細から「改善履歴に保存」を押すとここに表示されます。";
  }
  if (!filteredActions.length) {
    list.innerHTML = `<div class="empty-cell">改善アクションはまだありません。</div>`;
    return;
  }

  list.innerHTML = filteredActions.map((action) => {
    const isCompleted = action.status === "completed";
    return `
      <article class="improvement-action-card">
        <div class="improvement-action-card-head">
          <div>
            <p class="score-summary-label">${escapeHtml(action.store || "店舗")} / ${escapeHtml(fromCategoryId(action.managementCategory))}</p>
            <h3>${escapeHtml(action.actionTitle)}</h3>
          </div>
          <div class="improvement-action-badges">
            <span class="focus-badge priority-${escapeHtml(action.priority)}">優先度 ${escapeHtml(getActionPriorityLabel(action.priority))}</span>
            <span class="focus-badge status-${escapeHtml(action.status)}">${escapeHtml(getActionStatusLabel(action.status))}</span>
          </div>
        </div>
        <p class="focus-note">${escapeHtml(action.actionBody || "")}</p>
        <div class="improvement-action-meta">
          <span>担当: ${escapeHtml(action.ownerEmployeeName || "-")}</span>
          <span>期限: ${escapeHtml(formatDateOnly(action.dueDate))}</span>
          <span>作成: ${escapeHtml(formatDate(action.createdAt))}</span>
          ${isCompleted ? `<span>完了: ${escapeHtml(formatDate(action.completedAt))}</span>` : ""}
        </div>
        <div class="improvement-action-actions">
          <button type="button" class="ghost-btn action-source-detail-btn" data-record-id="${escapeHtml(action.sourceCheckId)}">元履歴</button>
          ${action.status === "open" ? `<button type="button" class="ghost-btn update-action-status-btn" data-action-id="${escapeHtml(action.id)}" data-next-status="in_progress">進行中にする</button>` : ""}
          ${isCompleted ? "" : `<button type="button" class="update-action-status-btn" data-action-id="${escapeHtml(action.id)}" data-next-status="completed">完了にする</button>`}
          ${["completed", "archived"].includes(action.status) ? "" : `<button type="button" class="ghost-btn update-action-status-btn" data-action-id="${escapeHtml(action.id)}" data-next-status="archived">アーカイブ</button>`}
        </div>
      </article>
    `;
  }).join("");
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${number.toLocaleString("ja-JP")}${suffix}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${Math.round(number * 10) / 10}%`;
}

function getLatestPerformanceSnapshot() {
  return [...performanceSnapshots].sort((a, b) => {
    return new Date(b.snapshotDate || 0).getTime() - new Date(a.snapshotDate || 0).getTime();
  })[0] || null;
}

function getLatestPerformanceInitiative() {
  return [...performanceInitiatives].sort((a, b) => {
    if (b.periodYear !== a.periodYear) return Number(b.periodYear || 0) - Number(a.periodYear || 0);
    return Number(b.periodMonth || 0) - Number(a.periodMonth || 0);
  })[0] || null;
}

function getFilteredPerformanceSnapshots() {
  const periodFilter = document.getElementById("performancePeriodFilter")?.value || "";
  return performanceSnapshots.filter((snapshot) => {
    if (periodFilter === "current_month") return isInCurrentMonth(snapshot.snapshotDate);
    if (periodFilter === "last_30_days") return isWithinLastDays(snapshot.snapshotDate, 30);
    if (periodFilter === "last_month") return isInLastMonth(snapshot.snapshotDate);
    return true;
  });
}

function getFilteredPerformanceInitiatives() {
  const periodFilter = document.getElementById("performancePeriodFilter")?.value || "";
  return performanceInitiatives.filter((initiative) => {
    if (!periodFilter) return true;
    const dateString = `${initiative.periodYear || "0000"}-${String(initiative.periodMonth || "01").padStart(2, "0")}-01`;
    if (periodFilter === "current_month") return isInCurrentMonth(dateString);
    if (periodFilter === "last_30_days") return isWithinLastDays(dateString, 30);
    if (periodFilter === "last_month") return isInLastMonth(dateString);
    return true;
  });
}

function getPerformanceSignals(snapshot, initiative) {
  const signals = [];
  if (snapshot) {
    if (Number.isFinite(Number(snapshot.salesBudgetRate)) && Number(snapshot.salesBudgetRate) < 100) {
      signals.push({ label: "予算比", value: formatPercent(snapshot.salesBudgetRate), note: "100%未満です。今日の売上行動を決めます。" });
    }
    if (Number.isFinite(Number(snapshot.salesYearOverYearRate)) && Number(snapshot.salesYearOverYearRate) < 100) {
      signals.push({ label: "前年比", value: formatPercent(snapshot.salesYearOverYearRate), note: "前年割れです。技術/商品/客数のどこが弱いか確認します。" });
    }
    if (Number.isFinite(Number(snapshot.approachRate)) && Number(snapshot.approachRate) < 70) {
      signals.push({ label: "アプローチ率", value: formatPercent(snapshot.approachRate), note: "声掛け・提案行動を確認します。" });
    }
    if (Number.isFinite(Number(snapshot.nps)) && Number(snapshot.nps) < 30) {
      signals.push({ label: "NPS", value: formatNumber(snapshot.nps), note: "顧客満足のコメントや要因を確認します。" });
    }
  }
  if (initiative?.storeIssue) {
    signals.push({ label: "店舗課題", value: "登録あり", note: initiative.storeIssue });
  }
  return signals;
}

function renderPerformanceFocusPanel() {
  const panel = document.getElementById("performanceFocusPanel");
  if (!panel) return;
  const latestSnapshot = getLatestPerformanceSnapshot();
  const latestInitiative = getLatestPerformanceInitiative();
  const signals = getPerformanceSignals(latestSnapshot, latestInitiative);

  if (!latestSnapshot && !latestInitiative) {
    panel.innerHTML = `
      <div class="panel-head horizontal">
        <div>
          <p class="section-label">Performance Focus</p>
          <h2>成果フォーカス</h2>
          <p class="muted-text">成果KPIを登録すると、予算比・前年比・店舗課題から次の成果行動を表示します。</p>
        </div>
        <button type="button" class="ghost-btn open-performance-btn">成果を登録</button>
      </div>
    `;
    return;
  }

  const headline = signals.length ? "成果課題を確認する" : "成果状態を維持する";
  const subText = latestSnapshot
    ? `${latestSnapshot.store} / ${formatDateOnly(latestSnapshot.snapshotDate)} の成果データ`
    : `${latestInitiative.store} / ${latestInitiative.periodYear}-${String(latestInitiative.periodMonth).padStart(2, "0")} の取り組み`;
  const rows = (signals.length ? signals : [
    { label: "成果状態", value: "大きな警告なし", note: "次の取り組みを継続し、月次で変化を確認します。" }
  ]).slice(0, 4);

  panel.innerHTML = `
    <div class="panel-head horizontal">
      <div>
        <p class="section-label">Performance Focus</p>
        <h2>${escapeHtml(headline)}</h2>
        <p class="muted-text">${escapeHtml(subText)}</p>
      </div>
      <button type="button" class="ghost-btn open-performance-btn">成果を見る</button>
    </div>
    <div class="performance-signal-grid">
      ${rows.map((signal) => `
        <article class="focus-card">
          <p class="score-summary-label">${escapeHtml(signal.label)}</p>
          <h3>${escapeHtml(signal.value)}</h3>
          <p class="focus-note">${escapeHtml(signal.note)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderPerformanceDashboard() {
  const status = document.getElementById("performanceStatus");
  const grid = document.getElementById("performanceKpiGrid");
  const snapshotBody = document.getElementById("performanceSnapshotBody");
  const initiativeBody = document.getElementById("performanceInitiativeBody");
  if (!grid || !snapshotBody || !initiativeBody) return;

  const filteredSnapshots = getFilteredPerformanceSnapshots();
  const filteredInitiatives = getFilteredPerformanceInitiatives();
  const latestSnapshot = filteredSnapshots[0] || getLatestPerformanceSnapshot();
  const latestInitiative = filteredInitiatives[0] || getLatestPerformanceInitiative();
  if (status) {
    status.textContent = hasApiConfig()
      ? `成果API接続OK: KPI ${filteredSnapshots.length}/${performanceSnapshots.length}件 / 取り組み ${filteredInitiatives.length}/${performanceInitiatives.length}件`
      : "API未接続のため成果データを読み込めません。";
  }

  const kpis = [
    { title: "総売上", value: latestSnapshot ? formatNumber(latestSnapshot.salesTotal, "円") : "-", note: latestSnapshot?.store || "最新KPI待ち" },
    { title: "予算比", value: latestSnapshot ? formatPercent(latestSnapshot.salesBudgetRate) : "-", note: "売上達成率" },
    { title: "前年比", value: latestSnapshot ? formatPercent(latestSnapshot.salesYearOverYearRate) : "-", note: "前年同日/月比較" },
    { title: "次の成果行動", value: latestInitiative?.storeIssue ? "課題あり" : "未設定", note: latestInitiative?.storeIssue || "店舗課題を登録すると表示します" }
  ];

  grid.innerHTML = kpis.map((kpi) => `
    <article class="performance-kpi-card">
      <h3>${escapeHtml(kpi.title)}</h3>
      <div class="value status-ok">${escapeHtml(kpi.value)}</div>
      <p class="note">${escapeHtml(kpi.note)}</p>
    </article>
  `).join("");

  if (!filteredSnapshots.length) {
    snapshotBody.innerHTML = `<tr><td class="empty-cell" colspan="8">成果KPIスナップショットはまだありません。</td></tr>`;
  } else {
    snapshotBody.innerHTML = filteredSnapshots.slice(0, 20).map((snapshot) => `
      <tr>
        <td>${escapeHtml(formatDateOnly(snapshot.snapshotDate))}</td>
        <td>${escapeHtml(snapshot.store)}</td>
        <td>${escapeHtml(formatNumber(snapshot.salesTotal, "円"))}</td>
        <td>${escapeHtml(formatPercent(snapshot.salesBudgetRate))}</td>
        <td>${escapeHtml(formatPercent(snapshot.salesYearOverYearRate))}</td>
        <td>${escapeHtml(formatNumber(snapshot.contributionProductivity, "円"))}</td>
        <td>${escapeHtml(formatNumber(snapshot.nps))}</td>
        <td>${escapeHtml(formatNumber(snapshot.enps))}</td>
      </tr>
    `).join("");
  }

  if (!filteredInitiatives.length) {
    initiativeBody.innerHTML = `<tr><td class="empty-cell" colspan="6">店舗取り組みはまだありません。</td></tr>`;
  } else {
    initiativeBody.innerHTML = filteredInitiatives.slice(0, 20).map((initiative) => `
      <tr>
        <td>${escapeHtml(`${initiative.periodYear || "-"}-${String(initiative.periodMonth || "").padStart(2, "0")}`)}</td>
        <td>${escapeHtml(initiative.store)}</td>
        <td>${escapeHtml(initiative.currentMonthInitiative || "-")}</td>
        <td>${escapeHtml(initiative.nextMonthInitiative || "-")}</td>
        <td>${escapeHtml(initiative.storeIssue || "-")}</td>
        <td>${escapeHtml(initiative.ownerEmployeeName || "-")}</td>
      </tr>
    `).join("");
  }
  renderPerformanceFocusPanel();
}

function getOptionalNumber(formData, name) {
  const value = String(formData.get(name) || "").trim();
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasInitiativeInput(formData) {
  return ["currentMonthInitiative", "nextMonthInitiative", "storeIssue", "performanceComment"]
    .some((name) => String(formData.get(name) || "").trim());
}

function buildPerformanceSnapshotPayload(form) {
  const formData = new FormData(form);
  const snapshotDate = String(formData.get("snapshotDate") || getLocalDateString());
  const { periodYear, periodMonth } = getPeriodFromDateString(snapshotDate);
  const storeId = getDefaultStoreId();
  if (!storeId) throw new Error("店舗IDが取得できないため成果KPIを保存できません。");
  return {
    storeId,
    snapshotDate,
    periodYear,
    periodMonth,
    salesTotal: getOptionalNumber(formData, "salesTotal"),
    technicalSales: getOptionalNumber(formData, "technicalSales"),
    productSales: getOptionalNumber(formData, "productSales"),
    budgetSales: getOptionalNumber(formData, "budgetSales"),
    salesBudgetRate: getOptionalNumber(formData, "salesBudgetRate"),
    salesYearOverYearRate: getOptionalNumber(formData, "salesYearOverYearRate"),
    contributionProductivity: getOptionalNumber(formData, "contributionProductivity"),
    approachRate: getOptionalNumber(formData, "approachRate"),
    nps: getOptionalNumber(formData, "nps"),
    enps: getOptionalNumber(formData, "enps"),
    sourceDetail: {
      source: "manual_management_platform",
      enteredBy: getDisplayName(),
      enteredAt: new Date().toISOString()
    },
    status: "active"
  };
}

function buildPerformanceInitiativePayload(form) {
  const formData = new FormData(form);
  const snapshotDate = String(formData.get("snapshotDate") || getLocalDateString());
  const { periodYear, periodMonth } = getPeriodFromDateString(snapshotDate);
  const storeId = getDefaultStoreId();
  if (!storeId) throw new Error("店舗IDが取得できないため店舗取り組みを保存できません。");
  return {
    storeId,
    periodYear,
    periodMonth,
    currentMonthInitiative: String(formData.get("currentMonthInitiative") || "").trim() || null,
    nextMonthInitiative: String(formData.get("nextMonthInitiative") || "").trim() || null,
    storeIssue: String(formData.get("storeIssue") || "").trim() || null,
    performanceComment: String(formData.get("performanceComment") || "").trim() || null,
    status: "active"
  };
}

function renderDashboard() {
  const records = getLocalRecords();
  const summary = getDashboardSummary(records, improvementActions);
  const grid = document.getElementById("dashboardGrid");
  grid.innerHTML = dashboardCards.map((card) => `
    <article class="card">
      <h3>${card.title}</h3>
      <div class="value ${card.status}">${summary.values[card.key] || card.value}</div>
      <p class="note">${summary.notes[card.key] || ""}</p>
    </article>
  `).join("");
  renderPerformanceFocusPanel();
  renderFocusPanel(records);
  renderStoreSummaryPanel(records);
  renderAiPriorityPanel(records);
  renderImprovementActions();

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
  const latestBreakdown = getRecordBreakdown(latest);
  const issueCount = Number(latestBreakdown.score0 || 0) + Number(latestBreakdown.score3 || 0);
  nextAction.textContent = issueCount > 0 ? `${latest.store} の改善アクションを決める` : `${latest.store} の良い状態を継続する`;
  nextNote.textContent = latest.comment || "次に取る行動をコメントに残してください。";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatScoreBreakdown(record) {
  const breakdown = record.score_breakdown;
  if (!breakdown) return "-";
  return `
    <span class="score-chip danger">0:${Number(breakdown.score0 || 0)}</span>
    <span class="score-chip warn">3:${Number(breakdown.score3 || 0)}</span>
    <span class="score-chip ok">5:${Number(breakdown.score5 || 0)}</span>
  `;
}

function isInCurrentMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isInLastMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date.getFullYear() === lastMonth.getFullYear() && date.getMonth() === lastMonth.getMonth();
}

function isWithinLastDays(value, days) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function getFilteredRecords(records) {
  const storeFilter = document.getElementById("historyStoreFilter")?.value || "";
  const issueFilter = document.getElementById("historyIssueFilter")?.value || "";
  const periodFilter = document.getElementById("historyPeriodFilter")?.value || "";
  return records.filter((record) => {
    if (storeFilter && record.store !== storeFilter) return false;
    if (periodFilter === "current_month" && !isInCurrentMonth(record.checked_at)) return false;
    if (periodFilter === "last_30_days" && !isWithinLastDays(record.checked_at, 30)) return false;
    if (issueFilter === "comments") return Boolean(record.comment && record.comment.trim());
    if (issueFilter === "photos") return hasRecordPhotos(record);
    if (issueFilter === "issues") {
      const breakdown = getRecordBreakdown(record);
      return Number(breakdown.score0 || 0) + Number(breakdown.score3 || 0) > 0;
    }
    return true;
  });
}

function renderHistoryFilters(records) {
  const storeFilter = document.getElementById("historyStoreFilter");
  const issueFilter = document.getElementById("historyIssueFilter");
  const periodFilter = document.getElementById("historyPeriodFilter");
  const status = document.getElementById("historyFilterStatus");
  if (!storeFilter || !issueFilter || !periodFilter) return;
  const currentStore = storeFilter.value;
  const stores = [...new Set(records.map((record) => record.store).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
  storeFilter.innerHTML = `<option value="">すべて</option>${stores.map((store) => `
    <option value="${escapeHtml(store)}">${escapeHtml(store)}</option>
  `).join("")}`;
  if (stores.includes(currentStore)) storeFilter.value = currentStore;
  const filtered = getFilteredRecords(records);
  if (status) {
    status.textContent = records.length
      ? `表示 ${filtered.length}/${records.length}件`
      : "まだ履歴がありません。";
  }
  return filtered;
}

function hasRecordPhotos(record) {
  if (Number(record.photo_count || 0) > 0) return true;
  if (record.photo_url || record.photo_storage_path) return true;
  return (record.results || []).some((result) => (result.photos || []).length > 0);
}

function getRecordPhotoCount(record) {
  if (Number(record.photo_count || 0) > 0) return Number(record.photo_count || 0);
  let count = record.photo_url || record.photo_storage_path ? 1 : 0;
  for (const result of record.results || []) {
    count += (result.photos || []).length;
  }
  return count;
}

function renderRecords(records = getLocalRecords()) {
  const body = document.getElementById("recordsBody");
  const filteredRecords = renderHistoryFilters(records) || records;
  if (filteredRecords.length === 0) {
    body.innerHTML = `<tr><td colspan="10" class="empty-cell">まだ履歴がありません。</td></tr>`;
    return;
  }
  body.innerHTML = filteredRecords.map((record) => `
    <tr>
      <td>${formatDate(record.checked_at)}</td>
      <td>${escapeHtml(record.store)}</td>
      <td>${escapeHtml(record.target_user)}</td>
      <td>${escapeHtml(record.management_category)}</td>
      <td><span class="count-badge">${Number(record.result_count || record.results?.length || 0)}項目</span></td>
      <td>${hasRecordPhotos(record) ? `<span class="count-badge photo-badge">${getRecordPhotoCount(record)}枚</span>` : "-"}</td>
      <td>${formatScoreBreakdown(record)}</td>
      <td><strong>${record.score}</strong></td>
      <td>${escapeHtml(record.comment)}</td>
      <td><button type="button" class="ghost-btn detail-btn" data-record-id="${escapeHtml(record.record_id)}">詳細</button></td>
    </tr>
  `).join("");
}

function findLocalRecord(recordId) {
  return getLocalRecords().find((record) => record.record_id === recordId) || null;
}

function getCheckItemMeta(checkItemId) {
  return checkItems.find((item) => item.id === checkItemId) || null;
}

function formatResultValue(result) {
  if (Number.isFinite(Number(result.score))) return `${Number(result.score)}点`;
  if (typeof result.booleanValue === "boolean") return result.booleanValue ? "はい" : "いいえ";
  if (result.textValue) return result.textValue;
  return "-";
}

function looksLikeImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
}

function renderPhotoPreview() {
  const form = document.getElementById("environmentForm");
  const panel = document.getElementById("photoPreviewPanel");
  if (!form || !panel) return;
  const url = String(form.elements.photoUrl?.value || "").trim();
  if (!url) {
    panel.innerHTML = `<p class="muted-text">写真URLを入力すると、保存前にリンクを確認できます。</p>`;
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    panel.innerHTML = `<p class="status-danger">写真URLの形式を確認してください。</p>`;
    return;
  }

  const imagePreview = looksLikeImageUrl(parsedUrl.href)
    ? `<img class="photo-preview-image" src="${escapeHtml(parsedUrl.href)}" alt="写真プレビュー" loading="lazy">`
    : `<p class="muted-text">Google Drive等の共有URLは、ボタンから別タブで確認できます。</p>`;

  panel.innerHTML = `
    <div class="photo-preview-card">
      ${imagePreview}
      <div class="photo-preview-actions">
        <a href="${escapeHtml(parsedUrl.href)}" target="_blank" rel="noopener" class="photo-link">写真URLを開く</a>
        <span class="muted-text">保存すると履歴詳細に紐付きます。</span>
      </div>
    </div>
  `;
}

function setPhotoUploadStatus(message, kind = "info") {
  const status = document.getElementById("photoUploadStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function renderPhotoLink(photo) {
  const url = photo.photo_url || photo.photoUrl || "";
  const label = photo.caption || photo.photo_type || photo.photoType || "写真を開く";
  if (!url) {
    return `<span class="photo-link muted-text">${escapeHtml(photo.storage_path || photo.storagePath || "写真URL未発行")}</span>`;
  }
  return `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="photo-link">
      ${escapeHtml(label)}
    </a>
  `;
}

function renderIssueResultSummary(results) {
  const issueResults = results
    .filter((result) => Number(result.score) === 0 || Number(result.score) === 3)
    .slice(0, 6);
  if (!issueResults.length) {
    return `
      <div class="issue-summary-panel">
        <p class="score-summary-label">課題候補</p>
        <p class="focus-note">0点・3点の項目はありません。良い状態を維持する行動を確認してください。</p>
      </div>
    `;
  }

  return `
    <div class="issue-summary-panel">
      <p class="score-summary-label">課題候補</p>
      <div class="issue-summary-list">
        ${issueResults.map((result, index) => {
          const item = getCheckItemMeta(result.checkItemId);
          const title = result.itemTitle || item?.title || `項目 ${index + 1}`;
          const category = result.managementCategory || item?.management_category || "";
          return `
            <article class="issue-summary-item">
              <span class="score-chip ${Number(result.score) === 0 ? "danger" : "warn"}">${Number(result.score)}点</span>
              <div>
                <p class="issue-summary-title">${escapeHtml(title)}</p>
                <p class="focus-note">${escapeHtml(category ? fromCategoryId(category) : "")}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function getRecordIssueResults(record) {
  return (record.results || [])
    .filter((result) => Number(result.score) === 0 || Number(result.score) === 3)
    .sort((a, b) => Number(a.score || 0) - Number(b.score || 0))
    .slice(0, 3);
}

function getIssueResultTitle(result, index) {
  const item = getCheckItemMeta(result.checkItemId);
  return result.itemTitle || item?.title || `項目 ${index + 1}`;
}

function normalizeManagementCategory(value) {
  if (CATEGORY_ORDER.includes(value)) return value;
  return toCategoryId(value);
}

function getPrimaryImprovementIssue(record) {
  return getRecordIssueResults(record)[0] || null;
}

function generateImprovementActionDraft(record) {
  const primaryIssue = getPrimaryImprovementIssue(record);
  const primaryTitle = primaryIssue ? getIssueResultTitle(primaryIssue, 0) : "";
  const category = primaryIssue?.managementCategory || getCheckItemMeta(primaryIssue?.checkItemId)?.management_category || record.management_category || "";
  const actionTitle = primaryIssue
    ? `${record.store || "店舗"}: ${primaryTitle}を改善する`
    : `${record.store || "店舗"}: 良い状態を維持する`;
  const actionBody = [
    `対象: ${record.target_user || "-"}`,
    `店舗: ${record.store || "-"}`,
    `4役割: ${category ? fromCategoryId(category) : record.management_category || "-"}`,
    `現状: 平均${record.score ?? "-"} / 0点 ${Number(getRecordBreakdown(record).score0 || 0)}件 / 3点 ${Number(getRecordBreakdown(record).score3 || 0)}件`,
    primaryIssue ? `改善対象: ${primaryTitle} (${Number(primaryIssue.score)}点)` : "改善対象: 0点・3点なし",
    `次の行動: ${record.comment || "次回チェックまでに維持行動を1つ決める"}`,
    "期限: 次回チェックまで",
    "確認方法: 次回の環境整備チェックで同じ項目を確認する"
  ].join("\n");

  return { title: actionTitle, body: actionBody };
}

function buildImprovementActionPayload(record) {
  const draft = generateImprovementActionDraft(record);
  const primaryIssue = getPrimaryImprovementIssue(record);
  const category = primaryIssue?.managementCategory ||
    getCheckItemMeta(primaryIssue?.checkItemId)?.management_category ||
    record.management_category ||
    "performance";
  const storeId = record.store_id || getDefaultStoreId();
  const sourceCheckId = record.source_check_id || record.record_id;
  if (!storeId) throw new Error("店舗IDが取得できないため改善履歴を保存できません。");
  if (!sourceCheckId) throw new Error("元チェックIDが取得できないため改善履歴を保存できません。");

  return {
    sourceCheckId,
    sourceCheckResultId: primaryIssue?.resultId || primaryIssue?.id || null,
    storeId,
    departmentId: record.department_id || null,
    targetEmployeeId: record.submitted_by_employee_id || null,
    ownerEmployeeId: trustedActor?.employeeId || null,
    managementCategory: normalizeManagementCategory(category),
    actionTitle: draft.title,
    actionBody: draft.body,
    priority: primaryIssue && Number(primaryIssue.score) === 0 ? "high" : primaryIssue ? "medium" : "low",
    dueDate: getLocalDateString(addDays(new Date(), 7)),
    scoreAtCreation: Number.isFinite(Number(record.score)) ? Number(record.score) : null,
    aiDraft: generateAiCommentDraft(record, [record])
  };
}

function findExistingImprovementActionForRecord(record) {
  const sourceCheckId = record.source_check_id || record.record_id;
  if (!sourceCheckId) return null;
  const primaryIssue = getPrimaryImprovementIssue(record);
  const sourceCheckResultId = primaryIssue?.resultId || primaryIssue?.id || null;
  return improvementActions.find((action) => {
    if (action.sourceCheckId !== sourceCheckId) return false;
    if (!sourceCheckResultId || !action.sourceCheckResultId) return true;
    return action.sourceCheckResultId === sourceCheckResultId;
  }) || null;
}

function renderImprovementActionDraft(record) {
  const draft = generateImprovementActionDraft(record);
  const existingAction = findExistingImprovementActionForRecord(record);
  const canSave = hasApiConfig() && Boolean(record.source_check_id || record.record_id) && !existingAction;
  const statusText = existingAction
    ? `保存済み: ${getActionStatusLabel(existingAction.status)} / 担当 ${existingAction.ownerEmployeeName || "-"}`
    : "保存すると、改善アクション履歴としてCore DBに残ります。";
  return `
    <div class="improvement-action-panel">
      <div>
        <p class="score-summary-label">改善アクション案</p>
        <h3>${escapeHtml(draft.title)}</h3>
      </div>
      <pre class="improvement-action-text">${escapeHtml(draft.body)}</pre>
      <div class="improvement-action-actions">
        <button type="button" class="save-action-btn" data-record-id="${escapeHtml(record.record_id)}" ${canSave ? "" : "disabled"}>${existingAction ? "保存済み" : "改善履歴に保存"}</button>
        ${existingAction ? `<button type="button" class="ghost-btn open-actions-btn">改善タブで確認</button>` : ""}
        <button type="button" class="ghost-btn copy-action-btn" data-action-text="${escapeHtml(draft.body)}">コピー</button>
        <span class="field-help">${escapeHtml(statusText)}</span>
      </div>
    </div>
  `;
}

function renderRecordDetail(record, note = "") {
  const content = document.getElementById("recordDetailContent");
  if (!content) return;
  const breakdown = getRecordBreakdown(record);
  const aiDraft = generateAiCommentDraft(record, [record]);
  const results = (record.results || []).slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const issueSummaryHtml = results.length ? renderIssueResultSummary(results) : "";
  const resultHtml = results.length ? `
    <div class="result-detail-list">
      ${results.map((result, index) => {
        const item = getCheckItemMeta(result.checkItemId);
        const title = result.itemTitle || item?.title || `項目 ${index + 1}`;
        const category = result.managementCategory || item?.management_category || "";
        const comment = result.comment || "";
        const photos = result.photos || [];
        return `
          <article class="result-detail-item">
            <div class="result-detail-head">
              <div>
                <p class="result-detail-title">${index + 1}. ${escapeHtml(title)}</p>
                <p class="muted-text">${escapeHtml(category ? fromCategoryId(category) : "")}</p>
              </div>
              <span class="score-chip ${Number(result.score) === 0 ? "danger" : Number(result.score) === 3 ? "warn" : Number(result.score) === 5 ? "ok" : ""}">${escapeHtml(formatResultValue(result))}</span>
            </div>
            ${comment ? `<p class="result-detail-comment">${escapeHtml(comment)}</p>` : ""}
            ${photos.length ? `
              <div class="photo-link-list">
                ${photos.map(renderPhotoLink).join("")}
              </div>
            ` : ""}
          </article>
        `;
      }).join("")}
    </div>
  ` : `<p class="muted-text">この履歴は一覧用の要約のみ取得済みです。Edge Function詳細取得を反映後、29項目の明細まで表示できます。</p>`;

  content.innerHTML = `
    <div class="record-detail-grid">
      <article class="record-detail-card">
        <p class="score-summary-label">日時</p>
        <p class="record-detail-value">${escapeHtml(formatDate(record.checked_at))}</p>
      </article>
      <article class="record-detail-card">
        <p class="score-summary-label">店舗</p>
        <p class="record-detail-value">${escapeHtml(record.store || "-")}</p>
      </article>
      <article class="record-detail-card">
        <p class="score-summary-label">対象者</p>
        <p class="record-detail-value">${escapeHtml(record.target_user || "-")}</p>
      </article>
      <article class="record-detail-card">
        <p class="score-summary-label">平均</p>
        <p class="record-detail-value">${escapeHtml(record.score ?? "-")}</p>
      </article>
    </div>
    <p class="field-help">
      0点 ${Number(breakdown.score0 || 0)}件 / 3点 ${Number(breakdown.score3 || 0)}件 / 5点 ${Number(breakdown.score5 || 0)}件
      ${note ? ` / ${escapeHtml(note)}` : ""}
    </p>
    ${record.comment ? `<p class="field-help"><strong>次の行動:</strong> ${escapeHtml(record.comment)}</p>` : ""}
    ${record.photo_url ? `<p class="field-help"><strong>写真:</strong> <a href="${escapeHtml(record.photo_url)}" target="_blank" rel="noopener">写真URLを開く</a></p>` : ""}
    <div class="record-ai-comment">
      ${renderAiCommentDraft(aiDraft)}
    </div>
    ${issueSummaryHtml}
    ${renderImprovementActionDraft(record)}
    ${resultHtml}
  `;
}

async function showRecordDetail(recordId) {
  const content = document.getElementById("recordDetailContent");
  const localRecord = findLocalRecord(recordId);
  if (content) content.innerHTML = "履歴詳細を読み込み中です。";
  if (!recordId) return;

  try {
    const remoteRecord = await loadRemoteRecordDetail(recordId);
    if (remoteRecord) {
      renderRecordDetail(remoteRecord);
      return;
    }
  } catch (error) {
    console.warn("Management check detail load skipped or failed", error);
    if (localRecord) {
      renderRecordDetail(localRecord, "詳細API未反映のため要約を表示");
      return;
    }
    if (content) content.innerHTML = `詳細読込エラー: ${escapeHtml(error.message || error)}`;
    return;
  }

  if (localRecord) renderRecordDetail(localRecord);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, "\"\"");
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function toHistoryCsvRows(records) {
  const header = ["日時", "店舗", "対象者", "4役割", "項目数", "写真数", "0点", "3点", "5点", "Score", "次の行動", "AI改善タイトル", "AI改善要約", "AI改善提案"];
  const rows = records.map((record) => {
    const breakdown = getRecordBreakdown(record);
    const aiDraft = generateAiCommentDraft(record, records);
    return [
      formatDate(record.checked_at),
      record.store,
      record.target_user,
      record.management_category,
      Number(record.result_count || record.results?.length || 0),
      getRecordPhotoCount(record),
      Number(breakdown.score0 || 0),
      Number(breakdown.score3 || 0),
      Number(breakdown.score5 || 0),
      record.score,
      record.comment,
      aiDraft.title,
      aiDraft.summary,
      aiDraft.suggestions.join(" / ")
    ];
  });
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(","));
}

function toPerformanceCsvRows(snapshots, initiatives) {
  const snapshotHeader = ["種別", "日付/年月", "店舗", "総売上", "技術売上", "商品売上", "予算", "予算比", "前年比", "生産性", "アプローチ率", "NPS", "eNPS", "今月の取り組み", "来月の取り組み", "店舗課題", "成果コメント", "担当"];
  const initiativeByStoreMonth = new Map();
  for (const initiative of initiatives) {
    initiativeByStoreMonth.set(`${initiative.storeId || initiative.store}_${initiative.periodYear}_${initiative.periodMonth}`, initiative);
  }
  const snapshotRows = snapshots.map((snapshot) => {
    const initiative = initiativeByStoreMonth.get(`${snapshot.storeId || snapshot.store}_${snapshot.periodYear}_${snapshot.periodMonth}`) || {};
    return [
      "KPI",
      formatDateOnly(snapshot.snapshotDate),
      snapshot.store,
      snapshot.salesTotal,
      snapshot.technicalSales,
      snapshot.productSales,
      snapshot.budgetSales,
      snapshot.salesBudgetRate,
      snapshot.salesYearOverYearRate,
      snapshot.contributionProductivity,
      snapshot.approachRate,
      snapshot.nps,
      snapshot.enps,
      initiative.currentMonthInitiative || "",
      initiative.nextMonthInitiative || "",
      initiative.storeIssue || "",
      initiative.performanceComment || "",
      initiative.ownerEmployeeName || snapshot.importedByName || ""
    ];
  });
  const snapshotKeys = new Set(snapshots.map((snapshot) => `${snapshot.storeId || snapshot.store}_${snapshot.periodYear}_${snapshot.periodMonth}`));
  const initiativeOnlyRows = initiatives
    .filter((initiative) => !snapshotKeys.has(`${initiative.storeId || initiative.store}_${initiative.periodYear}_${initiative.periodMonth}`))
    .map((initiative) => [
      "取り組み",
      `${initiative.periodYear || "-"}-${String(initiative.periodMonth || "").padStart(2, "0")}`,
      initiative.store,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      initiative.currentMonthInitiative,
      initiative.nextMonthInitiative,
      initiative.storeIssue,
      initiative.performanceComment,
      initiative.ownerEmployeeName
    ]);
  return [snapshotHeader, ...snapshotRows, ...initiativeOnlyRows].map((row) => row.map(escapeCsvCell).join(","));
}

function downloadCsv(filename, rows) {
  const blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportFilteredHistoryCsv() {
  const records = getLocalRecords();
  const filteredRecords = getFilteredRecords(records);
  if (!filteredRecords.length) {
    setApiStatus("CSV出力対象の履歴がありません。", "error");
    return;
  }
  const filename = `management_environment_history_${getLocalDateString()}.csv`;
  downloadCsv(filename, toHistoryCsvRows(filteredRecords));
  setApiStatus(`CSV出力OK: ${filteredRecords.length}件`, "ok");
}

function exportFilteredPerformanceCsv() {
  const snapshots = getFilteredPerformanceSnapshots();
  const initiatives = getFilteredPerformanceInitiatives();
  if (!snapshots.length && !initiatives.length) {
    setApiStatus("CSV出力対象の成果データがありません。", "error");
    return;
  }
  const filename = `management_performance_${getLocalDateString()}.csv`;
  downloadCsv(filename, toPerformanceCsvRows(snapshots, initiatives));
  setApiStatus(`成果CSV出力OK: KPI ${snapshots.length}件 / 取り組み ${initiatives.length}件`, "ok");
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

async function openPriorityRecordDetail(recordId) {
  showView("records");
  await showRecordDetail(recordId);
  document.getElementById("recordDetailPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function openActionSourceDetail(recordId) {
  showView("records");
  await showRecordDetail(recordId);
  document.getElementById("recordDetailPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyImprovementAction(button) {
  const text = button?.dataset?.actionText || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setApiStatus("改善アクション案をコピーしました。", "ok");
  } catch (_error) {
    setApiStatus("コピーできませんでした。改善アクション案の本文を選択してコピーしてください。", "error");
  }
}

async function saveImprovementAction(button) {
  const recordId = button?.dataset?.recordId;
  if (!recordId) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "保存中";
  setApiStatus("改善履歴を保存中です...", "loading");
  try {
    const record = await loadRemoteRecordDetail(recordId);
    if (isManagementAdmin()) {
      improvementActions = await loadRemoteImprovementActions();
      const existingAction = findExistingImprovementActionForRecord(record);
      if (existingAction) {
        setApiStatus(`改善履歴は保存済みです: ${getActionStatusLabel(existingAction.status)}`, "ok");
        renderRecordDetail(record);
        return;
      }
    }
    const result = await saveRemoteImprovementAction(record);
    const actionId = result.actionId || result.action?.id || "saved";
    setApiStatus(result.duplicate ? `改善履歴は保存済みです: ${actionId}` : `改善履歴保存OK: ${actionId}`, "ok");
    button.textContent = "保存済み";
    await refreshImprovementActions();
    await showRecordDetail(recordId);
  } catch (error) {
    console.warn("Improvement action save failed", error);
    setApiStatus(`改善履歴保存エラー: ${error.message || error}`, "error");
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function refreshImprovementActions() {
  if (!isManagementAdmin()) {
    improvementActions = [];
    renderImprovementActions();
    return;
  }
  try {
    improvementActions = await loadRemoteImprovementActions();
    renderImprovementActions();
    renderDashboard();
  } catch (error) {
    console.warn("Improvement action load failed", error);
    const status = document.getElementById("actionListStatus");
    if (status) status.textContent = `改善アクション読込エラー: ${error.message || error}`;
    setApiStatus(`改善アクション読込エラー: ${error.message || error}`, "error");
  }
}

async function refreshPerformanceData() {
  if (!hasApiConfig()) {
    performanceSnapshots = [];
    performanceInitiatives = [];
    renderPerformanceDashboard();
    return;
  }
  const status = document.getElementById("performanceStatus");
  if (status) status.textContent = "成果データを読み込み中です。";
  try {
    const [snapshots, initiatives] = await Promise.all([
      loadRemotePerformanceSnapshots(),
      loadRemotePerformanceInitiatives()
    ]);
    performanceSnapshots = snapshots;
    performanceInitiatives = initiatives;
    renderPerformanceDashboard();
    setApiStatus(`成果API接続OK: KPI ${snapshots.length}件 / 取り組み ${initiatives.length}件`, "ok");
  } catch (error) {
    console.warn("Performance data load failed", error);
    if (status) status.textContent = `成果データ読込エラー: ${error.message || error}`;
    setApiStatus(`成果データ読込エラー: ${error.message || error}`, "error");
    renderPerformanceDashboard();
  }
}

async function updateImprovementActionStatus(button) {
  const actionId = button?.dataset?.actionId;
  const nextStatus = button?.dataset?.nextStatus;
  if (!actionId) return;
  if (!nextStatus) return;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "更新中";
  setApiStatus(`改善アクションを${getActionStatusLabel(nextStatus)}に更新中です...`, "loading");
  try {
    await patchRemoteImprovementAction(actionId, {
      status: nextStatus,
      completionComment: nextStatus === "completed" ? "画面から完了" : null
    });
    setApiStatus(`改善アクション更新OK: ${getActionStatusLabel(nextStatus)} / ${actionId}`, "ok");
    await refreshImprovementActions();
  } catch (error) {
    console.warn("Improvement action status update failed", error);
    setApiStatus(`改善アクション更新エラー: ${error.message || error}`, "error");
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handlePerformanceSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent || "成果を保存";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "保存中";
  }
  setApiStatus("成果データを保存中です...", "loading");
  try {
    const formData = new FormData(form);
    const snapshotResult = await saveRemotePerformanceSnapshot(buildPerformanceSnapshotPayload(form));
    let initiativeResult = null;
    if (hasInitiativeInput(formData)) {
      initiativeResult = await saveRemotePerformanceInitiative(buildPerformanceInitiativePayload(form));
    }
    await refreshPerformanceData();
    const snapshotMode = snapshotResult.mode === "updated" ? "KPI更新" : "KPI作成";
    const initiativeMode = initiativeResult
      ? (initiativeResult.mode === "updated" ? "取り組み更新" : "取り組み作成")
      : "取り組み未入力";
    setApiStatus(`成果保存OK: ${snapshotMode} / ${initiativeMode}`, "ok");
  } catch (error) {
    console.warn("Performance save failed", error);
    setApiStatus(`成果保存エラー: ${error.message || error}`, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
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

function isTokenExpiredError(error) {
  const message = String(error?.message || error || "");
  return message.includes('"exp" claim timestamp check failed') ||
    message.includes("Firebase ID token is missing") ||
    message.includes("Firebase token verification failed");
}

function handleExpiredAuth(error) {
  if (typeof window.MANAGEMENT_CLEAR_AUTH === "function") {
    window.MANAGEMENT_CLEAR_AUTH();
  }
  trustedActor = null;
  checkItems = [];
  renderScoreControls();
  const detail = error?.message || error || "token expired";
  setApiStatus(`ログイン期限が切れました。NOV HUBからManagement Platformを開き直してください。${detail ? ` (${detail})` : ""}`, "error");
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
      await loadCheckItems();
      setApiStatus(`API接続OK: ${getDisplayName()} / ${getRoleKeys().join(", ") || "role未設定"}`, "ok");
    } catch (error) {
      console.warn("Management API actor load skipped or failed", error);
      if (isTokenExpiredError(error)) {
        handleExpiredAuth(error);
      } else {
      setApiStatus(`API本人確認エラー: ${error.message || error}`, "error");
      }
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
  if (!validateEnvironmentForm(form)) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const record = toRecord(form);

  if (submitButton) submitButton.disabled = true;
  setApiStatus("環境整備チェックを保存中です...", "loading");

  try {
    const result = await saveRemoteRecord(record);
    if (result?.ok) {
      setApiStatus(`保存OK: ${result.resultCount || record.results.length}項目 / checkId=${result.checkId}`, "ok");
      form.reset();
      delete form.dataset.photoStoragePath;
      renderScoreControls();
      renderPhotoPreview();
      await refreshRecords();
      showView("records");
      return;
    }

    saveLocalRecord(record);
    setApiStatus(`ローカル保存: ${result?.reason || "Management API未接続"}`, "info");
    form.reset();
    delete form.dataset.photoStoragePath;
    renderScoreControls();
    renderPhotoPreview();
    renderDashboard();
    renderRecords();
    showView("records");
  } catch (error) {
    console.warn("Management API save failed", error);
    setApiStatus(`保存エラー: ${error.message || error}`, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function handlePhotoFileChange(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setPhotoUploadStatus("画像ファイルを選択してください。", "error");
    input.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    setPhotoUploadStatus("写真は8MB以下にしてください。", "error");
    input.value = "";
    return;
  }

  setPhotoUploadStatus("写真をアップロード中です...", "loading");
  try {
    const result = await uploadPhotoFile(file);
    setPhotoUploadStatus(`アップロードOK: ${result.storagePath}`, "ok");
    renderPhotoPreview();
  } catch (error) {
    console.warn("Photo upload failed", error);
    setPhotoUploadStatus(`写真アップロードエラー: ${error.message || error}`, "error");
  }
}

async function refreshRecords() {
  try {
    setApiStatus("履歴を読み込み中です...", "loading");
    await loadCurrentActor();
    await loadCheckItems();
    const remoteRecords = await loadRemoteRecords();
    if (remoteRecords) {
      setLocalRecords(remoteRecords);
      if (isManagementAdmin()) {
        try {
          [improvementActions, performanceSnapshots, performanceInitiatives] = await Promise.all([
            loadRemoteImprovementActions(),
            loadRemotePerformanceSnapshots(),
            loadRemotePerformanceInitiatives()
          ]);
        } catch (actionError) {
          console.warn("Management related data load skipped or failed", actionError);
          improvementActions = [];
          performanceSnapshots = [];
          performanceInitiatives = [];
          const actionStatus = document.getElementById("actionListStatus");
          if (actionStatus) actionStatus.textContent = `関連データ読込エラー: ${actionError.message || actionError}`;
          const performanceStatus = document.getElementById("performanceStatus");
          if (performanceStatus) performanceStatus.textContent = `成果データ読込エラー: ${actionError.message || actionError}`;
        }
      }
      renderRecords(remoteRecords);
      renderImprovementActions();
      renderPerformanceDashboard();
      setApiStatus(`履歴読込OK: ${remoteRecords.length}件`, "ok");
    } else {
      renderRecords();
      setApiStatus("API未接続のためローカル履歴を表示しています。", "info");
    }
  } catch (error) {
    console.warn("Management API load skipped or failed", error);
    if (isTokenExpiredError(error)) {
      handleExpiredAuth(error);
      setStatusMessage("ログイン期限が切れました。NOV HUBからManagement Platformを開き直してください。");
    } else {
      setStatusMessage(`履歴読込エラー: ${error.message || error}`);
      setApiStatus(`履歴読込エラー: ${error.message || error}`, "error");
    }
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
  document.getElementById("refreshPerformanceBtn")?.addEventListener("click", refreshPerformanceData);
  document.getElementById("performanceForm")?.addEventListener("submit", handlePerformanceSubmit);
  document.getElementById("performancePeriodFilter")?.addEventListener("change", renderPerformanceDashboard);
  document.getElementById("clearPerformanceFiltersBtn")?.addEventListener("click", () => {
    document.getElementById("performancePeriodFilter").value = "";
    renderPerformanceDashboard();
  });
  document.getElementById("exportPerformanceCsvBtn")?.addEventListener("click", exportFilteredPerformanceCsv);
  document.getElementById("historyStoreFilter").addEventListener("change", () => renderRecords());
  document.getElementById("historyIssueFilter").addEventListener("change", () => renderRecords());
  document.getElementById("historyPeriodFilter").addEventListener("change", () => renderRecords());
  document.getElementById("clearHistoryFiltersBtn").addEventListener("click", () => {
    document.getElementById("historyStoreFilter").value = "";
    document.getElementById("historyIssueFilter").value = "";
    document.getElementById("historyPeriodFilter").value = "";
    renderRecords();
  });
  document.getElementById("exportHistoryCsvBtn").addEventListener("click", exportFilteredHistoryCsv);
  document.getElementById("refreshActionsBtn")?.addEventListener("click", refreshImprovementActions);
  document.getElementById("actionStatusFilter")?.addEventListener("change", () => {
    renderImprovementActions();
  });
  document.getElementById("improvementActionList")?.addEventListener("click", (event) => {
    const statusButton = event.target.closest(".update-action-status-btn");
    if (statusButton) {
      updateImprovementActionStatus(statusButton);
      return;
    }
    const sourceButton = event.target.closest(".action-source-detail-btn");
    if (sourceButton) openActionSourceDetail(sourceButton.dataset.recordId);
  });
  document.getElementById("aiPriorityPanel").addEventListener("click", (event) => {
    const button = event.target.closest(".ai-priority-detail-btn");
    if (button) openPriorityRecordDetail(button.dataset.recordId);
  });
  document.getElementById("performanceFocusPanel")?.addEventListener("click", (event) => {
    const button = event.target.closest(".open-performance-btn");
    if (button) {
      showView("performance");
      document.getElementById("view-performance")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  document.getElementById("recordsBody").addEventListener("click", (event) => {
    const button = event.target.closest(".detail-btn");
    if (button) showRecordDetail(button.dataset.recordId);
  });
  document.getElementById("recordDetailContent").addEventListener("click", (event) => {
    const openActionsButton = event.target.closest(".open-actions-btn");
    if (openActionsButton) {
      showView("actions");
      document.getElementById("view-actions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const saveButton = event.target.closest(".save-action-btn");
    if (saveButton) {
      saveImprovementAction(saveButton);
      return;
    }
    const copyButton = event.target.closest(".copy-action-btn");
    if (copyButton) copyImprovementAction(copyButton);
  });
  document.getElementById("environmentForm").addEventListener("submit", handleSubmit);
  document.getElementById("environmentForm").addEventListener("change", (event) => {
    if (event.target?.matches('input[type="radio"]')) {
      clearMissingScoreMarkers();
      renderScoreSummary();
    }
    if (event.target?.name === "photoUrl") renderPhotoPreview();
  });
  document.getElementById("environmentForm").elements.photoUrl.addEventListener("input", renderPhotoPreview);
  document.getElementById("photoFileInput").addEventListener("change", handlePhotoFileChange);
  document.getElementById("clearFormBtn").addEventListener("click", () => {
    const form = document.getElementById("environmentForm");
    form.reset();
    delete form.dataset.photoStoragePath;
    renderScoreControls();
    renderScoreSummary();
    renderPhotoPreview();
    setPhotoUploadStatus("写真を選択すると、StorageへアップロードしてURL欄に反映します。");
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
  const actionsButton = document.querySelector('[data-view="actions"]');
  if (actionsButton) actionsButton.hidden = !admin;
  const actionsView = document.getElementById("view-actions");
  if (actionsView) actionsView.hidden = !admin;
  const performanceForm = document.getElementById("performanceForm");
  if (performanceForm) {
    performanceForm.querySelectorAll("input, textarea, button").forEach((element) => {
      if (element.id !== "refreshPerformanceBtn") element.disabled = !admin;
    });
  }
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
hydrateFormFromActor();
hydratePerformanceForm();
renderPhotoPreview();
renderDashboard();
renderRecords();
renderPerformanceDashboard();

async function apiRequest(path, options = {}) {
  const token = await firebaseTokenProvider();
  if (!token) throw new Error("Firebase ID token is missing");
  const isFormData = options.body instanceof FormData;
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-request-id": createId(),
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };
  const response = await fetch(`${managementApiBaseUrl}${path}`, {
    ...options,
    headers
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
