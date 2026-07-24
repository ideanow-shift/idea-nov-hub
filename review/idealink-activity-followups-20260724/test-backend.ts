import {
  readOrganizationHealthMonitoringCandidate,
  saveIdeaLinkActivityFollowup,
} from "../../supabase/functions/nov-hub-api/organization_health_monitoring_candidate.ts";

type Row = Record<string, unknown>;
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const storeId = "11111111-1111-4111-8111-111111111111";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ids = [
  actorId,
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
];
const employees = ids.map((id, index) => ({
  id,
  full_name: `対象${index + 1}`,
  store_id: storeId,
  is_active: true,
  employment_status: "在職",
  joined_on: "2025-01-01",
}));
const post = (created_at: string, sender: string, receiver: string): Row => ({
  sender_id: sender,
  receiver_id: receiver,
  receiver_store_id: storeId,
  category: "感謝",
  status: "active",
  visibility: "public",
  created_at,
});
const posts = [
  post("2026-05-20T00:00:00.000Z", ids[0], ids[1]),
  post("2026-05-21T00:00:00.000Z", ids[0], ids[1]),
  post("2026-05-22T00:00:00.000Z", ids[0], ids[1]),
  post("2026-05-23T00:00:00.000Z", ids[2], ids[3]),
  post("2026-05-24T00:00:00.000Z", ids[3], ids[4]),
  post("2026-06-20T00:00:00.000Z", ids[2], ids[3]),
  post("2026-06-21T00:00:00.000Z", ids[2], ids[3]),
  post("2026-06-22T00:00:00.000Z", ids[3], ids[4]),
  post("2026-06-23T00:00:00.000Z", ids[4], ids[2]),
  post("2026-06-24T00:00:00.000Z", ids[4], ids[2]),
];
const actor = {
  id: actorId,
  isActive: true,
  employmentStatus: "在職",
  roleKeys: ["idea_link.manager"],
  storeAssignments: [{ storeId }],
  primaryStore: null,
};
let writeCount = 0;
const reader = async (table: string, options: { method?: string; payload?: unknown } = {}) => {
  if (options.method === "POST") {
    writeCount += 1;
    const payload = options.payload as Row;
    return [{ ...payload, updated_at: payload.updated_at }];
  }
  if (table === "stores") return [{ id: storeId, store_name: "立川店", is_active: true }];
  if (table === "employees") return employees;
  if (table === "idea_link_posts") return posts;
  if (table === "idea_link_activity_followups") return [];
  return [];
};

Deno.test("detects send and receive changes without counts or scores", async () => {
  const result = await readOrganizationHealthMonitoringCandidate(actor, reader, new Date("2026-07-01T00:00:00.000Z"));
  const store = (result.stores as Row[])[0];
  const signals = store.activitySignals as Row[];
  const first = signals.find((item) => item.targetEmployeeId === ids[0]);
  const second = signals.find((item) => item.targetEmployeeId === ids[1]);
  assert((first?.signalCategories as string[]).includes("PUBLIC_SEND_ACTIVITY_STOPPED"), "send stopped missing");
  assert((second?.signalCategories as string[]).includes("PUBLIC_RECEIVE_ACTIVITY_STOPPED"), "receive stopped missing");
  const serialized = JSON.stringify(result);
  for (const forbidden of ["score", "motivation", "postCount", "receiveCount", "body"]) {
    assert(!serialized.toLowerCase().includes(forbidden.toLowerCase()), `forbidden output: ${forbidden}`);
  }
  assert(result.safeguards.individualRanking === false && result.safeguards.turnoverPrediction === false, "safeguards");
});

Deno.test("recent joiner is not labeled long-term inactive", async () => {
  const joined = employees.map((employee, index) => index === 4 ? { ...employee, joined_on: "2026-06-15" } : employee);
  const localReader = async (table: string, options: { method?: string; payload?: unknown } = {}) =>
    table === "employees" ? joined : reader(table, options);
  const result = await readOrganizationHealthMonitoringCandidate(actor, localReader, new Date("2026-07-01T00:00:00.000Z"));
  const signal = ((result.stores as Row[])[0].activitySignals as Row[]).find((item) => item.targetEmployeeId === ids[4]);
  assert(!(signal?.signalCategories as string[] | undefined)?.includes("NO_PUBLIC_SEND_ACTIVITY"), "recent joiner send inactivity");
  assert(!(signal?.signalCategories as string[] | undefined)?.includes("NO_PUBLIC_RECEIVE_ACTIVITY"), "recent joiner receive inactivity");
});

Deno.test("save derives signals server-side and writes exactly once", async () => {
  writeCount = 0;
  const result = await saveIdeaLinkActivityFollowup(actor, {
    targetEmployeeId: ids[0],
    status: "CONTACTED",
    nextReviewOn: "2026-07-08",
  }, reader, new Date("2026-07-01T00:00:00.000Z"));
  assert(writeCount === 1, "write count");
  assert(result.mutationCount === 1 && result.rawValuesIncluded === false, "save result");
});

Deno.test("extra, missing, invalid fields fail before DB access", async () => {
  for (const payload of [
    { targetEmployeeId: ids[0], status: "PENDING", nextReviewOn: null, note: "blocked" },
    { targetEmployeeId: ids[0], status: "UNKNOWN", nextReviewOn: null },
    { targetEmployeeId: ids[0], status: "PENDING" },
  ]) {
    writeCount = 0;
    let failed = false;
    try { await saveIdeaLinkActivityFollowup(actor, payload, reader); } catch { failed = true; }
    assert(failed && writeCount === 0, "invalid payload reached write");
  }
});

Deno.test("continuing followup can complete without replacing creator", async () => {
  let writeMethod = "";
  let writtenPayload: Row = {};
  const continuingReader = async (table: string, options: { method?: string; query?: Row; payload?: unknown } = {}) => {
    if (options.method) {
      writeMethod = options.method;
      writtenPayload = options.payload as Row;
      return [{ target_employee_id: ids[0], status: writtenPayload.status, next_review_on: null, updated_at: writtenPayload.updated_at }];
    }
    if (table === "stores") return [{ id: storeId, store_name: "立川店", is_active: true }];
    if (table === "employees") return employees;
    if (table === "idea_link_posts") return [
      ...posts.filter((row) => row.sender_id !== ids[0] && row.receiver_id !== ids[0]),
      post("2026-05-20T00:00:00.000Z", ids[0], ids[2]),
      post("2026-06-20T00:00:00.000Z", ids[0], ids[2]),
      post("2026-05-20T00:00:00.000Z", ids[2], ids[0]),
      post("2026-06-20T00:00:00.000Z", ids[2], ids[0]),
    ];
    if (table === "idea_link_activity_followups" && options.query?.target_employee_id) {
      return [{ target_employee_id: ids[0], store_id: storeId, signal_categories: ["PUBLIC_SEND_ACTIVITY_STOPPED"] }];
    }
    if (table === "idea_link_activity_followups") {
      return [{
        target_employee_id: ids[0],
        store_id: storeId,
        status: "MONITORING",
        assigned_to_employee_id: actorId,
        next_review_on: null,
        updated_at: "2026-06-30T00:00:00.000Z",
      }];
    }
    return [];
  };
  const result = await saveIdeaLinkActivityFollowup(actor, {
    targetEmployeeId: ids[0],
    status: "COMPLETED",
    nextReviewOn: null,
  }, continuingReader, new Date("2026-07-01T00:00:00.000Z"));
  assert(result.status === "COMPLETED" && writeMethod === "PATCH", "continuing followup update");
  assert(!Object.hasOwn(writtenPayload, "created_by_employee_id"), "creator was replaced");
});

Deno.test("manager without store scope fails closed", async () => {
  let failed = false;
  try {
    await readOrganizationHealthMonitoringCandidate({ ...actor, storeAssignments: [] }, reader);
  } catch { failed = true; }
  assert(failed, "unscoped manager accepted");
});
