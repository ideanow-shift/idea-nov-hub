const STORAGE_KEY = "ideaNovManagementPlatform.environmentRecords";
const managementApiBaseUrl = (window.MANAGEMENT_API_BASE_URL || "").replace(/\/$/, "");
const firebaseTokenProvider = window.MANAGEMENT_FIREBASE_TOKEN_PROVIDER;
const hubContextProvider = window.MANAGEMENT_HUB_CONTEXT_PROVIDER;
const defaultCheckItemId = window.MANAGEMENT_DEFAULT_CHECK_ITEM_ID || "";
let trustedActor = null;
let checkItems = [];

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
    store: row.store_name || row.store_id,
    target_user: row.submitted_by_name || row.submitted_by_employee_id,
    role: "",
    management_category: "環境整備",
    checked_at: row.submitted_at || row.check_date,
    evaluator: row.submitted_by_employee_id,
    score: row.overall_score,
    comment: row.summary_comment || row.next_action || "",
    photo_url: "",
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

function getDashboardSummary(records) {
  const latest = records[0] || null;
  const latestBreakdown = latest ? getRecordBreakdown(latest) : null;
  const issueCount = latestBreakdown
    ? Number(latestBreakdown.score0 || 0) + Number(latestBreakdown.score3 || 0)
    : records.filter((record) => Number(record.score) <= 3).length;
  const actionCount = records.filter((record) => record.comment && record.comment.trim()).length;
  const latestScore = latest && Number.isFinite(Number(latest.score)) ? Number(latest.score).toFixed(1) : "未登録";

  return {
    values: {
      current: latest ? latestScore : "未登録",
      issues: `${issueCount}件`,
      actions: `${actionCount}件`,
      growth: `${records.length}件`
    },
    notes: {
      current: latest ? `${latest.store || "店舗"} の最新平均スコアです。` : "最初の環境整備チェックを登録してください。",
      issues: latest ? "最新チェックの0点・3点を課題候補として扱います。" : "履歴作成後に課題候補を表示します。",
      actions: actionCount ? "コメントがある履歴を改善行動の材料にします。" : "コメントに次の行動を残すと改善履歴に繋がります。",
      growth: records.length ? "履歴が増えるほど比較・AI分析が可能になります。" : "履歴が増えるほど成長推移を見られます。"
    }
  };
}

function getRecentActionRecords(records) {
  return records
    .filter((record) => record.comment && record.comment.trim())
    .slice(0, 3);
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

function renderDashboard() {
  const records = getLocalRecords();
  const summary = getDashboardSummary(records);
  const grid = document.getElementById("dashboardGrid");
  grid.innerHTML = dashboardCards.map((card) => `
    <article class="card">
      <h3>${card.title}</h3>
      <div class="value ${card.status}">${summary.values[card.key] || card.value}</div>
      <p class="note">${summary.notes[card.key] || ""}</p>
    </article>
  `).join("");
  renderFocusPanel(records);
  renderStoreSummaryPanel(records);

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

function renderRecords(records = getLocalRecords()) {
  const body = document.getElementById("recordsBody");
  const filteredRecords = renderHistoryFilters(records) || records;
  if (filteredRecords.length === 0) {
    body.innerHTML = `<tr><td colspan="9" class="empty-cell">まだ履歴がありません。</td></tr>`;
    return;
  }
  body.innerHTML = filteredRecords.map((record) => `
    <tr>
      <td>${formatDate(record.checked_at)}</td>
      <td>${escapeHtml(record.store)}</td>
      <td>${escapeHtml(record.target_user)}</td>
      <td>${escapeHtml(record.management_category)}</td>
      <td><span class="count-badge">${Number(record.result_count || record.results?.length || 0)}項目</span></td>
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

function renderRecordDetail(record, note = "") {
  const content = document.getElementById("recordDetailContent");
  if (!content) return;
  const breakdown = getRecordBreakdown(record);
  const results = (record.results || []).slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
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
                ${photos.map((photo) => `
                  <a href="${escapeHtml(photo.photo_url || photo.storage_path || "#")}" target="_blank" rel="noopener" class="photo-link">
                    ${escapeHtml(photo.caption || photo.photo_type || "写真を開く")}
                  </a>
                `).join("")}
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
  const header = ["日時", "店舗", "対象者", "4役割", "項目数", "0点", "3点", "5点", "Score", "次の行動"];
  const rows = records.map((record) => {
    const breakdown = getRecordBreakdown(record);
    return [
      formatDate(record.checked_at),
      record.store,
      record.target_user,
      record.management_category,
      Number(record.result_count || record.results?.length || 0),
      Number(breakdown.score0 || 0),
      Number(breakdown.score3 || 0),
      Number(breakdown.score5 || 0),
      record.score,
      record.comment
    ];
  });
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(","));
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
      renderRecords(remoteRecords);
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
  document.getElementById("recordsBody").addEventListener("click", (event) => {
    const button = event.target.closest(".detail-btn");
    if (button) showRecordDetail(button.dataset.recordId);
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
renderPhotoPreview();
renderDashboard();
renderRecords();

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
