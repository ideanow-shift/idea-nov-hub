import { readOrganizationHealthMonitoringCandidate } from "../../supabase/functions/nov-hub-api/organization_health_monitoring_candidate.ts";

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const storeId = "11111111-1111-4111-8111-111111111111";
const employees = Array.from({ length: 5 }, (_, index) => ({ id: `employee-${index}`, store_id: storeId, is_active: true, employment_status: "在職" }));
const post = (created_at: string, index: number) => ({ sender_id: `employee-${index % 5}`, receiver_id: `employee-${(index + 1) % 5}`, receiver_store_id: storeId, category: "感謝", status: "active", visibility: "public", created_at });
const posts = [...Array.from({ length: 5 }, (_, index) => post("2026-05-20T00:00:00.000Z", index)), ...Array.from({ length: 5 }, (_, index) => post("2026-06-20T00:00:00.000Z", index))];
const actor = { isActive: true, employmentStatus: "在職", roleKeys: ["idea_link.manager"], storeAssignments: [{ storeId }], primaryStore: null };
const reader = async (table: string) => table === "stores" ? [{ id: storeId, store_name: "東久留米店", is_active: true }] : table === "employees" ? employees : posts;

Deno.test("returns two aggregate periods without identifiers", async () => {
  const result = await readOrganizationHealthMonitoringCandidate(actor, reader, new Date("2026-07-01T00:00:00.000Z"));
  const stores = result.stores as Array<{ periods: unknown[] }>;
  assert(stores[0].periods.length === 2, "period count");
  const text = JSON.stringify(result);
  for (const forbidden of ["employee-", storeId, "sender_id", "receiver_id", "body"]) assert(!text.includes(forbidden), `exposure ${forbidden}`);
});
Deno.test("minimum cohort suppresses output periods", async () => {
  const result = await readOrganizationHealthMonitoringCandidate(actor, async (table: string) => table === "stores" ? [{ id: storeId, store_name: "鷺宮店" }] : table === "employees" ? employees.slice(0, 4) : posts, new Date("2026-07-01T00:00:00.000Z"));
  const stores = result.stores as Array<{ availability: string; periods: unknown[] }>;
  assert(stores[0].availability === "INSUFFICIENT_DATA" && stores[0].periods.length === 0, "cohort suppression");
});
Deno.test("inactive actor fails closed", async () => {
  let failed = false; try { await readOrganizationHealthMonitoringCandidate({ ...actor, isActive: false }, reader); } catch { failed = true; }
  assert(failed, "inactive actor accepted");
});
Deno.test("manager without store assignment fails closed", async () => {
  let failed = false; try { await readOrganizationHealthMonitoringCandidate({ ...actor, storeAssignments: [] }, reader); } catch { failed = true; }
  assert(failed, "unscoped manager accepted");
});
Deno.test("safety contract remains aggregate read-only", async () => {
  const result = await readOrganizationHealthMonitoringCandidate(actor, reader, new Date("2026-07-01T00:00:00.000Z"));
  assert(result.safeguards.aggregateOnly === true && result.safeguards.turnoverPrediction === false && result.safeguards.automatedEmploymentDecision === false, "safety contract");
});


