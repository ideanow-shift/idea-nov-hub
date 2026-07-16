export type JsonRecord = Record<string, unknown>;

export type ManagementAction =
  | "managementFinanceSummary"
  | "managementStoresSummary"
  | "managementDataopsStatus";

export type ManagementEndpoint =
  | "finance.summary"
  | "stores.summary"
  | "dataops.status";

export type ManagementPermission =
  | "finance.view"
  | "stores.view"
  | "dataops.view";

export type ScopeMode = "all" | "own" | "assigned" | "none";

export type ReadQuery = Record<string, string | number | boolean | undefined>;

export interface ReadOnlyGateway {
  select(table: string, query: ReadQuery): Promise<JsonRecord[]>;
  count(table: string, query: ReadQuery): Promise<number>;
}

export interface VerifiedAuth {
  subject: string;
}

export interface EmployeeReference {
  id: string;
}

export interface ManagementDependencies {
  verifyHubSession(token: string): Promise<VerifiedAuth | null>;
  resolveEmployee(auth: VerifiedAuth): Promise<EmployeeReference | null>;
  db: ReadOnlyGateway;
  today?: () => string;
  assignedScopeEnabled?: boolean;
}

export interface ManagementRequest {
  action: ManagementAction;
  token: string;
  payload?: {
    selectedMonth?: string;
    scopeMode?: ScopeMode;
    contractPhase?: string;
    responseProfile?: string;
  };
}

export interface ManagementResult {
  status: number;
  body: JsonRecord;
}

type InternalEmployee = {
  id: string;
  storeId: string | null;
};

type InternalScope = {
  mode: ScopeMode;
  storeIds: string[];
};

type AccessContext = {
  employee: InternalEmployee;
  roleKeys: string[];
  permissions: ManagementPermission[];
  scope: InternalScope;
};

const CONTRACT_PHASE = "phase2-select-only-contract";
const ACTION_PRODUCTION_ENABLED: Record<ManagementAction, boolean> = {
  managementFinanceSummary: true,
  managementStoresSummary: true,
  managementDataopsStatus: true,
};
const ASSIGNMENT_TYPE_ALLOWLIST = new Set(["primary", "secondary", "third"]);
const ALL_SCOPE_ROLE_CANDIDATES = new Set([
  "super_admin",
  "executive",
  "backoffice",
  "accounting",
]);

const ROLE_PERMISSION_CANDIDATES: Record<string, ManagementPermission[]> = {
  super_admin: ["finance.view", "stores.view", "dataops.view"],
  executive: ["finance.view", "stores.view", "dataops.view"],
  backoffice: ["finance.view", "stores.view", "dataops.view"],
  accounting: ["finance.view", "stores.view", "dataops.view"],
  area_manager: ["stores.view"],
  store_manager: ["stores.view"],
  department_manager: [],
};

const ACTION_DEFINITIONS: Record<ManagementAction, {
  endpoint: ManagementEndpoint;
  permission: ManagementPermission;
}> = {
  managementFinanceSummary: {
    endpoint: "finance.summary",
    permission: "finance.view",
  },
  managementStoresSummary: {
    endpoint: "stores.summary",
    permission: "stores.view",
  },
  managementDataopsStatus: {
    endpoint: "dataops.status",
    permission: "dataops.view",
  },
};

class ManagementSafeError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404,
    readonly code: "INVALID_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "SCOPE_DENIED" | "DATA_NOT_READY" | "NOT_APPROVED",
    message: string,
  ) {
    super(message);
  }
}

const DIAGNOSTIC_RESPONSE_PROFILE = "diagnostic-sanitized-v1";

function validateResponseProfile(request: ManagementRequest): string | null {
  const profile = request.payload?.responseProfile;
  if (profile === undefined) return null;
  if (request.action !== "managementDataopsStatus" || profile !== DIAGNOSTIC_RESPONSE_PROFILE) {
    throw new ManagementSafeError(400, "INVALID_REQUEST", "Unsupported management response profile.");
  }
  return profile;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function staffCountValue(value: unknown): number | null {
  const parsed = nullableNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function percentage(value: unknown): number {
  return Math.round(numberValue(value) * 1000) / 10;
}

function nullablePercentage(value: unknown): number | null {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.round(parsed * 1000) / 10;
}

function manYen(value: unknown): number {
  return Math.round(numberValue(value) / 10_000);
}

function nullableManYen(value: unknown): number | null {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.round(parsed / 10_000);
}

function unique<T>(values: T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function inFilter(values: string[]): string {
  return `in.(${values.join(",")})`;
}

function todayJstFallback(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isEligibleEmploymentStatus(value: unknown): boolean {
  const status = text(value);
  return Boolean(status) && !/退職|休職|産休|育休/.test(status);
}

function isCredentialLocked(value: unknown, nowIso: string): boolean {
  const lockedUntil = text(value);
  if (!lockedUntil) return false;
  const lockTime = Date.parse(lockedUntil);
  const nowTime = Date.parse(nowIso);
  return Number.isFinite(lockTime) && Number.isFinite(nowTime) && lockTime > nowTime;
}

function permissionsForRoles(roleKeys: string[]): ManagementPermission[] {
  return unique(roleKeys.flatMap((roleKey) => ROLE_PERMISSION_CANDIDATES[roleKey] || []));
}

function hasAllScopeRole(roleKeys: string[]): boolean {
  return roleKeys.some((roleKey) => ALL_SCOPE_ROLE_CANDIDATES.has(roleKey));
}

function safe401(): never {
  throw new ManagementSafeError(401, "UNAUTHORIZED", "Authentication is required.");
}

function safe403(code: "FORBIDDEN" | "SCOPE_DENIED"): never {
  const message = code === "SCOPE_DENIED"
    ? "Store scope is not available for this account."
    : "This account cannot access the requested management view.";
  throw new ManagementSafeError(403, code, message);
}

function safe404(): never {
  throw new ManagementSafeError(404, "DATA_NOT_READY", "Requested summary is not available.");
}

function safeNotApproved(): never {
  throw new ManagementSafeError(403, "NOT_APPROVED", "This management action is not enabled in the current gate.");
}

async function getCurrentEmployee(
  deps: ManagementDependencies,
  reference: EmployeeReference,
): Promise<InternalEmployee> {
  const rows = await deps.db.select("employees", {
    select: "id,store_id,employment_status,is_active",
    id: `eq.${reference.id}`,
    limit: 2,
  });
  const row = rows[0];
  if (rows.length !== 1 || !row || row.is_active !== true || text(row.id) !== reference.id
    || !isEligibleEmploymentStatus(row.employment_status)) safe401();
  return {
    id: text(row.id),
    storeId: text(row.store_id) || null,
  };
}

async function assertLoginAvailable(
  deps: ManagementDependencies,
  employeeId: string,
  nowIso: string,
): Promise<void> {
  const credentials = await deps.db.select("employee_login_credentials", {
    select: "employee_id,login_enabled,locked_until",
    employee_id: `eq.${employeeId}`,
    limit: 2,
  });
  const credential = credentials[0];
  if (credentials.length !== 1 || !credential || credential.login_enabled !== true
    || text(credential.employee_id) !== employeeId || isCredentialLocked(credential.locked_until, nowIso)) {
    safe401();
  }
}

async function getCurrentRoleKeys(
  deps: ManagementDependencies,
  employeeId: string,
): Promise<string[]> {
  const assignments = await deps.db.select("employee_roles", {
    select: "role_id,scope_type,scope_id,is_active",
    employee_id: `eq.${employeeId}`,
    is_active: "eq.true",
    limit: 100,
  });
  const activeAssignments = assignments.filter((row) => row.is_active === true);
  const roleIds = unique(activeAssignments.map((row) => text(row.role_id)).filter(Boolean));
  if (!roleIds.length) return [];
  const roles = await deps.db.select("roles", {
    select: "id,role_key,is_active",
    id: inFilter(roleIds),
    is_active: "eq.true",
    limit: 100,
  });
  const globalRoleIds = new Set(activeAssignments
    .filter((row) => ["all", "global"].includes(text(row.scope_type)) && !text(row.scope_id))
    .map((row) => text(row.role_id)));
  return unique(roles
    .filter((row) => row.is_active === true)
    .filter((row) => !ALL_SCOPE_ROLE_CANDIDATES.has(text(row.role_key)) || globalRoleIds.has(text(row.id)))
    .map((row) => text(row.role_key))
    .filter(Boolean));
}

async function getActiveStoreIds(
  deps: ManagementDependencies,
  storeIds: string[],
): Promise<string[]> {
  const ids = unique(storeIds.filter(Boolean));
  if (!ids.length) return [];
  const stores = await deps.db.select("stores", {
    select: "id,is_active",
    id: inFilter(ids),
    is_active: "eq.true",
    limit: Math.max(ids.length, 1),
  });
  return unique(stores.filter((row) => row.is_active === true).map((row) => text(row.id)).filter(Boolean));
}

async function getAssignedStoreIds(
  deps: ManagementDependencies,
  employeeId: string,
  today: string,
): Promise<string[]> {
  const rows = await deps.db.select("employee_store_assignments", {
    select: "store_id,assignment_type,assignment_order,effective_from,effective_to,is_active",
    employee_id: `eq.${employeeId}`,
    is_active: "eq.true",
    effective_from: `lte.${today}`,
    or: `(effective_to.is.null,effective_to.gte.${today})`,
    order: "assignment_order.asc",
    limit: 100,
  });
  const candidateIds = rows
    .filter((row) => row.is_active === true)
    .filter((row) => ASSIGNMENT_TYPE_ALLOWLIST.has(text(row.assignment_type)))
    .filter((row) => !text(row.effective_from) || text(row.effective_from) <= today)
    .filter((row) => !text(row.effective_to) || text(row.effective_to) >= today)
    .map((row) => text(row.store_id))
    .filter(Boolean);
  return await getActiveStoreIds(deps, candidateIds);
}

async function resolveStoreScope(
  deps: ManagementDependencies,
  employee: InternalEmployee,
  roleKeys: string[],
  requestedMode: ScopeMode | undefined,
  today: string,
): Promise<InternalScope> {
  if (hasAllScopeRole(roleKeys)) {
    return { mode: "all", storeIds: [] };
  }

  const assignedEnabled = deps.assignedScopeEnabled === true;
  const canUseAssigned = roleKeys.includes("area_manager") || roleKeys.includes("store_manager");
  if (assignedEnabled && canUseAssigned && (requestedMode === "assigned" || roleKeys.includes("area_manager"))) {
    const storeIds = await getAssignedStoreIds(deps, employee.id, today);
    if (storeIds.length) return { mode: "assigned", storeIds };
  }

  if (roleKeys.includes("store_manager") && employee.storeId) {
    const active = await getActiveStoreIds(deps, [employee.storeId]);
    if (active.length) return { mode: "own", storeIds: active };
  }

  return { mode: "none", storeIds: [] };
}

function requestedScopeExceedsResolved(requested: ScopeMode | undefined, resolved: ScopeMode): boolean {
  if (!requested || requested === resolved || resolved === "all") return false;
  if (requested === "none") return false;
  return true;
}

async function resolveAccess(
  deps: ManagementDependencies,
  request: ManagementRequest,
  requiredPermission: ManagementPermission,
): Promise<AccessContext> {
  let auth: VerifiedAuth | null = null;
  try {
    auth = request.token ? await deps.verifyHubSession(request.token) : null;
  } catch (_error) {
    safe401();
  }
  if (!auth) safe401();

  const reference = await deps.resolveEmployee(auth);
  if (!reference?.id) safe401();

  const nowIso = new Date().toISOString();
  const today = deps.today?.() || todayJstFallback();
  const employee = await getCurrentEmployee(deps, reference);
  await assertLoginAvailable(deps, employee.id, nowIso);
  const roleKeys = await getCurrentRoleKeys(deps, employee.id);
  const permissions = permissionsForRoles(roleKeys);
  if (!permissions.includes(requiredPermission)) safe403("FORBIDDEN");

  const requestedMode = request.payload?.scopeMode;
  const scope = await resolveStoreScope(deps, employee, roleKeys, requestedMode, today);
  if (requiredPermission === "stores.view" && scope.mode === "none") safe403("SCOPE_DENIED");
  if (requiredPermission === "stores.view" && requestedScopeExceedsResolved(requestedMode, scope.mode)) {
    safe403("SCOPE_DENIED");
  }

  return { employee, roleKeys, permissions, scope };
}

function endpointForAction(action: ManagementAction): ManagementEndpoint {
  return ACTION_DEFINITIONS[action].endpoint;
}

function validMonth(value: unknown): string {
  const month = text(value);
  return /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : "";
}

function statusFromFinance(pl: JsonRecord, bs: JsonRecord, cash: JsonRecord): "safe" | "warning" | "danger" {
  const cashStatus = text(cash.cash_status);
  if (cashStatus === "safe" || cashStatus === "warning" || cashStatus === "danger") return cashStatus;
  if (numberValue(pl.ordinary_profit_yen) < 0 || numberValue(bs.net_assets_yen) < 0) return "danger";
  if (numberValue(pl.ordinary_profit_rate) < 0.05 || numberValue(bs.equity_ratio) < 0.2) return "warning";
  return "safe";
}

async function buildFinanceSummary(
  deps: ManagementDependencies,
  request: ManagementRequest,
): Promise<JsonRecord> {
  let selectedMonth = validMonth(request.payload?.selectedMonth);
  if (!selectedMonth) {
    const latest = await deps.db.select("finance_monthly_corporate_pl", {
      select: "month",
      order: "month.desc",
      limit: 1,
    });
    selectedMonth = text(latest[0]?.month);
  }
  if (!selectedMonth) safe404();

  const [
    plRows,
    bsRows,
    cashRows,
    draftCount,
    reviewCount,
    approvedCount,
    staffRows,
    departmentPlRows,
    trendPlRows,
    trendCashRows,
  ] = await Promise.all([
    deps.db.select("finance_monthly_corporate_pl", {
      select: "month,corporation_id,total_sales_yen,technical_sales_yen,product_sales_yen,gross_profit_yen,labor_cost_yen,material_cost_yen,rent_yen,operating_profit_yen,ordinary_profit_yen,labor_cost_rate,material_cost_rate,rent_rate,operating_profit_rate,ordinary_profit_rate,break_even_ratio",
      month: `eq.${selectedMonth}`,
      order: "corporation_id.asc",
      limit: 100,
    }),
    deps.db.select("finance_monthly_corporate_bs", {
      select: "month,corporation_id,cash_yen,current_assets_yen,current_liabilities_yen,total_assets_yen,total_liabilities_yen,net_assets_yen,equity_ratio,current_ratio,total_asset_turnover",
      month: `eq.${selectedMonth}`,
      limit: 100,
    }),
    deps.db.select("finance_monthly_cash_positions", {
      select: "month,corporation_id,cash_balance_yen,monthly_fixed_cost_yen,defense_line_yen,survival_months,cash_status,forecast_1m_yen,forecast_3m_yen,forecast_6m_yen",
      month: `eq.${selectedMonth}`,
      limit: 100,
    }),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.draft", is_active: "eq.true" }),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.review", is_active: "eq.true" }),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.approved", is_active: "eq.true" }),
    deps.db.select("finance_monthly_staff_counts", {
      select: "corporation_id,staff_count,source",
      month: `eq.${selectedMonth}`,
      limit: 100,
    }),
    deps.db.select("finance_monthly_department_pl", {
      select: "month,corporation_id,department_id,sales_yen,management_fee_revenue_yen,other_sales_yen,labor_cost_yen,material_cost_yen,other_cost_yen,department_profit_yen,profit_rate,productivity_yen",
      month: `eq.${selectedMonth}`,
      order: "department_id.asc",
      limit: 200,
    }),
    deps.db.select("finance_monthly_corporate_pl", {
      select: "month,corporation_id,total_sales_yen,ordinary_profit_yen,ordinary_profit_rate",
      order: "month.asc",
      limit: 1000,
    }),
    deps.db.select("finance_monthly_cash_positions", {
      select: "month,corporation_id,cash_balance_yen,defense_line_yen",
      order: "month.asc",
      limit: 1000,
    }),
  ]);
  if (!plRows.length) safe404();

  const corporationRows = await deps.db.select("corporations", {
    select: "id,corporation_code,corporation_name,is_active",
    is_active: "eq.true",
    order: "corporation_code.asc",
    limit: 100,
  });
  const plByCorporation = new Map(plRows.map((row) => [text(row.corporation_id), row]));
  const bsByCorporation = new Map(bsRows.map((row) => [text(row.corporation_id), row]));
  const cashByCorporation = new Map(cashRows.map((row) => [text(row.corporation_id), row]));
  const staffByCorporation = new Map(staffRows.map((row) => [
    text(row.corporation_id),
    text(row.source) === "employees_snapshot" ? staffCountValue(row.staff_count) : null,
  ]));

  const corporations = corporationRows.map((corporation, index) => {
    const internalId = text(corporation.id);
    const pl = plByCorporation.get(internalId);
    const bs = bsByCorporation.get(internalId) || {};
    const cash = cashByCorporation.get(internalId) || {};
    return {
      id: text(corporation.corporation_code) || `corporation-${index + 1}`,
      name: text(corporation.corporation_name) || "未設定法人",
      dataAvailable: Boolean(pl),
      salesManYen: nullableManYen(pl?.total_sales_yen),
      profitRatePercent: nullablePercentage(pl?.ordinary_profit_rate),
      equityRatioPercent: nullablePercentage(bs.equity_ratio),
      cashManYen: nullableManYen(cash.cash_balance_yen ?? bs.cash_yen),
      survivalMonths: nullableNumber(cash.survival_months),
      monthlyFixedCostManYen: nullableManYen(cash.monthly_fixed_cost_yen),
      defenseLineManYen: nullableManYen(cash.defense_line_yen),
      status: pl ? statusFromFinance(pl, bs, cash) : "missing",
    };
  });

  const fourAxis = corporationRows.map((corporation, index) => {
    const internalId = text(corporation.id);
    const pl = plByCorporation.get(internalId);
    const bs = bsByCorporation.get(internalId) || {};
    const staffCount = staffByCorporation.get(internalId) ?? null;
    return {
      id: text(corporation.corporation_code) || `corporation-${index + 1}`,
      name: text(corporation.corporation_name) || "未設定法人",
      dataAvailable: Boolean(pl),
      salesManYen: nullableManYen(pl?.total_sales_yen),
      ordinaryProfitManYen: nullableManYen(pl?.ordinary_profit_yen),
      ordinaryProfitRatePercent: nullablePercentage(pl?.ordinary_profit_rate),
      operatingProfitRatePercent: nullablePercentage(pl?.operating_profit_rate),
      breakEvenRatioPercent: nullablePercentage(pl?.break_even_ratio),
      laborCostRatePercent: nullablePercentage(pl?.labor_cost_rate),
      materialCostRatePercent: nullablePercentage(pl?.material_cost_rate),
      rentRatePercent: nullablePercentage(pl?.rent_rate),
      staffCount: pl && staffCount !== null ? staffCount : null,
      salesPerStaffManYen: pl && staffCount !== null && staffCount > 0 ? manYen(numberValue(pl.total_sales_yen) / staffCount) : null,
      profitPerStaffManYen: pl && staffCount !== null && staffCount > 0 ? manYen(numberValue(pl.ordinary_profit_yen) / staffCount) : null,
      equityRatioPercent: nullablePercentage(bs.equity_ratio),
      currentRatioPercent: nullablePercentage(bs.current_ratio),
      totalAssetTurnover: nullableNumber(bs.total_asset_turnover),
    };
  });

  const departmentIds = unique(departmentPlRows.map((row) => text(row.department_id)).filter(Boolean));
  const departmentRows = departmentIds.length
    ? await deps.db.select("departments", {
      select: "id,department_code,department_name,is_active",
      id: inFilter(departmentIds),
      is_active: "eq.true",
      limit: 100,
    })
    : [];
  const departmentsById = new Map(departmentRows.map((row) => [text(row.id), row]));
  const departments = departmentPlRows.map((row, index) => {
    const department = departmentsById.get(text(row.department_id)) || {};
    return {
      id: text(department.department_code) || `department-${index + 1}`,
      name: text(department.department_name) || "未設定部門",
      salesManYen: manYen(row.sales_yen),
      managementFeeManYen: manYen(row.management_fee_revenue_yen),
      otherSalesManYen: manYen(row.other_sales_yen),
      laborCostManYen: manYen(row.labor_cost_yen),
      materialCostManYen: manYen(row.material_cost_yen),
      otherCostManYen: manYen(row.other_cost_yen),
      profitManYen: manYen(row.department_profit_yen),
      profitRatePercent: percentage(row.profit_rate),
      productivityManYen: manYen(row.productivity_yen),
    };
  });

  const publicCorporationId = new Map(corporationRows.map((row, index) => [
    text(row.id),
    text(row.corporation_code) || `corporation-${index + 1}`,
  ]));
  const cashTrendByMonth = new Map<string, { actualYen: number; defenseYen: number; defenseCount: number }>();
  trendCashRows.forEach((row) => {
    const month = text(row.month).slice(0, 7);
    const current = cashTrendByMonth.get(month) || { actualYen: 0, defenseYen: 0, defenseCount: 0 };
    current.actualYen += numberValue(row.cash_balance_yen);
    const defense = nullableNumber(row.defense_line_yen);
    if (defense !== null) {
      current.defenseYen += defense;
      current.defenseCount += 1;
    }
    cashTrendByMonth.set(month, current);
  });
  const cashTrend = [...cashTrendByMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, values]) => ({
    month,
    actualManYen: manYen(values.actualYen),
    defenseManYen: values.defenseCount ? manYen(values.defenseYen) : null,
  }));
  const profitTrend = trendPlRows.map((row) => ({
    month: text(row.month).slice(0, 7),
    corporation: publicCorporationId.get(text(row.corporation_id)) || "unmapped",
    salesManYen: manYen(row.total_sales_yen),
    ordinaryProfitManYen: manYen(row.ordinary_profit_yen),
    ordinaryProfitRatePercent: percentage(row.ordinary_profit_rate),
  })).filter((row) => row.corporation !== "unmapped");

  const classificationRuleStatus = {
    draft: draftCount,
    review: reviewCount,
    approved: approvedCount,
    usedForProductionCalculation: false,
  };
  const methodStatus = reviewCount > 0 ? "review" : (draftCount > 0 ? "draft" : "approved");
  const cashBalanceYen = cashRows.reduce((sum, row) => sum + numberValue(row.cash_balance_yen), 0);
  const salesTotalYen = plRows.reduce((sum, row) => sum + numberValue(row.total_sales_yen), 0);
  const missingCorporations = corporations.filter((row) => !row.dataAvailable).map((row) => row.name);
  const dataQuality = {
    activeCorporationCount: corporationRows.length,
    currentMonthCorporationCount: unique(plRows.map((row) => text(row.corporation_id))).length,
    missingCorporations,
    defenseLineCorporationCount: cashRows.filter((row) => nullableNumber(row.defense_line_yen) !== null).length,
    survivalMonthsCorporationCount: cashRows.filter((row) => nullableNumber(row.survival_months) !== null).length,
    headcountCorporationCount: corporationRows.filter((row) => staffByCorporation.get(text(row.id)) !== null
      && staffByCorporation.has(text(row.id))).length,
    headcountAuthoritative: false,
    headcountContract: "authoritative-month-end-contract-pending",
    headcountComplete: false,
    complete: false,
  };

  return {
    latestClosedMonth: selectedMonth.slice(0, 7),
    cashBalanceYen,
    salesTotalYen,
    dataQuality,
    alertCorporationCount: corporations.filter((row) => row.status !== "safe").length,
    methodStatus,
    classificationRuleStatus,
    corporations,
    fourAxis,
    departments,
    cashTrend,
    profitTrend,
    expertComments: [],
    expertCommentReadiness: "aggregate-content-provenance-pending",
    latestAdvice: null,
    aiAdviceReadiness: "aggregate-input-provenance-pending",
    moduleStatuses: [
      {
        title: "科目分類",
        status: draftCount > 0 || reviewCount > 0 ? "review" : "ready",
        note: "状態表示のみ。本番再計算には使用しません。",
      },
    ],
  };
}

async function buildStoresSummary(
  deps: ManagementDependencies,
  access: AccessContext,
): Promise<JsonRecord> {
  const storeQuery: ReadQuery = {
    select: "id,store_no,store_id,store_name,corporation_id,is_active",
    is_active: "eq.true",
    order: "store_no.asc",
    limit: 500,
  };
  if (access.scope.mode !== "all") storeQuery.id = inFilter(access.scope.storeIds);
  const storeRows = await deps.db.select("stores", storeQuery);
  const corporationIds = unique(storeRows.map((row) => text(row.corporation_id)).filter(Boolean));
  const corporationRows = await (
    corporationIds.length
      ? deps.db.select("corporations", {
        select: "id,corporation_name,is_active",
        id: inFilter(corporationIds),
        is_active: "eq.true",
        limit: 100,
      })
      : Promise.resolve([])
  );
  const corporationsById = new Map(corporationRows.map((row) => [text(row.id), text(row.corporation_name)]));

  const stores = storeRows.map((row, index) => {
    return {
      id: text(row.store_no) || text(row.store_id) || `store-${index + 1}`,
      name: text(row.store_name) || "未設定店舗",
      corporationName: corporationsById.get(text(row.corporation_id)) || "未設定法人",
      staffCount: null,
      salesManYen: 0,
      targetAchievementPercent: 0,
      customerCount: 0,
      unitPriceYen: 0,
      salesPerStaffManYen: 0,
      reservationFillRatePercent: 0,
      posYayoiDiffManYen: null,
      status: "warning",
      dataReadiness: "salonanswer_csv_waiting",
    };
  });

  const phase0Scope = access.scope.mode === "all"
    ? "all_stores"
    : access.scope.mode === "assigned" ? "assigned_stores" : "own_store";

  return {
    storeCount: stores.length,
    staffCount: null,
    headcountReadiness: {
      authoritative: false,
      basis: "authoritative-snapshot-provider-pending",
      currentPrimaryStoreFallbackUsed: false,
    },
    source: "nov-hub-backend-api",
    pendingCsvTypes: ["店舗別月次売上", "日次売上・客数・客単価", "予約状況"],
    phase0Scope,
    stores,
    requiredCsvFiles: [
      { name: "店舗別月次売上", fields: "対象月・店舗・売上", purpose: "店舗KPI" },
      { name: "日次売上", fields: "営業日・店舗・売上・客数・客単価", purpose: "日次進捗" },
      { name: "予約状況", fields: "営業日・店舗・予約枠・予約数", purpose: "予約充足率" },
    ],
    scopePolicy: {
      phase0: "employees.store_id",
      phase0_5: "employee_store_assignments",
      assignmentTypeAllowlist: ["primary", "secondary", "third"],
      rawIdsReturned: false,
    },
  };
}

async function buildDataopsStatus(deps: ManagementDependencies): Promise<JsonRecord> {
  const [documents, rawCount, draftCount, reviewCount] = await Promise.all([
    deps.db.select("finance_source_documents", {
      select: "document_type,source_system,period_start_month,period_end_month,imported_at",
      order: "imported_at.desc",
      limit: 500,
    }),
    deps.db.count("finance_accounting_monthly_raw", {}),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.draft", is_active: "eq.true" }),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.review", is_active: "eq.true" }),
  ]);
  const sourceTypes = unique(documents.map((row) => text(row.document_type) || text(row.source_system)).filter(Boolean));

  return {
    pendingImports: 0,
    pendingMappings: 0,
    pendingApprovals: draftCount + reviewCount,
    blockedReason: "Import, approval and production recalculation are not enabled in this read-only gate.",
    sources: sourceTypes.map((name) => ({
      name,
      source: /salon/i.test(name) ? "salonanswer" : "finance",
      readiness: "ready",
      nextAction: "状態確認のみ",
    })),
    workflow: [
      { step: 1, title: "原本確認", owner: "Data Operations Hub", status: documents.length ? "ready" : "waiting" },
      { step: 2, title: "raw確認", owner: "Data Operations Hub", status: rawCount > 0 ? "ready" : "waiting" },
      { step: 3, title: "分類承認", owner: "経営管理", status: draftCount + reviewCount > 0 ? "waiting" : "ready" },
    ],
    stoppedItems: [
      "SalonAnswer raw import",
      "classification approved update",
      "production recalculation",
    ],
    statusCounts: {
      sourceDocuments: documents.length,
      accountingRawRows: rawCount,
      classificationDraft: draftCount,
      classificationReview: reviewCount,
    },
  };
}

async function buildDataopsDiagnosticStatus(deps: ManagementDependencies): Promise<JsonRecord> {
  const [sourceDocumentCount, rawCount, draftCount, reviewCount] = await Promise.all([
    deps.db.count("finance_source_documents", {}),
    deps.db.count("finance_accounting_monthly_raw", {}),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.draft", is_active: "eq.true" }),
    deps.db.count("finance_account_classification_rules", { review_status: "eq.review", is_active: "eq.true" }),
  ]);

  return {
    pendingCounts: {
      imports: 0,
      mappings: 0,
      approvals: draftCount + reviewCount,
    },
    workflow: [
      { status: sourceDocumentCount > 0 ? "ready" : "waiting" },
      { status: rawCount > 0 ? "ready" : "waiting" },
      { status: draftCount + reviewCount > 0 ? "waiting" : "ready" },
    ],
    stoppedItems: [
      "SalonAnswer raw import",
      "classification approved update",
      "production recalculation",
    ],
    statusCounts: {
      sourceDocuments: sourceDocumentCount,
      accountingRawRows: rawCount,
      classificationDraft: draftCount,
      classificationReview: reviewCount,
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_PUBLIC_KEYS = new Set([
  "employee_id",
  "employeeId",
  "store_id",
  "storeId",
  "scope_id",
  "scopeId",
  "corporation_id",
  "corporationId",
  "firebase_uid",
  "firebaseUid",
  "token",
  "secret",
  "service_role",
  "serviceRole",
  "pin_hash",
  "pinHash",
  "full_name",
  "fullName",
  "email",
  "birth_date",
  "birthDate",
  "salary",
  "salary_yen",
  "wage",
  "evaluation",
  "evaluation_score",
  "health",
  "medical",
  "leave_type",
  "leaveType",
]);

export function assertPublicManagementPayloadSafe(value: unknown, path = "response"): void {
  if (typeof value === "string" && UUID_PATTERN.test(value)) {
    throw new Error(`Raw UUID detected at ${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicManagementPayloadSafe(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value as JsonRecord).forEach(([key, child]) => {
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) throw new Error(`Forbidden response key at ${path}.${key}`);
    assertPublicManagementPayloadSafe(child, `${path}.${key}`);
  });
}

function success(endpoint: ManagementEndpoint, data: JsonRecord, productionEnabled: boolean): ManagementResult {
  const body: JsonRecord = {
    ok: true,
    endpoint,
    contractPhase: CONTRACT_PHASE,
    productionEnabled,
    source: "nov-hub-backend-api",
    data,
  };
  assertPublicManagementPayloadSafe(body);
  return { status: 200, body };
}

function failure(endpoint: ManagementEndpoint, error: unknown, productionEnabled: boolean): ManagementResult {
  if (error instanceof ManagementSafeError) {
    return {
      status: error.status,
      body: {
        ok: false,
        endpoint,
        contractPhase: CONTRACT_PHASE,
        productionEnabled,
        error: {
          code: error.code,
          message: error.message,
          retryable: false,
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      endpoint,
      contractPhase: CONTRACT_PHASE,
      productionEnabled,
      error: {
        code: "UNKNOWN",
        message: "Management summary could not be loaded.",
        retryable: true,
      },
    },
  };
}

export async function handleManagementReadOnlyAction(
  request: ManagementRequest,
  deps: ManagementDependencies,
): Promise<ManagementResult> {
  const definition = ACTION_DEFINITIONS[request.action];
  const endpoint = definition ? definition.endpoint : "finance.summary";
  const productionEnabled = definition ? ACTION_PRODUCTION_ENABLED[request.action] === true : false;
  try {
    if (!definition) safe404();
    const responseProfile = validateResponseProfile(request);
    if (!productionEnabled) safeNotApproved();
    const access = await resolveAccess(deps, request, definition.permission);
    if (request.action === "managementFinanceSummary") {
      return success(endpoint, await buildFinanceSummary(deps, request), productionEnabled);
    }
    if (request.action === "managementStoresSummary") {
      return success(endpoint, await buildStoresSummary(deps, access), productionEnabled);
    }
    const data = responseProfile === DIAGNOSTIC_RESPONSE_PROFILE
      ? await buildDataopsDiagnosticStatus(deps)
      : await buildDataopsStatus(deps);
    return success(endpoint, data, productionEnabled);
  } catch (error) {
    return failure(endpoint, error, productionEnabled);
  }
}

export const MANAGEMENT_GATE_C4_CANDIDATE = Object.freeze({
  productionEnabledByAction: { ...ACTION_PRODUCTION_ENABLED },
  actions: Object.keys(ACTION_DEFINITIONS),
  permissions: ["finance.view", "stores.view", "dataops.view"],
  allScopeRoleCandidates: [...ALL_SCOPE_ROLE_CANDIDATES],
  departmentManagerPermissions: [],
  assignmentTypeAllowlist: [...ASSIGNMENT_TYPE_ALLOWLIST],
  repositoryMode: "SELECT-only",
});
