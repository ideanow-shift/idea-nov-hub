import {
  buildStoreSalesProjection,
  type StoreSalesProjectionInput,
} from "./store_sales_projection.ts";

export type JsonRecord = Record<string, unknown>;

export type ManagementAction =
  | "managementFinanceSummary"
  | "managementStoresSummary"
  | "storeSalesProjection"
  | "storeMonthlyActualProjectionV1"
  | "managementDataopsStatus"
  | "managementBusinessDataCapability";

export type ManagementEndpoint =
  | "finance.summary"
  | "stores.summary"
  | "store-sales.projection"
  | "store-monthly-actual.projection"
  | "dataops.status"
  | "business-data.capability";

export type ManagementPermission =
  | "finance.view"
  | "stores.view"
  | "dataops.view"
  | "business_data.admin";

export type ScopeMode = "all" | "own" | "assigned" | "none";

export type ReadQuery = Record<string, string | number | boolean | undefined>;

export interface ReadOnlyGateway {
  select(table: string, query: ReadQuery): Promise<JsonRecord[]>;
  count(table: string, query: ReadQuery): Promise<number>;
  rpc?(name: string, args: JsonRecord): Promise<JsonRecord[]>;
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
  resolveCanonicalAccess?(
    auth: VerifiedAuth,
    request: ManagementRequest,
  ): Promise<CanonicalAccessContext | null>;
  db: ReadOnlyGateway;
  today?: () => string;
  assignedScopeEnabled?: boolean;
}

export interface CanonicalAccessContext {
  employeeId: string;
  roleKeys: string[];
  scope: {
    mode: ScopeMode;
    storeIds: string[];
  };
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
  corporationId: string | null;
  departmentId: string | null;
  positionId: string | null;
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
  storeSalesProjection: true,
  storeMonthlyActualProjectionV1: true,
  managementDataopsStatus: true,
  managementBusinessDataCapability: true,
};
const ASSIGNMENT_TYPE_ALLOWLIST = new Set(["primary", "secondary", "third"]);
const ALL_SCOPE_ROLE_CANDIDATES = new Set([
  "super_admin",
  "executive",
  "backoffice",
  "accounting",
  "business_data_admin",
]);

const ROLE_PERMISSION_CANDIDATES: Record<string, ManagementPermission[]> = {
  super_admin: ["finance.view", "stores.view", "dataops.view", "business_data.admin"],
  executive: ["finance.view", "stores.view", "dataops.view"],
  backoffice: ["finance.view", "stores.view", "dataops.view"],
  accounting: ["finance.view", "stores.view", "dataops.view"],
  area_manager: ["stores.view"],
  store_manager: ["stores.view"],
  department_manager: [],
  business_data_admin: ["business_data.admin", "finance.view", "stores.view", "dataops.view"],
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
  storeSalesProjection: {
    endpoint: "store-sales.projection",
    permission: "stores.view",
  },
  storeMonthlyActualProjectionV1: {
    endpoint: "store-monthly-actual.projection",
    permission: "stores.view",
  },
  managementDataopsStatus: {
    endpoint: "dataops.status",
    permission: "dataops.view",
  },
  managementBusinessDataCapability: {
    endpoint: "business-data.capability",
    permission: "business_data.admin",
  },
};

class ManagementSafeError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404,
    readonly code: "INVALID_REQUEST" | "UNAUTHORIZED" | "ACCESS_DENIED" | "FORBIDDEN" | "SCOPE_DENIED" | "DATA_NOT_READY" | "NOT_APPROVED",
    message: string,
  ) {
    super(message);
  }
}

export function denyManagementAccess(): never {
  throw new ManagementSafeError(403, "ACCESS_DENIED", "Access denied.");
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
    select: "id,corporation_id,department_id,position_id,store_id,employment_status,is_active",
    id: `eq.${reference.id}`,
    limit: 2,
  });
  const row = rows[0];
  if (rows.length !== 1 || !row || row.is_active !== true || text(row.id) !== reference.id
    || !isEligibleEmploymentStatus(row.employment_status)) safe401();
  return {
    id: text(row.id),
    storeId: text(row.store_id) || null,
    corporationId: text(row.corporation_id) || null,
    departmentId: text(row.department_id) || null,
    positionId: text(row.position_id) || null,
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

  if (deps.resolveCanonicalAccess) {
    const canonical = await deps.resolveCanonicalAccess(auth, request);
    if (!canonical?.employeeId) safe401();
    const roleKeys = unique(canonical.roleKeys.map(text).filter(Boolean));
    const permissions = permissionsForRoles(roleKeys);
    if (!permissions.includes(requiredPermission)) safe403("FORBIDDEN");
    const scope: InternalScope = {
      mode: canonical.scope.mode,
      storeIds: unique(canonical.scope.storeIds.map(text).filter(Boolean)),
    };
    if (requiredPermission === "stores.view" && scope.mode === "none") safe403("SCOPE_DENIED");
    if (requiredPermission === "stores.view"
      && requestedScopeExceedsResolved(request.payload?.scopeMode, scope.mode)) safe403("SCOPE_DENIED");
    return {
      employee: {
        id: canonical.employeeId,
        storeId: scope.mode === "own" ? scope.storeIds[0] || null : null,
        corporationId: null,
        departmentId: null,
        positionId: null,
      },
      roleKeys,
      permissions,
      scope,
    };
  }

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

type OfficialOperatingStore = {
  rawId: string;
  publicKey: string;
  storeName: string;
  corporationId: string;
  corporationName: string;
  ownership: "DIRECT" | "FC";
};

const STORE_MONTHLY_ACTUAL_CONTRACT = "STORE_MONTHLY_ACTUAL_V1";
const STORE_MONTHLY_COMPARISON_CONTRACT = "STORE_MONTHLY_COMPARISON_V1";
const OFFICIAL_OPERATING_STORE_BASELINE = Object.freeze({ total: 20, direct: 13, fc: 7 });

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.slice(0, 7).split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  for (let current = start; current <= end && months.length < 24; current = shiftMonth(current, 1)) months.push(current);
  return months;
}

function fiscalStartMonth(selectedMonth: string, fiscalYearEndMonth: number): string {
  const selectedYear = Number(selectedMonth.slice(0, 4));
  const selectedMonthNumber = Number(selectedMonth.slice(5, 7));
  const startMonthNumber = fiscalYearEndMonth % 12 + 1;
  const startYear = selectedMonthNumber >= startMonthNumber ? selectedYear : selectedYear - 1;
  return `${startYear}-${String(startMonthNumber).padStart(2, "0")}-01`;
}

function comparisonValue(numerator: number | null, denominator: number | null): JsonRecord {
  if (numerator === null || denominator === null || denominator === 0) {
    return { dataState: "preparing", value: null };
  }
  const percentage = Math.round((numerator / denominator * 100) * 1e10) / 1e10;
  return { dataState: "confirmed", value: String(percentage) };
}

function normalizeOwnership(value: unknown): "DIRECT" | "FC" | null {
  const normalized = text(value).normalize("NFKC").toUpperCase();
  if (["DIRECT", "直営", "直営店"].includes(normalized)) return "DIRECT";
  if (["FC", "FRANCHISE", "FC店"].includes(normalized)) return "FC";
  return null;
}

async function loadOfficialOperatingStores(
  deps: ManagementDependencies,
  access: AccessContext,
): Promise<OfficialOperatingStore[]> {
  const storeRows = await deps.db.select("stores", {
    select: "id,store_no,store_id,store_name,corporation_id,store_type,is_active",
    is_active: "eq.true",
    order: "store_no.asc",
    limit: 500,
  });
  const officialRows = storeRows
    .map((row) => ({ row, ownership: normalizeOwnership(row.store_type) }))
    .filter((value): value is { row: JsonRecord; ownership: "DIRECT" | "FC" } => value.ownership !== null);
  const directCount = officialRows.filter((value) => value.ownership === "DIRECT").length;
  const fcCount = officialRows.filter((value) => value.ownership === "FC").length;
  if (officialRows.length !== OFFICIAL_OPERATING_STORE_BASELINE.total
    || directCount !== OFFICIAL_OPERATING_STORE_BASELINE.direct
    || fcCount !== OFFICIAL_OPERATING_STORE_BASELINE.fc) safe404();

  const corporationIds = unique(officialRows.map(({ row }) => text(row.corporation_id)).filter(Boolean));
  const corporationRows = corporationIds.length
    ? await deps.db.select("corporations", {
      select: "id,corporation_name,is_active",
      id: inFilter(corporationIds),
      is_active: "eq.true",
      limit: 100,
    })
    : [];
  const corporationsById = new Map(corporationRows
    .filter((row) => row.is_active === true)
    .map((row) => [text(row.id), text(row.corporation_name)]));
  const allowedIds = access.scope.mode === "all" ? null : new Set(access.scope.storeIds);

  return officialRows
    .filter(({ row }) => allowedIds === null || allowedIds.has(text(row.id)))
    .map(({ row, ownership }) => {
      const corporationId = text(row.corporation_id);
      const rawId = text(row.id);
      const publicKey = text(row.store_id) || text(row.store_no);
      const storeName = text(row.store_name);
      const corporationName = corporationsById.get(corporationId) || "";
      if (!rawId || !publicKey || !storeName || !corporationId || !corporationName) safe404();
      return { rawId, publicKey, storeName, corporationId, corporationName, ownership };
    });
}

async function assertBusinessDataAdminCanonicalContext(
  deps: ManagementDependencies,
  employee: InternalEmployee,
): Promise<void> {
  if (!employee.corporationId || !employee.positionId) safe403("FORBIDDEN");
  const referenceChecks: Promise<JsonRecord[]>[] = [
    deps.db.select("corporations", {
      select: "id,is_active",
      id: `eq.${employee.corporationId}`,
      is_active: "eq.true",
      limit: 2,
    }),
    deps.db.select("positions", {
      select: "id,is_active",
      id: `eq.${employee.positionId}`,
      is_active: "eq.true",
      limit: 2,
    }),
  ];
  const referenceIds = [employee.corporationId, employee.positionId];
  if (employee.departmentId) {
    referenceChecks.push(deps.db.select("departments", {
      select: "id,is_active",
      id: `eq.${employee.departmentId}`,
      is_active: "eq.true",
      limit: 2,
    }));
    referenceIds.push(employee.departmentId);
  }
  if (employee.storeId) {
    referenceChecks.push(deps.db.select("stores", {
      select: "id,is_active",
      id: `eq.${employee.storeId}`,
      is_active: "eq.true",
      limit: 2,
    }));
    referenceIds.push(employee.storeId);
  }
  const references = await Promise.all(referenceChecks);
  for (const [index, rows] of references.entries()) {
    if (rows.length !== 1 || rows[0].is_active !== true || text(rows[0].id) !== referenceIds[index]) {
      safe403("FORBIDDEN");
    }
  }
}

async function buildBusinessDataCapability(
  deps: ManagementDependencies,
  access: AccessContext,
): Promise<JsonRecord> {
  const today = deps.today?.() || todayJstFallback();
  await assertBusinessDataAdminCanonicalContext(deps, access.employee);
  return {
    capability: { businessDataAdmin: true },
    scope: access.scope.mode,
    effectiveOn: today,
    runtimeImport: "DISABLED",
    productionWrite: "DISABLED",
  };
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

async function buildStoreSalesProjectionResponse(
  deps: ManagementDependencies,
  access: AccessContext,
  request: ManagementRequest,
): Promise<JsonRecord> {
  const directory = await buildStoresSummary(deps, access);
  const selectedMonth = text(request.payload?.selectedMonth) || new Date().toISOString().slice(0, 7);
  const inputs = (Array.isArray(directory.stores) ? directory.stores : []).map((value) => {
    const row = value as JsonRecord;
    return {
      storeKey: text(row.id),
      storeName: text(row.name) || "未設定店舗",
      ownership: null,
      corporation: text(row.corporationName) || null,
      period: selectedMonth,
      accountingState: "preparing",
      lastUpdatedAt: null,
      metrics: {},
      signals: {},
    } satisfies StoreSalesProjectionInput;
  });
  return buildStoreSalesProjection(inputs);
}

async function buildStoreMonthlyActualProjection(
  deps: ManagementDependencies,
  access: AccessContext,
  request: ManagementRequest,
): Promise<JsonRecord> {
  const fiscalMonth = validMonth(request.payload?.selectedMonth);
  if (!fiscalMonth) {
    throw new ManagementSafeError(400, "INVALID_REQUEST", "selectedMonth must use YYYY-MM format.");
  }
  if (!deps.db.rpc) safe404();

  const stores = await loadOfficialOperatingStores(deps, access);
  if (!stores.length) safe403("SCOPE_DENIED");
  const storeByRawId = new Map(stores.map((store) => [store.rawId, store]));
  const corporationIds = unique(stores.map((store) => store.corporationId));
  const rangeStart = shiftMonth(fiscalMonth, -23);
  const profileRows = await deps.db.select("corporation_business_profiles", {
    select: "corporation_id,fiscal_year_end_month",
    corporation_id: inFilter(corporationIds),
    limit: 100,
  });
  const fiscalYearEndByCorporation = new Map(profileRows.map((row) => [
    text(row.corporation_id), numberValue(row.fiscal_year_end_month),
  ]));
  const rangeGroups = await Promise.all(corporationIds.map(async (corporationId) => {
    const scopedStoreIds = stores
      .filter((store) => store.corporationId === corporationId)
      .map((store) => store.rawId);
    const [actuals, budgets] = await Promise.all([
      deps.db.rpc!("dbf_store_monthly_actual_range_read_v1", {
        p_start_month: rangeStart, p_end_month: fiscalMonth,
        p_company_id: corporationId, p_store_ids: scopedStoreIds,
      }),
      deps.db.rpc!("dbf_store_monthly_budget_range_read_v1", {
        p_start_month: rangeStart, p_end_month: fiscalMonth,
        p_company_id: corporationId, p_store_ids: scopedStoreIds,
      }),
    ]);
    return { actuals, budgets };
  }));
  const facts = rangeGroups.flatMap((group) => group.actuals);
  const budgets = rangeGroups.flatMap((group) => group.budgets);
  const factsByStoreMonth = new Map<string, JsonRecord[]>();
  for (const fact of facts) {
    const rawStoreId = text(fact.store_id);
    const scopedStore = storeByRawId.get(rawStoreId);
    const metricValue = text(fact.metric_value);
    if (!scopedStore
      || text(fact.company_id) !== scopedStore.corporationId
      || text(fact.fiscal_month) < rangeStart || text(fact.fiscal_month) > fiscalMonth
      || !text(fact.metric_code)
      || !["amount", "quantity", "rate"].includes(text(fact.value_kind))
      || !metricValue
      || !/^-?\d+(?:\.\d+)?$/u.test(metricValue)
      || !/^[0-9a-f]{64}$/u.test(text(fact.source_file_sha256))) safe404();
    const grain = `${rawStoreId}|${text(fact.fiscal_month)}`;
    const current = factsByStoreMonth.get(grain) || [];
    if (current.some((value) => text(value.metric_code) === text(fact.metric_code))) safe404();
    current.push(fact);
    factsByStoreMonth.set(grain, current);
  }

  const budgetsByStoreMonthMetric = new Map<string, JsonRecord[]>();
  for (const budget of budgets) {
    const rawStoreId = text(budget.store_id);
    const scopedStore = storeByRawId.get(rawStoreId);
    const amount = text(budget.budget_amount);
    if (!scopedStore || text(budget.company_id) !== scopedStore.corporationId
      || text(budget.fiscal_month) < rangeStart || text(budget.fiscal_month) > fiscalMonth
      || !text(budget.metric_code) || !text(budget.scenario_code)
      || !/^-?\d+(?:\.\d+)?$/u.test(amount)
      || !/^[0-9a-f]{64}$/u.test(text(budget.source_file_sha256))) safe404();
    const grain = `${rawStoreId}|${text(budget.fiscal_month)}|${text(budget.metric_code)}`;
    const current = budgetsByStoreMonthMetric.get(grain) || [];
    current.push(budget);
    budgetsByStoreMonthMetric.set(grain, current);
  }

  const actualNumber = (storeId: string, month: string, metricCode: string): number | null => {
    const fact = (factsByStoreMonth.get(`${storeId}|${month}`) || [])
      .find((value) => text(value.metric_code) === metricCode);
    const value = text(fact?.metric_value);
    return /^-?\d+(?:\.\d+)?$/u.test(value) ? Number(value) : null;
  };
  const budgetNumber = (storeId: string, month: string, metricCode: string): number | null => {
    const candidates = budgetsByStoreMonthMetric.get(`${storeId}|${month}|${metricCode}`) || [];
    if (candidates.length !== 1) return null;
    const value = text(candidates[0].budget_amount);
    return /^-?\d+(?:\.\d+)?$/u.test(value) ? Number(value) : null;
  };

  const projectedStores = stores.map((store) => {
    const storeFacts = (factsByStoreMonth.get(`${store.rawId}|${fiscalMonth}`) || [])
      .sort((left, right) => text(left.metric_code).localeCompare(text(right.metric_code), "en"));
    const currentSales = actualNumber(store.rawId, fiscalMonth, "TOTAL_SALES");
    const budgetSales = budgetNumber(store.rawId, fiscalMonth, "TOTAL_SALES");
    const priorYearSales = actualNumber(store.rawId, shiftMonth(fiscalMonth, -12), "TOTAL_SALES");
    const fiscalYearEnd = fiscalYearEndByCorporation.get(store.corporationId) || 0;
    const validFiscalYear = Number.isInteger(fiscalYearEnd) && fiscalYearEnd >= 1 && fiscalYearEnd <= 12;
    const ytdMonths = validFiscalYear ? monthsBetween(fiscalStartMonth(fiscalMonth, fiscalYearEnd), fiscalMonth) : [];
    const ytdMetric = (metricCode: string): JsonRecord => {
      const values = ytdMonths.map((month) => actualNumber(store.rawId, month, metricCode));
      if (!ytdMonths.length || values.some((value) => value === null)) return { dataState: "preparing", value: null };
      return { dataState: "confirmed", value: String((values as number[]).reduce((sum, value) => sum + value, 0)) };
    };
    const ytdSales = ytdMetric("TOTAL_SALES");
    const ytdBudgets = ytdMonths.map((month) => budgetNumber(store.rawId, month, "TOTAL_SALES"));
    const ytdBudgetAchievement = ytdSales.dataState === "confirmed" && ytdBudgets.length
      && ytdBudgets.every((value) => value !== null && value !== 0)
      ? comparisonValue(Number(ytdSales.value), (ytdBudgets as number[]).reduce((sum, value) => sum + value, 0))
      : { dataState: "preparing", value: null };
    const monthlyTrend = monthsBetween(rangeStart, fiscalMonth).map((month) => {
      const metrics = [
        "TOTAL_SALES",
        "OPERATING_PROFIT",
        "TOTAL_CUSTOMERS",
        "TOTAL_UNIT_PRICE",
        "RETAIL_SALES",
        "EC_ALLOCATED_SALES",
      ]
        .map((metricCode) => ({ metricCode, value: actualNumber(store.rawId, month, metricCode) }))
        .filter((metric) => metric.value !== null)
        .map((metric) => ({ metricCode: metric.metricCode, value: String(metric.value) }));
      return { fiscalMonth: month.slice(0, 7), dataState: metrics.length ? "confirmed" : "preparing", metrics };
    });
    return {
      storeKey: store.publicKey,
      storeName: store.storeName,
      corporationName: store.corporationName,
      ownership: store.ownership,
      fiscalMonth: fiscalMonth.slice(0, 7),
      dataState: storeFacts.length ? "confirmed" : "preparing",
      metrics: storeFacts.map((fact) => ({
        metricCode: text(fact.metric_code),
        valueKind: text(fact.value_kind),
        value: text(fact.metric_value),
        definitionVersion: text(fact.definition_version),
        displayName: text(fact.display_name),
        description: text(fact.description),
        sourceEvidence: {
          sourceType: text(fact.source_type),
          sourceFileSha256: text(fact.source_file_sha256),
          importedAt: text(fact.imported_at),
          factVersion: numberValue(fact.fact_version),
        },
      })),
      comparisons: {
        contractVersion: STORE_MONTHLY_COMPARISON_CONTRACT,
        budgetRatio: comparisonValue(currentSales, budgetSales),
        yearOverYearRatio: comparisonValue(currentSales, priorYearSales),
        fiscalYear: {
          dataState: validFiscalYear ? "confirmed" : "preparing",
          startMonth: validFiscalYear ? fiscalStartMonth(fiscalMonth, fiscalYearEnd).slice(0, 7) : null,
          endMonth: fiscalMonth.slice(0, 7),
          metrics: {
            TOTAL_SALES: ytdSales,
            OPERATING_PROFIT: ytdMetric("OPERATING_PROFIT"),
            TOTAL_CUSTOMERS: ytdMetric("TOTAL_CUSTOMERS"),
          },
          budgetAchievement: ytdBudgetAchievement,
        },
        monthlyTrend,
      },
    };
  });

  return {
    contractVersion: STORE_MONTHLY_ACTUAL_CONTRACT,
    comparisonContractVersion: STORE_MONTHLY_COMPARISON_CONTRACT,
    fiscalMonth: fiscalMonth.slice(0, 7),
    scope: {
      mode: access.scope.mode,
      serverResolved: true,
      rawStoreIdsReturned: false,
      operatingStoreBaseline: { ...OFFICIAL_OPERATING_STORE_BASELINE },
      visibleStoreCount: projectedStores.length,
    },
    readiness: {
      confirmedStoreCount: projectedStores.filter((store) => store.dataState === "confirmed").length,
      missingStoreCount: projectedStores.filter((store) => store.dataState === "preparing").length,
      factRowCount: facts.length,
      budgetFactRowCount: budgets.length,
      missingDataPolicy: "preparing-not-zero",
    },
    responsibility: {
      operatingMetrics: "public.dbf_store_monthly_metric_facts",
      corporateFinancialLineItems: "public.dbf_pl_detail_facts",
      corporateFinancialLineItemsIncluded: false,
    },
    stores: projectedStores,
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
    if (request.action === "storeSalesProjection") {
      return success(endpoint, await buildStoreSalesProjectionResponse(deps, access, request), productionEnabled);
    }
    if (request.action === "storeMonthlyActualProjectionV1") {
      return success(endpoint, await buildStoreMonthlyActualProjection(deps, access, request), productionEnabled);
    }
    if (request.action === "managementBusinessDataCapability") {
      return success(endpoint, await buildBusinessDataCapability(deps, access), productionEnabled);
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
  permissions: ["finance.view", "stores.view", "dataops.view", "business_data.admin"],
  allScopeRoleCandidates: [...ALL_SCOPE_ROLE_CANDIDATES],
  departmentManagerPermissions: [],
  assignmentTypeAllowlist: [...ASSIGNMENT_TYPE_ALLOWLIST],
  repositoryMode: "SELECT-only",
});
