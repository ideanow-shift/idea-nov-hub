import { callApiAction, setHubSessionAuth } from "../js/api.js?v=2742128ec55c";
import {
  getNovHubSessionToken,
  handleNovHubSessionAuthFailure
} from "../js/nov-hub-session-candidate.js";

const DECISION_HUB_READONLY_LIVE = true;
const DECISION_HUB_DRAFT_WRITE_ENABLED = true;
const LIST_LIMIT = 50;

const state = {
  applications: [],
  selectedApplicationId: "",
  draftApplicationId: ""
};

const elements = {
  notice: document.getElementById("connection-notice"),
  noticeTitle: document.getElementById("connection-notice-title"),
  noticeBody: document.getElementById("connection-notice-body"),
  requestList: document.getElementById("request-list"),
  detailPanel: document.getElementById("detail-panel"),
  commentsPanel: document.getElementById("comments-panel"),
  summaryDraft: document.getElementById("summary-draft"),
  summaryWaiting: document.getElementById("summary-waiting"),
  summaryReturned: document.getElementById("summary-returned"),
  tabApplications: document.getElementById("tab-applications"),
  tabNewApplication: document.getElementById("tab-new-application"),
  applicationListPanel: document.getElementById("application-list-panel"),
  newApplicationPanel: document.getElementById("new-application-panel"),
  detailSection: document.getElementById("detail-section"),
  commentsSection: document.getElementById("comments-section"),
  applicationForm: document.getElementById("decision-application-form"),
  saveDraftButton: document.getElementById("save-draft-button"),
  draftSaveStatus: document.getElementById("draft-save-status")
};

wireNavigation();
initDecisionHubReadOnly();

function wireNavigation() {
  elements.tabApplications?.addEventListener("click", () => showView("applications"));
  elements.tabNewApplication?.addEventListener("click", () => showView("new-application"));
  elements.applicationForm?.addEventListener("submit", (event) => event.preventDefault());
  elements.saveDraftButton?.addEventListener("click", saveDraftApplication);
  elements.applicationForm?.addEventListener("input", updateDraftControls);
  updateDraftControls();
}

function updateDraftControls() {
  const canSave = DECISION_HUB_DRAFT_WRITE_ENABLED && Boolean(elements.applicationForm?.checkValidity());
  if (elements.saveDraftButton) elements.saveDraftButton.disabled = !canSave;
  setText(elements.draftSaveStatus, DECISION_HUB_DRAFT_WRITE_ENABLED
    ? "必須項目を入力すると下書き保存できます。"
    : "下書き保存は安全確認後に有効化します。入力内容はまだ送信されません。");
}

async function saveDraftApplication() {
  if (!DECISION_HUB_DRAFT_WRITE_ENABLED || !elements.applicationForm?.reportValidity()) return;
  if (!prepareHubSessionAuth()) {
    renderSafeError({ code: "HUB_SESSION_REQUIRED" });
    return;
  }
  let payload;
  try {
    payload = buildDraftPayload(new FormData(elements.applicationForm));
  } catch (error) {
    setText(elements.draftSaveStatus, getSafeErrorMessage(error?.code || "INVALID_REQUEST"));
    return;
  }
  elements.saveDraftButton.disabled = true;
  setText(elements.draftSaveStatus, "下書きを保存しています。");
  try {
    const response = sanitizeDecisionValue(await callApiAction("decisionSaveDraftApplication", payload));
    if (response?.draft?.isDraft !== true && response?.isDraft !== true) {
      throw Object.assign(new Error("Draft response is invalid."), { code: "INVALID_API_RESPONSE" });
    }
    const savedApplicationId = String(response?.draft?.applicationId || response?.applicationId || "");
    if (!isUuid(savedApplicationId)) {
      throw Object.assign(new Error("Draft identifier is invalid."), { code: "INVALID_API_RESPONSE" });
    }
    state.draftApplicationId = savedApplicationId;
    setText(elements.noticeTitle, "下書きを保存しました");
    setText(elements.noticeBody, "申請はまだ送信されていません。入力内容は下書きとして保存されています。");
    setText(elements.draftSaveStatus, "保存済み");
  } catch (error) {
    clearHubSessionOnAuthStatus(error);
    setText(elements.draftSaveStatus, getSafeErrorMessage(error?.code || ""));
  } finally {
    updateDraftControls();
  }
}

function buildDraftPayload(formData) {
  const value = (name) => safeText(formData.get(name));
  const title = value("title");
  const purpose = value("purpose");
  const contractStartDate = value("contractStartDate");
  const contractEndDate = value("contractEndDate");
  const budgetAmountText = value("budgetAmount");
  if (!title || title.length > 120 || !purpose || purpose.length > 2000) {
    throw Object.assign(new Error("Draft fields are invalid."), { code: "INVALID_REQUEST" });
  }
  if (contractStartDate && contractEndDate && contractEndDate < contractStartDate) {
    throw Object.assign(new Error("Contract date order is invalid."), { code: "CONTRACT_DATE_ORDER_INVALID" });
  }
  if (budgetAmountText && (!/^\d+(?:\.\d{1,2})?$/.test(budgetAmountText) || Number(budgetAmountText) > 999999999999.99)) {
    throw Object.assign(new Error("Budget amount is invalid."), { code: "INVALID_REQUEST" });
  }
  return {
    applicationId: isUuid(state.draftApplicationId) ? state.draftApplicationId : null,
    applicationType: value("applicationType"),
    title,
    purpose,
    background: value("background"),
    expectedEffect: value("expectedEffect"),
    budgetAmount: budgetAmountText || null,
    vendorName: value("vendorName"),
    contractStartDate: contractStartDate || null,
    contractEndDate: contractEndDate || null,
    desiredDecisionDate: value("desiredDecisionDate") || null,
    riskSummary: value("riskSummary")
  };
}

function showView(view) {
  const showApplications = view !== "new-application";
  elements.applicationListPanel.hidden = !showApplications;
  elements.newApplicationPanel.hidden = showApplications;
  elements.detailSection.hidden = !showApplications;
  elements.commentsSection.hidden = !showApplications;
  elements.tabApplications?.setAttribute("aria-selected", String(showApplications));
  elements.tabNewApplication?.setAttribute("aria-selected", String(!showApplications));
}

function initDecisionHubReadOnly() {
  if (!DECISION_HUB_READONLY_LIVE) {
    setDisabledNotice();
    return;
  }
  if (!prepareHubSessionAuth()) {
    renderSafeError({ code: "HUB_SESSION_REQUIRED" });
    return;
  }
  loadApplications();
}

function prepareHubSessionAuth() {
  try {
    const token = getNovHubSessionToken();
    if (!token) return false;
    setHubSessionAuth(token);
    return true;
  } catch {
    return false;
  }
}

async function loadApplications() {
  if (!prepareHubSessionAuth()) {
    renderSafeError({ code: "HUB_SESSION_REQUIRED" });
    return;
  }
  renderLoading("申請一覧を確認しています。");
  try {
    const response = await callApiAction("decisionListApplications", {
      limit: LIST_LIMIT
    });
    const safeResponse = sanitizeDecisionValue(response);
    const applications = normalizeApplicationList(safeResponse);
    state.applications = applications;
    state.selectedApplicationId = "";
    renderApplications(applications);
    renderSummary(applications);
    renderEmptyDetail();
    renderEmptyComments();
    renderReady(applications.length);
  } catch (error) {
    clearHubSessionOnAuthStatus(error);
    renderSafeError(error);
  }
}

async function selectApplication(applicationId) {
  if (!isUuid(applicationId)) return;
  if (!prepareHubSessionAuth()) {
    renderSafeError({ code: "HUB_SESSION_REQUIRED" }, { keepList: true });
    return;
  }
  state.selectedApplicationId = applicationId;
  renderApplications(state.applications);
  renderDetailLoading();
  renderCommentsLoading();
  try {
    const [detailResponse, commentsResponse] = await Promise.all([
      callApiAction("decisionGetApplicationDetail", { applicationId }),
      callApiAction("decisionListComments", { applicationId })
    ]);
    renderDetail(sanitizeDecisionValue(detailResponse));
    renderComments(sanitizeDecisionValue(commentsResponse));
  } catch (error) {
    clearHubSessionOnAuthStatus(error);
    renderSafeError(error, { keepList: true });
  }
}

function setDisabledNotice() {
  elements.notice?.classList.add("is-live-disabled");
  setText(elements.noticeTitle, "確認用画面 / DB未接続");
  setText(elements.noticeBody, "この画面から本番申請は送信されません。");
}

function renderLoading(message) {
  elements.notice?.classList.remove("is-ready");
  setText(elements.noticeTitle, "読み込み中");
  setText(elements.noticeBody, message);
  elements.requestList.replaceChildren(createStateMessage(message));
}

function renderReady(count) {
  elements.notice?.classList.add("is-ready");
  setText(elements.noticeTitle, "申請一覧を確認しました");
  setText(elements.noticeBody, count > 0
    ? `${count}件の申請を表示しています。`
    : "現在、表示できる申請はありません。新規申請の入力画面は準備済みです。");
}

function renderApplications(applications) {
  if (!applications.length) {
    elements.requestList.replaceChildren(createStateMessage("現在、表示できる申請はありません。"));
    return;
  }

  const rows = applications.map((application) => {
    const row = document.createElement("article");
    row.className = "request-row";
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-selected", application.applicationId === state.selectedApplicationId ? "true" : "false");
    row.addEventListener("click", () => selectApplication(application.applicationId));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectApplication(application.applicationId);
      }
    });

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = formatStatus(application.status);

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = application.title || application.applicationNo || "申請";
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = application.applicationNo || "表示許可済みの項目のみ表示";
    body.append(title, meta);

    const date = document.createElement("div");
    date.className = "muted";
    date.textContent = application.updatedAt || application.createdAt || "";

    row.append(status, body, date);
    return row;
  });

  elements.requestList.replaceChildren(...rows);
}

function renderSummary(applications) {
  const summary = applications.reduce((counts, application) => {
    const status = String(application.status || "").toLowerCase();
    if (status.includes("draft")) counts.draft += 1;
    if (status.includes("return")) counts.returned += 1;
    if (status.includes("wait") || status.includes("submit") || status.includes("approv")) counts.waiting += 1;
    return counts;
  }, { draft: 0, returned: 0, waiting: 0 });

  setText(elements.summaryDraft, String(summary.draft));
  setText(elements.summaryWaiting, String(summary.waiting));
  setText(elements.summaryReturned, String(summary.returned));
}

function renderEmptyDetail() {
  elements.detailPanel.replaceChildren(createStateMessage("申請を選択すると、表示許可済みの項目を表示します。"));
}

function renderEmptyComments() {
  elements.commentsPanel.replaceChildren(createStateMessage("コメントは、表示権限の確認後に表示します。"));
}

function renderDetailLoading() {
  elements.detailPanel.replaceChildren(createStateMessage("申請詳細を確認しています。"));
}

function renderCommentsLoading() {
  elements.commentsPanel.replaceChildren(createStateMessage("コメントを確認しています。"));
}

function renderDetail(detail) {
  const application = detail?.application || detail?.data || detail || {};
  const fields = [
    ["Application no", application.applicationNo],
    ["Title", application.title],
    ["Status", application.status],
    ["Category", application.category],
    ["Updated", application.updatedAt || application.createdAt]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  if (!fields.length) {
    renderEmptyDetail();
    return;
  }

  elements.detailPanel.replaceChildren(...fields.map(([label, value]) => createField(label, value)));
}

function renderComments(commentsResponse) {
  const comments = normalizeItems(commentsResponse);
  if (!comments.length) {
    elements.commentsPanel.replaceChildren(createStateMessage("No visible comments are available."));
    return;
  }

  const items = comments.map((comment) => {
    const article = document.createElement("article");
    article.className = "empty-state";
    const visibility = document.createElement("div");
    visibility.className = "muted";
    visibility.textContent = comment.visibility || "comment";
    const body = document.createElement("div");
    body.textContent = comment.body || "";
    article.append(visibility, body);
    return article;
  });
  elements.commentsPanel.replaceChildren(...items);
}

function renderSafeError(error, options = {}) {
  elements.notice?.classList.remove("is-ready");
  const code = String(error?.code || "");
  const message = getSafeErrorMessage(code);
  setText(elements.noticeTitle, "確認できませんでした");
  setText(elements.noticeBody, message);
  if (!options.keepList) {
    elements.requestList.replaceChildren(createStateMessage(message, "error-state"));
    renderEmptyDetail();
    renderEmptyComments();
  } else {
    elements.detailPanel.replaceChildren(createStateMessage(message, "error-state"));
    elements.commentsPanel.replaceChildren(createStateMessage("コメントを表示できませんでした。", "error-state"));
  }
}

function normalizeApplicationList(response) {
  return normalizeItems(response)
    .map((item) => ({
      applicationId: String(item.applicationId || item.id || ""),
      applicationNo: safeText(item.applicationNo || item.no || ""),
      title: safeText(item.title || item.subject || ""),
      status: safeText(item.status || ""),
      category: safeText(item.category || item.applicationType || ""),
      updatedAt: safeText(item.updatedAt || ""),
      createdAt: safeText(item.createdAt || "")
    }))
    .filter((item) => isUuid(item.applicationId));
}

function normalizeItems(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.applications)) return response.applications;
  if (Array.isArray(response?.comments)) return response.comments;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function sanitizeDecisionValue(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeDecisionValue(item));
  if (!value || typeof value !== "object") return value;

  const sanitized = {};
  Object.entries(value).forEach(([key, item]) => {
    if (isInternalDecisionKey(key)) return;
    sanitized[key] = sanitizeDecisionValue(item);
  });
  return sanitized;
}

function isInternalDecisionKey(key) {
  const compact = String(key || "").replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (compact.includes("token") || compact.includes("secret")) return true;
  if (compact.includes("auth") || compact.includes("claim")) return true;
  if (compact.includes("storage") || compact.includes("signed")) return true;
  if (compact.includes("service") && compact.includes("role")) return true;
  if (compact.includes("url")) return true;
  if (compact.includes("file") && compact.includes("name")) return true;
  if (compact.includes("raw") && compact.includes("file")) return true;
  return false;
}

function createField(label, value) {
  const wrapper = document.createElement("div");
  const name = document.createElement("div");
  name.className = "muted";
  name.textContent = label;
  const content = document.createElement("div");
  content.textContent = safeText(value);
  wrapper.append(name, content);
  return wrapper;
}

function createStateMessage(message, className = "empty-state") {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = message;
  return element;
}

function getSafeErrorMessage(code) {
  if (code === "HUB_SESSION_REQUIRED") return "NOV HUBへログインし、アプリ一覧からDecision Hubを開いてください。";
  if (code === "TOKEN_MISSING") return "NOV HUBのログイン情報を確認できませんでした。";
  if (code === "API_TIMEOUT") return "申請一覧の確認に時間がかかっています。しばらくしてからNOV HUBより開き直してください。";
  if (code === "INVALID_REQUEST") return "申請の確認条件が正しくありません。";
  if (code === "CONTRACT_DATE_ORDER_INVALID") return "契約終了日は契約開始日以降を指定してください。";
  if (code.startsWith("ACTOR_")) return "利用者の権限を確認できませんでした。";
  return "申請一覧を確認できませんでした。しばらくしてからお試しください。";
}

function formatStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return "確認中";
  if (status.includes("draft")) return "下書き";
  if (status.includes("return")) return "差戻し";
  if (status.includes("reject")) return "却下";
  if (status.includes("approv")) return "承認済み";
  if (status.includes("submit") || status.includes("wait")) return "承認待ち";
  if (status.includes("cancel")) return "取消";
  return safeText(value);
}

function clearHubSessionOnAuthStatus(error) {
  handleNovHubSessionAuthFailure(error?.status);
}

function safeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
