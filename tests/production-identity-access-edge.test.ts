import { assert, assertEquals } from "jsr:@std/assert";
import {
  denyManagementAccess,
  handleManagementReadOnlyAction,
  type ManagementDependencies,
} from "../supabase/functions/nov-hub-api/management_readonly_candidate.ts";
import {
  isStoreOperationsProductionRolloutDenied,
  resolveProductionCanonicalAccess,
} from "../supabase/functions/nov-hub-api/store_operations_production_access.mjs";

const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stores = Array.from({ length: 20 }, (_, i) => ({ id: uuid(i+1), store_id: `s-${i+1}`, store_no: String(i+1),
  store_name: `Fixture ${i+1}`, corporation_id: uuid(501), store_type: i<13 ? "DIRECT" : "FC", is_active: true }));
for (const [role, mode, count] of [["executive","all",20],["area_manager","assigned",1],["store_manager","own",1]] as const) {
  for (const spoof of [false,true]) Deno.test(`Production resolver -> formal DBF -> public projection: ${role} spoof=${spoof}`, async () => {
    const response = { contract: "production_identity_access_v1", employeeId: uuid(101), roleKeys: [role],
      scope: { mode, storeIds: stores.slice(0,count).map(s=>s.id) },
      masters: { stores, corporations: [{ id: uuid(501), corporation_name: "Fixture", is_active: true }],
        corporation_business_profiles: [{ corporation_id: uuid(501), fiscal_year_end_month: 8 }] } };
    const access = await resolveProductionCanonicalAccess({ projectRef: "nkmxevmioczcmnldreyo", rolloutState: "GENERAL", ownerEmployeeId: uuid(101),
      session: { authType: "hub_session", employeeId: uuid(101), sessionId: uuid(900), audience: "nov_hub", expiresAt: "2099-01-01T00:00:00Z" },
      rpc: async () => response });
    const calls: unknown[][] = [];
    const deps: ManagementDependencies = {
      verifyHubSession: async () => ({ subject: uuid(101) }),
      resolveCanonicalAccess: async () => access,
      resolveEmployee: async () => { throw new Error("Legacy employee fallback forbidden"); },
      assignedScopeEnabled: true,
      db: {
        count: async () => 0,
        select: async (table) => {
          assert(["stores","corporations","corporation_business_profiles"].includes(table), "Legacy auth master read forbidden");
          return access.masters[table];
        },
        rpc: async (name, args) => { calls.push([name,args]); return []; },
      },
    };
    const result = await handleManagementReadOnlyAction({ action: "storeMonthlyActualProjectionV1", token: "fixture-only",
      payload: { selectedMonth: "2026-06", scopeMode: spoof ? "all" : mode } }, deps);
    if (spoof && mode!=="all") { assertEquals(result.status,403); assertEquals(calls.length,0); return; }
    assertEquals(result.status,200);
    const data = result.body.data as { stores: { metrics: unknown[]; dataState: string }[] };
    assertEquals(data.stores.length,count);
    assert(data.stores.every(s=>s.dataState==="preparing" && s.metrics.length===0));
    assert(calls.length>0);
    for (const [,args] of calls) assertEquals((args as {p_store_ids:string[]}).p_store_ids, access.scope.storeIds);
    assert(!JSON.stringify(result.body).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i));
  });
}

function denialDependencies(options: { rolloutState?: string; ownerEmployeeId?: string; rpc?: () => unknown } = {}): ManagementDependencies {
  const response = { contract: "production_identity_access_v1", employeeId: uuid(101), roleKeys: ["executive"],
    scope: { mode: "all", storeIds: stores.map((store) => store.id) },
    masters: { stores, corporations: [{ id: uuid(501), corporation_name: "Fixture", is_active: true }],
      corporation_business_profiles: [{ corporation_id: uuid(501), fiscal_year_end_month: 8 }] } };
  const session = { authType: "hub_session", employeeId: uuid(101), sessionId: uuid(900), audience: "nov_hub", expiresAt: "2099-01-01T00:00:00Z" };
  return {
    verifyHubSession: async (token) => token ? { subject: uuid(101) } : null,
    resolveEmployee: async () => null,
    resolveCanonicalAccess: async () => {
      try {
        return await resolveProductionCanonicalAccess({
          projectRef: "nkmxevmioczcmnldreyo",
          rolloutState: options.rolloutState || "OWNER_PILOT",
          ownerEmployeeId: options.ownerEmployeeId ?? uuid(101),
          session,
          rpc: options.rpc || (async () => response),
        });
      } catch (error) {
        if (isStoreOperationsProductionRolloutDenied(error)) denyManagementAccess();
        throw error;
      }
    },
    assignedScopeEnabled: true,
    db: { count: async () => 0, select: async () => [], rpc: async () => [] },
  };
}

const denialRequest = (token = "signed-hub-session") => ({
  action: "storeMonthlyActualProjectionV1" as const,
  token,
  payload: { selectedMonth: "2026-06" },
});

Deno.test("DISABLED maps a valid canonical Owner to generic HTTP 403", async () => {
  const result = await handleManagementReadOnlyAction(denialRequest(), denialDependencies({ rolloutState: "DISABLED" }));
  assertEquals(result.status, 403);
  assertEquals(result.body.error, { code: "ACCESS_DENIED", message: "Access denied.", retryable: false });
  assert(!JSON.stringify(result.body).match(/PRODUCTION_|DISABLED|OWNER_PILOT|employee|session|token|uuid/iu));
});

Deno.test("OWNER_PILOT non-owner maps to the same generic HTTP 403", async () => {
  const result = await handleManagementReadOnlyAction(denialRequest(), denialDependencies({ ownerEmployeeId: uuid(999) }));
  assertEquals(result.status, 403);
  assertEquals((result.body.error as { code: string }).code, "ACCESS_DENIED");
});

Deno.test("unauthenticated Production Store Operations remains HTTP 401", async () => {
  const result = await handleManagementReadOnlyAction(denialRequest(""), denialDependencies());
  assertEquals(result.status, 401);
  assertEquals((result.body.error as { code: string }).code, "UNAUTHORIZED");
});

Deno.test("unexpected Production resolver RPC failure remains safe HTTP 500", async () => {
  const result = await handleManagementReadOnlyAction(denialRequest(), denialDependencies({
    rpc: async () => { throw new Error("secret database failure"); },
  }));
  assertEquals(result.status, 500);
  assertEquals(result.body.error, { code: "UNKNOWN", message: "Management summary could not be loaded.", retryable: true });
  assert(!JSON.stringify(result.body).includes("secret database failure"));
});

Deno.test("malformed Production resolver response remains safe HTTP 500", async () => {
  const result = await handleManagementReadOnlyAction(denialRequest(), denialDependencies({ rpc: async () => ({ malformed: true }) }));
  assertEquals(result.status, 500);
  assertEquals((result.body.error as { code: string }).code, "UNKNOWN");
});
