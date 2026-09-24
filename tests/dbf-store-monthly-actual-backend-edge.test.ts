import { assert, assertEquals } from "jsr:@std/assert";
import {
  handleManagementReadOnlyAction,
  type JsonRecord,
  type ManagementDependencies,
} from "../supabase/functions/nov-hub-api/management_readonly_candidate.ts";

const EMPLOYEE_ID = "10000000-0000-4000-8000-000000000001";
const COMPANY_DIRECT = "e4059116-bdb3-4e13-9763-bbc77bdfe062";
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
  repeatRows?: JsonRecord[];
  operatorRows?: JsonRecord[];
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
      if (name === "store_corporation_effective_operator_range_read_v1") {
        if (options.operatorRows) return options.operatorRows;
        const rows: JsonRecord[] = [];
        for (let month = String(args.p_start_month); month <= String(args.p_end_month);) {
          for (const row of STORE_ROWS.filter((value) => value.store_type !== "本部")) {
            if ((args.p_store_ids as string[]).includes(String(row.id))) {
              rows.push({
                fiscal_month: month,
                store_id: row.id,
                corporation_id: row.corporation_id,
                corporation_no: row.corporation_id === COMPANY_DIRECT ? "0001" : "0002",
              });
            }
          }
          const date = new Date(`${month}T00:00:00Z`);
          date.setUTCMonth(date.getUTCMonth() + 1);
          month = date.toISOString().slice(0, 10);
        }
        return rows;
      }
      const rows = name === "dbf_store_monthly_budget_range_read_v1"
        ? options.budgetRows || []
        : name === "dbf_store_repeat_rate_read_v1"
        ? options.repeatRows || []
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

function budgetFact(rawStoreId: string, fiscalMonth: string, value: number, metricCode = "TOTAL_SALES"): JsonRecord {
  return {
    fiscal_month: `${fiscalMonth}-01`, company_id: COMPANY_DIRECT, store_id: rawStoreId,
    metric_code: metricCode, scenario_code: "APPROVED", budget_amount: String(value),
    source_file_sha256: FACT_SHA,
  };
}

function repeatFact(rawStoreId: string, customerSegment = "TOTAL", metricCode = "TOTAL_REPEAT_RATE"): JsonRecord {
  return {
    visit_month: "2026-03-01", calculation_month: "2026-07-01",
    company_id: COMPANY_DIRECT, store_id: rawStoreId, horizon_months: 4,
    customer_segment: customerSegment, metric_code: metricCode,
    denominator_visit_count: 100, numerator_cumulative_repeat_count: 42,
    pos_display_rate: "0.420", exact_rate: "0.42",
    definition_version: "POS_REPEAT_COHORT_4M_CUMULATIVE_V1",
    source_file_sha256: FACT_SHA, imported_at: "2026-09-21T00:00:00Z", fact_version: 1,
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
  assertEquals(calls.length, 7);
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
  assertEquals(calls.length, 4);
  assertEquals(calls[0].p_store_ids, [ownStoreId]);
});

Deno.test("formal Total Repeat and retail purchase count are read-only projected without overwriting the existing rate", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const rpcNames: string[] = [];
  const totalCustomers = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "TOTAL_CUSTOMERS", value_kind: "quantity", metric_value: "100",
  };
  const retailPurchaseCustomers = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "RETAIL_PURCHASE_CUSTOMER_VISITS", value_kind: "quantity", metric_value: "20",
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
  };
  const existingRetailPurchaseRate = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "RETAIL_PURCHASE_RATE", value_kind: "rate", metric_value: "0.25",
  };
  const legacyTotalRepeat = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "TOTAL_REPEAT_RATE", value_kind: "rate", metric_value: "0.99",
  };
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({
      roleKey: "store_manager",
      employeeStoreId: ownStoreId,
      factRows: [totalCustomers, retailPurchaseCustomers, existingRetailPurchaseRate, legacyTotalRepeat],
      repeatRows: [repeatFact(ownStoreId), repeatFact(ownStoreId, "RETURNING", "RETURNING_REPEAT_RATE")],
      captureRpc: (name) => rpcNames.push(name),
    }),
  );

  assertEquals(result.status, 200);
  assert(rpcNames.includes("dbf_store_repeat_rate_read_v1"));
  const data = result.body.data as JsonRecord;
  const projected = (data.stores as JsonRecord[])[0];
  const metrics = projected.metrics as JsonRecord[];
  const totalRepeat = metrics.find((metric) => metric.metricCode === "TOTAL_REPEAT_RATE")!;
  assertEquals(totalRepeat.value, "0.42");
  assertEquals(totalRepeat.definitionVersion, "POS_REPEAT_COHORT_4M_CUMULATIVE_V1");
  assertEquals(metrics.some((metric) => metric.metricCode === "RETURNING_REPEAT_RATE"), false);
  assertEquals(metrics.find((metric) => metric.metricCode === "RETAIL_PURCHASE_CUSTOMER_VISITS")?.value, "20");
  assertEquals(projected.retailPurchaseRateReconciliation, {
    dataState: "confirmed",
    policy: "retain-existing-rate-no-overwrite",
    existingMetricCode: "RETAIL_PURCHASE_RATE",
    candidateNumeratorMetricCode: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    denominatorMetricCode: "TOTAL_CUSTOMERS",
    existingRate: "0.25",
    derivedRate: "0.2",
    difference: "0.05",
    matches: false,
  });
  const readiness = data.readiness as JsonRecord;
  assertEquals(readiness.formalRepeatFactRowCount, 1);
  assertEquals(readiness.retailPurchaseRateMismatchCount, 1);
});

Deno.test("actual labor FTE accepts only the formal quantity definition and non-negative values", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const formalFte = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "ACTUAL_LABOR_FTE", value_kind: "quantity", metric_value: "12.3456",
    definition_version: "ACTUAL_LABOR_FTE_173_76_V1",
    display_name: "実労働FTE（換算人数）",
  };
  const accepted = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({ roleKey: "store_manager", employeeStoreId: ownStoreId, factRows: [formalFte] }),
  );
  assertEquals(accepted.status, 200);
  const acceptedMetrics = (((accepted.body.data as JsonRecord).stores as JsonRecord[])[0].metrics as JsonRecord[]);
  assertEquals(acceptedMetrics.find((metric) => metric.metricCode === "ACTUAL_LABOR_FTE")?.value, "12.3456");

  for (const invalidFte of [
    { ...formalFte, value_kind: "amount" },
    { ...formalFte, definition_version: "legacy" },
    { ...formalFte, metric_value: "-0.01" },
  ]) {
    const rejected = await handleManagementReadOnlyAction(
      { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
      dependencies({ roleKey: "store_manager", employeeStoreId: ownStoreId, factRows: [invalidFte] }),
    );
    assertEquals(rejected.status, 404);
  }
});

Deno.test("retail purchase reconciliation serializes sub-micro differences without exponent notation", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const totalCustomers = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "TOTAL_CUSTOMERS", value_kind: "quantity", metric_value: "100",
  };
  const retailPurchaseCustomers = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "RETAIL_PURCHASE_CUSTOMER_VISITS", value_kind: "quantity", metric_value: "20",
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
  };
  const existingRetailPurchaseRate = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "RETAIL_PURCHASE_RATE", value_kind: "rate", metric_value: "0.200000004941",
  };
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({
      roleKey: "store_manager",
      employeeStoreId: ownStoreId,
      factRows: [totalCustomers, retailPurchaseCustomers, existingRetailPurchaseRate],
    }),
  );

  assertEquals(result.status, 200);
  const projected = ((result.body.data as JsonRecord).stores as JsonRecord[])[0];
  assertEquals((projected.retailPurchaseRateReconciliation as JsonRecord).difference, "0.000000004941");
  assertEquals((projected.retailPurchaseRateReconciliation as JsonRecord).matches, true);
});

Deno.test("retail purchase count derives a display-only precise rate when no canonical rate exists", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const totalCustomers = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "TOTAL_CUSTOMERS", value_kind: "quantity", metric_value: "100",
  };
  const retailPurchaseCustomers = {
    ...factForStore(ownStoreId), fiscal_month: "2026-07-01",
    metric_code: "RETAIL_PURCHASE_CUSTOMER_VISITS", value_kind: "quantity", metric_value: "20",
    definition_version: "POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1",
  };
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({
      roleKey: "store_manager",
      employeeStoreId: ownStoreId,
      factRows: [totalCustomers, retailPurchaseCustomers],
    }),
  );
  assertEquals(result.status, 200);
  const data = result.body.data as JsonRecord;
  const projected = (data.stores as JsonRecord[])[0];
  assertEquals(projected.retailPurchaseRateReconciliation, {
    dataState: "derived_only",
    policy: "retain-existing-rate-no-overwrite",
    existingMetricCode: "RETAIL_PURCHASE_RATE",
    candidateNumeratorMetricCode: "RETAIL_PURCHASE_CUSTOMER_VISITS",
    denominatorMetricCode: "TOTAL_CUSTOMERS",
    existingRate: null,
    derivedRate: "0.2",
    difference: null,
    matches: null,
  });
  assertEquals((data.readiness as JsonRecord).retailPurchaseRateDerivedOnlyCount, 1);
  assertEquals((data.readiness as JsonRecord).retailPurchaseRateMismatchCount, 0);
});

Deno.test("formal Total Repeat with a zero denominator remains preparing rather than failing or becoming zero", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const zeroDenominatorRepeat = {
    ...repeatFact(ownStoreId),
    denominator_visit_count: 0,
    numerator_cumulative_repeat_count: 0,
    pos_display_rate: "0",
    exact_rate: null,
  };
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({
      roleKey: "store_manager",
      employeeStoreId: ownStoreId,
      repeatRows: [zeroDenominatorRepeat],
    }),
  );

  assertEquals(result.status, 200);
  const projected = ((result.body.data as JsonRecord).stores as JsonRecord[])[0];
  assertEquals((projected.metrics as JsonRecord[]).some((metric) => metric.metricCode === "TOTAL_REPEAT_RATE"), false);
  assertEquals(((result.body.data as JsonRecord).readiness as JsonRecord).formalRepeatMissingStoreCount, 1);
});

Deno.test("historical company change is resolved by fiscal month and current ownership is not backcast", async () => {
  const rawStoreId = String(STORE_ROWS[1].id);
  const operatorRows = [
    { fiscal_month: "2026-05-01", store_id: rawStoreId, corporation_id: COMPANY_FC, corporation_no: "0002" },
    { fiscal_month: "2026-06-01", store_id: rawStoreId, corporation_id: COMPANY_DIRECT, corporation_no: "0001" },
  ];
  const oldFact = { ...factForStore(rawStoreId), fiscal_month: "2026-05-01", company_id: COMPANY_FC };
  const currentFact = factForStore(rawStoreId);
  const wrongBackcast = { ...oldFact, company_id: COMPANY_DIRECT, metric_code: "TECHNICAL_SALES" };
  const result = await handleManagementReadOnlyAction(
    {
      action: "storeMonthlyActualProjectionV1",
      token: "hub-session",
      payload: { selectedMonth: "2026-06", scopeMode: "own" },
    },
    dependencies({
      roleKey: "store_manager",
      employeeStoreId: rawStoreId,
      operatorRows,
      factRows: [oldFact, currentFact, wrongBackcast],
    }),
  );

  assertEquals(result.status, 200);
  const data = result.body.data as JsonRecord;
  const projected = (data.stores as JsonRecord[])[0];
  assertEquals(projected.corporationName, "IDEA NOV");
  assertEquals(projected.operatorDataState, "confirmed");
  assertEquals((data.readiness as JsonRecord).ownershipMismatchExcludedCount, 1);
  const may = ((projected.comparisons as JsonRecord).monthlyTrend as JsonRecord[])
    .find((row) => row.fiscalMonth === "2026-05");
  assertEquals((may?.metrics as JsonRecord[]).length, 1);
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

Deno.test("formal comparisons use canonical sales, customer, ticket and retail baselines", async () => {
  const ownStoreId = String(STORE_ROWS[1].id);
  const fiscalMonths = ["2026-04", "2026-05", "2026-06", "2026-07"];
  const actualRows = [
    comparisonFact(ownStoreId, "2025-07", "TOTAL_SALES", 100),
    comparisonFact(ownStoreId, "2025-07", "TOTAL_CUSTOMERS", 10),
    comparisonFact(ownStoreId, "2025-07", "TOTAL_UNIT_PRICE", 10),
    comparisonFact(ownStoreId, "2025-07", "RETAIL_SALES", 10),
    ...fiscalMonths.flatMap((month, index) => [
      comparisonFact(ownStoreId, month, "TOTAL_SALES", 120 + index),
      comparisonFact(ownStoreId, month, "OPERATING_PROFIT", 12 + index),
      comparisonFact(ownStoreId, month, "TOTAL_CUSTOMERS", 10 + index),
      comparisonFact(ownStoreId, month, "TOTAL_UNIT_PRICE", 11 + index),
      comparisonFact(ownStoreId, month, "RETAIL_SALES", 8 + index),
      comparisonFact(ownStoreId, month, "EC_ALLOCATED_SALES", 4 + index),
    ]),
  ];
  const budgetRows = [
    ...fiscalMonths.map((month) => budgetFact(ownStoreId, month, 100)),
    budgetFact(ownStoreId, "2026-07", 10, "RETAIL_SALES"),
  ];
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({ roleKey: "store_manager", employeeStoreId: ownStoreId, factRows: actualRows, budgetRows }),
  );

  assertEquals(result.status, 200);
  const projected = ((result.body.data as JsonRecord).stores as JsonRecord[])[0];
  const comparisons = projected.comparisons as JsonRecord;
  assertEquals((comparisons.budgetRatio as JsonRecord).value, "123");
  assertEquals((comparisons.yearOverYearRatio as JsonRecord).value, "123");
  assertEquals((comparisons.customerYearOverYear as JsonRecord).value, "30");
  assertEquals((comparisons.ticketYearOverYear as JsonRecord).value, "40");
  assertEquals((comparisons.retailYearOverYear as JsonRecord).value, "10");
  assertEquals((comparisons.retailBudgetRatio as JsonRecord).value, "110");
  assertEquals(projected.status, "Needs Attention");
  assertEquals(projected.statusRuleId, "operating-margin-below-15");
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
  const currentCustomers = comparisonFact(ownStoreId, "2026-07", "TOTAL_CUSTOMERS", 123);
  const currentTicket = comparisonFact(ownStoreId, "2026-07", "TOTAL_UNIT_PRICE", 123);
  const currentRetail = comparisonFact(ownStoreId, "2026-07", "RETAIL_SALES", 123);
  const result = await handleManagementReadOnlyAction(
    { action: "storeMonthlyActualProjectionV1", token: "hub-session", payload: { selectedMonth: "2026-07" } },
    dependencies({
      roleKey: "store_manager", employeeStoreId: ownStoreId,
      factRows: [
        current, currentCustomers, currentTicket, currentRetail,
        comparisonFact(ownStoreId, "2025-07", "TOTAL_SALES", 0),
        comparisonFact(ownStoreId, "2025-07", "TOTAL_CUSTOMERS", 0),
        comparisonFact(ownStoreId, "2025-07", "TOTAL_UNIT_PRICE", 0),
        comparisonFact(ownStoreId, "2025-07", "RETAIL_SALES", 0),
      ],
      budgetRows: [
        budgetFact(ownStoreId, "2026-07", 0),
        budgetFact(ownStoreId, "2026-07", 0, "RETAIL_SALES"),
      ],
    }),
  );
  const comparisons = (((result.body.data as JsonRecord).stores as JsonRecord[])[0].comparisons) as JsonRecord;
  assertEquals(comparisons.budgetRatio, { dataState: "preparing", value: null });
  assertEquals(comparisons.yearOverYearRatio, { dataState: "preparing", value: null });
  const projected = ((result.body.data as JsonRecord).stores as JsonRecord[])[0];
  assertEquals(projected.status, "Preparing");
  assertEquals(projected.statusRuleId, "comparison-data-preparing");
  assertEquals(comparisons.customerYearOverYear, { dataState: "preparing", value: null });
  assertEquals(comparisons.ticketYearOverYear, { dataState: "preparing", value: null });
  assertEquals(comparisons.retailYearOverYear, { dataState: "preparing", value: null });
  assertEquals(comparisons.retailBudgetRatio, { dataState: "preparing", value: null });
  assertEquals(((comparisons.fiscalYear as JsonRecord).metrics as JsonRecord).TOTAL_SALES, { dataState: "preparing", value: null });
});
