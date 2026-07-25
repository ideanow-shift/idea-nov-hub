const API_PATH = "/api/talent/v1/workforce/procedure-cases";
const AUDIT_PATH = `${API_PATH}/audit`;
const PROCEDURE_TYPES = Object.freeze(["ONBOARDING", "TRANSFER", "LEAVE", "RETIREMENT"]);
const CASE_STATUSES = Object.freeze(["DRAFT", "READY_FOR_REVIEW", "CONFIRMED", "CANCELLED"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const WORKFORCE_PROCEDURE_CASE_CONTRACT = Object.freeze({
  employeeMasterMutation: false,
  auditHistory: true,
  optimisticConcurrency: true,
  requestMaxPerAction: 1,
  retryCount: 0
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function safeResult(ok, category, requestCount = 0, data = null) {
  return Object.freeze({ ok, category, requestCount, retryCount: 0, data });
}

function normalizeCaseList(value) {
  if (!exactKeys(value, ["cases"]) || !Array.isArray(value.cases) || value.cases.length > 200) return null;
  const cases = [];
  for (const row of value.cases) {
    if (!exactKeys(row, ["caseId", "procedureType", "caseStatus", "subjectLabel", "effectiveDate", "detail", "version", "updatedAt"])
      || !UUID.test(row.caseId) || !PROCEDURE_TYPES.includes(row.procedureType) || !CASE_STATUSES.includes(row.caseStatus)
      || typeof row.subjectLabel !== "string" || !row.subjectLabel.trim() || row.subjectLabel.trim().length > 120
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate)
      || !(row.detail === null || (typeof row.detail === "string" && row.detail.length <= 500))
      || !Number.isInteger(row.version) || row.version < 1
      || typeof row.updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt)) return null;
    cases.push(Object.freeze({ ...row, subjectLabel: row.subjectLabel.trim() }));
  }
  return Object.freeze(cases);
}

function normalizeSaveResult(value) {
  if (!exactKeys(value, ["caseId", "caseVersion", "operation"])
    || !UUID.test(value.caseId) || !Number.isInteger(value.caseVersion) || value.caseVersion < 1
    || !["CREATE", "UPDATE"].includes(value.operation)) return null;
  return Object.freeze({ ...value });
}

function normalizeAudit(value) {
  if (!exactKeys(value, ["entries"]) || !Array.isArray(value.entries) || value.entries.length > 20) return null;
  const allowedFields = ["procedureType", "caseStatus", "subjectLabel", "effectiveDate", "detail"];
  const entries = [];
  for (const row of value.entries) {
    if (!exactKeys(row, ["action", "changedFields", "caseVersion", "occurredAt"])
      || !["CREATE", "UPDATE"].includes(row.action) || !Array.isArray(row.changedFields)
      || row.changedFields.length < 1 || row.changedFields.length > 5
      || row.changedFields.some((field) => !allowedFields.includes(field))
      || new Set(row.changedFields).size !== row.changedFields.length
      || !Number.isInteger(row.caseVersion) || row.caseVersion < 1
      || typeof row.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.occurredAt)) return null;
    entries.push(Object.freeze({ ...row, changedFields: Object.freeze([...row.changedFields]) }));
  }
  return Object.freeze(entries);
}

function normalizeDraft(value) {
  if (!isRecord(value) || !exactKeys(value, ["caseId", "expectedVersion", "procedureType", "caseStatus", "subjectLabel", "effectiveDate", "detail"])
    || !(value.caseId === null || UUID.test(value.caseId)) || !Number.isInteger(value.expectedVersion) || value.expectedVersion < 0
    || !PROCEDURE_TYPES.includes(value.procedureType) || !CASE_STATUSES.includes(value.caseStatus)
    || typeof value.subjectLabel !== "string" || typeof value.effectiveDate !== "string") return null;
  const subjectLabel = value.subjectLabel.normalize("NFKC").trim();
  const detail = value.detail === "" || value.detail === null ? null : typeof value.detail === "string" ? value.detail.trim() : undefined;
  if (!subjectLabel || subjectLabel.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(value.effectiveDate)
    || detail === undefined || (detail !== null && detail.length > 500)
    || (value.caseId === null && value.expectedVersion !== 0)) return null;
  return Object.freeze({ ...value, subjectLabel, detail });
}

function failureCategory(status) {
  if (status === 401) return "auth_required";
  if (status === 403) return "write_forbidden";
  if (status === 503) return "not_ready";
  return "request_failed";
}

export function createWorkforceProcedureCaseController({
  globalObject = globalThis,
  fetchImpl = globalObject.fetch,
  config = globalObject.NOV_TALENT_CONFIG,
  helper = globalObject.NovHubSession
} = {}) {
  const baseUrl = normalizeBaseUrl(config?.writeApiBaseUrl);
  const enabled = config?.writeApiEnabled === true && baseUrl !== null
    && typeof fetchImpl === "function" && typeof helper?.getSessionToken === "function";
  let busy = false;

  const request = async (method, payload = null, path = API_PATH) => {
    if (!enabled) return safeResult(false, "feature_disabled");
    if (busy) return safeResult(false, "busy");
    busy = true;
    try {
      let token;
      try {
        token = await helper.getSessionToken({ audience: "nov_hub" });
      } catch {
        return safeResult(false, "auth_required");
      }
      if (typeof token !== "string" || !token) return safeResult(false, "auth_required");
      let response;
      try {
        response = await fetchImpl(`${baseUrl}${path}`, {
          method,
          headers: { authorization: `Bearer ${token}`, ...(payload ? { "content-type": "application/json" } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {})
        });
      } catch {
        return safeResult(false, "request_failed", 1);
      }
      if (!response.ok) return safeResult(false, failureCategory(response.status), 1);
      const body = await response.json().catch(() => null);
      if (!isRecord(body) || body.ok !== true || !Object.hasOwn(body, "data")) return safeResult(false, "invalid_response", 1);
      return safeResult(true, "saved", 1, body.data);
    } finally {
      busy = false;
    }
  };

  return Object.freeze({
    enabled,
    isBusy: () => busy,
    async load() {
      const result = await request("GET");
      const cases = result.ok ? normalizeCaseList(result.data) : null;
      return cases ? safeResult(true, "loaded", result.requestCount, cases) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async save(draft) {
      const payload = normalizeDraft(draft);
      if (!payload) return safeResult(false, "invalid_request");
      const result = await request("POST", payload);
      const saved = result.ok ? normalizeSaveResult(result.data) : null;
      return saved ? safeResult(true, "saved", result.requestCount, saved) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async loadAudit(caseId) {
      if (!UUID.test(caseId)) return safeResult(false, "invalid_request");
      const result = await request("GET", null, `${AUDIT_PATH}?caseId=${encodeURIComponent(caseId)}`);
      const entries = result.ok ? normalizeAudit(result.data) : null;
      return entries ? safeResult(true, "loaded", result.requestCount, entries) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    }
  });
}

export function initializeWorkforceProcedureDesk({
  globalObject = globalThis,
  documentObject = globalObject.document,
  fetchImpl = globalObject.fetch
} = {}) {
  const desk = documentObject?.getElementById?.("workforce-procedure-desk");
  const list = documentObject?.getElementById?.("workforce-case-list");
  const form = documentObject?.getElementById?.("workforce-case-form");
  const status = documentObject?.getElementById?.("workforce-case-status");
  const audit = documentObject?.getElementById?.("workforce-case-audit");
  const auditList = documentObject?.getElementById?.("workforce-case-audit-list");
  const auditStatus = documentObject?.getElementById?.("workforce-case-audit-status");
  if (!desk || !list || !form || !status || !audit || !auditList || !auditStatus) return Object.freeze({ initialized: false, load: async () => safeResult(false, "not_ready") });
  if (desk.dataset.bound === "true") return Object.freeze({ initialized: true, duplicateBindingPrevented: true, load: async () => safeResult(false, "already_bound") });
  desk.dataset.bound = "true";
  const controller = createWorkforceProcedureCaseController({ globalObject, fetchImpl });
  let cases = [];

  const setStatus = (category) => {
    const messages = {
      idle: "手続き案件を読み込むと、下書き・確認・中止の履歴を管理できます。",
      loading: "手続き案件を読み込んでいます。",
      loaded: "手続き案件を表示しました。",
      saved: "手続き案件を保存しました。",
      feature_disabled: "手続き案件の編集機能はまだ接続されていません。",
      auth_required: "認証を確認してから、もう一度お試しください。",
      write_forbidden: "手続き案件を編集する権限を確認できません。",
      not_ready: "手続き案件を準備中です。",
      invalid_request: "入力内容を確認してください。",
      invalid_response: "手続き案件の応答を確認できませんでした。",
      request_failed: "手続き案件を保存できませんでした。",
      busy: "処理中です。"
    };
    status.dataset.category = category;
    status.textContent = messages[category] || messages.request_failed;
  };
  const input = (name) => form.elements.namedItem(name);
  const reset = () => {
    form.reset();
    input("caseId").value = "";
    input("expectedVersion").value = "0";
    form.hidden = true;
  };
  const clearAudit = () => {
    audit.hidden = true;
    auditList.replaceChildren();
    auditStatus.textContent = "";
  };
  const showAudit = async (item) => {
    audit.hidden = false;
    auditStatus.textContent = "変更履歴を読み込んでいます。";
    auditList.replaceChildren();
    const result = await controller.loadAudit(item.caseId);
    if (!result.ok) {
      auditStatus.textContent = "変更履歴を表示できませんでした。";
      return;
    }
    auditStatus.textContent = result.data.length === 0 ? "表示できる変更履歴はありません。" : "この案件の変更履歴です。";
    const fragment = documentObject.createDocumentFragment();
    for (const entry of result.data) {
      const row = documentObject.createElement("li");
      const title = documentObject.createElement("strong");
      const meta = documentObject.createElement("span");
      title.textContent = `${entry.action === "CREATE" ? "案件を登録" : "案件を更新"}（第${entry.caseVersion}版）`;
      meta.textContent = `${entry.changedFields.map(fieldLabel).join("、")}を更新 / ${formatAuditTime(entry.occurredAt)}`;
      row.append(title, meta);
      fragment.append(row);
    }
    auditList.append(fragment);
    audit.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  };
  const render = () => {
    list.replaceChildren();
    if (cases.length === 0) {
      const empty = documentObject.createElement("p");
      empty.className = "procedure-case-empty";
      empty.textContent = "登録済みの手続き案件はありません。";
      list.append(empty);
      return;
    }
    const fragment = documentObject.createDocumentFragment();
    for (const item of cases) {
      const row = documentObject.createElement("article");
      row.className = "procedure-case-row";
      const copy = documentObject.createElement("div");
      const title = documentObject.createElement("strong");
      const meta = documentObject.createElement("span");
      title.textContent = item.subjectLabel;
      meta.textContent = `${procedureLabel(item.procedureType)} / ${statusLabel(item.caseStatus)} / ${item.effectiveDate}`;
      copy.append(title, meta);
      const edit = documentObject.createElement("button");
      edit.type = "button";
      edit.className = "case-edit-button";
      edit.textContent = "編集";
      edit.addEventListener("click", () => {
        input("caseId").value = item.caseId;
        input("expectedVersion").value = String(item.version);
        input("procedureType").value = item.procedureType;
        input("caseStatus").value = item.caseStatus;
        input("subjectLabel").value = item.subjectLabel;
        input("effectiveDate").value = item.effectiveDate;
        input("detail").value = item.detail || "";
        form.hidden = false;
        form.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      });
      const actions = documentObject.createElement("div");
      actions.className = "procedure-case-actions-inline";
      const history = documentObject.createElement("button");
      history.type = "button";
      history.className = "case-edit-button";
      history.textContent = "変更履歴";
      history.addEventListener("click", () => showAudit(item));
      actions.append(history, edit);
      row.append(copy, actions);
      fragment.append(row);
    }
    list.append(fragment);
  };
  const load = async () => {
    setStatus("loading");
    const result = await controller.load();
    if (result.ok) {
      cases = result.data;
      render();
    }
    setStatus(result.category);
    return result;
  };

  documentObject.getElementById("workforce-case-new")?.addEventListener("click", () => {
    reset();
    form.hidden = false;
    input("subjectLabel")?.focus?.();
  });
  documentObject.getElementById("workforce-case-cancel")?.addEventListener("click", reset);
  documentObject.getElementById("workforce-case-audit-close")?.addEventListener("click", clearAudit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const draft = Object.freeze({
      caseId: input("caseId").value || null,
      expectedVersion: Number(input("expectedVersion").value),
      procedureType: input("procedureType").value,
      caseStatus: input("caseStatus").value,
      subjectLabel: input("subjectLabel").value,
      effectiveDate: input("effectiveDate").value,
      detail: input("detail").value
    });
    const controls = [...form.querySelectorAll("button,input,select,textarea")];
    controls.forEach((control) => { control.disabled = true; });
    try {
      const saved = await controller.save(draft);
      if (saved.ok) {
        reset();
        await load();
      } else {
        setStatus(saved.category);
      }
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
  });
  setStatus(controller.enabled ? "idle" : "feature_disabled");
  return Object.freeze({ initialized: true, enabled: controller.enabled, load, controller });
}

function procedureLabel(value) {
  return ({ ONBOARDING: "入社", TRANSFER: "異動", LEAVE: "休職・復職", RETIREMENT: "退職" })[value] || "手続き";
}

function statusLabel(value) {
  return ({ DRAFT: "下書き", READY_FOR_REVIEW: "確認待ち", CONFIRMED: "確認済み", CANCELLED: "中止" })[value] || "未設定";
}

function fieldLabel(value) {
  return ({ procedureType: "手続き", caseStatus: "進捗", subjectLabel: "対象者", effectiveDate: "基準日", detail: "手続きメモ" })[value] || "項目";
}

function formatAuditTime(value) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "記録時刻を確認中";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}
