const TYPE_LABELS = Object.freeze({
  SCHOOL_MISSING: "学校名不足",
  NAME_MISSING: "氏名不足",
  STATUS_MISSING: "状態不足",
  ASSIGNEE_MISSING: "担当者不足",
  NEXT_ACTION_MISSING: "次回対応不足",
  DUPLICATE_CANDIDATE: "重複候補"
});

function nonNegative(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative integer`);
  return value;
}

export function validateWorkQueuePayload(payload) {
  if (!payload || payload.schemaVersion !== "2.0") throw new TypeError("unsupported work queue schema");
  if (!payload.metrics || !Array.isArray(payload.categoryCounts) || !Array.isArray(payload.dataConsistencyIssues) || !Array.isArray(payload.items)) {
    throw new TypeError("work queue metrics, consistency issues, and items are required");
  }
  if (payload.safety?.mockOnly !== true || payload.safety?.containsPersonalValues !== false || payload.safety?.persistentWriteEnabled !== false) {
    throw new TypeError("work queue safety boundary is invalid");
  }

  nonNegative(payload.metrics.workQueueTotalCount, "workQueueTotalCount");
  nonNegative(payload.metrics.fixedCount, "fixedCount");
  nonNegative(payload.metrics.remainingCount, "remainingCount");
  if (payload.metrics.fixedCount + payload.metrics.remainingCount !== payload.metrics.workQueueTotalCount) {
    throw new TypeError("work queue total must match fixed and remaining counts");
  }
  for (const key of ["workQueueIntegrityRate", "dataConsistencyIntegrityRate"]) {
    const value = payload.metrics[key];
    if (value !== null && (typeof value !== "number" || value < 0 || value > 100)) {
      throw new RangeError(`${key} must be null or 0..100`);
    }
  }
  if (!["HOLD", "MIGRATION_HOLD", "STAGING_MIGRATION_APPROVAL_PENDING", "STAGING_MIGRATION_BLOCKED", "STAGING_SCHEMA_APPLY_PENDING", "STAGING_DATASET_ACTIVE"].includes(payload.metrics.migrationStatus)) {
    throw new TypeError("migration status is invalid");
  }
  if (
    payload.releaseReady !== true ||
    payload.platformStatus !== "DATA_INTEGRITY_COMPLETED / STAGING_DATASET_ACTIVE / PRODUCTION_MIGRATION_HOLD" ||
    payload.migrationHoldReason !== "STAGING_UI_RUNTIME_INTEGRATION_PENDING" ||
    payload.metrics.dataConsistencyIntegrityRate !== 100 ||
    payload.dataConsistencyIssues.length !== 0
  ) {
    throw new TypeError("completed work queue release status is invalid");
  }

  for (const issue of payload.dataConsistencyIssues) {
    nonNegative(issue.numberedRowCount, "numberedRowCount");
    nonNegative(issue.populatedRecordCount, "populatedRecordCount");
    nonNegative(issue.differenceCount, "differenceCount");
    if (Math.abs(issue.numberedRowCount - issue.populatedRecordCount) !== issue.differenceCount) {
      throw new TypeError("data consistency difference is invalid");
    }
  }

  const ids = new Set();
  for (const item of payload.items) {
    if (!TYPE_LABELS[item.type]) throw new TypeError("unknown work queue type");
    if (!item.id || ids.has(item.id)) throw new TypeError("work queue item id must be unique");
    ids.add(item.id);
  }
  if (payload.items.length !== payload.metrics.remainingCount) throw new TypeError("remainingCount must match queue length");
  return payload;
}

function validDuplicatePairRow(value) {
  if (value === null) return true;
  if (Number.isInteger(value) && value > 0) return true;
  return Array.isArray(value) && value.length > 0 && value.every((row) => Number.isInteger(row) && row > 0);
}

export function validateSourceLineage(lineage, queuePayload) {
  if (!lineage || lineage.schemaVersion !== "1.0") throw new TypeError("unsupported source lineage schema");
  if (lineage.readOnly !== true || lineage.containsPersonalValues !== false) {
    throw new TypeError("source lineage safety boundary is invalid");
  }
  if (!Array.isArray(lineage.sourceSpreadsheets) || !Array.isArray(lineage.closedIssues) || !Array.isArray(lineage.items)) {
    throw new TypeError("source lineage inventory and items are required");
  }

  const primaryByCohort = new Map();
  for (const source of lineage.sourceSpreadsheets) {
    if (source.lineage_role !== "PRIMARY" || !source.graduation_year || !source.spreadsheet_id || !source.sheet_id) {
      throw new TypeError("source lineage primary inventory is invalid");
    }
    if (primaryByCohort.has(source.graduation_year)) throw new TypeError("source lineage cohort must have one primary source");
    primaryByCohort.set(source.graduation_year, source);
  }

  const closedIds = new Set();
  for (const issue of lineage.closedIssues) {
    if (!issue.issue_id || closedIds.has(issue.issue_id)) throw new TypeError("closed issue id must be unique");
    if (!["false_positive", "resolved", "human_review_completed"].includes(issue.final_status) || !issue.closure_reason || !issue.closed_at || !issue.source_type) {
      throw new TypeError("closed issue metadata is incomplete");
    }
    if (issue.current_queue_included !== false) throw new TypeError("closed issue cannot remain in the current queue");
    closedIds.add(issue.issue_id);
  }

  const queueItems = new Map(validateWorkQueuePayload(queuePayload).items.map((item) => [item.id, item]));
  const lineageIds = new Set();
  for (const item of lineage.items) {
    const queueItem = queueItems.get(item.issue_id);
    if (!queueItem || lineageIds.has(item.issue_id) || closedIds.has(item.issue_id)) throw new TypeError("source lineage issue id is invalid");
    lineageIds.add(item.issue_id);
    if (item.graduation_year !== queueItem.cohort || item.issue_type !== queueItem.type) {
      throw new TypeError("source lineage does not match work queue item");
    }
    if (!item.spreadsheet_name || !item.sheet_name || !Number.isInteger(item.source_row_no) || item.source_row_no < 1) {
      throw new TypeError("source lineage location is incomplete");
    }
    if (!item.stable_key_hint || !item.correction_target || !validDuplicatePairRow(item.duplicate_pair_row)) {
      throw new TypeError("source lineage repair metadata is invalid");
    }
    if (!String(item.open_url).startsWith("https://docs.google.com/spreadsheets/d/")) {
      throw new TypeError("source lineage open url is invalid");
    }
  }
  if (lineageIds.size !== queueItems.size) throw new TypeError("source lineage must cover every work queue item");
  return lineage;
}

export function attachSourceLineage(queuePayload, lineagePayload) {
  const queue = validateWorkQueuePayload(queuePayload);
  const lineage = validateSourceLineage(lineagePayload, queue);
  const byIssueId = new Map(lineage.items.map((item) => [item.issue_id, item]));
  return {
    ...queue,
    items: queue.items.map((item) => ({ ...item, lineage: { ...byIssueId.get(item.id) } }))
  };
}

export function createWorkQueueState(payload) {
  const valid = validateWorkQueuePayload(payload);
  return {
    workQueueTotalCount: valid.metrics.workQueueTotalCount,
    dataConsistencyIntegrityRate: valid.metrics.dataConsistencyIntegrityRate,
    fixedCount: valid.metrics.fixedCount,
    migrationStatus: valid.metrics.migrationStatus,
    categoryCounts: valid.categoryCounts.map((entry) => ({ ...entry })),
    dataConsistencyIssues: valid.dataConsistencyIssues.map((entry) => ({ ...entry })),
    items: valid.items.map((item) => ({ ...item, status: "PENDING", decision: null })),
    lastMessage: "今日の修正対象を確認してください。"
  };
}

export function getPendingItems(state) {
  return state.items.filter((item) => ["PENDING", "CONFIRMED"].includes(item.status));
}

export function getCurrentItem(state) {
  return state.items.find((item) => item.status !== "COMPLETED") || null;
}

export function getWorkQueueMetrics(state) {
  const pending = getPendingItems(state).length;
  const workQueueIntegrityRate = state.workQueueTotalCount === 0
    ? 100
    : Math.round((state.fixedCount / state.workQueueTotalCount) * 1000) / 10;
  return {
    workQueueIntegrityRate: `${workQueueIntegrityRate}%`,
    dataConsistencyIntegrityRate: state.dataConsistencyIntegrityRate === null ? "未算出" : `${state.dataConsistencyIntegrityRate}%`,
    fixedCount: state.fixedCount,
    remainingCount: pending,
    migrationStatus: state.migrationStatus === "STAGING_DATASET_ACTIVE"
      ? "Staging Candidate Dataset有効"
      : state.migrationStatus === "STAGING_SCHEMA_APPLY_PENDING"
      ? "Staging Candidate schema適用待ち"
      : state.migrationStatus === "STAGING_MIGRATION_BLOCKED"
      ? "Staging Migration停止（受入schema未対応）"
      : state.migrationStatus === "STAGING_MIGRATION_APPROVAL_PENDING"
      ? "Staging Migration承認待ち（Production保留）"
      : state.migrationStatus === "MIGRATION_HOLD"
      ? "Migration保留（Migration実行前条件未完了）"
      : state.migrationStatus === "HOLD" ? "保留" : state.migrationStatus
  };
}

export function validateRepairDecision(item, decision) {
  if (!item || !decision || typeof decision !== "object") return false;
  if (item.type === "DUPLICATE_CANDIDATE") return ["SAME_PERSON", "DIFFERENT_PERSON", "HOLD"].includes(decision.action);
  if (item.type === "STATUS_MISSING") return ["REVIEW", "CONTACT", "SALON_TOUR", "INTERVIEW", "OFFER"].includes(decision.value);
  return typeof decision.value === "string" && decision.value.trim().length > 0 && decision.value.trim().length <= 120;
}

export function confirmRepairDecision(state, itemId, decision) {
  const item = state.items.find((entry) => entry.id === itemId && entry.status === "PENDING");
  if (!item) return { state, category: "ITEM_NOT_PENDING" };
  if (!validateRepairDecision(item, decision)) return { state, category: "DECISION_INVALID" };
  const nextItems = state.items.map((entry) => entry.id === itemId
    ? { ...entry, status: "CONFIRMED", decision: { ...decision } }
    : entry);
  return {
    state: { ...state, items: nextItems, lastMessage: "修正内容を確認しました。正本Spreadsheetを修正してください。" },
    category: "REPAIR_CONFIRMED"
  };
}

export function markSpreadsheetFixed(state, itemId) {
  const item = state.items.find((entry) => entry.id === itemId && entry.status === "CONFIRMED");
  if (!item) return { state, category: "REPAIR_NOT_CONFIRMED" };

  const nextItems = state.items.map((entry) => entry.id === itemId ? { ...entry, status: "SHEET_FIXED" } : entry);
  const categoryCounts = state.categoryCounts.map((entry) => entry.type === item.type && typeof entry.count === "number"
    ? { ...entry, count: Math.max(0, entry.count - 1) }
    : entry);
  return {
    state: {
      ...state,
      items: nextItems,
      categoryCounts,
      fixedCount: state.fixedCount + 1,
      lastMessage: "Spreadsheet修正済として確認しました。「次へ」で次の対象へ進みます。"
    },
    category: "SPREADSHEET_FIXED"
  };
}

export function advanceWorkQueue(state, itemId) {
  const item = state.items.find((entry) => entry.id === itemId && entry.status === "SHEET_FIXED");
  if (!item) return { state, category: "SPREADSHEET_NOT_FIXED" };
  const nextItems = state.items.map((entry) => entry.id === itemId ? { ...entry, status: "COMPLETED" } : entry);
  return {
    state: { ...state, items: nextItems, lastMessage: "次の修正対象を表示しました。" },
    category: "ADVANCED"
  };
}

function addText(documentObject, parent, tag, text, className = "") {
  const node = documentObject.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function createDecisionControl(documentObject, item) {
  const fieldset = documentObject.createElement("fieldset");
  fieldset.className = "repair-control";
  const legend = documentObject.createElement("legend");
  legend.textContent = "修正内容";
  fieldset.append(legend);

  if (item.type === "DUPLICATE_CANDIDATE") {
    for (const [value, label] of [["SAME_PERSON", "同一人物"], ["DIFFERENT_PERSON", "別人"], ["HOLD", "判断保留"]]) {
      const choice = documentObject.createElement("label");
      const input = documentObject.createElement("input");
      input.type = "radio";
      input.name = "duplicate-decision";
      input.value = value;
      choice.append(input, documentObject.createTextNode(label));
      fieldset.append(choice);
    }
  } else if (item.type === "STATUS_MISSING") {
    const select = documentObject.createElement("select");
    select.id = "repair-value";
    select.innerHTML = '<option value="">選択してください</option><option value="REVIEW">要確認</option><option value="CONTACT">接触</option><option value="SALON_TOUR">見学</option><option value="INTERVIEW">面接</option><option value="OFFER">内定</option>';
    fieldset.append(select);
  } else {
    const input = documentObject.createElement("input");
    input.id = "repair-value";
    input.type = "text";
    input.maxLength = 120;
    input.autocomplete = "off";
    input.placeholder = item.type === "SCHOOL_MISSING" ? "学校名を入力" : "氏名を入力";
    fieldset.append(input);
  }
  return fieldset;
}

function readDecision(documentObject, item) {
  if (item.type === "DUPLICATE_CANDIDATE") {
    return { action: documentObject.querySelector('input[name="duplicate-decision"]:checked')?.value || "" };
  }
  return { value: documentObject.querySelector("#repair-value")?.value || "" };
}

export function renderWorkQueue(documentObject, state, onChange) {
  const root = documentObject.querySelector("#data-integrity-work-queue");
  if (!root) throw new Error("work queue root not found");
  root.replaceChildren();
  const metrics = getWorkQueueMetrics(state);
  const current = getCurrentItem(state);

  const summary = documentObject.createElement("section");
  summary.className = "queue-summary";
  addText(documentObject, summary, "p", "DATA INTEGRITY WORK QUEUE", "eyebrow");
  addText(documentObject, summary, "h1", "今日修正するデータ");
  addText(documentObject, summary, "p", current ? `残り${metrics.remainingCount}件。修正内容を確認し、正本Spreadsheetの修正後に次へ進みます。` : "本日の修正対象は完了しました。", "queue-lead");
  root.append(summary);

  const kpis = documentObject.createElement("section");
  kpis.className = "queue-kpis";
  kpis.setAttribute("aria-label", "データ品質KPI");
  for (const [label, value] of [["Work Queue解消率", metrics.workQueueIntegrityRate], ["Data Consistency整合率", metrics.dataConsistencyIntegrityRate], ["修正済件数", metrics.fixedCount], ["残件数", metrics.remainingCount]]) {
    const card = documentObject.createElement("article");
    addText(documentObject, card, "p", label, "kpi-label");
    addText(documentObject, card, "p", String(value), "kpi-value");
    kpis.append(card);
  }
  root.append(kpis);

  const categories = documentObject.createElement("section");
  categories.className = "queue-categories";
  categories.setAttribute("aria-label", "今日の修正カテゴリ");
  for (const entry of state.categoryCounts) {
    const card = documentObject.createElement("article");
    addText(documentObject, card, "p", entry.label);
    addText(documentObject, card, "strong", entry.count === null ? "未集計" : `${entry.count}件`);
    categories.append(card);
  }
  root.append(categories);

  const consistency = documentObject.createElement("section");
  consistency.className = "consistency-panel";
  addText(documentObject, consistency, "h2", "Data Consistency Issue");
  for (const issue of state.dataConsistencyIssues) {
    const item = documentObject.createElement("article");
    addText(documentObject, item, "p", `${issue.cohort} 接触データ`);
    addText(documentObject, item, "strong", `採番済${issue.numberedRowCount}行 / 実データ入力済${issue.populatedRecordCount}行 / 差分${issue.differenceCount}件`);
    consistency.append(item);
  }
  addText(documentObject, consistency, "p", `Data Consistency整合率: ${metrics.dataConsistencyIntegrityRate} / Migration判定: ${metrics.migrationStatus}`, "consistency-status");
  root.append(consistency);

  if (!current) {
    const done = documentObject.createElement("section");
    done.className = "queue-empty";
    addText(documentObject, done, "h2", "今日の修正は完了です");
    addText(documentObject, done, "p", "次回のデータ品質レポート更新までお待ちください。");
    root.append(done);
    return;
  }

  const workspace = documentObject.createElement("section");
  workspace.className = "repair-workspace";
  const repair = documentObject.createElement("article");
  repair.className = "repair-card";
  addText(documentObject, repair, "p", `${current.cohort} / ${TYPE_LABELS[current.type]}`, "repair-type");
  addText(documentObject, repair, "h2", current.lineage.correction_target);
  const facts = documentObject.createElement("dl");
  const pairRows = current.lineage.duplicate_pair_row === null
    ? ""
    : Array.isArray(current.lineage.duplicate_pair_row)
      ? ` / 相手行 ${current.lineage.duplicate_pair_row.join("・")}`
      : ` / 相手行 ${current.lineage.duplicate_pair_row}`;
  for (const [term, value] of [
    ["正本ファイル", current.lineage.spreadsheet_name],
    ["シート名", current.lineage.sheet_name],
    ["行番号", `${current.lineage.source_row_no}${pairRows}`],
    ["修正項目", current.lineage.correction_target]
  ]) {
    addText(documentObject, facts, "dt", term);
    addText(documentObject, facts, "dd", value);
  }
  repair.append(facts);
  const openSource = documentObject.createElement("a");
  openSource.className = "source-link";
  openSource.href = current.lineage.open_url;
  openSource.target = "_blank";
  openSource.rel = "noopener noreferrer";
  openSource.textContent = "正本Spreadsheetの該当行を開く";
  repair.append(openSource);
  if (current.status === "PENDING") {
    repair.append(createDecisionControl(documentObject, current));
  } else {
    addText(documentObject, repair, "p", current.status === "CONFIRMED"
      ? "確認した内容で正本Spreadsheetを修正してください。"
      : "Spreadsheet修正済です。次の対象へ進めます。", "spreadsheet-instruction");
  }
  const actions = documentObject.createElement("div");
  actions.className = "repair-actions";
  const primary = documentObject.createElement("button");
  primary.type = "button";
  if (current.status === "PENDING") {
    primary.textContent = "修正内容を確認";
    primary.addEventListener("click", () => onChange(confirmRepairDecision(state, current.id, readDecision(documentObject, current))));
  } else if (current.status === "CONFIRMED") {
    primary.textContent = "Spreadsheet修正済";
    primary.addEventListener("click", () => onChange(markSpreadsheetFixed(state, current.id)));
  } else {
    primary.textContent = "次へ";
    primary.addEventListener("click", () => onChange(advanceWorkQueue(state, current.id)));
  }
  actions.append(primary);
  repair.append(actions);
  addText(documentObject, repair, "p", state.lastMessage, "queue-message");
  workspace.append(repair);

  const pendingPanel = documentObject.createElement("aside");
  pendingPanel.className = "pending-panel";
  addText(documentObject, pendingPanel, "h2", "今日修正する対象");
  const pendingList = documentObject.createElement("ol");
  for (const item of getPendingItems(state)) addText(documentObject, pendingList, "li", `${TYPE_LABELS[item.type]} / ${item.cohort}`);
  pendingPanel.append(pendingList);
  workspace.append(pendingPanel);
  root.append(workspace);

  const boundary = documentObject.createElement("p");
  boundary.className = "mock-boundary";
  boundary.textContent = "正本は総務人事部管理のSpreadsheetです。Work Queueは修正対象の確認だけを行い、DB保存は行いません。";
  root.append(boundary);
}

export async function loadWorkQueue(fetchImplementation = globalThis.fetch) {
  const [queueResponse, lineageResponse] = await Promise.all([
    fetchImplementation("./data-integrity-work-queue.seed.json", { cache: "no-store" }),
    fetchImplementation("./data-integrity-source-lineage.json", { cache: "no-store" })
  ]);
  if (!queueResponse.ok || !lineageResponse.ok) throw new Error("work queue could not be loaded");
  const payload = attachSourceLineage(await queueResponse.json(), await lineageResponse.json());
  return createWorkQueueState(payload);
}

async function initialize() {
  const root = document.querySelector("#data-integrity-work-queue");
  if (!root) return;
  try {
    let state = await loadWorkQueue();
    const update = (result) => {
      if (result.category === "DECISION_INVALID") {
        state = { ...state, lastMessage: "修正内容を入力してください。" };
      } else {
        state = result.state;
      }
      renderWorkQueue(document, state, update);
    };
    renderWorkQueue(document, state, update);
  } catch {
    root.textContent = "修正対象を読み込めませんでした。個人値を表示せず安全に停止しています。";
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
}
