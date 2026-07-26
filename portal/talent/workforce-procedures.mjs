const API_PATH = "/api/talent/v1/workforce/procedure-cases";
const AUDIT_PATH = `${API_PATH}/audit`;
const STEPS_PATH = `${API_PATH}/steps`;
const PROCEDURE_TYPES = Object.freeze(["ONBOARDING", "TRANSFER", "LEAVE", "RETIREMENT"]);
const CASE_STATUSES = Object.freeze(["DRAFT", "READY_FOR_REVIEW", "CONFIRMED", "CANCELLED"]);
const CASE_FILTERS = Object.freeze(["ALL", "OPEN", ...CASE_STATUSES]);
const PRIORITY_FILTERS = Object.freeze(["ALL", "OVERDUE", "NEXT_7_DAYS", "SCHEDULED"]);
const CASE_STATUS_TRANSITIONS = Object.freeze({
  NEW: Object.freeze(["DRAFT", "READY_FOR_REVIEW", "CANCELLED"]),
  DRAFT: Object.freeze(["DRAFT", "READY_FOR_REVIEW", "CANCELLED"]),
  READY_FOR_REVIEW: Object.freeze(["READY_FOR_REVIEW", "DRAFT", "CONFIRMED", "CANCELLED"]),
  CONFIRMED: Object.freeze(["CONFIRMED"]),
  CANCELLED: Object.freeze(["CANCELLED", "DRAFT"])
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STEP_LABELS = Object.freeze({
  BASIC_INFO: "基本情報・配属予定を確認", DOCUMENTS: "必要書類を確認", APPROVAL: "関係者の承認を確認", CORE_HANDOFF: "Core反映の引き継ぎを確認",
  CHANGE_DETAILS: "異動内容を確認", STAKEHOLDER_CONFIRMATION: "本人・関係者の確認を記録", APPLICATION: "申請内容を確認", REQUIRED_PROCEDURES: "必要な社内手続きを確認",
  RETURN_PLAN: "復職予定・所属を確認", RETIREMENT_DATE: "退職日・最終出勤日を確認", ASSET_RETURN: "貸与物の返却を確認"
});
const PROCEDURE_STEP_KEYS = Object.freeze({
  ONBOARDING: Object.freeze(["BASIC_INFO", "DOCUMENTS", "APPROVAL", "CORE_HANDOFF"]),
  TRANSFER: Object.freeze(["CHANGE_DETAILS", "STAKEHOLDER_CONFIRMATION", "APPROVAL", "CORE_HANDOFF"]),
  LEAVE: Object.freeze(["APPLICATION", "REQUIRED_PROCEDURES", "RETURN_PLAN", "CORE_HANDOFF"]),
  RETIREMENT: Object.freeze(["RETIREMENT_DATE", "DOCUMENTS", "ASSET_RETURN", "CORE_HANDOFF"])
});

export const WORKFORCE_PROCEDURE_CASE_CONTRACT = Object.freeze({
  employeeMasterMutation: false,
  auditHistory: true,
  statusFilters: true,
  openCaseFilter: true,
  caseSearch: true,
  filterReset: true,
  checklistTracking: true,
  coreHandoffQueue: true,
  optimisticConcurrency: true,
  requestMaxPerAction: 1,
  retryCount: 0
});

export function getActiveWorkforceProcedureType(documentObject) {
  const selected = documentObject?.querySelector?.('[data-workforce-tab][aria-selected="true"]');
  const procedureType = String(selected?.dataset?.procedureType || "");
  return PROCEDURE_TYPES.includes(procedureType) ? procedureType : "ONBOARDING";
}

export function normalizeWorkforceProcedureCasePrefill(value, documentObject) {
  const draft = isRecord(value) ? value : {};
  const procedureType = PROCEDURE_TYPES.includes(draft.procedureType)
    ? draft.procedureType
    : getActiveWorkforceProcedureType(documentObject);
  const subjectLabel = typeof draft.subjectLabel === "string" ? draft.subjectLabel.trim().slice(0, 120) : "";
  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(draft.effectiveDate || ""))
    ? String(draft.effectiveDate)
    : "";
  const detail = typeof draft.detail === "string" ? draft.detail.trim().slice(0, 500) : "";
  return Object.freeze({ procedureType, subjectLabel, effectiveDate, detail });
}

export function filterWorkforceProcedureCases(cases, filter = "ALL") {
  if (!Array.isArray(cases) || !CASE_FILTERS.includes(filter)) return Object.freeze([]);
  return Object.freeze(cases.filter((item) => filter === "ALL" || (filter === "OPEN"
    ? ["DRAFT", "READY_FOR_REVIEW"].includes(item.caseStatus)
    : item.caseStatus === filter)));
}

export function filterWorkforceProcedureCasesByType(cases, procedureType = "ALL") {
  if (!Array.isArray(cases) || !["ALL", ...PROCEDURE_TYPES].includes(procedureType)) return Object.freeze([]);
  return Object.freeze(cases.filter((item) => procedureType === "ALL" || item.procedureType === procedureType));
}

export function filterWorkforceProcedureCasesByPriority(cases, priority = "ALL", referenceDate = localDateIso()) {
  if (!Array.isArray(cases) || !PRIORITY_FILTERS.includes(priority)) return Object.freeze([]);
  return Object.freeze(cases.filter((item) => priority === "ALL" || classifyWorkforceProcedureCasePriority(item, referenceDate) === priority));
}

export function filterWorkforceProcedureCasesByQuery(cases, query = "") {
  if (!Array.isArray(cases)) return Object.freeze([]);
  const normalizedQuery = normalizeWorkforceProcedureCaseSearch(query);
  if (!normalizedQuery) return Object.freeze([...cases]);
  return Object.freeze(cases.filter((item) => [item.subjectLabel, item.detail]
    .some((value) => normalizeWorkforceProcedureCaseSearch(value).includes(normalizedQuery))));
}

function normalizeWorkforceProcedureCaseSearch(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP").slice(0, 120) : "";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function countCategory(value) {
  const count = Number(value || 0);
  return count <= 0 ? "ZERO" : count === 1 ? "ONE" : "MULTIPLE";
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

export function buildWorkforceProcedureAuditSummary(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  const changedFields = new Set(rows.flatMap((entry) => Array.isArray(entry?.changedFields) ? entry.changedFields : []));
  const latest = rows.find((entry) => typeof entry?.occurredAt === "string") || null;
  const category = rows.length === 0
    ? "NO_HISTORY"
    : changedFields.has("caseStatus")
      ? "STATUS_CHANGED"
      : changedFields.has("effectiveDate")
        ? "DATE_CHANGED"
        : "DETAIL_CHANGED";
  const title = {
    NO_HISTORY: "変更履歴はまだありません",
    STATUS_CHANGED: "進捗変更を含む履歴があります",
    DATE_CHANGED: "基準日の変更を含む履歴があります",
    DETAIL_CHANGED: "案件情報の更新履歴があります"
  }[category];
  const copy = {
    NO_HISTORY: "新規登録後の更新はまだ記録されていません。",
    STATUS_CHANGED: "確認待ち・確認済み・中止などの進捗変更を確認してください。",
    DATE_CHANGED: "手続き基準日が変わっています。期限順の見え方も確認してください。",
    DETAIL_CHANGED: "対象者・手続きメモなどの変更内容を確認できます。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    updateCount: rows.length,
    changedFieldCount: changedFields.size,
    latestCategory: latest ? "PRESENT" : "NONE",
    rawValuesIncluded: false
  });
}

export function isWorkforceProcedureCaseReadyToConfirm(steps) {
  return Array.isArray(steps) && steps.length === 4 && steps.every((step) => step && step.isCompleted === true);
}

export function buildWorkforceProcedureConfirmationReadiness(steps) {
  const rows = Array.isArray(steps) ? steps : [];
  const expected = 4;
  const completed = rows.filter((step) => step?.isCompleted === true).length;
  const category = rows.length !== expected
    ? "CHECKLIST_SHAPE_INVALID"
    : completed === expected
      ? "READY_TO_CONFIRM"
      : "CHECKLIST_INCOMPLETE";
  const title = {
    CHECKLIST_SHAPE_INVALID: "確認項目を安全に判定できません",
    READY_TO_CONFIRM: "確認済みに進める準備ができています",
    CHECKLIST_INCOMPLETE: "未完了の確認項目があります"
  }[category];
  const copy = {
    CHECKLIST_SHAPE_INVALID: "手続き別の4項目が揃っていないため、進捗変更は止めて再読み込みしてください。",
    READY_TO_CONFIRM: "4項目が完了しています。進捗変更は保存前に内容をもう一度確認してください。",
    CHECKLIST_INCOMPLETE: "未完了の項目をチェックしてから、確認済みへ進めます。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    completed,
    expected,
    canConfirm: category === "READY_TO_CONFIRM",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureStepProgress(steps) {
  const rows = Array.isArray(steps) ? steps : [];
  const completed = rows.filter((step) => step?.isCompleted === true).length;
  const pending = Math.max(0, rows.length - completed);
  const nextPending = rows.find((step) => step?.isCompleted !== true) || null;
  const category = rows.length !== 4
    ? "CHECKLIST_SHAPE_INVALID"
    : pending === 0
      ? "ALL_COMPLETE"
      : completed === 0
        ? "NOT_STARTED"
        : "IN_PROGRESS";
  const title = {
    CHECKLIST_SHAPE_INVALID: "確認項目の形を確認してください",
    ALL_COMPLETE: "4項目すべて完了しています",
    NOT_STARTED: "確認項目は未着手です",
    IN_PROGRESS: "未完了の確認項目が残っています"
  }[category];
  const nextStepLabel = nextPending ? STEP_LABELS[nextPending.stepKey] || "次の確認項目" : "確認済みに進められます";
  return Object.freeze({
    category,
    title,
    completed,
    pending,
    nextStepCategory: nextPending ? "PRESENT" : "NONE",
    nextStepLabel,
    canConfirm: category === "ALL_COMPLETE",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function classifyWorkforceProcedureCasePriority(item, referenceDate = localDateIso()) {
  if (!item || !CASE_STATUSES.includes(item.caseStatus) || !/^\d{4}-\d{2}-\d{2}$/.test(item.effectiveDate || "")) return "SCHEDULED";
  if (["CONFIRMED", "CANCELLED"].includes(item.caseStatus)) return "CLOSED";
  const distance = daysBetween(referenceDate, item.effectiveDate);
  if (distance < 0) return "OVERDUE";
  if (distance <= 7) return "NEXT_7_DAYS";
  return "SCHEDULED";
}

export function sortWorkforceProcedureCases(cases, referenceDate = localDateIso()) {
  const order = { OVERDUE: 0, NEXT_7_DAYS: 1, SCHEDULED: 2, CLOSED: 3 };
  return Object.freeze([...cases].sort((left, right) => {
    const priority = order[classifyWorkforceProcedureCasePriority(left, referenceDate)] - order[classifyWorkforceProcedureCasePriority(right, referenceDate)];
    if (priority !== 0) return priority;
    return String(left.effectiveDate).localeCompare(String(right.effectiveDate));
  }));
}

export function buildWorkforceProcedureOperationSummary(cases, referenceDate = localDateIso()) {
  const rows = Array.isArray(cases) ? cases : [];
  const overdue = rows.filter((item) => classifyWorkforceProcedureCasePriority(item, referenceDate) === "OVERDUE").length;
  const soon = rows.filter((item) => classifyWorkforceProcedureCasePriority(item, referenceDate) === "NEXT_7_DAYS").length;
  const review = rows.filter((item) => item?.caseStatus === "READY_FOR_REVIEW").length;
  const draft = rows.filter((item) => item?.caseStatus === "DRAFT").length;
  const nextAction = overdue > 0
    ? "OVERDUE"
    : soon > 0 ? "NEXT_7_DAYS"
      : review > 0 ? "READY_FOR_REVIEW"
        : draft > 0 ? "DRAFT"
          : "NO_OPEN_WORK";
  const title = {
    OVERDUE: "期限超過の手続きから処理してください",
    NEXT_7_DAYS: "7日以内の手続きを前倒し確認します",
    READY_FOR_REVIEW: "確認待ち案件をチェックリストで確認します",
    DRAFT: "下書き案件を開いて不足情報を補います",
    NO_OPEN_WORK: "今日の優先処理はありません"
  }[nextAction];
  const copy = {
    OVERDUE: "社員マスタは変更せず、案件の状態・期限・確認項目を先に整えます。",
    NEXT_7_DAYS: "直近の入社・異動・休復職・退職を先に見て、担当者が迷わない状態にします。",
    READY_FOR_REVIEW: "確認待ちはチェックリスト完了後に確認済みへ進めます。",
    DRAFT: "下書きは対象者・実施日・メモを整えて確認待ちへ回します。",
    NO_OPEN_WORK: "対応中・確認待ちの期限キューは落ち着いています。"
  }[nextAction];
  return Object.freeze({ overdue, soon, review, draft, nextAction, title, copy });
}

export function buildWorkforceProcedureOperationFilter(action) {
  const plans = Object.freeze({
    OVERDUE: Object.freeze({ status: "ALL", priority: "OVERDUE", label: "期限超過の案件へ絞り込み" }),
    NEXT_7_DAYS: Object.freeze({ status: "ALL", priority: "NEXT_7_DAYS", label: "7日以内の案件へ絞り込み" }),
    READY_FOR_REVIEW: Object.freeze({ status: "READY_FOR_REVIEW", priority: "ALL", label: "確認待ちへ絞り込み" }),
    DRAFT: Object.freeze({ status: "DRAFT", priority: "ALL", label: "下書きへ絞り込み" })
  });
  return Object.freeze({
    ...(plans[action] || Object.freeze({ status: "ALL", priority: "ALL", label: "すべての案件を表示" })),
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureTypeQueueFilter(summaryRow) {
  const row = isRecord(summaryRow) ? summaryRow : {};
  const category = ["OVERDUE", "READY_FOR_REVIEW", "OPEN", "CLEAR"].includes(row.nextCategory)
    ? row.nextCategory
    : "CLEAR";
  const plans = Object.freeze({
    OVERDUE: Object.freeze({ status: "ALL", priority: "OVERDUE", label: "期限超過を先に表示" }),
    READY_FOR_REVIEW: Object.freeze({ status: "READY_FOR_REVIEW", priority: "ALL", label: "確認待ちを表示" }),
    OPEN: Object.freeze({ status: "OPEN", priority: "ALL", label: "対応中を表示" }),
    CLEAR: Object.freeze({ status: "ALL", priority: "ALL", label: "全件を表示" })
  });
  return Object.freeze({
    category,
    ...plans[category],
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureOperationSteps(summary) {
  const nextAction = summary?.nextAction || "NO_OPEN_WORK";
  const labelsByAction = Object.freeze({
    OVERDUE: ["期限超過だけに絞り込む", "基準日と不足情報を確認する", "確認待ちまたは中止へ進捗を整える"],
    NEXT_7_DAYS: ["7日以内の案件を開く", "対象者・基準日・メモを補う", "期限前に確認待ちへ回す"],
    READY_FOR_REVIEW: ["確認待ちだけに絞り込む", "4つの確認項目を確認する", "完了した案件だけ確認済みにする"],
    DRAFT: ["下書きだけに絞り込む", "対象者と基準日を揃える", "準備できたものを確認待ちへ進める"],
    NO_OPEN_WORK: ["新規案件を受け付ける", "直近予定を確認する", "社員マスタ反映は別承認で扱う"]
  });
  const labels = labelsByAction[nextAction] || labelsByAction.NO_OPEN_WORK;
  return Object.freeze({
    nextAction,
    steps: Object.freeze(labels.map((label, index) => Object.freeze({ order: index + 1, label }))),
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false
  });
}

export function buildWorkforceProcedureOperationStartGuide(summary) {
  const nextAction = summary?.nextAction || "NO_OPEN_WORK";
  const filter = buildWorkforceProcedureOperationFilter(nextAction);
  const plans = Object.freeze({
    OVERDUE: Object.freeze({
      title: "最初に期限超過を見る",
      copy: "遅れている案件だけに絞り、基準日・不足情報・進捗を先に整えます。",
      buttonLabel: "期限超過を見る",
      reason: "期限超過は現職者手続きの優先キューです。"
    }),
    NEXT_7_DAYS: Object.freeze({
      title: "次に7日以内を見る",
      copy: "期限超過がなければ、直近予定を先に確認して確認待ちへ回します。",
      buttonLabel: "7日以内を見る",
      reason: "近い予定を先に整えると、当日の抜け漏れを減らせます。"
    }),
    READY_FOR_REVIEW: Object.freeze({
      title: "確認待ちをチェックリストで見る",
      copy: "編集ではなく確認項目を開き、完了した案件だけ確認済みにします。",
      buttonLabel: "確認待ちを見る",
      reason: "確認済みはCore DB引き渡し候補ですが、社員マスタ反映は別承認です。"
    }),
    DRAFT: Object.freeze({
      title: "下書きを補完する",
      copy: "対象者・実施日・メモを揃えて、確認待ちへ進められる状態にします。",
      buttonLabel: "下書きを見る",
      reason: "下書きのまま残すと日常運用のキューに埋もれます。"
    }),
    NO_OPEN_WORK: Object.freeze({
      title: "通常受付を継続する",
      copy: "優先キューがなければ、新規案件受付と既存案件の履歴確認を続けます。",
      buttonLabel: "全件を見る",
      reason: "社員マスタへの反映は、この画面から自動実行しません。"
    })
  });
  const plan = plans[nextAction] || plans.NO_OPEN_WORK;
  return Object.freeze({
    category: nextAction,
    title: plan.title,
    copy: plan.copy,
    buttonLabel: plan.buttonLabel,
    reason: plan.reason,
    filterStatus: filter.status,
    filterPriority: filter.priority,
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildWorkforceProcedureActionMix(cases, referenceDate = localDateIso()) {
  const rows = Array.isArray(cases) ? cases : [];
  const counts = { EDIT: 0, CHECKLIST: 0, AUDIT: 0 };
  for (const item of rows) {
    if (!isRecord(item)) continue;
    const plan = buildWorkforceProcedureCaseNextAction(item, referenceDate);
    const route = buildWorkforceProcedureCaseActionRoute(plan);
    if (Object.hasOwn(counts, route.action)) counts[route.action] += 1;
  }
  const nextAction = counts.EDIT > 0
    ? "EDIT"
    : counts.CHECKLIST > 0
      ? "CHECKLIST"
      : counts.AUDIT > 0
        ? "AUDIT"
        : "NONE";
  const title = {
    EDIT: "まず編集で不足情報を整えます",
    CHECKLIST: "確認項目の完了確認に進めます",
    AUDIT: "Core反映前の履歴確認だけです",
    NONE: "処理対象はありません"
  }[nextAction];
  const copy = {
    EDIT: "期限超過・下書き・中止再開は、確認済みに進める前に案件メモと基準日を整えます。",
    CHECKLIST: "確認待ち案件は、4項目を確認してから確認済みに進めます。",
    AUDIT: "確認済み案件は社員マスタへ自動反映せず、履歴確認で止めます。",
    NONE: "表示中の案件に日常処理の候補はありません。"
  }[nextAction];
  return Object.freeze({
    edit: counts.EDIT,
    checklist: counts.CHECKLIST,
    audit: counts.AUDIT,
    nextAction,
    title,
    copy,
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false
  });
}

export function buildWorkforceProcedureCoreHandoffQueue(cases) {
  const rows = Array.isArray(cases) ? cases.filter(isRecord) : [];
  const handoffReady = rows.filter((item) => item.caseStatus === "CONFIRMED").length;
  const localInProgress = rows.filter((item) => ["DRAFT", "READY_FOR_REVIEW"].includes(item.caseStatus)).length;
  const cancelled = rows.filter((item) => item.caseStatus === "CANCELLED").length;
  const category = handoffReady > 0
    ? "SEPARATE_CORE_APPROVAL_REQUIRED"
    : localInProgress > 0
      ? "LOCAL_CASES_IN_PROGRESS"
      : "NO_CORE_HANDOFF_WORK";
  const title = {
    SEPARATE_CORE_APPROVAL_REQUIRED: "Core DB反映前の確認待ちがあります",
    LOCAL_CASES_IN_PROGRESS: "まず案件内の確認を完了します",
    NO_CORE_HANDOFF_WORK: "Core DBへ渡す案件はありません"
  }[category];
  const copy = {
    SEPARATE_CORE_APPROVAL_REQUIRED: "確認済み案件は社員マスタへ自動反映せず、別承認の引き渡しで扱います。",
    LOCAL_CASES_IN_PROGRESS: "下書き・確認待ちを整えてから、Core DB引き渡し候補に進めます。",
    NO_CORE_HANDOFF_WORK: "表示中の範囲に、社員マスタ反映前の引き渡し候補はありません。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    handoffReady,
    localInProgress,
    cancelled,
    handoffReadyCategory: countCategory(handoffReady),
    localInProgressCategory: countCategory(localInProgress),
    cancelledCategory: countCategory(cancelled),
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    coreDbWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildWorkforceProcedureCoreHandoffSteps(queue) {
  const category = String(queue?.category || "NO_CORE_HANDOFF_WORK");
  const labelsByCategory = {
    SEPARATE_CORE_APPROVAL_REQUIRED: [
      "確認済み案件だけをCore引き渡し候補にする",
      "社員マスタ更新は別承認まで実行しない",
      "履歴と確認項目を見直して引き渡し依頼へ進む"
    ],
    LOCAL_CASES_IN_PROGRESS: [
      "下書き・確認待ちを先に開く",
      "不足メモと基準日を整える",
      "4項目チェック後に確認済みへ進める"
    ],
    NO_CORE_HANDOFF_WORK: [
      "新しい案件または絞り込み条件を確認する",
      "確認済み案件が出るまでCore反映は行わない",
      "社員マスタは読み取り専用の正本として扱う"
    ]
  };
  const labels = labelsByCategory[category] || labelsByCategory.NO_CORE_HANDOFF_WORK;
  return Object.freeze({
    category,
    steps: Object.freeze(labels.map((label, index) => Object.freeze({
      order: index + 1,
      category: ["QUEUE_SCOPE", "APPROVAL_BOUNDARY", "NEXT_LOCAL_ACTION"][index],
      label
    }))),
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    coreDbWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildWorkforceProcedureCoreHandoffReadback(queue) {
  const category = String(queue?.category || "NO_CORE_HANDOFF_WORK");
  const labelsByCategory = {
    SEPARATE_CORE_APPROVAL_REQUIRED: {
      title: "Core DB引き渡し承認前の読み合わせが必要です",
      copy: "確認済み案件だけを対象にし、社員マスタ反映は別承認の実行経路へ渡します。",
      steps: [
        ["CONFIRMED_ONLY", "確認済みカテゴリだけを引き渡し候補にする"],
        ["NO_IN_PROGRESS", "下書き・確認待ち・中止はCore DB反映対象に含めない"],
        ["SEPARATE_APPROVAL", "社員マスタ更新は別承認まで実行しない"]
      ]
    },
    LOCAL_CASES_IN_PROGRESS: {
      title: "Core DB引き渡し前に案件整理が必要です",
      copy: "下書き・確認待ちを完了させるまで、社員マスタ更新の承認文は準備しません。",
      steps: [
        ["COMPLETE_LOCAL_CASES", "下書きと確認待ちを案件内で完了する"],
        ["CHECK_HISTORY", "変更履歴と確認項目を確認する"],
        ["DO_NOT_HANDOFF_YET", "Core DB引き渡し依頼はまだ作らない"]
      ]
    },
    NO_CORE_HANDOFF_WORK: {
      title: "Core DB引き渡し承認は不要です",
      copy: "確認済み案件が出るまで、社員マスタ更新の承認文は準備しません。",
      steps: [
        ["KEEP_INTAKE_OPEN", "通常受付と案件登録を続ける"],
        ["WATCH_CONFIRMED", "確認済みになった案件だけを次回確認する"],
        ["NO_MASTER_MUTATION", "社員マスタ更新は不可到達のままにする"]
      ]
    }
  };
  const plan = labelsByCategory[category] || labelsByCategory.NO_CORE_HANDOFF_WORK;
  return Object.freeze({
    category,
    title: plan.title,
    copy: plan.copy,
    steps: Object.freeze(plan.steps.map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    }))),
    handoffReadyCategory: String(queue?.handoffReadyCategory || "ZERO"),
    localInProgressCategory: String(queue?.localInProgressCategory || "ZERO"),
    cancelledCategory: String(queue?.cancelledCategory || "ZERO"),
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    coreDbWriteRequiresSeparateApproval: true,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildWorkforceProcedureCoreHandoffFinalCheck(queue) {
  const normalized = queue && typeof queue === "object" ? queue : buildWorkforceProcedureCoreHandoffQueue([]);
  const ready = Number(normalized.handoffReady || 0);
  const inProgress = Number(normalized.localInProgress || 0);
  const category = ready > 0
    ? inProgress > 0 ? "HANDOFF_READY_WITH_LOCAL_WORK" : "HANDOFF_READY_FOR_SEPARATE_APPROVAL"
    : inProgress > 0 ? "LOCAL_WORK_BEFORE_HANDOFF" : "NO_CORE_HANDOFF_WORK";
  const labels = {
    HANDOFF_READY_FOR_SEPARATE_APPROVAL: [
      ["CONFIRMED_ONLY", "確認済み案件だけをCore DB引き渡し候補にする"],
      ["READBACK_COUNTS", "件数カテゴリだけで読み合わせる"],
      ["SEPARATE_MASTER_APPROVAL", "社員マスタ反映は別承認まで実行しない"]
    ],
    HANDOFF_READY_WITH_LOCAL_WORK: [
      ["SPLIT_CONFIRMED", "確認済み案件と対応中案件を混ぜない"],
      ["FINISH_LOCAL_WORK", "下書き・確認待ちは画面内で完了させる"],
      ["SEPARATE_MASTER_APPROVAL", "社員マスタ反映は別承認まで実行しない"]
    ],
    LOCAL_WORK_BEFORE_HANDOFF: [
      ["NO_CONFIRMED_CASES", "引き渡し候補はまだZERO"],
      ["COMPLETE_CASES", "案件入力・確認項目・履歴を整える"],
      ["KEEP_READ_ONLY_MASTER", "Core DB正本は読み取り専用のまま扱う"]
    ],
    NO_CORE_HANDOFF_WORK: [
      ["KEEP_INTAKE_OPEN", "通常の案件受付を継続する"],
      ["WATCH_CONFIRMED", "確認済み案件が出たら候補化する"],
      ["NO_MASTER_MUTATION", "社員マスタ反映は行わない"]
    ]
  }[category];
  return Object.freeze({
    category,
    steps: Object.freeze(labels.map(([stepCategory, label], index) => Object.freeze({
      order: index + 1,
      category: stepCategory,
      label
    }))),
    handoffReadyCategory: String(normalized.handoffReadyCategory || "ZERO"),
    localInProgressCategory: String(normalized.localInProgressCategory || "ZERO"),
    cancelledCategory: String(normalized.cancelledCategory || "ZERO"),
    rawValuesIncluded: false,
    coreDbWriteRequiresSeparateApproval: true,
    employeeMasterMutation: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
}

export function buildWorkforceProcedureEmptyState({ total = 0, hasActiveFilters = false, activeProcedureType = "ALL" } = {}) {
  const procedureType = PROCEDURE_TYPES.includes(activeProcedureType) ? activeProcedureType : "ALL";
  const category = total === 0
    ? "NO_CASES"
    : hasActiveFilters
      ? "FILTERED_EMPTY"
      : "NO_VISIBLE_CASES";
  const title = {
    NO_CASES: "手続き案件はまだありません",
    FILTERED_EMPTY: "条件に合う案件はありません",
    NO_VISIBLE_CASES: "表示できる案件はありません"
  }[category];
  const copy = {
    NO_CASES: procedureType === "ALL"
      ? "入社・異動・休職復職・退職の案件を登録すると、期限順に処理できます。"
      : `${procedureLabel(procedureType)}の案件を登録すると、このキューで追跡できます。`,
    FILTERED_EMPTY: "絞り込み条件を解除すると、ほかの案件を確認できます。",
    NO_VISIBLE_CASES: "Core DB正本は読み取り専用です。案件登録または表示条件を確認してください。"
  }[category];
  const action = {
    NO_CASES: "案件を登録",
    FILTERED_EMPTY: "絞り込みを解除",
    NO_VISIBLE_CASES: "表示条件を確認"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    action,
    canReset: category === "FILTERED_EMPTY",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureTypeSummary(cases, referenceDate = localDateIso()) {
  const rows = Array.isArray(cases) ? cases : [];
  return Object.freeze(Object.fromEntries(PROCEDURE_TYPES.map((procedureType) => {
    const scoped = rows.filter((item) => item?.procedureType === procedureType);
    const open = scoped.filter((item) => ["DRAFT", "READY_FOR_REVIEW"].includes(item?.caseStatus)).length;
    const overdue = scoped.filter((item) => classifyWorkforceProcedureCasePriority(item, referenceDate) === "OVERDUE").length;
    const review = scoped.filter((item) => item?.caseStatus === "READY_FOR_REVIEW").length;
    const nextCategory = overdue > 0
      ? "OVERDUE"
      : review > 0
        ? "READY_FOR_REVIEW"
        : open > 0
          ? "OPEN"
          : "CLEAR";
    return [procedureType, Object.freeze({
      procedureType,
      open,
      overdue,
      review,
      nextCategory,
      rawValuesIncluded: false
    })];
  })));
}

export function buildWorkforceProcedureCaseNextAction(item, referenceDate = localDateIso()) {
  const status = CASE_STATUSES.includes(item?.caseStatus) ? item.caseStatus : "DRAFT";
  const priority = classifyWorkforceProcedureCasePriority(item, referenceDate);
  const category = status === "CONFIRMED"
    ? "CORE_HANDOFF_READY"
    : status === "CANCELLED"
      ? "CANCELLED"
      : priority === "OVERDUE"
        ? "OVERDUE_REVIEW"
        : status === "READY_FOR_REVIEW"
          ? "CHECKLIST_REVIEW"
          : priority === "NEXT_7_DAYS"
            ? "COMPLETE_DRAFT"
            : "DRAFT_UPDATE";
  const title = {
    CORE_HANDOFF_READY: "Core反映待ち",
    CANCELLED: "中止済み",
    OVERDUE_REVIEW: "期限超過を確認",
    CHECKLIST_REVIEW: "確認項目を確認",
    COMPLETE_DRAFT: "下書きを確認待ちへ",
    DRAFT_UPDATE: "下書きを整備"
  }[category];
  const copy = {
    CORE_HANDOFF_READY: "社員マスタ反映は別承認で実行します。",
    CANCELLED: "再開する場合は下書きへ戻して理由を残します。",
    OVERDUE_REVIEW: "基準日と不足情報を確認し、必要なら確認待ちへ進めます。",
    CHECKLIST_REVIEW: "4つの確認項目を完了すると確認済みに進められます。",
    COMPLETE_DRAFT: "直近の手続きです。対象者・基準日・メモを整えます。",
    DRAFT_UPDATE: "期限順で拾えるよう、対象者・基準日・メモを保存します。"
  }[category];
  const primaryAction = {
    CORE_HANDOFF_READY: "変更履歴",
    CANCELLED: "編集",
    OVERDUE_REVIEW: "編集",
    CHECKLIST_REVIEW: "確認項目",
    COMPLETE_DRAFT: "編集",
    DRAFT_UPDATE: "編集"
  }[category];
  const safetyBoundary = {
    CORE_HANDOFF_READY: "社員マスタ反映は別承認",
    CANCELLED: "再開時は理由を記録",
    OVERDUE_REVIEW: "この案件だけ保存",
    CHECKLIST_REVIEW: "4項目完了後に確認済み",
    COMPLETE_DRAFT: "確認待ちへ進める準備",
    DRAFT_UPDATE: "下書きの不足を補完"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    primaryAction,
    safetyBoundary,
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureCaseActionRoute(nextActionPlan) {
  const category = nextActionPlan?.category || "DRAFT_UPDATE";
  const routes = Object.freeze({
    CORE_HANDOFF_READY: Object.freeze({ action: "AUDIT", label: "変更履歴", emphasis: "Core反映前に履歴確認" }),
    CANCELLED: Object.freeze({ action: "EDIT", label: "編集", emphasis: "再開理由を記録" }),
    OVERDUE_REVIEW: Object.freeze({ action: "EDIT", label: "編集", emphasis: "期限超過を先に整備" }),
    CHECKLIST_REVIEW: Object.freeze({ action: "CHECKLIST", label: "確認項目", emphasis: "4項目を確認" }),
    COMPLETE_DRAFT: Object.freeze({ action: "EDIT", label: "編集", emphasis: "確認待ちへ準備" }),
    DRAFT_UPDATE: Object.freeze({ action: "EDIT", label: "編集", emphasis: "下書きを補完" })
  });
  const selected = routes[category] || routes.DRAFT_UPDATE;
  return Object.freeze({
    ...selected,
    category,
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureCaseActionRouteSteps(route) {
  const action = ["EDIT", "CHECKLIST", "AUDIT"].includes(route?.action) ? route.action : "EDIT";
  const labelsByAction = Object.freeze({
    EDIT: [
      "対象者・基準日・メモを先に整える",
      "確認待ちへ進める前に不足をなくす",
      "社員マスタへは反映しない"
    ],
    CHECKLIST: [
      "4つの確認項目を開く",
      "未完了だけを順に完了する",
      "全完了後に確認済みへ進める"
    ],
    AUDIT: [
      "変更履歴を確認する",
      "Core DB引き渡し候補だけを分ける",
      "社員マスタ更新は別承認まで止める"
    ]
  });
  return Object.freeze({
    action,
    category: route?.category || "DRAFT_UPDATE",
    steps: Object.freeze(labelsByAction[action].map((label, index) => Object.freeze({
      order: index + 1,
      category: `${action}_STEP_${index + 1}`,
      label
    }))),
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildWorkforceProcedureCaseBoundary(item) {
  const status = CASE_STATUSES.includes(item?.caseStatus) ? item.caseStatus : "DRAFT";
  const category = status === "CONFIRMED"
    ? "CORE_HANDOFF_SEPARATE_APPROVAL"
    : status === "CANCELLED"
      ? "CANCELLED_REOPEN_WITH_REASON"
      : status === "READY_FOR_REVIEW"
        ? "CHECKLIST_GATE"
        : "LOCAL_DRAFT_ONLY";
  const title = {
    CORE_HANDOFF_SEPARATE_APPROVAL: "Core反映は別承認",
    CANCELLED_REOPEN_WITH_REASON: "中止は理由を残して再開",
    CHECKLIST_GATE: "確認項目ゲート",
    LOCAL_DRAFT_ONLY: "下書きは案件履歴のみ"
  }[category];
  const copy = {
    CORE_HANDOFF_SEPARATE_APPROVAL: "確認済みでも社員マスタ・LINE履歴へはここから書き込みません。履歴を確認して別手続きへ渡します。",
    CANCELLED_REOPEN_WITH_REASON: "対応中キューから外れます。再開する場合は下書きへ戻し、理由をメモに残します。",
    CHECKLIST_GATE: "4項目がそろうまで確認済みにしません。Core反映は確認後も別承認です。",
    LOCAL_DRAFT_ONLY: "社員マスタは変更しません。対象者・基準日・メモを整えて確認待ちへ進めます。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildWorkforceProcedureCaseFormGuide(draft, referenceDate = localDateIso()) {
  const priority = classifyWorkforceProcedureCasePriority(draft, referenceDate);
  const status = draft?.caseStatus;
  const hasSubject = typeof draft?.subjectLabel === "string" && draft.subjectLabel.trim().length > 0;
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(String(draft?.effectiveDate || ""));
  const hasDetail = typeof draft?.detail === "string" && draft.detail.trim().length > 0;
  const category = status === "CONFIRMED"
    ? "CONFIRMED"
    : status === "CANCELLED"
      ? "CANCELLED"
      : priority === "OVERDUE"
        ? "OVERDUE"
        : priority === "NEXT_7_DAYS"
          ? "NEXT_7_DAYS"
          : status === "READY_FOR_REVIEW"
            ? "READY_FOR_REVIEW"
            : "DRAFT";
  const title = {
    OVERDUE: "期限超過です。確認項目と基準日を先に整えます",
    NEXT_7_DAYS: "7日以内の手続きです。確認待ちへ進める準備をします",
    READY_FOR_REVIEW: "確認待ちです。チェックリスト完了後に確認済みへ進めます",
    DRAFT: "下書きです。対象者・基準日・メモを補います",
    CONFIRMED: "確認済みです。変更時は履歴を確認してから更新します",
    CANCELLED: "中止案件です。再開する場合はメモで理由を残します"
  }[category];
  const copy = {
    OVERDUE: "社員マスタは変更せず、この案件だけを保存します。確認済みにする前に確認項目が必要です。",
    NEXT_7_DAYS: "不足情報を補ってから確認待ちにすると、日常キューで追いやすくなります。",
    READY_FOR_REVIEW: "保存前に確認項目を開き、すべて完了しているか確認してください。",
    DRAFT: "迷ったら下書きのまま保存できます。担当者が後で検索・期限順で拾えます。",
    CONFIRMED: "確認済みは監査履歴に残ります。取り消しや変更は理由をメモに残してください。",
    CANCELLED: "中止は対応中キューから外れます。誤って選んだ場合は下書きへ戻してください。"
  }[category];
  const requirements = Object.freeze([
    Object.freeze({ key: "SUBJECT", label: hasSubject ? "対象者: 入力済み" : "対象者: 必須", category: hasSubject ? "READY" : "MISSING_REQUIRED" }),
    Object.freeze({ key: "EFFECTIVE_DATE", label: hasDate ? "基準日: 入力済み" : "基準日: 必須", category: hasDate ? "READY" : "MISSING_REQUIRED" }),
    Object.freeze({ key: "DETAIL", label: hasDetail ? "メモ: 補足あり" : "メモ: 任意・理由があれば記録", category: hasDetail ? "READY" : "OPTIONAL" })
  ]);
  return Object.freeze({
    category,
    title,
    copy,
    requirements,
    requiredReady: hasSubject && hasDate,
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureFormSubmitReadiness(draft) {
  const guide = buildWorkforceProcedureCaseFormGuide(draft);
  const missingRequiredKeys = guide.requirements
    .filter((requirement) => requirement.category === "MISSING_REQUIRED")
    .map((requirement) => requirement.key);
  return Object.freeze({
    category: missingRequiredKeys.length === 0 ? "READY_TO_SUBMIT" : "MISSING_REQUIRED_FIELDS",
    canSubmit: missingRequiredKeys.length === 0,
    missingRequiredCount: missingRequiredKeys.length,
    missingRequiredKeys: Object.freeze(missingRequiredKeys),
    statusCategory: missingRequiredKeys.length === 0 ? "idle" : "invalid_request",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
}

export function buildWorkforceProcedureFormSavePreview(draft, currentStatus = "NEW") {
  const readiness = buildWorkforceProcedureFormSubmitReadiness(draft);
  const transition = buildWorkforceProcedureStatusTransitionPlan(currentStatus, draft?.caseStatus);
  const hasExistingCase = UUID.test(String(draft?.caseId || ""));
  const category = !readiness.canSubmit
    ? "MISSING_REQUIRED_FIELDS"
    : draft?.caseStatus === "CONFIRMED" && !hasExistingCase
      ? "CONFIRM_REQUIRES_EXISTING_CASE"
    : !transition.isAllowed
      ? "STATUS_TRANSITION_BLOCKED"
    : draft?.caseStatus === "CONFIRMED"
        ? "CHECKLIST_REQUIRED_BEFORE_CONFIRM"
        : "READY_TO_SAVE";
  const title = {
    MISSING_REQUIRED_FIELDS: "必須項目が不足しています",
    STATUS_TRANSITION_BLOCKED: "この進捗変更は保存前に止めます",
    CHECKLIST_REQUIRED_BEFORE_CONFIRM: "確認済みはチェックリスト確認後に保存します",
    CONFIRM_REQUIRES_EXISTING_CASE: "新規作成と同時に確認済みにはしません",
    READY_TO_SAVE: "この内容で案件履歴へ保存できます"
  }[category];
  const copy = {
    MISSING_REQUIRED_FIELDS: "対象者と基準日を入力すると保存できます。",
    STATUS_TRANSITION_BLOCKED: "許可された進捗だけを選び、飛び越しを防ぎます。",
    CHECKLIST_REQUIRED_BEFORE_CONFIRM: "保存時に4項目の完了を読み取り、未完了なら保存せず止めます。",
    CONFIRM_REQUIRES_EXISTING_CASE: "まず下書きまたは確認待ちで登録してから、確認項目を完了してください。",
    READY_TO_SAVE: "社員マスタは変更せず、この案件の履歴だけを更新します。"
  }[category];
  return Object.freeze({
    category,
    title,
    copy,
    canSubmit: category === "READY_TO_SAVE" || category === "CHECKLIST_REQUIRED_BEFORE_CONFIRM",
    requiresChecklistRead: category === "CHECKLIST_REQUIRED_BEFORE_CONFIRM",
    missingRequiredCount: readiness.missingRequiredCount,
    transitionCategory: transition.category,
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false
  });
}

export function buildWorkforceProcedureSaveFollowUpPlan(preview) {
  const category = preview?.category || "MISSING_REQUIRED_FIELDS";
  const plans = Object.freeze({
    MISSING_REQUIRED_FIELDS: Object.freeze({
      title: "Complete required fields before saving",
      copy: "The case should stay local until subject and effective date are ready.",
      steps: Object.freeze(["Fill the missing required fields.", "Keep the case out of Core handoff.", "Do not create an employee master update."])
    }),
    STATUS_TRANSITION_BLOCKED: Object.freeze({
      title: "Choose an allowed status transition",
      copy: "The form keeps workflow jumps blocked before any save request is sent.",
      steps: Object.freeze(["Return to an allowed status.", "Save the case history only after the status is valid.", "Review the checklist before confirming."])
    }),
    CONFIRM_REQUIRES_EXISTING_CASE: Object.freeze({
      title: "Save the draft before confirmation",
      copy: "New cases cannot become confirmed in the same local form action.",
      steps: Object.freeze(["Save as draft or ready for review first.", "Open checklist items.", "Confirm only after the case exists."])
    }),
    CHECKLIST_REQUIRED_BEFORE_CONFIRM: Object.freeze({
      title: "Open checklist before Core handoff",
      copy: "A confirmed case is only a handoff candidate; employee master updates still need separate approval.",
      steps: Object.freeze(["Read checklist completion.", "Confirm the audit trail.", "Keep Core DB handoff separate."])
    }),
    READY_TO_SAVE: Object.freeze({
      title: "Save and verify the case history",
      copy: "The next safe step is to check the saved case row and its audit trail.",
      steps: Object.freeze(["Save the case.", "Confirm it appears in the correct queue.", "Open history if the status or date changed."])
    })
  });
  const selected = plans[category] || plans.MISSING_REQUIRED_FIELDS;
  return Object.freeze({
    category,
    title: selected.title,
    copy: selected.copy,
    steps: selected.steps,
    rawValuesIncluded: false,
    employeeMasterMutation: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false
  });
}

export function buildWorkforceProcedureChecklistPlan(procedureType) {
  const normalized = PROCEDURE_TYPES.includes(procedureType) ? procedureType : "ONBOARDING";
  const steps = PROCEDURE_STEP_KEYS[normalized].map((stepKey, index) => Object.freeze({
    stepKey,
    order: index + 1,
    label: STEP_LABELS[stepKey]
  }));
  const title = {
    ONBOARDING: "入社手続きの確認項目",
    TRANSFER: "異動手続きの確認項目",
    LEAVE: "休職・復職手続きの確認項目",
    RETIREMENT: "退職手続きの確認項目"
  }[normalized];
  const copy = {
    ONBOARDING: "受け入れ準備からCore反映引き継ぎまでを確認します。",
    TRANSFER: "異動内容、関係者確認、承認、Core反映引き継ぎを順番に確認します。",
    LEAVE: "申請内容、必要手続き、復職予定、Core反映引き継ぎを整理します。",
    RETIREMENT: "退職日、書類、貸与物返却、Core反映引き継ぎを漏れなく確認します。"
  }[normalized];
  return Object.freeze({ procedureType: normalized, title, copy, steps: Object.freeze(steps) });
}

export function buildWorkforceProcedureStatusTransitionPlan(currentStatus, nextStatus = null) {
  const normalizedCurrent = CASE_STATUSES.includes(currentStatus) ? currentStatus : "NEW";
  const allowedStatuses = CASE_STATUS_TRANSITIONS[normalizedCurrent];
  const selectedNext = CASE_STATUSES.includes(nextStatus) ? nextStatus : allowedStatuses[0];
  const isAllowed = allowedStatuses.includes(selectedNext);
  const category = normalizedCurrent === "NEW"
    ? "NEW_CASE"
    : normalizedCurrent === "CONFIRMED"
      ? "CONFIRMED_LOCKED"
      : normalizedCurrent === "CANCELLED"
        ? "CANCELLED_REOPENABLE"
        : selectedNext === "CONFIRMED"
          ? "CONFIRM_REQUIRES_CHECKLIST"
          : isAllowed ? "ALLOWED" : "BLOCKED";
  const title = {
    NEW_CASE: "新規案件は下書き・確認待ち・中止で登録できます",
    CONFIRMED_LOCKED: "確認済み案件はこの画面では戻しません",
    CANCELLED_REOPENABLE: "中止案件は下書きへ戻して再開できます",
    CONFIRM_REQUIRES_CHECKLIST: "確認済みにする前に確認項目を完了します",
    ALLOWED: "この進捗変更は保存できます",
    BLOCKED: "この進捗変更は保存前に止めます"
  }[category];
  const copy = {
    NEW_CASE: "社員マスタへは反映せず、案件管理として登録します。",
    CONFIRMED_LOCKED: "確認済みからの差戻しや中止は、別の承認済み訂正手続きで扱います。",
    CANCELLED_REOPENABLE: "再開する場合は下書きに戻し、メモへ理由を残してください。",
    CONFIRM_REQUIRES_CHECKLIST: "保存時に4つの確認項目が完了しているか確認します。",
    ALLOWED: "この保存は案件履歴に残り、Core DB正本は変更しません。",
    BLOCKED: "状態の飛び越しを避けるため、許可された進捗だけ選んでください。"
  }[category];
  return Object.freeze({
    currentStatus: normalizedCurrent,
    nextStatus: selectedNext,
    isAllowed,
    allowedStatuses: Object.freeze([...allowedStatuses]),
    category,
    title,
    copy
  });
}

export function buildWorkforceProcedureStatusMessage(category) {
  const messages = {
    idle: "手続き案件を読み込むと、下書き・確認・中止の履歴を管理できます。社員マスタはここでは変更しません。",
    loading: "手続き案件を読み込んでいます。",
    loaded: "手続き案件を表示しました。編集は案件履歴に記録されます。",
    saved: "手続き案件を保存しました。社員マスタへの反映は別の承認済み手続きで行います。",
    feature_disabled: "手続き案件の編集機能は未接続です。画面確認と導線確認はできますが、保存はまだ行えません。",
    auth_required: "認証を確認できません。ログイン状態を確認してから、保存や履歴表示をやり直してください。",
    write_forbidden: "このアカウントでは手続き案件の編集権限を確認できません。閲覧できる範囲で確認し、権限付与後に保存してください。",
    not_ready: "手続き案件APIは準備中です。入力内容は画面で確認できますが、保存は有効化後に行ってください。",
    invalid_request: "入力内容を確認してください。対象者・基準日・進捗は必須です。",
    checklist_incomplete: "確認済みにする前に、案件の確認項目をすべて完了してください。",
    invalid_status_transition: "この進捗変更は保存できません。許可された進め方を確認してください。",
    invalid_response: "手続き案件の応答を確認できませんでした。値は表示せず、安全に停止しました。",
    request_failed: "手続き案件を保存できませんでした。再読み込み後、重複保存に注意して確認してください。",
    busy: "処理中です。完了するまで次の操作を待ってください。"
  };
  return messages[category] || messages.request_failed;
}

function normalizeSteps(value) {
  if (!exactKeys(value, ["procedureType", "steps"]) || !PROCEDURE_TYPES.includes(value.procedureType)
    || !Array.isArray(value.steps) || value.steps.length !== 4) return null;
  const keys = PROCEDURE_STEP_KEYS[value.procedureType];
  const steps = [];
  for (const row of value.steps) {
    if (!exactKeys(row, ["stepKey", "isCompleted", "version", "updatedAt"])
      || !keys.includes(row.stepKey) || typeof row.isCompleted !== "boolean"
      || !Number.isInteger(row.version) || row.version < 0
      || !(row.updatedAt === null || (typeof row.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}T/.test(row.updatedAt)))) return null;
    steps.push(Object.freeze({ ...row }));
  }
  if (new Set(steps.map((step) => step.stepKey)).size !== steps.length) return null;
  if (!keys.every((stepKey) => steps.some((step) => step.stepKey === stepKey))) return null;
  return Object.freeze({ procedureType: value.procedureType, steps: Object.freeze(steps) });
}

function normalizeStepSaveResult(value) {
  if (!exactKeys(value, ["caseId", "stepKey", "stepVersion", "operation"])
    || !UUID.test(value.caseId) || !Object.hasOwn(STEP_LABELS, value.stepKey)
    || !Number.isInteger(value.stepVersion) || value.stepVersion < 1
    || !["COMPLETE", "REOPEN"].includes(value.operation)) return null;
  return Object.freeze({ ...value });
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
    },
    async loadSteps(caseId) {
      if (!UUID.test(caseId)) return safeResult(false, "invalid_request");
      const result = await request("GET", null, `${STEPS_PATH}?caseId=${encodeURIComponent(caseId)}`);
      const steps = result.ok ? normalizeSteps(result.data) : null;
      return steps ? safeResult(true, "loaded", result.requestCount, steps) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
    },
    async saveStep(draft) {
      if (!isRecord(draft) || !exactKeys(draft, ["caseId", "stepKey", "completed", "expectedVersion"])
        || !UUID.test(draft.caseId) || !Object.hasOwn(STEP_LABELS, draft.stepKey)
        || typeof draft.completed !== "boolean" || !Number.isInteger(draft.expectedVersion) || draft.expectedVersion < 0) return safeResult(false, "invalid_request");
      const result = await request("POST", draft, STEPS_PATH);
      const saved = result.ok ? normalizeStepSaveResult(result.data) : null;
      return saved ? safeResult(true, "saved", result.requestCount, saved) : safeResult(false, result.ok ? "invalid_response" : result.category, result.requestCount);
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
  const steps = documentObject?.getElementById?.("workforce-case-steps");
  const stepsList = documentObject?.getElementById?.("workforce-case-steps-list");
  const stepsStatus = documentObject?.getElementById?.("workforce-case-steps-status");
  const filterStatus = documentObject?.getElementById?.("workforce-case-filter-status");
  const priorityStatus = documentObject?.getElementById?.("workforce-case-priority-status");
  const operationSummary = documentObject?.getElementById?.("workforce-case-operation-summary");
  const operationFilterButtons = Array.from(documentObject?.querySelectorAll?.("[data-workforce-operation-filter]") || []);
  const operationActionMix = documentObject?.getElementById?.("workforce-case-operation-action-mix");
  const operationActionMixTitle = documentObject?.getElementById?.("workforce-case-operation-action-mix-title");
  const operationActionMixCopy = documentObject?.getElementById?.("workforce-case-operation-action-mix-copy");
  const operationStartGuide = documentObject?.getElementById?.("workforce-case-operation-start-guide");
  const operationStartTitle = documentObject?.getElementById?.("workforce-case-operation-start-title");
  const operationStartCopy = documentObject?.getElementById?.("workforce-case-operation-start-copy");
  const operationStartReason = documentObject?.getElementById?.("workforce-case-operation-start-reason");
  const operationStartButton = documentObject?.getElementById?.("workforce-case-operation-start-button");
  const coreHandoffQueue = documentObject?.getElementById?.("workforce-case-core-handoff-queue");
  const coreHandoffTitle = documentObject?.getElementById?.("workforce-case-core-handoff-title");
  const coreHandoffCopy = documentObject?.getElementById?.("workforce-case-core-handoff-copy");
  const coreHandoffSteps = documentObject?.getElementById?.("workforce-case-core-handoff-steps");
  const coreHandoffReadback = documentObject?.getElementById?.("workforce-case-core-handoff-readback");
  const coreHandoffReadbackTitle = documentObject?.getElementById?.("workforce-case-core-handoff-readback-title");
  const coreHandoffReadbackCopy = documentObject?.getElementById?.("workforce-case-core-handoff-readback-copy");
  const coreHandoffReadbackSteps = documentObject?.getElementById?.("workforce-case-core-handoff-readback-steps");
  const operationSteps = documentObject?.getElementById?.("workforce-case-operation-steps");
  const procedureFilter = documentObject?.getElementById?.("workforce-case-procedure-filter");
  const searchInput = documentObject?.getElementById?.("workforce-case-search");
  const filterResetButton = documentObject?.getElementById?.("workforce-case-filter-reset");
  const formGuide = documentObject?.getElementById?.("workforce-case-form-guide");
  const formGuideTitle = documentObject?.getElementById?.("workforce-case-form-guide-title");
  const formGuideCopy = documentObject?.getElementById?.("workforce-case-form-guide-copy");
  const checklistPlan = documentObject?.getElementById?.("workforce-case-checklist-plan");
  const checklistPlanTitle = documentObject?.getElementById?.("workforce-case-checklist-plan-title");
  const checklistPlanCopy = documentObject?.getElementById?.("workforce-case-checklist-plan-copy");
  const checklistPlanList = documentObject?.getElementById?.("workforce-case-checklist-plan-list");
  const savePreview = documentObject?.getElementById?.("workforce-case-save-preview");
  const savePreviewTitle = documentObject?.getElementById?.("workforce-case-save-preview-title");
  const savePreviewCopy = documentObject?.getElementById?.("workforce-case-save-preview-copy");
  const saveFollowUp = documentObject?.getElementById?.("workforce-case-save-follow-up");
  const saveFollowUpTitle = documentObject?.getElementById?.("workforce-case-save-follow-up-title");
  const saveFollowUpCopy = documentObject?.getElementById?.("workforce-case-save-follow-up-copy");
  const saveFollowUpSteps = documentObject?.getElementById?.("workforce-case-save-follow-up-steps");
  const transitionPlan = documentObject?.getElementById?.("workforce-case-transition-plan");
  const transitionPlanTitle = documentObject?.getElementById?.("workforce-case-transition-plan-title");
  const transitionPlanCopy = documentObject?.getElementById?.("workforce-case-transition-plan-copy");
  const transitionPlanList = documentObject?.getElementById?.("workforce-case-transition-plan-list");
  if (!desk || !list || !form || !status || !audit || !auditList || !auditStatus || !steps || !stepsList || !stepsStatus || !filterStatus || !priorityStatus || !operationSummary || !operationActionMix || !operationActionMixTitle || !operationActionMixCopy || !operationStartGuide || !operationStartTitle || !operationStartCopy || !operationStartReason || !operationStartButton || !coreHandoffQueue || !coreHandoffTitle || !coreHandoffCopy || !coreHandoffSteps || !coreHandoffReadback || !coreHandoffReadbackTitle || !coreHandoffReadbackCopy || !coreHandoffReadbackSteps || !procedureFilter || !searchInput || !filterResetButton || !formGuide || !formGuideTitle || !formGuideCopy || !checklistPlan || !checklistPlanTitle || !checklistPlanCopy || !checklistPlanList || !savePreview || !savePreviewTitle || !savePreviewCopy || !saveFollowUp || !saveFollowUpTitle || !saveFollowUpCopy || !saveFollowUpSteps || !transitionPlan || !transitionPlanTitle || !transitionPlanCopy || !transitionPlanList) return Object.freeze({ initialized: false, load: async () => safeResult(false, "not_ready") });
  if (desk.dataset.bound === "true") return Object.freeze({ initialized: true, duplicateBindingPrevented: true, load: async () => safeResult(false, "already_bound") });
  desk.dataset.bound = "true";
  const controller = createWorkforceProcedureCaseController({ globalObject, fetchImpl });
  let cases = [];
  let activeFilter = "ALL";
  let activeProcedureType = getActiveWorkforceProcedureType(documentObject);
  let activePriority = "ALL";
  let activeSearch = "";
  procedureFilter.value = activeProcedureType;

  const updateStatusFilterButtons = () => {
    for (const button of desk.querySelectorAll("[data-case-status-filter]")) {
      const selected = button.dataset.caseStatusFilter === activeFilter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  };
  const updatePriorityFilterButtons = () => {
    for (const button of desk.querySelectorAll("[data-case-priority-filter]")) {
      const selected = button.dataset.casePriorityFilter === activePriority;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  };
  const hasActiveFilters = () => activeFilter !== "ALL" || activePriority !== "ALL" || activeSearch !== "" || activeProcedureType !== getActiveWorkforceProcedureType(documentObject);
  const updateFilterResetButton = () => {
    const active = hasActiveFilters();
    filterResetButton.disabled = !active;
    filterResetButton.setAttribute("aria-disabled", String(!active));
  };

  const setStatus = (category) => {
    status.dataset.category = category;
    status.textContent = buildWorkforceProcedureStatusMessage(category);
  };
  const input = (name) => form.elements.namedItem(name);
  const currentDraftFromForm = () => Object.freeze({
    caseStatus: input("caseStatus")?.value,
    subjectLabel: input("subjectLabel")?.value,
    effectiveDate: input("effectiveDate")?.value,
    detail: input("detail")?.value
  });
  const renderFormGuide = () => {
    const guide = buildWorkforceProcedureCaseFormGuide(currentDraftFromForm());
    formGuide.dataset.category = guide.category;
    formGuide.dataset.requiredReady = String(guide.requiredReady);
    formGuideTitle.textContent = guide.title;
    formGuideCopy.textContent = guide.copy;
    const list = documentObject.getElementById("workforce-case-form-guide-list");
    list?.replaceChildren(...guide.requirements.map((requirement) => {
      const item = documentObject.createElement("li");
      item.dataset.category = requirement.category;
      item.textContent = requirement.label;
      return item;
    }));
  };
  const markFormInvalid = () => {
    renderFormGuide();
    renderSavePreview();
    setStatus("invalid_request");
  };
  const renderChecklistPlan = () => {
    const plan = buildWorkforceProcedureChecklistPlan(input("procedureType")?.value);
    checklistPlan.dataset.procedureType = plan.procedureType;
    checklistPlanTitle.textContent = plan.title;
    checklistPlanCopy.textContent = plan.copy;
    checklistPlanList.replaceChildren(...plan.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
  };
  const renderTransitionPlan = () => {
    const plan = buildWorkforceProcedureStatusTransitionPlan(form.dataset.currentStatus, input("caseStatus")?.value);
    transitionPlan.dataset.category = plan.category;
    transitionPlanTitle.textContent = plan.title;
    transitionPlanCopy.textContent = plan.copy;
    transitionPlanList.replaceChildren(...plan.allowedStatuses.map((caseStatus) => {
      const item = documentObject.createElement("li");
      item.textContent = statusLabel(caseStatus);
      if (caseStatus === plan.nextStatus) item.dataset.selected = "true";
      return item;
    }));
    const statusInput = input("caseStatus");
    if (statusInput?.options) {
      for (const option of statusInput.options) {
        option.disabled = !plan.allowedStatuses.includes(option.value);
      }
    }
  };
  const renderSavePreview = () => {
    const preview = buildWorkforceProcedureFormSavePreview({
      ...currentDraftFromForm(),
      caseId: input("caseId")?.value || null
    }, form.dataset.currentStatus);
    savePreview.dataset.category = preview.category;
    savePreviewTitle.textContent = preview.title;
    savePreviewCopy.textContent = preview.copy;
    savePreview.dataset.canSubmit = String(preview.canSubmit);
    savePreview.dataset.requiresChecklistRead = String(preview.requiresChecklistRead);
    const followUp = buildWorkforceProcedureSaveFollowUpPlan(preview);
    saveFollowUp.dataset.category = followUp.category;
    saveFollowUpTitle.textContent = followUp.title;
    saveFollowUpCopy.textContent = followUp.copy;
    saveFollowUpSteps.replaceChildren(...followUp.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.textContent = step;
      return item;
    }));
  };
  const reset = () => {
    form.reset();
    input("caseId").value = "";
    input("expectedVersion").value = "0";
    form.dataset.currentStatus = "NEW";
    form.hidden = true;
  };
  const clearAudit = () => {
    audit.hidden = true;
    auditList.replaceChildren();
    auditStatus.textContent = "";
  };
  const clearSteps = () => {
    steps.hidden = true;
    stepsList.replaceChildren();
    stepsStatus.textContent = "";
  };
  const setFilter = (nextFilter) => {
    activeFilter = CASE_FILTERS.includes(nextFilter) ? nextFilter : "ALL";
    updateStatusFilterButtons();
    updateFilterResetButton();
    render();
  };
  const setProcedureType = (nextProcedureType) => {
    activeProcedureType = ["ALL", ...PROCEDURE_TYPES].includes(nextProcedureType) ? nextProcedureType : "ALL";
    procedureFilter.value = activeProcedureType;
    updateFilterResetButton();
    render();
  };
  const openProcedureTypeQueue = (nextProcedureType) => {
    const procedureType = PROCEDURE_TYPES.includes(nextProcedureType) ? nextProcedureType : "ALL";
    const summary = buildWorkforceProcedureTypeSummary(cases)[procedureType];
    const plan = buildWorkforceProcedureTypeQueueFilter(summary);
    activeProcedureType = procedureType;
    activeFilter = plan.status;
    activePriority = plan.priority;
    procedureFilter.value = activeProcedureType;
    updateStatusFilterButtons();
    updatePriorityFilterButtons();
    updateFilterResetButton();
    render();
  };
  const setPriorityFilter = (nextPriority) => {
    activePriority = PRIORITY_FILTERS.includes(nextPriority) ? nextPriority : "ALL";
    updatePriorityFilterButtons();
    updateFilterResetButton();
    render();
  };
  const setSearch = (nextSearch) => {
    activeSearch = normalizeWorkforceProcedureCaseSearch(nextSearch);
    updateFilterResetButton();
    render();
  };
  const resetFilters = () => {
    activeFilter = "ALL";
    activePriority = "ALL";
    activeSearch = "";
    activeProcedureType = getActiveWorkforceProcedureType(documentObject);
    procedureFilter.value = activeProcedureType;
    searchInput.value = "";
    updateStatusFilterButtons();
    updatePriorityFilterButtons();
    updateFilterResetButton();
    render();
  };
  const renderOperationSummary = (summary) => {
    const set = (id, value) => {
      const element = documentObject.getElementById(id);
      if (element) element.textContent = String(value);
    };
    operationSummary.dataset.nextAction = summary.nextAction;
    set("workforce-case-operation-title", summary.title);
    set("workforce-case-operation-copy", summary.copy);
    set("workforce-case-operation-overdue", summary.overdue);
    set("workforce-case-operation-soon", summary.soon);
    set("workforce-case-operation-review", summary.review);
    set("workforce-case-operation-draft", summary.draft);
    const startGuide = buildWorkforceProcedureOperationStartGuide(summary);
    operationStartGuide.dataset.category = startGuide.category;
    operationStartGuide.dataset.filterStatus = startGuide.filterStatus;
    operationStartGuide.dataset.filterPriority = startGuide.filterPriority;
    operationStartTitle.textContent = startGuide.title;
    operationStartCopy.textContent = startGuide.copy;
    operationStartReason.textContent = startGuide.reason;
    operationStartButton.textContent = startGuide.buttonLabel;
    operationSteps?.replaceChildren(...buildWorkforceProcedureOperationSteps(summary).steps.map((step) => {
      const item = documentObject.createElement("li");
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
    for (const button of operationFilterButtons) {
      const plan = buildWorkforceProcedureOperationFilter(button.dataset.workforceOperationFilter);
      const selected = activeFilter === plan.status && activePriority === plan.priority;
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = false;
      button.setAttribute("aria-label", plan.label);
    }
  };
  const renderOperationActionMix = (visibleCases) => {
    const mix = buildWorkforceProcedureActionMix(visibleCases);
    operationActionMix.dataset.nextAction = mix.nextAction;
    operationActionMixTitle.textContent = mix.title;
    operationActionMixCopy.textContent = mix.copy;
    const set = (id, value) => {
      const element = documentObject.getElementById(id);
      if (element) element.textContent = String(value);
    };
    set("workforce-case-operation-action-edit", mix.edit);
    set("workforce-case-operation-action-checklist", mix.checklist);
    set("workforce-case-operation-action-audit", mix.audit);
  };
  const renderCoreHandoffQueue = (visibleCases) => {
    const queue = buildWorkforceProcedureCoreHandoffQueue(visibleCases);
    coreHandoffQueue.dataset.category = queue.category;
    coreHandoffTitle.textContent = queue.title;
    coreHandoffCopy.textContent = queue.copy;
    const set = (id, value) => {
      const element = documentObject.getElementById(id);
      if (element) element.textContent = String(value);
    };
    set("workforce-case-core-handoff-ready", queue.handoffReady);
    set("workforce-case-core-handoff-progress", queue.localInProgress);
    set("workforce-case-core-handoff-cancelled", queue.cancelled);
    const stepPlan = buildWorkforceProcedureCoreHandoffSteps(queue);
    coreHandoffSteps.dataset.category = stepPlan.category;
    coreHandoffSteps.replaceChildren(...stepPlan.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
    const readback = buildWorkforceProcedureCoreHandoffReadback(queue);
    coreHandoffReadback.dataset.category = readback.category;
    coreHandoffReadbackTitle.textContent = readback.title;
    coreHandoffReadbackCopy.textContent = readback.copy;
    coreHandoffReadbackSteps.replaceChildren(...readback.steps.map((step) => {
      const item = documentObject.createElement("li");
      item.dataset.category = step.category;
      item.textContent = `${step.order}. ${step.label}`;
      return item;
    }));
  };
  const renderTypeSummary = (summary) => {
    for (const procedureType of PROCEDURE_TYPES) {
      const row = summary[procedureType];
      const key = procedureType.toLowerCase();
      const card = documentObject.getElementById(`workforce-case-type-${key}`);
      if (!card || !row) continue;
      card.dataset.nextCategory = row.nextCategory;
      card.setAttribute("aria-pressed", String(activeProcedureType === procedureType));
      for (const [suffix, value] of Object.entries({ open: row.open, overdue: row.overdue, review: row.review })) {
        const element = documentObject.getElementById(`workforce-case-type-${key}-${suffix}`);
        if (element) element.textContent = String(value);
      }
    }
  };
  const renderOverview = (filteredCount = null) => {
    const scopedCases = filterWorkforceProcedureCasesByType(cases, activeProcedureType);
    const counts = Object.fromEntries(CASE_FILTERS.map((key) => [key, filterWorkforceProcedureCases(scopedCases, key).length]));
    const countIds = { ALL: "workforce-case-count-all", OPEN: "workforce-case-count-open", DRAFT: "workforce-case-count-draft", READY_FOR_REVIEW: "workforce-case-count-review", CONFIRMED: "workforce-case-count-confirmed", CANCELLED: "workforce-case-count-cancelled" };
    for (const [key, id] of Object.entries(countIds)) {
      const element = documentObject.getElementById(id);
      if (element) element.textContent = String(counts[key]);
    }
    const visibleCount = Number.isInteger(filteredCount) ? filteredCount : counts[activeFilter];
    const procedureScope = activeProcedureType === "ALL" ? "すべての手続き" : procedureLabel(activeProcedureType);
    const priorityScope = activePriority === "ALL" ? "" : ` / ${priorityLabel(activePriority)}`;
    filterStatus.textContent = activeFilter === "ALL" ? `${procedureScope}${priorityScope}の案件 ${visibleCount}件を表示しています。` : `${procedureScope} / ${statusLabel(activeFilter)}${priorityScope} ${visibleCount}件を表示しています。`;
    const overdue = scopedCases.filter((item) => classifyWorkforceProcedureCasePriority(item) === "OVERDUE").length;
    const soon = scopedCases.filter((item) => classifyWorkforceProcedureCasePriority(item) === "NEXT_7_DAYS").length;
    renderOperationSummary(buildWorkforceProcedureOperationSummary(scopedCases));
    renderTypeSummary(buildWorkforceProcedureTypeSummary(cases));
    priorityStatus.textContent = overdue > 0 ? `期限を過ぎた案件 ${overdue}件、直近7日の案件 ${soon}件があります。` : soon > 0 ? `直近7日の案件が ${soon}件あります。` : "期限超過・直近7日の案件はありません。";
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
    const summary = buildWorkforceProcedureAuditSummary(result.data);
    auditStatus.dataset.category = summary.category;
    auditStatus.textContent = `${summary.title}。${summary.copy}（更新 ${summary.updateCount}件 / 項目 ${summary.changedFieldCount}種類）`;
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
  const showSteps = async (item) => {
    steps.hidden = false;
    stepsStatus.textContent = "確認項目を読み込んでいます。";
    stepsList.replaceChildren();
    const result = await controller.loadSteps(item.caseId);
    if (!result.ok) {
      stepsStatus.textContent = "確認項目を表示できませんでした。";
      return;
    }
    const completed = result.data.steps.filter((step) => step.isCompleted).length;
    const readiness = buildWorkforceProcedureConfirmationReadiness(result.data.steps);
    const progress = buildWorkforceProcedureStepProgress(result.data.steps);
    stepsStatus.dataset.category = readiness.category;
    stepsStatus.dataset.progressCategory = progress.category;
    stepsStatus.textContent = `${procedureLabel(result.data.procedureType)}の確認項目 ${completed} / ${result.data.steps.length} 件が完了しています。${readiness.title}。次: ${progress.nextStepLabel}。${readiness.copy}`;
    const fragment = documentObject.createDocumentFragment();
    for (const [index, step] of result.data.steps.entries()) {
      const label = documentObject.createElement("label");
      label.className = `procedure-case-step${step.isCompleted ? " is-completed" : ""}`;
      const checkbox = documentObject.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = step.isCompleted;
      const order = documentObject.createElement("b");
      order.textContent = String(index + 1).padStart(2, "0");
      const text = documentObject.createElement("span");
      text.textContent = STEP_LABELS[step.stepKey];
      const state = documentObject.createElement("em");
      state.textContent = step.isCompleted ? "完了" : "未完了";
      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        const saved = await controller.saveStep({ caseId: item.caseId, stepKey: step.stepKey, completed: checkbox.checked, expectedVersion: step.version });
        if (saved.ok) {
          await showSteps(item);
        } else {
          checkbox.checked = step.isCompleted;
          checkbox.disabled = false;
          stepsStatus.textContent = "確認項目を更新できませんでした。画面を再読み込みして状態を確認してください。";
        }
      });
      label.append(checkbox, order, text, state);
      fragment.append(label);
    }
    stepsList.append(fragment);
    steps.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  };
  const render = () => {
    list.replaceChildren();
    const visibleCases = sortWorkforceProcedureCases(filterWorkforceProcedureCasesByQuery(filterWorkforceProcedureCasesByPriority(
      filterWorkforceProcedureCases(filterWorkforceProcedureCasesByType(cases, activeProcedureType), activeFilter),
      activePriority
    ), activeSearch));
    renderOverview(visibleCases.length);
    renderOperationActionMix(visibleCases);
    renderCoreHandoffQueue(visibleCases);
    if (visibleCases.length === 0) {
      const emptyState = buildWorkforceProcedureEmptyState({
        total: cases.length,
        hasActiveFilters: hasActiveFilters(),
        activeProcedureType
      });
      const empty = documentObject.createElement("section");
      empty.className = "procedure-case-empty";
      empty.dataset.category = emptyState.category;
      const body = documentObject.createElement("div");
      const title = documentObject.createElement("strong");
      const copy = documentObject.createElement("span");
      title.textContent = emptyState.title;
      copy.textContent = emptyState.copy;
      body.append(title, copy);
      empty.append(body);
      if (emptyState.canReset) {
        const resetButton = documentObject.createElement("button");
        resetButton.type = "button";
        resetButton.className = "case-edit-button procedure-case-empty-reset";
        resetButton.textContent = emptyState.action;
        resetButton.addEventListener("click", resetFilters);
        empty.append(resetButton);
      } else if (emptyState.category === "NO_CASES") {
        const newButton = documentObject.createElement("button");
        newButton.type = "button";
        newButton.className = "case-edit-button procedure-case-empty-new";
        newButton.textContent = emptyState.action;
        newButton.addEventListener("click", () => {
          reset();
          input("procedureType").value = PROCEDURE_TYPES.includes(activeProcedureType) ? activeProcedureType : getActiveWorkforceProcedureType(documentObject);
          form.dataset.currentStatus = "NEW";
          renderFormGuide();
          renderChecklistPlan();
          renderTransitionPlan();
          renderSavePreview();
          form.hidden = false;
          form.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
        });
        empty.append(newButton);
      }
      list.append(empty);
      return;
    }
    const fragment = documentObject.createDocumentFragment();
    for (const item of visibleCases) {
      const row = documentObject.createElement("article");
      row.className = "procedure-case-row";
      const copy = documentObject.createElement("div");
      const title = documentObject.createElement("strong");
      const meta = documentObject.createElement("span");
      const priority = documentObject.createElement("span");
      const nextAction = documentObject.createElement("div");
      const priorityCategory = classifyWorkforceProcedureCasePriority(item);
      const nextActionPlan = buildWorkforceProcedureCaseNextAction(item);
      const actionRoute = buildWorkforceProcedureCaseActionRoute(nextActionPlan);
      const boundary = buildWorkforceProcedureCaseBoundary(item);
      title.textContent = item.subjectLabel;
      meta.textContent = `${procedureLabel(item.procedureType)} / ${statusLabel(item.caseStatus)} / ${item.effectiveDate}`;
      priority.className = `procedure-case-priority${priorityCategory === "OVERDUE" ? " is-overdue" : priorityCategory === "NEXT_7_DAYS" ? " is-soon" : ""}`;
      priority.textContent = priorityLabel(priorityCategory);
      nextAction.className = "procedure-case-next-action";
      nextAction.dataset.category = nextActionPlan.category;
      const nextTitle = documentObject.createElement("strong");
      const nextCopy = documentObject.createElement("span");
      const nextChips = documentObject.createElement("span");
      const primaryChip = documentObject.createElement("b");
      const boundaryChip = documentObject.createElement("b");
      const routeSteps = buildWorkforceProcedureCaseActionRouteSteps(actionRoute);
      const routeStepList = documentObject.createElement("ol");
      nextTitle.textContent = nextActionPlan.title;
      nextCopy.textContent = nextActionPlan.copy;
      nextChips.className = "procedure-case-next-action-chips";
      primaryChip.textContent = `次: ${nextActionPlan.primaryAction}`;
      boundaryChip.textContent = nextActionPlan.safetyBoundary;
      nextChips.append(primaryChip, boundaryChip);
      routeStepList.className = "procedure-case-row-action-steps";
      routeStepList.dataset.action = routeSteps.action;
      routeStepList.replaceChildren(...routeSteps.steps.map((step) => {
        const item = documentObject.createElement("li");
        item.dataset.category = step.category;
        item.textContent = `${step.order}. ${step.label}`;
        return item;
      }));
      nextAction.append(nextTitle, nextCopy, nextChips, routeStepList);
      const boundaryNote = documentObject.createElement("div");
      boundaryNote.className = "procedure-case-boundary-note";
      boundaryNote.dataset.category = boundary.category;
      const boundaryTitle = documentObject.createElement("strong");
      const boundaryCopy = documentObject.createElement("span");
      boundaryTitle.textContent = boundary.title;
      boundaryCopy.textContent = boundary.copy;
      boundaryNote.append(boundaryTitle, boundaryCopy);
      copy.append(title, meta, priority, nextAction, boundaryNote);
      const edit = documentObject.createElement("button");
      edit.type = "button";
      edit.className = "case-edit-button";
      edit.dataset.caseRowAction = "EDIT";
      edit.textContent = "編集";
      edit.addEventListener("click", () => {
        input("caseId").value = item.caseId;
        input("expectedVersion").value = String(item.version);
        input("procedureType").value = item.procedureType;
        input("caseStatus").value = item.caseStatus;
        form.dataset.currentStatus = item.caseStatus;
        input("subjectLabel").value = item.subjectLabel;
        input("effectiveDate").value = item.effectiveDate;
        input("detail").value = item.detail || "";
        renderFormGuide();
        renderChecklistPlan();
        renderTransitionPlan();
        renderSavePreview();
        form.hidden = false;
        form.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      });
      const actions = documentObject.createElement("div");
      actions.className = "procedure-case-actions-inline";
      const history = documentObject.createElement("button");
      history.type = "button";
      history.className = "case-edit-button";
      history.dataset.caseRowAction = "AUDIT";
      history.textContent = "変更履歴";
      history.addEventListener("click", () => showAudit(item));
      const checklist = documentObject.createElement("button");
      checklist.type = "button";
      checklist.className = "case-edit-button";
      checklist.dataset.caseRowAction = "CHECKLIST";
      checklist.textContent = "確認項目";
      checklist.addEventListener("click", () => showSteps(item));
      for (const button of [checklist, history, edit]) {
        const recommended = button.dataset.caseRowAction === actionRoute.action;
        button.dataset.recommended = recommended ? "true" : "false";
        if (recommended) button.setAttribute("aria-label", `おすすめ: ${actionRoute.emphasis}`);
      }
      actions.append(checklist, history, edit);
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

  const openNewCase = (prefill = {}) => {
    reset();
    const normalized = normalizeWorkforceProcedureCasePrefill(prefill, documentObject);
    input("procedureType").value = normalized.procedureType;
    form.dataset.currentStatus = "NEW";
    input("caseStatus").value = "DRAFT";
    input("subjectLabel").value = normalized.subjectLabel;
    input("effectiveDate").value = normalized.effectiveDate;
    input("detail").value = normalized.detail;
    renderFormGuide();
    renderChecklistPlan();
    renderTransitionPlan();
    renderSavePreview();
    form.hidden = false;
    input("subjectLabel")?.focus?.();
  };
  documentObject.getElementById("workforce-case-new")?.addEventListener("click", () => openNewCase());
  for (const button of documentObject.querySelectorAll?.("[data-procedure-new]") || []) {
    button.addEventListener("click", () => openNewCase({ procedureType: String(button.dataset.procedureNew || "") }));
  }
  documentObject.addEventListener?.("nov-talent:open-procedure-case", (event) => {
    openNewCase(event?.detail);
    form.scrollIntoView?.({ behavior: "smooth", block: "start" });
  });
  documentObject.getElementById("workforce-case-cancel")?.addEventListener("click", reset);
  documentObject.getElementById("workforce-case-audit-close")?.addEventListener("click", clearAudit);
  documentObject.getElementById("workforce-case-steps-close")?.addEventListener("click", clearSteps);
  for (const button of desk.querySelectorAll("[data-case-status-filter]")) {
    button.addEventListener("click", () => setFilter(button.dataset.caseStatusFilter));
  }
  for (const button of desk.querySelectorAll("[data-case-priority-filter]")) {
    button.addEventListener("click", () => setPriorityFilter(button.dataset.casePriorityFilter));
  }
  for (const button of operationFilterButtons) {
    button.addEventListener("click", () => {
      const plan = buildWorkforceProcedureOperationFilter(button.dataset.workforceOperationFilter);
      activeFilter = plan.status;
      activePriority = plan.priority;
      updateStatusFilterButtons();
      updatePriorityFilterButtons();
      updateFilterResetButton();
      render();
    });
  }
  operationStartButton.addEventListener("click", () => {
    activeFilter = operationStartGuide.dataset.filterStatus || "ALL";
    activePriority = operationStartGuide.dataset.filterPriority || "ALL";
    updateStatusFilterButtons();
    updatePriorityFilterButtons();
    updateFilterResetButton();
    render();
  });
  for (const button of desk.querySelectorAll("[data-procedure-type-summary]")) {
    button.addEventListener("click", () => openProcedureTypeQueue(button.dataset.procedureTypeSummary));
  }
  procedureFilter.addEventListener("change", () => setProcedureType(procedureFilter.value));
  searchInput.addEventListener("input", () => setSearch(searchInput.value));
  filterResetButton.addEventListener("click", resetFilters);
  input("caseStatus").addEventListener("change", () => {
    renderFormGuide();
    renderTransitionPlan();
    renderSavePreview();
  });
  input("subjectLabel").addEventListener("input", () => { renderFormGuide(); renderSavePreview(); });
  input("effectiveDate").addEventListener("change", () => { renderFormGuide(); renderSavePreview(); });
  input("detail").addEventListener("input", () => { renderFormGuide(); renderSavePreview(); });
  input("procedureType").addEventListener("change", () => { renderChecklistPlan(); renderSavePreview(); });
  form.addEventListener("invalid", markFormInvalid, true);
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
    const readiness = buildWorkforceProcedureFormSubmitReadiness(draft);
    if (!readiness.canSubmit) {
      setStatus(readiness.statusCategory);
      renderFormGuide();
      renderSavePreview();
      return;
    }
    const transition = buildWorkforceProcedureStatusTransitionPlan(form.dataset.currentStatus, draft.caseStatus);
    if (!transition.isAllowed) {
      setStatus("invalid_status_transition");
      renderTransitionPlan();
      renderSavePreview();
      return;
    }
    if (draft.caseStatus === "CONFIRMED") {
      if (draft.caseId === null) {
        setStatus("checklist_incomplete");
        return;
      }
      const checklist = await controller.loadSteps(draft.caseId);
      if (!checklist.ok || !isWorkforceProcedureCaseReadyToConfirm(checklist.data.steps)) {
        setStatus("checklist_incomplete");
        return;
      }
    }
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
  updateStatusFilterButtons();
  updatePriorityFilterButtons();
  updateFilterResetButton();
  return Object.freeze({ initialized: true, enabled: controller.enabled, load, setProcedureType, resetFilters, controller });
}

function procedureLabel(value) {
  return ({ ONBOARDING: "入社", TRANSFER: "異動", LEAVE: "休職・復職", RETIREMENT: "退職" })[value] || "手続き";
}

function statusLabel(value) {
  if (value === "OPEN") return "対応中";
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

function priorityLabel(value) {
  return ({ OVERDUE: "期限超過", NEXT_7_DAYS: "直近7日", SCHEDULED: "予定", CLOSED: "完了・中止" })[value] || "予定";
}

function localDateIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
