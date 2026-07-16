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
const MISSING_CORPORATION_ID = "55555555-5555-4555-8555-555555555555";
const DEPARTMENT_ID = "44444444-4444-4444-8444-444444444444";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type FixtureOptions = {
  employeeRows?: JsonRecord[];
  credentialRows?: JsonRecord[];
  assignmentRows?: JsonRecord[];
  staffRows?: JsonRecord[];
};

function depsFor(roleKey: string, auth = true, options: FixtureOptions = {}): ManagementDependencies {
  return {
    verifyHubSession: async () => auth ? ({ subject: EMPLOYEE_ID }) : null,
    resolveEmployee: async () => ({ id: EMPLOYEE_ID }),
    today: () => "2026-07-12",
    assignedScopeEnabled: true,
    db: {
      select: async (table: string, query: ReadQuery): Promise<JsonRecord[]> => {
        if (table === "employees" && query.id) return options.employeeRows ?? [{ id: EMPLOYEE_ID, store_id: STORE_ID, employment_status: "active", is_active: true }];
        if (table === "employees" && query.store_id) return [{ store_id: STORE_ID, employment_status: "active", is_active: true }];
        if (table === "employee_login_credentials") return options.credentialRows ?? [{ employee_id: EMPLOYEE_ID, login_enabled: true, locked_until: null }];
        if (table === "employee_roles") return options.assignmentRows ?? [{ role_id: "role-1", scope_type: "all", scope_id: null, is_active: true }];
        if (table === "roles") return [{ id: "role-1", role_key: roleKey, is_active: true }];
        if (table === "employee_store_assignments") return [{ store_id: STORE_ID, assignment_type: "primary", assignment_order: 1, effective_from: "2026-01-01", effective_to: null, is_active: true }];
        if (table === "stores") return [{ id: STORE_ID, store_no: "S01", store_id: "S01", store_name: "テスト店舗", corporation_id: CORPORATION_ID, is_active: true }];
        if (table === "corporations" && query.id) return [{ id: CORPORATION_ID, corporation_code: "C01", corporation_name: "テスト法人", is_active: true }];
        if (table === "corporations") return [{ id: CORPORATION_ID, corporation_code: "C01", corporation_name: "テスト法人", is_active: true }, { id: MISSING_CORPORATION_ID, corporation_code: "C02", corporation_name: "未取込法人", is_active: true }];
        if (table === "departments") return [{ id: DEPARTMENT_ID, department_code: "D01", department_name: "営業部", is_active: true }];
        if (table === "finance_monthly_corporate_pl") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, total_sales_yen: 12000000, ordinary_profit_yen: 1200000, ordinary_profit_rate: 0.1, break_even_ratio: 0.8 }];
        if (table === "finance_monthly_corporate_bs") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, cash_yen: 5000000, net_assets_yen: 20000000, equity_ratio: 0.4 }];
        if (table === "finance_monthly_cash_positions") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, cash_balance_yen: 5000000, survival_months: 4, cash_status: "safe" }];
        if (table === "finance_monthly_staff_counts") return options.staffRows ?? [{ corporation_id: CORPORATION_ID, staff_count: 10, source: "employees_snapshot" }];
        if (table === "finance_monthly_department_pl") return [{ month: "2026-06-01", corporation_id: CORPORATION_ID, department_id: DEPARTMENT_ID, sales_yen: 3000000, labor_cost_yen: 1200000, material_cost_yen: 200000, other_cost_yen: 400000, department_profit_yen: 1200000, profit_rate: 0.4, productivity_yen: 300000 }];
        if (table === "finance_expert_comments") return [{ comment_month: "2026-06-01", external_author_name: "専門家", organization: "経営支援", title: "月次所見", body: "利益とキャッシュを確認してください。", comment_scope: "group", is_active: true, created_at: "2026-07-01T00:00:00Z" }];
        if (table === "finance_ai_advice_logs") return [{ target_month: "2026-06-01", target_scope: "group", model: "approved-model", response: "保存済みアドバイス", created_at: "2026-07-01T00:00:00Z" }];
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

async function run(action: ManagementAction, roleKey: string, auth = true, options: FixtureOptions = {}) {
  return await handleManagementReadOnlyAction({ action, token: auth ? "fixture-token" : "", payload: {} }, depsFor(roleKey, auth, options));
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
  assert(JSON.stringify(result.body).includes("営業部"), "department display name missing");
  assert(JSON.stringify(result.body).includes("未取込法人"), "missing corporation must remain visible");
  const body = result.body as { data?: { dataQuality?: { activeCorporationCount?: number; currentMonthCorporationCount?: number; complete?: boolean } } };
  assert(body.data?.dataQuality?.activeCorporationCount === 2, "active corporation count mismatch");
  assert(body.data?.dataQuality?.currentMonthCorporationCount === 1, "current month coverage mismatch");
  assert(body.data?.dataQuality?.complete === false, "incomplete month must not be marked complete");
  const finance = body.data as { fourAxis?: Array<{ staffCount?: number | null }>; latestAdvice?: unknown; aiAdviceReadiness?: string; expertComments?: unknown[]; expertCommentReadiness?: string };
  assert(finance.fourAxis?.[0]?.staffCount === 10, "valid aggregate headcount missing");
  assert(finance.latestAdvice === null, "AI advice must remain hidden until aggregate provenance is confirmed");
  assert(finance.aiAdviceReadiness === "aggregate-input-provenance-pending", "AI advice readiness marker missing");
  assert(finance.expertComments?.length === 0, "free-text expert comments must remain hidden until aggregate provenance is confirmed");
  assert(finance.expertCommentReadiness === "aggregate-content-provenance-pending", "expert comment readiness marker missing");
  assert(!JSON.stringify(result.body).includes(CORPORATION_ID), "raw corporation UUID leaked");
  assert(!JSON.stringify(result.body).includes(DEPARTMENT_ID), "raw department UUID leaked");
});

Deno.test("store manager receives own-store summary", async () => {
  const result = await run("managementStoresSummary", "store_manager");
  assert(result.status === 200, `expected 200, got ${result.status}`);
  const body = result.body as { data?: { phase0Scope?: string } };
  assert(body.data?.phase0Scope === "own_store", "own-store scope was not applied");
  const stores = body.data as { staffCount?: number | null; stores?: Array<{ staffCount?: number | null }> };
  assert(stores.staffCount === null, "non-authoritative current store headcount must be hidden");
  assert(stores.stores?.[0]?.staffCount === null, "store headcount must be hidden until snapshot contract exists");
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

Deno.test("missing finance headcount remains null instead of zero", async () => {
  const result = await run("managementFinanceSummary", "executive", true, { staffRows: [] });
  const body = result.body as { data?: { fourAxis?: Array<{ staffCount?: number | null; salesPerStaffManYen?: number | null }> } };
  assert(result.status === 200, `expected 200, got ${result.status}`);
  assert(body.data?.fourAxis?.[0]?.staffCount === null, "missing headcount was converted to zero");
  assert(body.data?.fourAxis?.[0]?.salesPerStaffManYen === null, "productivity must remain uncalculated without headcount");
});

Deno.test("non-authoritative finance headcount source remains null", async () => {
  const result = await run("managementFinanceSummary", "executive", true, {
    staffRows: [{ corporation_id: CORPORATION_ID, staff_count: 10, source: "legacy_sheet" }],
  });
  const body = result.body as { data?: { fourAxis?: Array<{ staffCount?: number | null; salesPerStaffManYen?: number | null }> } };
  assert(result.status === 200, `expected 200, got ${result.status}`);
  assert(body.data?.fourAxis?.[0]?.staffCount === null, "untrusted headcount source was accepted");
  assert(body.data?.fourAxis?.[0]?.salesPerStaffManYen === null, "productivity used an untrusted headcount source");
});

Deno.test("inactive or noncanonical employee is denied fail closed", async () => {
  const result = await run("managementFinanceSummary", "executive", true, {
    employeeRows: [{ id: EMPLOYEE_ID, store_id: STORE_ID, employment_status: "active", is_active: null }],
  });
  assert(result.status === 401, `expected 401, got ${result.status}`);
});

Deno.test("duplicate or nullable login credential is denied fail closed", async () => {
  const duplicate = { employee_id: EMPLOYEE_ID, login_enabled: true, locked_until: null };
  const duplicateResult = await run("managementFinanceSummary", "executive", true, {
    credentialRows: [duplicate, duplicate],
  });
  assert(duplicateResult.status === 401, `expected duplicate credential denial, got ${duplicateResult.status}`);
  const nullableResult = await run("managementFinanceSummary", "executive", true, {
    credentialRows: [{ employee_id: EMPLOYEE_ID, login_enabled: null, locked_until: null }],
  });
  assert(nullableResult.status === 401, `expected nullable login denial, got ${nullableResult.status}`);
});

Deno.test("scoped executive assignment cannot acquire global management access", async () => {
  const result = await run("managementFinanceSummary", "executive", true, {
    assignmentRows: [{ role_id: "role-1", scope_type: "store", scope_id: STORE_ID, is_active: true }],
  });
  assert(result.status === 403, `expected 403, got ${result.status}`);
});

Deno.test("public management sanitizer rejects HR personal fields", () => {
  let rejected = false;
  try {
    assertPublicManagementPayloadSafe({ full_name: "fixture-person" });
  } catch (_error) {
    rejected = true;
  }
  assert(rejected, "full_name must be rejected from public management payloads");
});

Deno.test("diagnostic response profile remains exact status-only", async () => {
  const result = await handleManagementReadOnlyAction({
    action: "managementDataopsStatus",
    token: "fixture-token",
    payload: { responseProfile: "diagnostic-sanitized-v1" },
  }, depsFor("executive"));
  assert(result.status === 200, `expected 200, got ${result.status}`);
  const data = result.body.data as JsonRecord;
  assert(
    Object.keys(data).sort().join(",") === "pendingCounts,statusCounts,stoppedItems,workflow",
    "diagnostic response keys changed",
  );
  const forbiddenOrdinaryKeys = [
    "pendingImports",
    "pendingMappings",
    "pendingApprovals",
    "blockedReason",
    "sources",
    "name",
    "step",
    "title",
    "owner",
  ];
  const serialized = JSON.stringify(data);
  forbiddenOrdinaryKeys.forEach((key) => assert(!serialized.includes(`\"${key}\"`), `ordinary-only key leaked: ${key}`));
  assertPublicManagementPayloadSafe(result.body);
});

Deno.test("ordinary dataops response remains unchanged without profile", async () => {
  const result = await run("managementDataopsStatus", "executive");
  const data = result.body.data as JsonRecord;
  assert(result.status === 200, `expected 200, got ${result.status}`);
  assert(Object.hasOwn(data, "pendingImports"), "ordinary dataops producer changed");
  assert(!Object.hasOwn(data, "pendingCounts"), "diagnostic producer used without profile");
});

Deno.test("invalid response profiles fail closed", async () => {
  const invalidProfiles: unknown[] = ["unknown", null, false, 1, {}];
  for (const responseProfile of invalidProfiles) {
    const result = await handleManagementReadOnlyAction({
      action: "managementDataopsStatus",
      token: "fixture-token",
      payload: { responseProfile } as { responseProfile?: string },
    }, depsFor("executive"));
    assert(result.status === 400, `profile must fail closed: ${String(responseProfile)}`);
    const code = (result.body.error as JsonRecord | undefined)?.code;
    assert(code === "INVALID_REQUEST", `unexpected invalid profile category: ${String(code)}`);
  }
  const wrongAction = await handleManagementReadOnlyAction({
    action: "managementFinanceSummary",
    token: "fixture-token",
    payload: { responseProfile: "diagnostic-sanitized-v1" },
  }, depsFor("executive"));
  assert(wrongAction.status === 400, `diagnostic profile must not reach finance: ${wrongAction.status}`);
});
