import { callApiAction, setHubSessionAuth } from "../js/api.js";

const DECISION_HUB_READONLY_LIVE = true;
const LIST_LIMIT = 50;

const state = {
  applications: [],
  selectedApplicationId: ""
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
  summaryReturned: document.getElementById("summary-returned")
};

initDecisionHubReadOnly();

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
    const token = window.NovHubSession?.getSessionToken?.();
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
  renderLoading("Checking applications.");
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
  } catch (error) {
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
    renderSafeError(error, { keepList: true });
  }
}

function setDisabledNotice() {
  elements.notice?.classList.add("is-live-disabled");
  setText(elements.noticeTitle, "Design preview / DB disconnected");
  setText(elements.noticeBody, "This screen is a preview. No production request is submitted.");
}

function renderLoading(message) {
  setText(elements.noticeTitle, "Loading");
  setText(elements.noticeBody, message);
  elements.requestList.replaceChildren(createStateMessage(message));
}

function renderApplications(applications) {
  if (!applications.length) {
    elements.requestList.replaceChildren(createStateMessage("No applications are available."));
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
    status.textContent = application.status || "Review";

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = application.title || application.applicationNo || "Application";
    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = application.applicationNo || "Safe fields only";
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
  elements.detailPanel.replaceChildren(createStateMessage("Select an application to show safe detail fields."));
}

function renderEmptyComments() {
  elements.commentsPanel.replaceChildren(createStateMessage("Comment body appears here only after visibility checks."));
}

function renderDetailLoading() {
  elements.detailPanel.replaceChildren(createStateMessage("Checking application detail."));
}

function renderCommentsLoading() {
  elements.commentsPanel.replaceChildren(createStateMessage("Checking comments."));
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
  const code = String(error?.code || "");
  const message = getSafeErrorMessage(code);
  setText(elements.noticeTitle, "Unable to verify");
  setText(elements.noticeBody, message);
  if (!options.keepList) {
    elements.requestList.replaceChildren(createStateMessage(message, "error-state"));
    renderEmptyDetail();
    renderEmptyComments();
  } else {
    elements.detailPanel.replaceChildren(createStateMessage(message, "error-state"));
    elements.commentsPanel.replaceChildren(createStateMessage("Comments could not be displayed.", "error-state"));
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
  if (code === "TOKEN_MISSING") return "Open this screen from a signed-in NOV HUB session.";
  if (code === "INVALID_REQUEST") return "The application request is invalid.";
  if (code.startsWith("ACTOR_")) return "Access could not be confirmed.";
  return "Application data could not be checked. Please retry later.";
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
