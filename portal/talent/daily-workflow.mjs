export const DAILY_WORKFLOW_CONTRACT_VERSION = "1.0.0";

export function classifyNextActionPriority(dueDate, businessDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(dueDate || ""))) return "UNSCHEDULED";
  if (dueDate < businessDate) return "OVERDUE";
  if (dueDate === businessDate) return "TODAY";
  return "FUTURE";
}

export function buildDailyWorkflowQueue(data, businessDate) {
  if (data?.sourceCoverageState !== "COMPLETE") return Object.freeze({ state: "PREPARING", rows: Object.freeze([]) });
  const order = Object.freeze({ OVERDUE: 0, TODAY: 1, AWAITING_REPLY: 2, ON_HOLD: 3, FUTURE: 4, UNSCHEDULED: 5, CLOSED: 6 });
  const actionRows = (Array.isArray(data?.nextActions) ? data.nextActions : []).map((row) => {
    const category = row.state === "ON_HOLD" ? "ON_HOLD"
      : ["COMPLETED", "CANCELLED"].includes(row.state) ? "CLOSED"
        : classifyNextActionPriority(row.dueDate, businessDate);
    return Object.freeze({ ...row, category });
  });
  const replyRows = (Array.isArray(data?.communications) ? data.communications : [])
    .filter((row) => row.awaitingReply === true)
    .map((row) => Object.freeze({ id: `communication:${row.id}`, candidateId: row.candidateId,
      text: `返信待ち：${row.summary}`, dueDate: row.nextFollowUpDate, assignedTo: null,
      state: "REMINDER", category: "AWAITING_REPLY", readOnly: true }));
  const rows = [...actionRows, ...replyRows].sort((left, right) => order[left.category] - order[right.category]
    || String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31"))
    || String(left.id).localeCompare(String(right.id)));
  return Object.freeze({ state: "READY", rows: Object.freeze(rows) });
}

export function filterDailyWorkflowQueue(queue, filter = "ALL") {
  if (queue?.state !== "READY") return Object.freeze([]);
  return Object.freeze(queue.rows.filter((row) => filter === "ALL" || row.category === filter));
}

export function buildSuggestedActions(_context, { enabled = false } = {}) {
  if (!enabled) return Object.freeze({ state: "DISABLED", suggestions: Object.freeze([]) });
  return Object.freeze({ state: "PREPARING", suggestions: Object.freeze([]) });
}

export function validateDailyWorkflowResponse(value) {
  const data = value?.data;
  if (value?.ok !== true || data?.daily_workflow_contract_version !== DAILY_WORKFLOW_CONTRACT_VERSION) return false;
  if (!["COMPLETE", "PREPARING"].includes(data?.sourceCoverageState)) return false;
  if (!Array.isArray(data?.communications) || !Array.isArray(data?.nextActions)) return false;
  if (data.sourceCoverageState === "PREPARING" && (data.communications.length || data.nextActions.length)) return false;
  return data.communications.every((row) => row && typeof row.id === "string" && typeof row.candidateId === "string"
    && typeof row.occurredAt === "string" && typeof row.summary === "string")
    && data.nextActions.every((row) => row && typeof row.id === "string" && typeof row.candidateId === "string"
      && typeof row.isMine === "boolean" && ["OPEN", "ON_HOLD", "COMPLETED", "CANCELLED"].includes(row.state));
}
