type JsonRecord = Record<string, unknown>;
type RowOptions = { method?: string; query?: JsonRecord; payload?: unknown; prefer?: string };
type ReadRows = (table: string, options: RowOptions) => Promise<JsonRecord[]>;

const MIN_COHORT = 5;
const MAX_STORES = 100;
const MAX_EMPLOYEES = 2000;
const MAX_POSTS = 10000;
const MAX_SUPPORT_SIGNALS_PER_STORE = 25;
const WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
const FOLLOWUP_STATUSES = new Set(["PENDING", "CONTACTED", "MONITORING", "COMPLETED"]);
const ACTIVITY_SIGNAL_CATEGORIES = new Set([
  "PUBLIC_SEND_ACTIVITY_STOPPED",
  "PUBLIC_SEND_ACTIVITY_DROPPED",
  "NO_PUBLIC_SEND_ACTIVITY",
  "PUBLIC_RECEIVE_ACTIVITY_STOPPED",
  "PUBLIC_RECEIVE_ACTIVITY_DROPPED",
  "NO_PUBLIC_RECEIVE_ACTIVITY",
]);

function strings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "")).filter(Boolean) : [];
}
function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function uuid(value: unknown) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "")); }
function unique(values: unknown[]) { return [...new Set(values.map((value) => String(value || "")).filter(Boolean))]; }
function ratio(a: number, b: number) { return b > 0 ? Math.round((a / b) * 1000) / 1000 : 0; }

function scopeFor(actor: JsonRecord) {
  const roles = strings(actor.roleKeys);
  if (roles.includes("idea_link.admin")) return { all: true, storeIds: [] as string[] };
  if (!roles.includes("idea_link.manager")) throw new Error("ACCESS_DENIED");
  const assignments = Array.isArray(actor.storeAssignments) ? actor.storeAssignments : [];
  const primary = record(actor.primaryStore);
  const storeIds = unique([
    ...assignments.map((value) => record(value).storeId || record(value).store_id),
    primary.id,
  ]).filter(uuid);
  if (!storeIds.length || storeIds.length > MAX_STORES) throw new Error("ACCESS_DENIED");
  return { all: false, storeIds };
}

function aggregate(rows: JsonRecord[], activeIds: Set<string>, employeeStore: Map<string, string>, storeId: string) {
  const senders = new Set<string>();
  const receivers = new Set<string>();
  const participants = new Set<string>();
  const pairs = new Set<string>();
  const categories = new Set<string>();
  const senderCounts = new Map<string, number>();
  let crossStore = 0;
  for (const row of rows) {
    const sender = String(row.sender_id || "");
    const receiver = String(row.receiver_id || "");
    if (activeIds.has(sender)) senders.add(sender);
    if (activeIds.has(receiver)) receivers.add(receiver);
    if (activeIds.has(sender)) participants.add(sender);
    if (activeIds.has(receiver)) participants.add(receiver);
    if (sender && receiver) pairs.add(`${sender}>${receiver}`);
    if (row.category) categories.add(String(row.category));
    if (sender) senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
    if (employeeStore.get(sender) && employeeStore.get(sender) !== storeId) crossStore += 1;
  }
  return {
    posts: rows.length,
    participationRate: ratio(participants.size, activeIds.size),
    senderCoverage: ratio(senders.size, activeIds.size),
    receiverCoverage: ratio(receivers.size, activeIds.size),
    uniquePairCount: pairs.size,
    categoryCount: categories.size,
    crossStoreRate: ratio(crossStore, rows.length),
    concentrationRate: ratio(Math.max(0, ...senderCounts.values()), rows.length),
  };
}

function activitySupportSignals(
  employees: JsonRecord[],
  posts: JsonRecord[],
  previousStart: Date,
  currentStart: Date,
  now: Date,
) {
  const previousSendCounts = new Map<string, number>();
  const currentSendCounts = new Map<string, number>();
  const previousReceiveCounts = new Map<string, number>();
  const currentReceiveCounts = new Map<string, number>();
  for (const row of posts) {
    const sender = String(row.sender_id || "");
    const receiver = String(row.receiver_id || "");
    const time = new Date(String(row.created_at || "")).getTime();
    if (!Number.isFinite(time) || time < previousStart.getTime() || time >= now.getTime()) continue;
    const sendCounts = time < currentStart.getTime() ? previousSendCounts : currentSendCounts;
    const receiveCounts = time < currentStart.getTime() ? previousReceiveCounts : currentReceiveCounts;
    if (sender) sendCounts.set(sender, (sendCounts.get(sender) || 0) + 1);
    if (receiver) receiveCounts.set(receiver, (receiveCounts.get(receiver) || 0) + 1);
  }
  const signals = employees.flatMap((employee) => {
    const employeeId = String(employee.id || "");
    const employeeLabel = String(employee.full_name || "").trim();
    if (!employeeId || !employeeLabel) return [];
    const joinedAt = new Date(String(employee.joined_on || "")).getTime();
    const fullObservationWindow = !Number.isFinite(joinedAt) || joinedAt < previousStart.getTime();
    const categories: string[] = [];
    const appendChange = (
      previous: number,
      current: number,
      stopped: string,
      dropped: string,
      inactive: string,
    ) => {
      if (previous >= 3 && current === 0) categories.push(stopped);
      else if (previous >= 6 && current * 3 <= previous) categories.push(dropped);
      else if (fullObservationWindow && previous === 0 && current === 0) categories.push(inactive);
    };
    appendChange(
      previousSendCounts.get(employeeId) || 0,
      currentSendCounts.get(employeeId) || 0,
      "PUBLIC_SEND_ACTIVITY_STOPPED",
      "PUBLIC_SEND_ACTIVITY_DROPPED",
      "NO_PUBLIC_SEND_ACTIVITY",
    );
    appendChange(
      previousReceiveCounts.get(employeeId) || 0,
      currentReceiveCounts.get(employeeId) || 0,
      "PUBLIC_RECEIVE_ACTIVITY_STOPPED",
      "PUBLIC_RECEIVE_ACTIVITY_DROPPED",
      "NO_PUBLIC_RECEIVE_ACTIVITY",
    );
    return categories.length ? [{ targetEmployeeId: employeeId, employeeLabel, signalCategories: categories }] : [];
  }).sort((left, right) => {
    const priority = (categories: string[]) =>
      categories.some((category) => category.endsWith("_STOPPED")) ? 0 :
      categories.some((category) => category.endsWith("_DROPPED")) ? 1 : 2;
    return priority(left.signalCategories) - priority(right.signalCategories) ||
      left.employeeLabel.localeCompare(right.employeeLabel, "ja");
  });
  return {
    activitySignals: signals.slice(0, MAX_SUPPORT_SIGNALS_PER_STORE),
    activitySignalOverflow: signals.length > MAX_SUPPORT_SIGNALS_PER_STORE,
  };
}

function followupResult(row: JsonRecord, employeesById: Map<string, JsonRecord>) {
  const target = employeesById.get(String(row.target_employee_id || ""));
  const assigned = employeesById.get(String(row.assigned_to_employee_id || ""));
  return {
    targetEmployeeId: String(row.target_employee_id || ""),
    employeeLabel: String(target?.full_name || "対象者"),
    status: String(row.status || ""),
    assignedToLabel: String(assigned?.full_name || "担当者"),
    nextReviewOn: row.next_review_on ? String(row.next_review_on) : null,
    updatedAt: String(row.updated_at || ""),
  };
}

export async function readOrganizationHealthMonitoringCandidate(actor: JsonRecord, readRows: ReadRows, now = new Date()) {
  if (actor.isActive !== true || /退職|休職|産休|育休/.test(String(actor.employmentStatus || ""))) throw new Error("ACCESS_DENIED");
  const scope = scopeFor(actor);
  const currentStart = new Date(now.getTime() - WINDOW_MS);
  const previousStart = new Date(now.getTime() - WINDOW_MS * 2);
  const storeQuery: JsonRecord = { select: "id,store_name,is_active", is_active: "eq.true", order: "store_name.asc", limit: String(MAX_STORES + 1) };
  if (!scope.all) storeQuery.id = `in.(${scope.storeIds.join(",")})`;
  const stores = await readRows("stores", { query: storeQuery });
  if (stores.length > MAX_STORES) throw new Error("RESULT_LIMIT_EXCEEDED");
  const storeIds = unique(stores.map((store) => store.id)).filter(uuid);
  if (!storeIds.length) return monitoringResult([]);
  const storeIdSet = new Set(storeIds);
  const [employees, posts, followups] = await Promise.all([
    readRows("employees", { query: { select: "id,full_name,store_id,is_active,employment_status,joined_on", is_active: "eq.true", limit: String(MAX_EMPLOYEES + 1) } }),
    readRows("idea_link_posts", { query: { select: "sender_id,receiver_id,receiver_store_id,category,status,visibility,created_at", status: "eq.active", visibility: "eq.public", created_at: `gte.${previousStart.toISOString()}`, order: "created_at.asc", limit: String(MAX_POSTS + 1) } }),
    readRows("idea_link_activity_followups", { query: { select: "target_employee_id,store_id,status,assigned_to_employee_id,next_review_on,updated_at", store_id: `in.(${storeIds.join(",")})`, order: "updated_at.desc", limit: String(MAX_EMPLOYEES + 1) } }),
  ]);
  if (employees.length > MAX_EMPLOYEES || posts.length > MAX_POSTS || followups.length > MAX_EMPLOYEES) throw new Error("RESULT_LIMIT_EXCEEDED");
  const activeEmployees = employees.filter((row) =>
    storeIdSet.has(String(row.store_id || "")) &&
    row.is_active === true &&
    !/退職|休職|産休|育休/.test(String(row.employment_status || ""))
  );
  const boundedPosts = posts.filter((row) => {
    if (!storeIdSet.has(String(row.receiver_store_id || ""))) return false;
    const time = new Date(String(row.created_at || "")).getTime();
    return Number.isFinite(time) && time >= previousStart.getTime() && time < now.getTime();
  });
  const employeeStore = new Map(activeEmployees.map((row) => [String(row.id || ""), String(row.store_id || "")]));
  const employeesById = new Map(employees.map((row) => [String(row.id || ""), row]));
  const output = stores.flatMap((store) => {
    const storeId = String(store.id || "");
    const activeIds = new Set(activeEmployees.filter((row) => String(row.store_id || "") === storeId).map((row) => String(row.id || "")));
    if (activeIds.size < MIN_COHORT) return [];
    const storeEmployees = activeEmployees.filter((row) => String(row.store_id || "") === storeId);
    const storePosts = boundedPosts.filter((row) => String(row.receiver_store_id || "") === storeId);
    const storeFollowups = followups
      .filter((row) => String(row.store_id || "") === storeId && FOLLOWUP_STATUSES.has(String(row.status || "")))
      .map((row) => followupResult(row, employeesById))
      .filter((row) => uuid(row.targetEmployeeId))
      .slice(0, MAX_SUPPORT_SIGNALS_PER_STORE);
    const ranges = [[previousStart, currentStart], [currentStart, now]] as const;
    const periods = ranges.flatMap(([start, end]) => {
      const rows = storePosts.filter((row) => {
        const time = new Date(String(row.created_at || "")).getTime();
        return time >= start.getTime() && time < end.getTime();
      });
      if (activeIds.size < MIN_COHORT || rows.length < MIN_COHORT) return [];
      return [{ periodStart: start.toISOString().slice(0, 10), periodEnd: new Date(end.getTime() - 1).toISOString().slice(0, 10), ...aggregate(rows, activeIds, employeeStore, storeId) }];
    });
    const support = activitySupportSignals(storeEmployees, posts, previousStart, currentStart, now);
    return [{
      storeLabel: String(store.store_name || "店舗"),
      availability: periods.length === 2 ? "AGGREGATE_READY" : "INSUFFICIENT_DATA",
      periods,
      ...support,
      followups: storeFollowups,
    }];
  });
  return monitoringResult(output);
}

function assertExactPayload(payload: JsonRecord) {
  const keys = Object.keys(payload).sort();
  const expected = ["nextReviewOn", "status", "targetEmployeeId"];
  if (keys.length !== expected.length || !keys.every((key, index) => key === expected[index])) throw new Error("INVALID_REQUEST");
}

export async function saveIdeaLinkActivityFollowup(
  actor: JsonRecord,
  payload: JsonRecord,
  readRows: ReadRows,
  now = new Date(),
) {
  assertExactPayload(payload);
  const actorId = String(actor.id || "");
  const targetEmployeeId = String(payload.targetEmployeeId || "");
  const status = String(payload.status || "");
  const nextReviewOn = payload.nextReviewOn === null || payload.nextReviewOn === "" ? null : String(payload.nextReviewOn);
  if (!uuid(actorId) || !uuid(targetEmployeeId) || !FOLLOWUP_STATUSES.has(status) ||
    (nextReviewOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(nextReviewOn))) throw new Error("INVALID_REQUEST");
  const observation = await readOrganizationHealthMonitoringCandidate(actor, readRows, now);
  let matchedStore: JsonRecord | null = null;
  let matchedSignal: JsonRecord | null = null;
  let matchedFollowup: JsonRecord | null = null;
  for (const store of Array.isArray(observation.stores) ? observation.stores as JsonRecord[] : []) {
    const signal = (Array.isArray(store.activitySignals) ? store.activitySignals : [])
      .map(record)
      .find((item) => String(item.targetEmployeeId || "") === targetEmployeeId);
    const followup = (Array.isArray(store.followups) ? store.followups : [])
      .map(record)
      .find((item) => String(item.targetEmployeeId || "") === targetEmployeeId);
    if (signal || followup) {
      matchedStore = store;
      matchedSignal = signal || null;
      matchedFollowup = followup || null;
      break;
    }
  }
  if (!matchedStore || (!matchedSignal && !matchedFollowup)) throw new Error("FOLLOWUP_TARGET_NOT_ELIGIBLE");
  const targetRows = await readRows("employees", {
    query: { select: "id,store_id,is_active,employment_status", id: `eq.${targetEmployeeId}`, limit: "1" },
  });
  const target = targetRows[0];
  const scope = scopeFor(actor);
  const targetStoreId = String(target?.store_id || "");
  if (!target || target.is_active !== true || !uuid(targetStoreId) ||
    (!scope.all && !scope.storeIds.includes(targetStoreId))) throw new Error("ACCESS_DENIED");
  let categories = Array.isArray(matchedSignal?.signalCategories)
    ? matchedSignal.signalCategories.map(String).filter((category) => ACTIVITY_SIGNAL_CATEGORIES.has(category))
    : [];
  let existingRow: JsonRecord | null = null;
  if (matchedFollowup) {
    const existingRows = await readRows("idea_link_activity_followups", {
      query: {
        select: "target_employee_id,store_id,signal_categories",
        target_employee_id: `eq.${targetEmployeeId}`,
        store_id: `eq.${targetStoreId}`,
        limit: "1",
      },
    });
    existingRow = existingRows[0] || null;
    if (!categories.length && Array.isArray(existingRow?.signal_categories)) {
      categories = existingRow.signal_categories.map(String).filter((category) => ACTIVITY_SIGNAL_CATEGORIES.has(category));
    }
  }
  if (!categories.length) throw new Error("FOLLOWUP_TARGET_NOT_ELIGIBLE");
  const updatedAt = now.toISOString();
  const payloadBase = {
    store_id: targetStoreId,
    signal_categories: categories,
    status,
    assigned_to_employee_id: actorId,
    next_review_on: nextReviewOn,
    updated_by_employee_id: actorId,
    updated_at: updatedAt,
  };
  const saved = await readRows("idea_link_activity_followups", {
    method: existingRow ? "PATCH" : "POST",
    query: existingRow
      ? { target_employee_id: `eq.${targetEmployeeId}`, select: "target_employee_id,status,next_review_on,updated_at" }
      : { on_conflict: "target_employee_id", select: "target_employee_id,status,next_review_on,updated_at" },
    payload: existingRow
      ? payloadBase
      : { target_employee_id: targetEmployeeId, created_by_employee_id: actorId, ...payloadBase },
    prefer: existingRow ? "return=representation" : "resolution=merge-duplicates,return=representation",
  });
  if (saved.length !== 1) throw new Error("FOLLOWUP_SAVE_FAILED");
  return {
    targetEmployeeId,
    status,
    nextReviewOn,
    updatedAt: String(saved[0].updated_at || updatedAt),
    mutationCount: 1,
    rawValuesIncluded: false,
  };
}

function monitoringResult(stores: JsonRecord[]) {
  return {
    contract: "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V4",
    stores,
    safeguards: {
      aggregateOnly: true,
      minimumCohort: MIN_COHORT,
      maximumPeriods: 13,
      individualSupportSignals: true,
      individualRanking: false,
      turnoverPrediction: false,
      rawTextIncluded: false,
      automatedEmploymentDecision: false,
      supportSignalMeaning: "CONVERSATION_PROMPT_ONLY",
      followupFreeText: false,
      followupStatusesOnly: true,
    },
  };
}
