import { handleManagementReadOnlyAction } from "../supabase/functions/nov-hub-api/management_readonly_candidate.ts";

const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const CORPORATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const DEPARTMENT_ID = "44444444-4444-4444-8444-444444444444";
const POSITION_ID = "55555555-5555-4555-8555-555555555555";

function equal(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

function dependencies({ auth = true, roleKey = "business_data_admin" } = {}) {
  return {
    verifyHubSession: async () => auth ? { subject: "fixture" } : null,
    resolveEmployee: async () => auth ? { id: EMPLOYEE_ID } : null,
    today: () => "2026-07-31",
    assignedScopeEnabled: false,
    db: {
      count: async () => 0,
      select: async (table: string) => {
        if (table === "employees") return [{ id: EMPLOYEE_ID, corporation_id: CORPORATION_ID, department_id: DEPARTMENT_ID, position_id: POSITION_ID, store_id: STORE_ID, employment_status: "active", is_active: true }];
        if (table === "employee_login_credentials") return [{ employee_id: EMPLOYEE_ID, login_enabled: true, locked_until: null }];
        if (table === "employee_roles") return [{ role_id: "role-1", scope_type: "all", scope_id: null, is_active: true }];
        if (table === "roles") return [{ id: "role-1", role_key: roleKey, is_active: true }];
        if (table === "positions") return [{ id: POSITION_ID, is_active: true }];
        if (table === "departments") return [{ id: DEPARTMENT_ID, is_active: true }];
        if (table === "employee_assignment_histories") return [{ employee_id: EMPLOYEE_ID, corporation_id: CORPORATION_ID, department_id: DEPARTMENT_ID, position_id: POSITION_ID, store_id: STORE_ID, effective_from: "2026-01-01", effective_to: null, is_active: true }];
        return [];
      },
    },
  };
}

Deno.test("business_data_admin requires backend auth and canonical effective context", async () => {
  const allowed = await handleManagementReadOnlyAction({ action: "managementBusinessDataCapability", token: "token", payload: {} }, dependencies());
  const data = allowed.body.data as { capability: { businessDataAdmin: boolean }; runtimeImport: string; productionWrite: string };
  equal(allowed.status, 200);
  equal(data.capability.businessDataAdmin, true);
  equal(data.runtimeImport, "DISABLED");
  equal(data.productionWrite, "DISABLED");

  const unauthorized = await handleManagementReadOnlyAction({ action: "managementBusinessDataCapability", token: "token", payload: {} }, dependencies({ roleKey: "staff" }));
  equal(unauthorized.status, 403);

  const missing = await handleManagementReadOnlyAction({ action: "managementBusinessDataCapability", token: "", payload: {} }, dependencies({ auth: false }));
  equal(missing.status, 401);
});
