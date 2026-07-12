import {
  assertPublicManagementPayloadSafe,
  handleManagementReadOnlyAction,
  MANAGEMENT_GATE_C4_CANDIDATE,
  type JsonRecord,
  type ManagementAction,
  type ManagementDependencies,
  type ReadQuery,
} from "../supabase/functions/nov-hub-api/management_readonly_candidate.ts";

const EMPLOYEE_ID = "11111111-1111-4111-8111-111111111111";
const STORE_ID = "22222222-2222-4222-8222-222222222222";
const CORPORATION_ID = "33333333-3333-4333-8333-333333333333";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function depsFor(roleKey: string, auth = true): ManagementDependencies {
  return {
    verifyHubSession: async () => auth ? ({ subject: EMPLOYEE_ID }) : null,
    resolveEmployee: async () => ({ id: EMPLOYEE_ID }),
    today: () => "2026-07-12",
    assignedScopeEnabled: true,
    db: {
      select: async (table: string, query: ReadQuery): Promise<JsonRecord[]> => {
        if (table === "employees" && query.id) return [{ id: EMPLOYEE_ID, store_id: STORE_ID, employment_status: "active", is_active: true }];
        if (table === "employees" && query.store_id) return [{ store_id: STORE_ID, employment_status: "active", is_active: true }];
        if (table === "employee_login_credentials") return [{ employee_id: EMPLOYEE_ID, login_enabled: true, locked_until: null }];
        if (table === "employee_roles") return [{ role_id: "role-1" }];
        if (table === "roles") return [{ id: "role-1", role_key: roleKey, is_active: true }];
        if (table === "employee_store_assignments") return [{ store_id: STORE_ID, assignment_type: "primary", assignment_order: 1, effective_from: "2026-01-01", effective_to: null, is_active: true }];
        if (table === "stores") return [{ id: STORE_ID, store_no: "S01", store_id: "S01", store_name: "テスト店舗", corporation_id: CORPORATION_ID, is_active: true }];
        if (table === "corporations") return [{ id: CORPORATION_ID, corporation_code: "C01", corporation_name: "テスト法人", is_active: true }];
        if (table === "finance_monthly_corporate_pl") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, total_sales_yen: 12000000, ordinary_profit_yen: 1200000, ordinary_profit_rate: 0.1, break_even_ratio: 0.8 }];
        if (table === "finance_monthly_corporate_bs") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, cash_yen: 5000000, net_assets_yen: 20000000, equity_ratio: 0.4 }];
        if (table === "finance_monthly_cash_positions") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, cash_balance_yen: 5000000, survival_months: 4, cash_status: "safe" }];
        if (table === "finance_source_documents") return [{ document_type: "trial_balance", source_system: "yayoi", period_start_month: "2026-06-01", period_end_month: "2026-06-01", imported_at: "2026-07-01T00:00:00Z" }];
        return [];
      },
      count: async (table: string, query: ReadQuery) => {
        if (table === "finance_accounting_monthly_raw") return 24;
        if (table === "finance_account_classification_rules" && query.review_status === "eq.review") return 2;
        if (table === "finance_account_classification_rules" && query.review_status === "eq.approved") return 8;
        return 0;
      },
    },
  };
}

async function run(action: ManagementAction, roleKey: string, auth = true) {
  return await handleManagementReadOnlyAction({ action, token: auth ? "fixture-token" : "", payload: {} }, depsFor(roleKey, auth));
}

Deno.test("all management actions are enabled", () => {
  const enabled = MANAGEMENT_GATE_C4_CANDIDATE.productionEnabledByAction;
  assert(enabled.managementFinanceSummary === true, "finance must be enabled");
  assert(enabled.managementStoresSummary === true, "stores must be enabled");
  assert(enabled.managementDataopsStatus === true, "dataops must be enabled");
});

Deno.test("executive can read finance summary without raw UUID", async () => {
  const result = await run("managementFinanceSummary", "executive");
  assert(result.status === 200, `expected 200, got ${result.status}`);
  assertPublicManagementPayloadSafe(result.body);
  assert(JSON.stringify(result.body).includes("テスト法人"), "corporation display name missing");
  assert(!JSON.stringify(result.body).includes(CORPORATION_ID), "raw corporation UUID leaked");
});

Deno.test("store manager receives own-store summary", async () => {
  const result = await run("managementStoresSummary", "store_manager");
  assert(result.status === 200, `expected 200, got ${result.status}`);
  const body = result.body as { data?: { phase0Scope?: string } };
  assert(body.data?.phase0Scope === "own_store", "own-store scope was not applied");
  assertPublicManagementPayloadSafe(result.body);
});

Deno.test("executive can read dataops status", async () => {
  const result = await run("managementDataopsStatus", "executive");
  assert(result.status === 200, `expected 200, got ${result.status}`);
  assertPublicManagementPayloadSafe(result.body);
});

Deno.test("department manager remains denied", async () => {
  const result = await run("managementFinanceSummary", "department_manager");
  assert(result.status === 403, `expected 403, got ${result.status}`);
});

Deno.test("missing hub session remains denied", async () => {
  const result = await run("managementFinanceSummary", "executive", false);
  assert(result.status === 401, `expected 401, got ${result.status}`);
});

Deno.test("staff cannot read management data", async () => {
  const result = await run("managementStoresSummary", "staff");
  assert(result.status === 403, `expected 403, got ${result.status}`);
});
