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
  if (!payload || payload.schemaVersion !== "1.0") throw new TypeError("unsupported work queue schema");
  if (!payload.metrics || !Array.isArray(payload.categoryCounts) || !Array.isArray(payload.items)) {
    throw new TypeError("work queue metrics and items are required");
  }
  if (payload.safety?.mockOnly !== true || payload.safety?.containsPersonalValues !== false || payload.safety?.persistentWriteEnabled !== false) {
    throw new TypeError("work queue safety boundary is invalid");
  }

  nonNegative(payload.metrics.fixedCount, "fixedCount");
  nonNegative(payload.metrics.remainingCount, "remainingCount");
  nonNegative(payload.metrics.migrationProgress, "migrationProgress");
  if (payload.metrics.migrationProgress > 100) throw new RangeError("migrationProgress must not exceed 100");
  if (payload.metrics.integrityRate !== null && (typeof payload.metrics.integrityRate !== "number" || payload.metrics.integrityRate < 0 || payload.metrics.integrityRate > 100)) {
    throw new RangeError("integrityRate must be null or 0..100");
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

export function createWorkQueueState(payload) {
  const valid = validateWorkQueuePayload(payload);
  return {
    integrityRate: valid.metrics.integrityRate,
    fixedCount: valid.metrics.fixedCount,
    migrationProgress: valid.metrics.migrationProgress,
    categoryCounts: valid.categoryCounts.map((entry) => ({ ...entry })),
    items: valid.items.map((item) => ({ ...item, status: "PENDING" })),
    currentIndex: 0,
    lastMessage: "今日の修正対象を確認してください。"
  };
}

export function getPendingItems(state) {
  return state.items.filter((item) => item.status === "PENDING");
}

export function getCurrentItem(state) {
  const pending = getPendingItems(state);
  return pending[0] || null;
}

export function getWorkQueueMetrics(state) {
  const pending = getPendingItems(state).length;
  return {
    integrityRate: state.integrityRate === null ? "未算出" : `${state.integrityRate}%`,
    fixedCount: state.fixedCount,
    remainingCount: pending,
    migrationProgress: `${state.migrationProgress}%`
  };
}

export function validateRepairDecision(item, decision) {
  if (!item || !decision || typeof decision !== "object") return false;
  if (item.type === "DUPLICATE_CANDIDATE") return ["KEEP_A", "KEEP_B"].includes(decision.action);
  if (item.type === "STATUS_MISSING") return ["REVIEW", "CONTACT", "SALON_TOUR", "INTERVIEW", "OFFER"].includes(decision.value);
  return typeof decision.value === "string" && decision.value.trim().length > 0 && decision.value.trim().length <= 120;
}

export function applyRepairDecision(state, itemId, decision) {
  const item = state.items.find((entry) => entry.id === itemId && entry.status === "PENDING");
  if (!item) return { state, category: "ITEM_NOT_PENDING" };
  if (decision?.action === "HOLD") {
    const nextItems = state.items.map((entry) => entry.id === itemId ? { ...entry, status: "HELD" } : entry);
    return { state: { ...state, items: nextItems, lastMessage: "保留しました。次の件を表示します。" }, category: "HELD" };
  }
  if (!validateRepairDecision(item, decision)) return { state, category: "DECISION_INVALID" };

  const nextItems = state.items.map((entry) => entry.id === itemId ? { ...entry, status: "FIXED" } : entry);
  const categoryCounts = state.categoryCounts.map((entry) => entry.type === item.type && typeof entry.count === "number"
    ? { ...entry, count: Math.max(0, entry.count - 1) }
    : entry);
  return {
    state: {
      ...state,
      items: nextItems,
      categoryCounts,
      fixedCount: state.fixedCount + 1,
      lastMessage: "保存しました。次の件を表示します。"
    },
    category: "FIXED"
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
    for (const [value, label] of [["KEEP_A", "候補Aを正として採用"], ["KEEP_B", "候補Bを正として採用"]]) {
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
  addText(documentObject, summary, "p", current ? `残り${metrics.remainingCount}件。修正して保存すると次の件へ進みます。` : "本日の修正対象は完了しました。", "queue-lead");
  root.append(summary);

  const kpis = documentObject.createElement("section");
  kpis.className = "queue-kpis";
  kpis.setAttribute("aria-label", "データ品質KPI");
  for (const [label, value] of [["整合率", metrics.integrityRate], ["修正済件数", metrics.fixedCount], ["残件数", metrics.remainingCount], ["Migration進捗", metrics.migrationProgress]]) {
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
  addText(documentObject, repair, "h2", current.subject);
  const facts = documentObject.createElement("dl");
  for (const [term, value] of [["現在値", current.currentValue], ["修正候補", current.suggestion]]) {
    addText(documentObject, facts, "dt", term);
    addText(documentObject, facts, "dd", value);
  }
  repair.append(facts, createDecisionControl(documentObject, current));
  const actions = documentObject.createElement("div");
  actions.className = "repair-actions";
  const save = documentObject.createElement("button");
  save.type = "button";
  save.textContent = "保存して次へ";
  save.addEventListener("click", () => onChange(applyRepairDecision(state, current.id, readDecision(documentObject, current))));
  const hold = documentObject.createElement("button");
  hold.type = "button";
  hold.className = "secondary";
  hold.textContent = "保留して次へ";
  hold.addEventListener("click", () => onChange(applyRepairDecision(state, current.id, { action: "HOLD" })));
  actions.append(save, hold);
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
  boundary.textContent = "ローカルMock確認中です。保存内容は正式データへ反映されません。";
  root.append(boundary);
}

export async function loadWorkQueue(fetchImplementation = globalThis.fetch) {
  const response = await fetchImplementation("./data-integrity-work-queue.seed.json", { cache: "no-store" });
  if (!response.ok) throw new Error("work queue could not be loaded");
  return createWorkQueueState(await response.json());
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
