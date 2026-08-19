import { assert, assertEquals } from "jsr:@std/assert";
import {
  handleManagementReadOnlyAction,
  type JsonRecord,
  type ManagementDependencies,
} from "../supabase/functions/nov-hub-api/management_readonly_candidate.ts";

const EMPLOYEE_ID = "10000000-0000-4000-8000-000000000001";
const COMPANY_DIRECT = "20000000-0000-4000-8000-000000000001";
const COMPANY_FC = "20000000-0000-4000-8000-000000000002";
const FACT_SHA = "a".repeat(64);

function store(index: number, ownership: "直営" | "FC" | "本部"): JsonRecord {
  const serial = String(index).padStart(12, "0");
  return {
    id: `30000000-0000-4000-8000-${serial}`,
    store_no: String(index).padStart(4, "0"),
    store_id: ownership === "本部"
      ? "honbu"
      : `store-${String(index).padStart(2, "0")}`,
    store_name: ownership === "本部" ? "本部" : `店舗${index}`,
    corporation_id: ownership === "FC" ? COMPANY_FC : COMPANY_DIRECT,
    store_type: ownership,
    is_active: true,
  };
}

const STORE_ROWS = [
  store(0, "本部"),
  ...Array.from({ length: 13 }, (_, index) => store(index + 1, "直営")),
  ...Array.from({ length: 7 }, (_, index) => store(index + 14, "FC")),
];

function dependencies(options: {
  roleKey?: string;
  employeeStoreId?: string | null;
  assignments?: JsonRecord[];
  assignedScopeEnabled?: boolean;
  factRows?: JsonRecord[];
  budgetRows?: JsonRecord[];
  captureRpc?: (name: string, args: JsonRecord) => void;
  includeRpc?: boolean;
} = {}): ManagementDependencies {
  const roleKey = options.roleKey || "executive";
  const includeRpc = options.includeRpc !== false;
  const db: ManagementDependencies["db"] = {
    async count() {
      return 0;
    },
    async select(table, query) {
      if (table === "employees") {
        return [{
          id: EMPLOYEE_ID,
          corporation_id: COMPANY_DIRECT,
          department_id: null,
          position_id: null,
          store_id: options.employeeStoreId ?? null,
          employment_status: "在籍",
          is_active: true,
        }];
      }
      if (table === "employee_login_credentials") {
        return [{
          employee_id: EMPLOYEE_ID,
          login_enabled: true,
          locked_until: null,
        }];
      }
      if (table === "employee_roles") {
        return [{
          role_id: "role-1",
          scope_type: roleKey === "store_manager" ? "store" : "global",
          scope_id: roleKey === "store_manager"
            ? options.employeeStoreId
            : null,
          is_active: true,
        }];
      }
      if (table === "roles") {
        return [{ id: "role-1", role_key: roleKey, is_active: true }];
      }
      if (table === "employee_store_assignments") {
        return options.assignments || [];
      }
      if (table === "stores") {
        const scopedIds =
          String(query.id || "").match(/^in\.\((.*)\)$/u)?.[1]?.split(",") ||
          null;
        return scopedIds
          ? STORE_ROWS.filter((row) => scopedIds.includes(String(row.id)))
          : STORE_ROWS;
      }
      if (table === "corporations") {
        return [
          { id: COMPANY_DIRECT, corporation_name: "IDEA NOV", is_active: true },
          { id: COMPANY_FC, corporation_name: "UNO", is_active: true },
        ];
      }
      if (table === "corporation_business_profiles") {
        return [
          { corporation_id: COMPANY_DIRECT, fiscal_year_end_month: 3 },
          { corporation_id: COMPANY_FC, fiscal_year_end_month: 3 },
        ];
      }
      return [];
    },
  };
  if (includeRpc) {
    db.rpc = async (name, args) => {
      options.captureRpc?.(name, args);
      const rows = name === "dbf_store_monthly_budget_range_read_v1"
        ? options.budgetRows || []
        : options.factRows || [];
      return rows.filter((row) =>
        row.company_id === args.p_company_id &&
        Array.isArray(args.p_store_ids) &&
        args.p_store_ids.includes(row.store_id)
      );
    };
  }
  return {
    verifyHubSession: async () => ({ subject: "verified" }),
    resolveEmployee: async () => ({ id: EMPLOYEE_ID }),
    db,
    today: () => "2026-08-19",
    assignedScopeEnabled: options.assignedScopeEnabled === true,
  };
}

function factForStore(rawStoreId: string): JsonRecord {
  return {
    fiscal_month: "2026-06-01",
    company_id: COMPANY_DIRECT,
    store_id: rawStoreId,
    metric_code: "TOTAL_SALES",
    value_kind: "amount",
    metric_value: "1234567.00",
    definition_version: "v1",
    display_name: "総売上",
    description: "Monthly gross sales at the canonical store grain.",
    source_type: "store_operating_result",
    source_file_sha256: FACT_SHA,
    imported_at: "2026-08-19T00:00:00Z",
    fact_version: 1,
  };
}

function comparisonFact(rawStoreId: string, fiscalMonth: string, metricCode: string, value: number): JsonRecord {
  return {
    ...factForStore(rawStoreId),
    fiscal_month: `${fiscalMonth}-01`,
    metric_code: metricCode,
    value_kind: metricCode === "TOTAL_CUSTOMERS" ? "quantity" : "amount",
    metric_value: String(value),
  };
}

function budgetFact(rawStoreId: string, fiscalMonth: string, value: number): JsonRecord {
  return {
    fiscal_month: `${fiscalMonth}-01`, company_id: COMPANY_DIRECT, store_id: rawStoreId,
    metric_code: "TOTAL_SALES", scenario_code: "APPROVED", budget_amount: String(value),
    source_file_sha256: FACT_SHA,
  };
}

Deno.test("all-scope projection returns the formal 20 stores and never fabricates missing facts", async () => {
  const directStore = STORE_ROWS[1];
  const calls: JsonRecord[] = [];
  const result = await handleManagementReadOnlyAction(
    {
      action: "storeMonthlyActualProjectionV1",
      token: "hub-session",
      payload: { selectedMonth: "2026-06", scopeMode: "all" },
    },
    dependencies({
      factRows: [factForStore(String(directStore.id))],
      captureRpc: (_name, args) => calls.push(args),
    }),
  );

  assertEquals(result.status, 200);
  const data = result.body.data as JsonRecord;
  const stores = data.stores as JsonRecord[];
  assertEquals(stores.length, 20);
  assertEquals(stores.filter((row) => row.ownership === "DIRECT").length, 13);
  assertEquals(stores.filter((row) => row.ownership === "FC").length, 7);
  assertEquals(stores.some((row) => row.storeKey === "honbu"), false);
  assertEquals((data.readiness as JsonRecord).confirmedStoreCount, 1);
  assertEquals((data.readiness as JsonRecord).missingStoreCount, 19);
  const missing = stores.find((row) => row.dataState === "preparing")!;
  assertEquals(missing.metrics, []);
  assertEquals(
    (data.responsibility as JsonRecord).corporateFinancialLineItemsIncluded,
    false,
  );
  assertEquals(calls.length, 4);
  assert(calls.every((call) => Array.isArray(call.p_store_ids)));
});

Deno.test("store-manager projection derives one store from server-side identity", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const calls: JsonRecord[] = [];
  const result = await handleManagementReadOnlyAction(
    {
      action: "storeMonthlyActualProjectionV1",
      token: "hub-session",
      payload: {
        selectedMonth: "2026-06",
        scopeMode: "own",
        storeIds: [String(STORE_ROWS[2].id)],
        actorEmployeeId: "spoofed",
      } as never,
    },
    dependencies({
      roleKey: "store_manager",
      employeeStoreId: ownStoreId,
      factRows: [factForStore(ownStoreId)],
      captureRpc: (_name, args) => calls.push(args),
    }),
  );

  assertEquals(result.status, 200);
  const stores = (result.body.data as JsonRecord).stores as JsonRecord[];
  assertEquals(stores.length, 1);
  assertEquals(stores[0].storeKey, STORE_ROWS[1].store_id);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].p_store_ids, [ownStoreId]);
});

Deno.test("area-manager projection derives only active assigned stores from server-side identity", async () => {
  const assignedStoreIds = [String(STORE_ROWS[2].id), String(STORE_ROWS[4].id)];
  const result = await handleManagementReadOnlyAction(
    {
      action: "storeMonthlyActualProjectionV1",
      token: "hub-session",
      payload: {
        selectedMonth: "2026-06",
        scopeMode: "assigned",
        role: "executive",
        actorEmployeeId: "spoofed",
        storeIds: [String(STORE_ROWS[1].id)],
      } as never,
    },
    dependencies({
      roleKey: "area_manager",
      assignedScopeEnabled: true,
      assignments: [
        { store_id: assignedStoreIds[0], assignment_type: "primary", assignment_order: 1, effective_from: "2026-01-01", effective_to: null, is_active: true },
        { store_id: assignedStoreIds[1], assignment_type: "secondary", assignment_order: 2, effective_from: "2026-08-01", effective_to: "2026-12-31", is_active: true },
        { store_id: String(STORE_ROWS[6].id), assignment_type: "primary", assignment_order: 3, effective_from: "2025-01-01", effective_to: "2026-08-18", is_active: true },
        { store_id: String(STORE_ROWS[7].id), assignment_type: "primary", assignment_order: 4, effective_from: "2026-01-01", effective_to: null, is_active: false },
      ],
    }),
  );

  assertEquals(result.status, 200);
  const data = result.body.data as JsonRecord;
  assertEquals((data.scope as JsonRecord).mode, "assigned");
  assertEquals(((data.stores as JsonRecord[]).map((row) => row.storeKey)), [STORE_ROWS[2].store_id, STORE_ROWS[4].store_id]);
});

Deno.test("area-manager cannot expand assigned scope to all stores", async () => {
  const result = await handleManagementReadOnlyAction(
    {
      action: "storeMonthlyActualProjectionV1",
      token: "hub-session",
      payload: { selectedMonth: "2026-06", scopeMode: "all" },
    },
    dependencies({
      roleKey: "area_manager",
      assignedScopeEnabled: true,
      assignments: [{ store_id: String(STORE_ROWS[2].id), assignment_type: "primary", assignment_order: 1, effective_from: "2026-01-01", effective_to: null, is_active: true }],
    }),
  );

  assertEquals(result.status, 403);
  assertEquals((result.body.error as JsonRecord).code, "SCOPE_DENIED");
});

Deno.test("area-manager with only inactive or expired assignments is scope denied", async () => {
  for (const assignment of [
    { store_id: String(STORE_ROWS[2].id), assignment_type: "primary", assignment_order: 1, effective_from: "2026-01-01", effective_to: null, is_active: false },
    { store_id: String(STORE_ROWS[2].id), assignment_type: "primary", assignment_order: 1, effective_from: "2026-01-01", effective_to: "2026-08-18", is_active: true },
  ]) {
    const result = await handleManagementReadOnlyAction(
      { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-06", scopeMode: "assigned" } },
      dependencies({ roleKey: "area_manager", assignedScopeEnabled: true, assignments: [assignment] }),
    );
    assertEquals(result.status, 403);
    assertEquals((result.body.error as JsonRecord).code, "SCOPE_DENIED");
  }
});

Deno.test("authorized global role retains all-store scope when assigned scope is enabled", async () => {
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-06", scopeMode: "all" } },
    dependencies({ roleKey: "executive", assignedScopeEnabled: true }),
  );
  assertEquals(result.status, 200);
  assertEquals(((result.body.data as JsonRecord).scope as JsonRecord).mode, "all");
  assertEquals(((result.body.data as JsonRecord).stores as JsonRecord[]).length, 20);
});

Deno.test("invalid month and absent canonical RPC fail closed before facts are returned", async () => {
  const invalid = await handleManagementReadOnlyAction({
    action: "storeMonthlyActualProjectionV1",
    token: "hub-session",
    payload: { selectedMonth: "2026-6", scopeMode: "all" },
  }, dependencies());
  assertEquals(invalid.status, 400);
  assertEquals((invalid.body.error as JsonRecord).code, "INVALID_REQUEST");

  const missingRpc = await handleManagementReadOnlyAction({
    action: "storeMonthlyActualProjectionV1",
    token: "hub-session",
    payload: { selectedMonth: "2026-06", scopeMode: "all" },
  }, dependencies({ includeRpc: false }));
  assertEquals(missingRpc.status, 404);
  assertEquals((missingRpc.body.error as JsonRecord).code, "DATA_NOT_READY");
});

Deno.test("formal comparisons use canonical budget, prior year, fiscal YTD and six-signal history", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const fiscalMonths = ["2026-04", "2026-05", "2026-06", "2026-07"];
  const actualRows = [
    comparisonFact(ownStoreId, "2025-07", "TOTAL_SALES", 100),
    ...fiscalMonths.flatMap((month, index) => [
      comparisonFact(ownStoreId, month, "TOTAL_SALES", 120 + index),
      comparisonFact(ownStoreId, month, "OPERATING_PROFIT", 12 + index),
      comparisonFact(ownStoreId, month, "TOTAL_CUSTOMERS", 10 + index),
      comparisonFact(ownStoreId, month, "TOTAL_UNIT_PRICE", 11 + index),
      comparisonFact(ownStoreId, month, "RETAIL_SALES", 8 + index),
      comparisonFact(ownStoreId, month, "EC_ALLOCATED_SALES", 4 + index),
    ]),
  ];
  const budgetRows = fiscalMonths.map((month) => budgetFact(ownStoreId, month, 100));
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({ roleKey: "store_manager", employeeStoreId: ownStoreId, factRows: actualRows, budgetRows }),
  );

  assertEquals(result.status, 200);
  const projected = ((result.body.data as JsonRecord).stores as JsonRecord[])[0];
  const comparisons = projected.comparisons as JsonRecord;
  assertEquals((comparisons.budgetRatio as JsonRecord).value, "123");
  assertEquals((comparisons.yearOverYearRatio as JsonRecord).value, "123");
  const fiscalYear = comparisons.fiscalYear as JsonRecord;
  assertEquals(fiscalYear.startMonth, "2026-04");
  assertEquals(((fiscalYear.metrics as JsonRecord).TOTAL_SALES as JsonRecord).value, "486");
  assertEquals((fiscalYear.budgetAchievement as JsonRecord).value, "121.5");
  const trend = comparisons.monthlyTrend as JsonRecord[];
  const july = trend.find((point) => point.fiscalMonth === "2026-07")!;
  assertEquals((july.metrics as JsonRecord[]).length, 6);
});

Deno.test("comparison denominators and incomplete fiscal periods remain preparing, never zero", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const current = comparisonFact(ownStoreId, "2026-07", "TOTAL_SALES", 123);
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({
      roleKey: "store_manager", employeeStoreId: ownStoreId,
      factRows: [current, comparisonFact(ownStoreId, "2025-07", "TOTAL_SALES", 0)],
      budgetRows: [budgetFact(ownStoreId, "2026-07", 0)],
    }),
  );
  const comparisons = (((result.body.data as JsonRecord).stores as JsonRecord[])[0].comparisons) as JsonRecord;
  assertEquals(comparisons.budgetRatio, { dataState: "preparing", value: null });
  assertEquals(comparisons.yearOverYearRatio, { dataState: "preparing", value: null });
  assertEquals(((comparisons.fiscalYear as JsonRecord).metrics as JsonRecord).TOTAL_SALES, { dataState: "preparing", value: null });
});
