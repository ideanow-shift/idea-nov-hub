type JsonRecord = Record<string, unknown>;
type ReadRows = (table: string, options: { query: JsonRecord }) => Promise<JsonRecord[]>;

const MIN_COHORT = 5;
const MAX_STORES = 40;
const MAX_EMPLOYEES = 2000;
const MAX_POSTS = 10000;
const WINDOW_MS = 28 * 24 * 60 * 60 * 1000;

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
    if (sender) senders.add(sender);
    if (receiver) receivers.add(receiver);
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
  const [employees, posts] = await Promise.all([
    readRows("employees", { query: { select: "id,store_id,is_active,employment_status", store_id: `in.(${storeIds.join(",")})`, is_active: "eq.true", limit: String(MAX_EMPLOYEES + 1) } }),
    readRows("idea_link_posts", { query: { select: "sender_id,receiver_id,receiver_store_id,category,status,visibility,created_at", receiver_store_id: `in.(${storeIds.join(",")})`, status: "eq.active", visibility: "eq.public", and: `(created_at.gte.${previousStart.toISOString()},created_at.lt.${now.toISOString()})`, order: "created_at.asc", limit: String(MAX_POSTS + 1) } }),
  ]);
  if (employees.length > MAX_EMPLOYEES || posts.length > MAX_POSTS) throw new Error("RESULT_LIMIT_EXCEEDED");
  const activeEmployees = employees.filter((row) => row.is_active === true && !/退職|休職|産休|育休/.test(String(row.employment_status || "")));
  const employeeStore = new Map(activeEmployees.map((row) => [String(row.id || ""), String(row.store_id || "")]));
  const output = stores.map((store) => {
    const storeId = String(store.id || "");
    const activeIds = new Set(activeEmployees.filter((row) => String(row.store_id || "") === storeId).map((row) => String(row.id || "")));
    const storePosts = posts.filter((row) => String(row.receiver_store_id || "") === storeId);
    const ranges = [[previousStart, currentStart], [currentStart, now]] as const;
    const periods = ranges.flatMap(([start, end]) => {
      const rows = storePosts.filter((row) => {
        const time = new Date(String(row.created_at || "")).getTime();
        return time >= start.getTime() && time < end.getTime();
      });
      if (activeIds.size < MIN_COHORT || rows.length < MIN_COHORT) return [];
      return [{ periodStart: start.toISOString().slice(0, 10), periodEnd: new Date(end.getTime() - 1).toISOString().slice(0, 10), ...aggregate(rows, activeIds, employeeStore, storeId) }];
    });
    return { storeLabel: String(store.store_name || "店舗"), availability: periods.length ? "AGGREGATE_READY" : "INSUFFICIENT_DATA", periods };
  });
  return monitoringResult(output);
}

function monitoringResult(stores: JsonRecord[]) {
  return {
    contract: "IDEA_LINK_ORGANIZATION_HEALTH_MONITORING_V2_CANDIDATE",
    stores,
    safeguards: { aggregateOnly: true, minimumCohort: MIN_COHORT, maximumPeriods: 13, individualRanking: false, turnoverPrediction: false, rawTextIncluded: false, automatedEmploymentDecision: false },
  };
}


