export const HUB_CONTEXT_KEY = "novHub.currentEmployee";

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function normalizeRole(role) {
  if (!role) return null;
  if (typeof role === "string") return { roleKey: role, roleName: "", scopeType: "", scopeId: null };
  const roleKey = String(role.roleKey || role.role_key || "").trim();
  if (!roleKey) return null;
  return {
    roleKey,
    roleName: String(role.roleName || role.role_name || ""),
    scopeType: String(role.scopeType || role.scope_type || ""),
    scopeId: role.scopeId || role.scope_id || null
  };
}

function normalizeRoles(value, fallbackKeys = []) {
  const roles = Array.isArray(value) ? value.map(normalizeRole).filter(Boolean) : [];
  if (roles.length) return roles;
  return normalizeArray(fallbackKeys).map((roleKey) => ({ roleKey, roleName: "", scopeType: "", scopeId: null }));
}

function normalizeRef(value, fallback = {}) {
  if (value && typeof value === "object") {
    return {
      id: String(value.id || ""),
      code: String(value.code || ""),
      name: String(value.name || "")
    };
  }
  return {
    id: String(fallback.id || ""),
    code: String(fallback.code || ""),
    name: String(fallback.name || value || "")
  };
}

function normalizeStore(value, fallback = {}) {
  if (value && typeof value === "object") {
    return {
      id: String(value.id || ""),
      storeNo: String(value.storeNo || value.store_no || ""),
      storeId: String(value.storeId || value.store_id || value.storeCode || ""),
      name: String(value.name || value.storeName || value.store_name || "")
    };
  }
  return {
    id: String(fallback.id || ""),
    storeNo: String(fallback.storeNo || ""),
    storeId: String(fallback.storeId || fallback.storeCode || ""),
    name: String(fallback.name || value || "")
  };
}

function normalizeStoreAssignment(item) {
  if (!item || typeof item !== "object") return null;
  const storeId = String(item.storeId || item.store_id || "");
  const storeName = String(item.storeName || item.store_name || "");
  if (!storeId && !storeName) return null;
  return {
    storeId,
    storeNo: String(item.storeNo || item.store_no || ""),
    storeCode: String(item.storeCode || item.store_code || ""),
    storeName,
    assignmentType: String(item.assignmentType || item.assignment_type || ""),
    priority: Number(item.priority || item.assignment_order || 0)
  };
}

function buildPermissions(roleKeys) {
  const roles = new Set(normalizeArray(roleKeys));
  const isSuperAdmin = roles.has("super_admin");
  const isExecutive = roles.has("executive");
  const isBackoffice = roles.has("backoffice");
  const isAccounting = roles.has("accounting");
  return {
    isSuperAdmin,
    isExecutive,
    isBackoffice,
    isAccounting,
    canViewAllMasters: isSuperAdmin || isExecutive || isBackoffice || isAccounting || roles.has("department_manager"),
    canEditCoreMasters: isSuperAdmin || isBackoffice
  };
}

export function buildHubEmployeeContext(employee = {}, authType = "") {
  const sourceLabel = employee.source === "supabase" ? "Core DB" : employee.source === "spreadsheet" ? "Spreadsheet" : "Demo";
  const coreEmployeeId = String(employee.coreEmployeeId || employee.id || "");
  const employeeNumber = String(employee.employeeNumber || employee.employeeId || "");
  const roleKeys = normalizeArray(employee.roleKeys);
  const roles = normalizeRoles(employee.roles, roleKeys);
  const storeAssignments = Array.isArray(employee.storeAssignments) ? employee.storeAssignments.map(normalizeStoreAssignment).filter(Boolean) : [];
  const primaryStore = normalizeStore(employee.primaryStore, { id: employee.storeUuid || "", storeId: employee.storeCode || "", name: employee.store || "" });
  return {
    source: employee.source || "",
    sourceLabel,
    authType: authType || "",
    id: coreEmployeeId,
    coreEmployeeId,
    employeeId: coreEmployeeId,
    employeeNumber,
    firebaseUid: employee.firebaseUid || "",
    email: employee.email || "",
    fullName: employee.fullName || employee.name || "",
    name: employee.name || employee.fullName || "",
    employmentStatus: employee.employmentStatus || "",
    employmentType: employee.employmentType || "",
    isActive: employee.isActive !== false,
    corporation: normalizeRef(employee.corporationRef, { name: employee.corporation || "" }),
    department: normalizeRef(employee.departmentRef, { name: employee.department || "" }),
    position: normalizeRef(employee.positionRef, { name: employee.position || "" }),
    primaryStore,
    storeAssignments,
    roleLevel: Number(employee.roleLevel || 1),
    roleKeys,
    roles,
    permissions: buildPermissions(roleKeys),
    tags: normalizeArray(employee.tags),
    store: primaryStore.name || employee.store || "",
    storeCode: primaryStore.storeId || employee.storeCode || "",
    departmentName: employee.department || "",
    positionName: employee.position || "",
    storedAt: new Date().toISOString(),
    loadedAt: new Date().toISOString()
  };
}

export function saveHubEmployeeContext(employee, authType) {
  const context = buildHubEmployeeContext(employee, authType);
  sessionStorage.setItem(HUB_CONTEXT_KEY, JSON.stringify(context));
  window.dispatchEvent(new CustomEvent("novHub:employeeContextReady", { detail: context }));
  return context;
}

export function readHubEmployeeContext() {
  const raw = sessionStorage.getItem(HUB_CONTEXT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("NOV HUB context could not be parsed.", error);
    return null;
  }
}

export function clearHubEmployeeContext() {
  sessionStorage.removeItem(HUB_CONTEXT_KEY);
}

export function getHubEmployeeContextSummary(context) {
  if (!context) return "";
  const authLabel = context.authType === "firebase" ? "Firebase Auth" : context.authType === "pin" ? "PIN" : "デモ";
  const positionName = typeof context.position === "object" ? context.position.name : context.position;
  return [
    `${context.sourceLabel || "HUB"}連携`,
    authLabel,
    context.employeeNumber ? `社員番号 ${context.employeeNumber}` : "",
    positionName || context.positionName || "",
    normalizeArray(context.roleKeys).length ? `権限 ${normalizeArray(context.roleKeys).join(", ")}` : ""
  ].filter(Boolean).join(" / ");
}

if (typeof window !== "undefined") {
  window.NovHubContext = {
    key: HUB_CONTEXT_KEY,
    read: readHubEmployeeContext,
    summary: getHubEmployeeContextSummary
  };
}
