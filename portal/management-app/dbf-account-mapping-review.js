import { DBF_IMPORT_RUNTIME } from "./dbf-business-data-runtime.js";

const COMPANY_ID = "e4059116-bdb3-4e13-9763-bbc77bdfe062";
const MONTH = "2026-06";
const SEMANTICS = ["POSTABLE_DETAIL", "DERIVED_SUBTOTAL", "CONTROL_TOTAL", "DISPLAY_ONLY", "NEEDS_OWNER_REVIEW"];
const DECISIONS = ["APPROVE", "EDIT_AND_APPROVE", "EXCLUDE", "NEEDS_REVIEW"];
const CATEGORIES = {
  PL: ["revenue", "cost_of_sales", "gross_profit", "personnel_cost", "operating_expense", "operating_profit"],
  BS: ["current_asset", "noncurrent_asset", "current_liability", "noncurrent_liability", "equity"],
};
const APPROVAL_DECISIONS = new Set(["APPROVE", "EDIT_AND_APPROVE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DECISION_LABELS = Object.freeze({ APPROVE: "承認", EDIT_AND_APPROVE: "修正して承認", EXCLUDE: "対象外", NEEDS_REVIEW: "要再確認", UNREVIEWED: "未確認" });
const SEMANTICS_LABELS = Object.freeze({ POSTABLE_DETAIL: "計上対象の明細", DERIVED_SUBTOTAL: "計算で求める小計", CONTROL_TOTAL: "照合用の合計", DISPLAY_ONLY: "表示のみ", NEEDS_OWNER_REVIEW: "Owner確認が必要" });
const CATEGORY_LABELS = Object.freeze({ revenue: "売上高", cost_of_sales: "売上原価", gross_profit: "売上総利益", personnel_cost: "人件費", operating_expense: "販売費・一般管理費", operating_profit: "営業利益", current_asset: "流動資産", noncurrent_asset: "固定資産", current_liability: "流動負債", noncurrent_liability: "固定負債", equity: "純資産" });
const BALANCE_LABELS = Object.freeze({ debit: "借方", credit: "貸方" });

export const ACCOUNT_REVIEW_ACTIONS = Object.freeze({ list: "dbfAccountReviewListV1", decide: "dbfAccountReviewDecideV1" });

const SAFE_ERRORS = Object.freeze({
  DBF_STAGING_SESSION_REQUIRED: "セッションの有効期限が切れています。NOV HUBの正式な経営データ管理画面から開き直してください。",
  AUTH_REQUIRED: "セッションの有効期限が切れています。NOV HUBの正式な経営データ管理画面から開き直してください。",
  FORBIDDEN: "この操作に必要な経営データ管理権限がありません。",
  COMPANY_SCOPE_REJECTED: "対象法人または対象月が許可範囲外です。同じ内容を再送しないでください。",
  DECISION_INVALID: "判断を選択してください。",
  APPROVAL_FIELDS_REQUIRED: "承認に必要な入力項目が不足しています。",
  ROW_SEMANTICS_INVALID: "Row Semanticsと加算設定を確認してください。",
  ROW_SEMANTICS_FLAGS_MISMATCH: "Row Semanticsと加算設定を確認してください。",
  VERSION_CONFLICT: "ほかの操作により状態が更新されています。最新状態を再取得しました。",
  DBF_ACCOUNT_REVIEW_ALREADY_FINAL: "この勘定科目はすでに確定しています。最新状態を再取得しました。",
  DBF_DUPLICATE_REVIEW_REQUEST: "同じ操作がすでに処理されている可能性があります。最新状態を再取得しました。",
  RUNTIME_RPC_REJECTED: "処理を完了できませんでした。最新状態を確認してから再試行してください。",
  AUTH_BACKEND_UNAVAILABLE: "一時的にシステムへ接続できません。入力内容を保持したまま再試行できます。",
  RUNTIME_RPC_UNAVAILABLE: "一時的にシステムへ接続できません。入力内容を保持したまま再試行できます。",
  DBF_RUNTIME_INVALID_RESPONSE: "安全のため処理を停止しました。再読込しても解消しない場合は、request IDを添えて管理者へ連絡してください。",
  INTERNAL_ERROR: "安全のため処理を停止しました。再読込しても解消しない場合は、request IDを添えて管理者へ連絡してください。",
});
const RELOAD_AFTER_ERROR = new Set(["VERSION_CONFLICT", "DBF_ACCOUNT_REVIEW_ALREADY_FINAL", "DBF_DUPLICATE_REVIEW_REQUEST", "RUNTIME_RPC_REJECTED"]);

function el(doc, tag, className = "", text = "") {
  const value = doc.createElement(tag); value.className = className; if (text) value.textContent = text; return value;
}
function option(doc, label, value) { const node = doc.createElement("option"); node.textContent = label; node.value = value; return node; }
function select(doc, values, current, blank = "選択してください", labels = {}) {
  const value = el(doc, "select", "dbf-account-review-input"); value.append(option(doc, blank, ""));
  values.forEach((item) => value.append(option(doc, labels[item] || item, item))); value.value = current || ""; return value;
}
function labelledControl(doc, labelText, control, id, errorId = "") {
  const wrapper = el(doc, "div", "dbf-account-review-field"); const label = el(doc, "label", "dbf-account-review-field-label", labelText);
  control.id = id; label.htmlFor = id; if (errorId) control.setAttribute("aria-describedby", errorId); wrapper.append(label, control);
  if (errorId) { const error = el(doc, "span", "dbf-account-review-field-error"); error.id = errorId; wrapper.append(error); }
  return wrapper;
}
function metric(doc, label, value) { const card = el(doc, "article", "dbf-account-review-metric"); card.append(el(doc, "span", "", label), el(doc, "strong", "", String(value))); return card; }

export function flagsForRowSemantics(rowSemantics) {
  return ({ POSTABLE_DETAIL: [true, false], DERIVED_SUBTOTAL: [false, false], CONTROL_TOTAL: [false, true], DISPLAY_ONLY: [false, false] }[rowSemantics] || [null, null])
    .reduce((result, value, index) => ({ ...result, [index ? "isControlTotal" : "isPostable"]: value }), {});
}

export function validateAccountReviewDraft(draft) {
  const errors = {};
  if (!DECISIONS.includes(draft.decision)) errors.decision = "判断を選択してください。";
  if (APPROVAL_DECISIONS.has(draft.decision)) {
    if (!String(draft.proposedAccountCode || "").trim()) errors.proposedAccountCode = "正式な勘定科目コードは必須です。";
    if (!String(draft.proposedAccountName || "").trim()) errors.proposedAccountName = "正式な勘定科目名は必須です。";
    if (!String(draft.accountCategory || "").trim()) errors.accountCategory = "勘定区分は必須です。";
    if (!["debit", "credit"].includes(draft.normalBalance)) errors.normalBalance = "通常残高を選択してください。";
    if (!["POSTABLE_DETAIL", "DERIVED_SUBTOTAL", "CONTROL_TOTAL", "DISPLAY_ONLY"].includes(draft.rowSemantics)) errors.rowSemantics = "行の扱いを選択してください。";
    const level = Number(draft.hierarchyLevel);
    if (!Number.isInteger(level) || level < 0 || level > 32) errors.hierarchyLevel = "階層レベルは0から32の整数で入力してください。";
    if (draft.parentCandidateId && !UUID.test(draft.parentCandidateId)) errors.parentCandidateId = "親勘定科目の指定を確認してください。";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function buildAccountReviewDecisionPayload(draft, requestId) {
  const approval = APPROVAL_DECISIONS.has(draft.decision);
  const flags = approval ? flagsForRowSemantics(draft.rowSemantics) : { isPostable: null, isControlTotal: null };
  return {
    candidateId: draft.candidateId, requestId, decision: draft.decision,
    proposedAccountCode: approval ? String(draft.proposedAccountCode || "").trim() : null,
    proposedAccountName: approval ? String(draft.proposedAccountName || "").trim() : null,
    accountCategory: approval ? draft.accountCategory || null : null, normalBalance: approval ? draft.normalBalance || null : null,
    parentCandidateId: approval ? draft.parentCandidateId || null : null, hierarchyLevel: approval ? Number(draft.hierarchyLevel) : null,
    rowSemantics: approval ? draft.rowSemantics || null : null, isPostable: flags.isPostable, isControlTotal: flags.isControlTotal,
  };
}

export function filterAccountReviewItems(items, filters) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("ja-JP");
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (filters.statementType !== "ALL" && item.statementType !== filters.statementType) return false;
    if (filters.mappingStatus !== "ALL" && item.mappingStatus !== filters.mappingStatus) return false;
    return !query || [item.sourceAccountName, item.candidateSourceCode, item.proposedCanonicalAccountCode, item.proposedCanonicalAccountName]
      .some((value) => String(value || "").toLocaleLowerCase("ja-JP").includes(query));
  });
}

export function safeAccountReviewError(error) {
  const code = String(error?.message || "INTERNAL_ERROR").replace(/[^A-Z0-9_]/gu, "").slice(0, 80) || "INTERNAL_ERROR";
  return { code, message: SAFE_ERRORS[code] || "処理を完了できませんでした。最新状態を確認してから再試行してください。",
    requestId: /^[A-Za-z0-9_-]{1,128}$/u.test(String(error?.requestId || "")) ? String(error.requestId) : null,
    reload: RELOAD_AFTER_ERROR.has(code), auth: ["DBF_STAGING_SESSION_REQUIRED", "AUTH_REQUIRED"].includes(code) };
}

export async function submitAccountReviewDraft({ draft, runtime, requestId, reload }) {
  const validation = validateAccountReviewDraft(draft);
  if (!validation.valid) return { ok: false, kind: "validation", validation };
  try {
    const response = await runtime.accountReviewDecide(buildAccountReviewDecisionPayload(draft, requestId));
    if (!response || response.candidateId !== draft.candidateId || response.requestId !== requestId || response.decision !== draft.decision) throw new Error("DBF_RUNTIME_INVALID_RESPONSE");
    return { ok: true, response, latest: await reload() };
  } catch (error) {
    const safe = safeAccountReviewError(error);
    if (safe.reload || error instanceof TypeError) { try { await reload(); safe.reloaded = true; } catch { safe.reloaded = false; } }
    return { ok: false, kind: error instanceof TypeError ? "network" : "runtime", error: safe };
  }
}

function itemDraft(item, existing) {
  return existing || { candidateId: item.candidateId, proposedAccountCode: item.proposedCanonicalAccountCode || "", proposedAccountName: item.proposedCanonicalAccountName || item.sourceAccountName || "",
    accountCategory: item.classification || "", normalBalance: item.normalBalance || "", parentCandidateId: item.parentCandidateId || null,
    hierarchyLevel: Number.isInteger(item.hierarchyLevel) ? item.hierarchyLevel : 0, rowSemantics: item.rowSemantics || "", decision: "" };
}

function reviewRow(doc, item, context) {
  const draft = itemDraft(item, context.drafts.get(item.candidateId)); context.drafts.set(item.candidateId, draft);
  const row = el(doc, "tr"); row.dataset.candidateId = item.candidateId; row.tabIndex = -1;
  const td = (label, content) => { const cell = el(doc, "td"); cell.dataset.label = label; typeof content === "string" ? cell.textContent = content : cell.append(content); row.append(cell); };
  td("取込元の勘定科目", item.sourceAccountName); td("取込元コード", item.candidateSourceCode);
  const field = (key, labelText, control) => { const base = `dbf-review-${item.candidateId}-${key}`; control.addEventListener("input", () => { draft[key] = control.value; }); control.addEventListener("change", () => { draft[key] = control.value; }); return labelledControl(doc, labelText, control, base, `${base}-error`); };
  const code = el(doc, "input", "dbf-account-review-input"); code.value = draft.proposedAccountCode; td("正式な科目コード", field("proposedAccountCode", "正式な科目コード", code));
  const name = el(doc, "input", "dbf-account-review-input"); name.value = draft.proposedAccountName; td("正式な科目名", field("proposedAccountName", "正式な科目名", name));
  td("勘定区分", field("accountCategory", "勘定区分", select(doc, CATEGORIES[item.statementType] || [], draft.accountCategory, "選択してください", CATEGORY_LABELS)));
  td("通常残高", field("normalBalance", "通常残高", select(doc, ["debit", "credit"], draft.normalBalance, "選択してください", BALANCE_LABELS)));
  td("行の扱い", field("rowSemantics", "行の扱い", select(doc, SEMANTICS, draft.rowSemantics, "選択してください", SEMANTICS_LABELS)));
  td("法人 / 将来店舗", `${item.selectedCorporateRowCount} / ${item.futureStoreDetailRowCount}`);
  td("Owner判断", field("decision", `Owner判断: ${item.sourceAccountName}`, select(doc, DECISIONS, draft.decision, "判断を選択してください", DECISION_LABELS)));
  const action = el(doc, "div", "dbf-account-review-action"); const currentStatus = item.mappingStatus || "UNREVIEWED"; const current = el(doc, "span", "dbf-account-review-current", `現在: ${DECISION_LABELS[currentStatus] || currentStatus}`);
  const save = el(doc, "button", "business-data-action", "判断を保存"); save.type = "button"; const rowStatus = el(doc, "span", "dbf-account-review-row-status"); rowStatus.setAttribute("aria-live", "polite");
  save.addEventListener("click", async () => {
    if (context.pending.has(item.candidateId) || context.uncertain.has(item.candidateId)) return;
    const validation = validateAccountReviewDraft(draft); row.querySelectorAll(".dbf-account-review-field-error").forEach((node) => { node.textContent = ""; }); row.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    if (!validation.valid) {
      const firstKey = Object.keys(validation.errors)[0];
      Object.entries(validation.errors).forEach(([key, message]) => { const control = row.querySelector(`[data-field="${key}"]`); const error = row.querySelector(`[data-error-for="${key}"]`); control?.setAttribute("aria-invalid", "true"); if (error) error.textContent = message; });
      row.querySelector(`[data-field="${firstKey}"]`)?.focus(); context.notify("入力内容を確認してください。", true); return;
    }
    context.pending.add(item.candidateId); row.setAttribute("aria-busy", "true"); save.disabled = true; save.textContent = "保存中…"; rowStatus.textContent = "判断を保存しています。"; context.notify(`${item.sourceAccountName}の判断を保存しています。`);
    const result = await submitAccountReviewDraft({ draft, runtime: context.runtime, requestId: context.randomUUID(), reload: context.reload });
    context.pending.delete(item.candidateId); row.removeAttribute("aria-busy"); save.disabled = false; save.textContent = "判断を保存";
    if (result.ok) { context.drafts.delete(item.candidateId); context.focusCandidate = item.candidateId; context.notify(`${item.sourceAccountName}を保存し、最新状態を再取得しました。`); context.render(); return; }
    if (result.kind === "network" && result.error.reloaded !== true) { context.uncertain.add(item.candidateId); save.disabled = true; }
    const detail = result.kind === "validation" ? "入力内容を確認してください。" : result.error.message; const request = result.error?.requestId ? `request ID: ${result.error.requestId}` : "";
    rowStatus.textContent = `${detail}${request ? ` ${request}` : ""}`; context.notify(detail, true, request);
  });
  [...row.querySelectorAll(".dbf-account-review-field")].forEach((wrapper) => { const control = wrapper.querySelector("input,select"); const error = wrapper.querySelector(".dbf-account-review-field-error"); const key = control?.id.split("-").at(-1); if (key) { control.dataset.field = key; if (error) error.dataset.errorFor = key; } });
  action.append(current, save, rowStatus); td("操作", action); return row;
}

export function createDbfAccountMappingReview(doc, options = {}) {
  const runtime = options.runtime || DBF_IMPORT_RUNTIME; const randomUUID = options.randomUUID || (() => crypto.randomUUID());
  const panel = el(doc, "section", "business-data-preview-panel dbf-account-review"); panel.dataset.businessDataPanel = "account-review"; panel.hidden = true;
  const heading = el(doc, "h3", "", "勘定科目確認"); heading.tabIndex = -1;
  panel.append(heading, el(doc, "p", "", "取り込んだ法人P/L・B/Sの勘定科目を、IDEA NOVの正式な勘定科目へ紐付けます。店舗別P/Lは対象外です。未確認と要再確認が0件になるまで判断してください。"));
  const decisionHelp = el(doc, "details", "dbf-account-review-help");
  decisionHelp.append(el(doc, "summary", "", "判断の選び方"), el(doc, "p", "", "承認：候補の内容をそのまま使用します。修正して承認：コードや名称を直して使用します。対象外：正式データへ含めません。要再確認：判断を保留し、後から再判断します。"));
  panel.append(decisionHelp);
  const live = el(doc, "p", "dbf-account-review-live"); live.setAttribute("aria-live", "polite"); live.setAttribute("aria-atomic", "true");
  const alert = el(doc, "section", "dbf-account-review-alert"); alert.setAttribute("role", "alert"); alert.tabIndex = -1; alert.hidden = true;
  const loading = el(doc, "section", "dbf-account-review-state dbf-account-review-loading", "勘定科目候補を読み込んでいます…"); loading.setAttribute("role", "status"); loading.setAttribute("aria-live", "polite");
  const loaded = el(doc, "div", "dbf-account-review-loaded"); loaded.hidden = true; const summary = el(doc, "div", "dbf-account-review-summary");
  const master = el(doc, "p", "dbf-account-review-master", "店舗マスタ: 法人6 / 総数22 / 有効21 / 無効1 / 営業店舗20（DIRECT 13・FC 7）/ HEAD_OFFICE 1（非店舗）");
  const filters = el(doc, "div", "dbf-account-review-filters"); const statement = select(doc, ["ALL", "PL", "BS"], "ALL", "", { ALL: "すべて", PL: "P/L", BS: "B/S" }); const state = select(doc, ["ALL", "UNREVIEWED", ...DECISIONS], "ALL", "", { ALL: "すべて", ...DECISION_LABELS });
  const search = el(doc, "input", "dbf-account-review-input"); search.type = "search"; search.placeholder = "勘定科目名・コード";
  filters.append(labelledControl(doc, "財務諸表", statement, "dbf-review-filter-statement"), labelledControl(doc, "確認状況", state, "dbf-review-filter-status"), labelledControl(doc, "検索", search, "dbf-review-filter-search"));
  const clear = el(doc, "button", "business-data-secondary-action", "絞り込みを解除"); clear.type = "button"; filters.append(clear); const count = el(doc, "p", "dbf-account-review-count");
  const filterEmpty = el(doc, "section", "dbf-account-review-state"); filterEmpty.hidden = true; filterEmpty.append(el(doc, "strong", "", "条件に一致する候補はありません。"), el(doc, "p", "", "絞り込みを解除するか、検索条件を変更してください。"));
  const wrap = el(doc, "div", "dbf-account-review-table-wrap"); wrap.tabIndex = 0; wrap.setAttribute("aria-label", "勘定科目候補一覧。横方向にスクロールできます。");
  const table = el(doc, "table", "dbf-account-review-table"); table.innerHTML = "<caption class=visually-hidden>勘定科目確認の候補一覧</caption><thead><tr><th>取込元の勘定科目</th><th>取込元コード</th><th>正式な科目コード</th><th>正式な科目名</th><th>勘定区分</th><th>通常残高</th><th>行の扱い</th><th>法人 / 将来店舗</th><th>Owner判断</th><th>操作</th></tr></thead>";
  const body = el(doc, "tbody"); table.append(body); wrap.append(table); const promotion = el(doc, "button", "business-data-danger-action business-data-disabled-action", "正式データへの反映は別途責任者の承認が必要です"); promotion.disabled = true; promotion.dataset.contractState = "Promotion disabled";
  const empty = el(doc, "section", "dbf-account-review-state"); empty.hidden = true; empty.append(el(doc, "strong", "", "対象データはありません。"), el(doc, "p", "", `対象法人: 株式会社イディア・ノブ / 対象月: ${MONTH}。これはエラーではありません。`));
  const emptyRetry = el(doc, "button", "business-data-secondary-action", "再読込"); emptyRetry.type = "button"; empty.append(emptyRetry); loaded.append(summary, master, filters, count, filterEmpty, wrap, empty, promotion); panel.append(live, alert, loading, loaded);
  let data = null; let focusCandidate = null; const drafts = new Map(); const pending = new Set(); const uncertain = new Set();
  const notify = (message, serious = false, suffix = "") => { live.textContent = serious ? "" : message; alert.hidden = !serious; if (serious) alert.replaceChildren(el(doc, "strong", "", message), suffix ? el(doc, "p", "", suffix) : el(doc, "span")); };
  const context = { runtime, randomUUID, drafts, pending, uncertain, notify, reload: null, render: null, get focusCandidate() { return focusCandidate; }, set focusCandidate(value) { focusCandidate = value; } };
  const render = () => {
    if (!data) return; const items = Array.isArray(data.items) ? data.items : [];
    summary.replaceChildren(metric(doc, "候補", data.summary?.candidates ?? items.length), metric(doc, "承認", data.summary?.approved ?? 0), metric(doc, "修正して承認", data.summary?.editAndApproved ?? 0), metric(doc, "対象外", data.summary?.excluded ?? 0), metric(doc, "要再確認", data.summary?.needsReview ?? 0), metric(doc, "未確認", data.summary?.unreviewed ?? 0), metric(doc, "法人P/L", data.summary?.corporatePlRows ?? 0), metric(doc, "法人B/S", data.summary?.corporateBsRows ?? 0));
    body.replaceChildren(); const filtered = filterAccountReviewItems(items, { statementType: statement.value, mappingStatus: state.value, query: search.value }); filtered.forEach((item) => body.append(reviewRow(doc, item, context)));
    count.textContent = `${filtered.length}件表示 / 全${items.length}件`; filterEmpty.hidden = items.length === 0 || filtered.length !== 0; wrap.hidden = items.length === 0 || filtered.length === 0; empty.hidden = items.length !== 0; promotion.hidden = items.length === 0;
    if (focusCandidate) { body.querySelector(`[data-candidate-id="${focusCandidate}"]`)?.focus(); focusCandidate = null; }
  }; context.render = render;
  const load = async ({ focusHeading = false } = {}) => {
    panel.setAttribute("aria-busy", "true"); loading.hidden = false; loaded.hidden = true; alert.hidden = true; notify("勘定科目候補を読み込んでいます。");
    try { data = await runtime.accountReviewList({ companyId: COMPANY_ID, fiscalMonth: MONTH }); if (!data || !Array.isArray(data.items) || !data.summary) throw new Error("DBF_RUNTIME_INVALID_RESPONSE"); loading.hidden = true; loaded.hidden = false; panel.removeAttribute("aria-busy"); render(); notify(`${data.items.length}件の候補を読み込みました。`); if (focusHeading) heading.focus(); return data; }
    catch (error) { data = null; loading.hidden = true; loaded.hidden = true; panel.removeAttribute("aria-busy"); const safe = safeAccountReviewError(error); alert.hidden = false; alert.replaceChildren(el(doc, "strong", "", safe.message)); const technical = el(doc, "details", "dbf-technical-detail"); technical.append(el(doc, "summary", "", "技術情報を表示"), el(doc, "code", "", `${safe.code}${safe.requestId ? ` / request=${safe.requestId}` : ""}`)); alert.append(technical); if (safe.auth) { const launcher = el(doc, "a", "business-data-secondary-action", "NOV HUBへ戻る"); launcher.href = "/"; alert.append(launcher); } const retry = el(doc, "button", "business-data-secondary-action", "再読込"); retry.type = "button"; retry.addEventListener("click", () => void load({ focusHeading: true }).catch(() => {})); alert.append(retry); alert.focus(); throw error; }
  }; context.reload = () => load();
  statement.addEventListener("change", render); state.addEventListener("change", render); search.addEventListener("input", render); clear.addEventListener("click", () => { statement.value = "ALL"; state.value = "ALL"; search.value = ""; render(); search.focus(); }); emptyRetry.addEventListener("click", () => void load({ focusHeading: true }).catch(() => {})); panel.loadAccountReview = load; return panel;
}
