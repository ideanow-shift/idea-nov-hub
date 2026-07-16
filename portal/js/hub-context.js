export const HUB_CONTEXT_KEY = "novHub.currentEmployee";
export const HUB_CONTEXT_QUERY_KEY = "hub_context";
export const HUB_CONTEXT_SCHEMA = "nov-hub-context";
export const HUB_CONTEXT_SCHEMA_VERSION = 1;
const HUB_CONTEXT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const HUB_CONTEXT_CLOCK_SKEW_MS = 5 * 60 * 1000;
const URL_CONTEXT_ALLOWED_KEYS = new Set([
  "schema",
  "schemaVersion",
  "source",
  "sourceLabel",
  "authType",
  "storedAt",
  "issuedAt",
  "expiresAt",
  "employeeId",
  "employeeNumber",
  "name",
  "email",
  "corporationId",
  "corporationName",
  "departmentId",
  "departmentName",
  "positionId",
  "positionName",
  "jobTypeId",
  "jobTypeName",
  "primaryStoreId",
  "primaryStoreNo",
  "primaryStoreCode",
  "primaryStoreName",
  "employmentStatus",
  "employmentType"
]);
const URL_CONTEXT_AUTHORIZATION_KEYS = new Set([
  "access",
  "admin",
  "capabilities",
  "capability",
  "canedit",
  "canview",
  "grants",
  "isadmin",
  "permission",
  "permissions",
  "role",
  "rolekey",
  "rolekeys",
  "rolelevel",
  "roles",
  "scope",
  "scopes"
]);
const URL_CONTEXT_STRING_KEYS = new Set(
  [...URL_CONTEXT_ALLOWED_KEYS].filter((key) => key !== "schemaVersion")
);

function normalizeContextKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isStrictUrlContext(context) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return false;
  const keys = Object.keys(context);
  if (!keys.length) return false;
  if (keys.some((key) => URL_CONTEXT_AUTHORIZATION_KEYS.has(normalizeContextKey(key)))) return false;
  if (keys.some((key) => !URL_CONTEXT_ALLOWED_KEYS.has(key))) return false;
  if (context.schema !== HUB_CONTEXT_SCHEMA || context.schemaVersion !== HUB_CONTEXT_SCHEMA_VERSION) return false;
  if (keys.some((key) => URL_CONTEXT_STRING_KEYS.has(key) && typeof context[key] !== "string")) return false;
  if (!context.employeeId.trim()) return false;

  const issuedAt = Date.parse(context.issuedAt || "");
  const storedAt = Date.parse(context.storedAt || context.issuedAt || "");
  const expiresAt = Date.parse(context.expiresAt || "");
  if (![issuedAt, storedAt, expiresAt].every(Number.isFinite)) return false;
  const now = Date.now();
  if (issuedAt > now + HUB_CONTEXT_CLOCK_SKEW_MS || storedAt > now + HUB_CONTEXT_CLOCK_SKEW_MS) return false;
  if (now > expiresAt || now - storedAt > HUB_CONTEXT_MAX_AGE_MS) return false;
  if (expiresAt <= issuedAt || expiresAt - issuedAt > HUB_CONTEXT_MAX_AGE_MS) return false;
  return true;
}

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

function toBase64Url(jsonText) {
  const bytes = new TextEncoder().encode(jsonText);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isUsableContext(context) {
  if (!context || typeof context !== "object") return false;
  if (context.schema && context.schema !== HUB_CONTEXT_SCHEMA) return false;
  const expiresAt = Date.parse(context.expiresAt || "");
  if (expiresAt && Date.now() > expiresAt) return false;
  const storedAt = Date.parse(context.storedAt || context.issuedAt || "");
  if (storedAt && Date.now() - storedAt > HUB_CONTEXT_MAX_AGE_MS) return false;
  return Boolean(context.id || context.employeeId || context.supabaseEmployeeId || context.email);
}

function persistHubEmployeeContext(context) {
  if (!isUsableContext(context)) return null;
  const serialized = JSON.stringify(context);
  sessionStorage.setItem(HUB_CONTEXT_KEY, serialized);
  localStorage.setItem(HUB_CONTEXT_KEY, serialized);
  return context;
}

export function encodeHubContextForUrl(context) {
  if (!context || typeof context !== "object") return "";
  try {
    const payload = {
      schema: context.schema || HUB_CONTEXT_SCHEMA,
      schemaVersion: context.schemaVersion || HUB_CONTEXT_SCHEMA_VERSION,
      source: context.source,
      sourceLabel: context.sourceLabel,
      authType: context.authType,
      storedAt: context.storedAt,
      issuedAt: context.issuedAt,
      expiresAt: context.expiresAt,
      id: context.id,
      employeeId: context.employeeId,
      employeeNumber: context.employeeNumber,
      coreEmployeeId: context.coreEmployeeId,
      supabaseEmployeeId: context.supabaseEmployeeId,
      staffId: context.staffId,
      firebaseUid: context.firebaseUid,
      name: context.name,
      displayName: context.displayName,
      fullName: context.fullName,
      email: context.email,
      authEmail: context.authEmail,
      corporation: context.corporation,
      corporationId: context.corporationId,
      corporationName: context.corporationName,
      department: context.department,
      departmentId: context.departmentId,
      departmentName: context.departmentName,
      position: context.position,
      positionId: context.positionId,
      positionName: context.positionName,
      jobType: context.jobType,
      jobTypeId: context.jobTypeId,
      jobTypeName: context.jobTypeName,
      primaryStore: context.primaryStore,
      primaryStoreId: context.primaryStoreId,
      primaryStoreNo: context.primaryStoreNo,
      primaryStoreCode: context.primaryStoreCode,
      primaryStoreName: context.primaryStoreName,
      storeId: context.storeId,
      storeName: context.storeName,
      storeCode: context.storeCode,
      store: context.store,
      storeAssignments: context.storeAssignments,
      employmentStatus: context.employmentStatus,
      employmentType: context.employmentType,
      roleLevel: context.roleLevel,
      roleKeys: context.roleKeys,
      roles: context.roles,
      permissions: context.permissions,
      tags: context.tags
    };
    return toBase64Url(JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to encode NOV HUB context.", error);
    return "";
  }
}

export function decodeHubContextFromUrlValue(value) {
  if (!value) return null;
  try {
    const context = JSON.parse(fromBase64Url(value));
    return isStrictUrlContext(context) ? context : null;
  } catch (error) {
    console.warn("NOV HUB context URL parameter could not be decoded.", error);
    return null;
  }
}

export function readHubEmployeeContextFromUrl(url) {
  try {
    const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!targetUrl) return null;
    const value = new URL(targetUrl).searchParams.get(HUB_CONTEXT_QUERY_KEY);
    return decodeHubContextFromUrlValue(value);
  } catch (error) {
    console.warn("NOV HUB context URL could not be inspected.", error);
    return null;
  }
}

export function buildHubEmployeeContext(employee = {}, authType = "") {
  const source = String(employee.source || "").toLowerCase();
  const sourceLabel = source.startsWith("supabase") ? "Core DB" : source === "spreadsheet" ? "Spreadsheet" : "HUB";
  const coreEmployeeId = String(employee.coreEmployeeId || employee.id || "");
  const employeeNumber = String(employee.employeeNumber || employee.employeeId || "");
  const roleKeys = normalizeArray(employee.roleKeys);
  const roles = normalizeRoles(employee.roles, roleKeys);
  const storeAssignments = Array.isArray(employee.storeAssignments) ? employee.storeAssignments.map(normalizeStoreAssignment).filter(Boolean) : [];
  const primaryStore = normalizeStore(employee.primaryStore, { id: employee.storeUuid || "", storeId: employee.storeCode || "", name: employee.store || "" });
  const corporation = normalizeRef(employee.corporationRef, { name: employee.corporation || "" });
  const department = normalizeRef(employee.departmentRef, { name: employee.department || "" });
  const position = normalizeRef(employee.positionRef, { name: employee.position || "" });
  const jobType = normalizeRef(employee.jobTypeRef, { name: employee.jobType || employee.jobTypeName || "" });
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + HUB_CONTEXT_MAX_AGE_MS).toISOString();
  return {
    schema: HUB_CONTEXT_SCHEMA,
    schemaVersion: HUB_CONTEXT_SCHEMA_VERSION,
    source: employee.source || "",
    sourceLabel,
    authType: authType || "",
    id: coreEmployeeId,
    coreEmployeeId,
    supabaseEmployeeId: coreEmployeeId,
    staffId: coreEmployeeId,
    employeeId: coreEmployeeId,
    employeeNumber,
    firebaseUid: employee.firebaseUid || "",
    email: employee.email || "",
    authEmail: employee.email || "",
    fullName: employee.fullName || employee.name || "",
    name: employee.name || employee.fullName || "",
    employmentStatus: employee.employmentStatus || "",
    employmentType: employee.employmentType || "",
    isActive: employee.isActive !== false,
    corporation,
    corporationId: corporation.id,
    corporationName: corporation.name,
    department,
    departmentId: department.id,
    departmentName: department.name || employee.department || "",
    position,
    positionId: position.id,
    positionName: position.name || employee.position || "",
    jobType,
    jobTypeId: jobType.id,
    jobTypeName: jobType.name || employee.jobType || employee.jobTypeName || "",
    primaryStore,
    primaryStoreId: primaryStore.id,
    primaryStoreNo: primaryStore.storeNo,
    primaryStoreCode: primaryStore.storeId,
    primaryStoreName: primaryStore.name,
    storeId: primaryStore.id,
    storeName: primaryStore.name,
    storeAssignments,
    roleLevel: Number(employee.roleLevel || 1),
    roleKeys,
    roles,
    permissions: buildPermissions(roleKeys),
    tags: normalizeArray(employee.tags),
    store: primaryStore.name || employee.store || "",
    storeCode: primaryStore.storeId || employee.storeCode || "",
    storedAt: issuedAt,
    loadedAt: issuedAt,
    issuedAt,
    expiresAt
  };
}

export function saveHubEmployeeContext(employee, authType) {
  const context = buildHubEmployeeContext(employee, authType);
  persistHubEmployeeContext(context);
  window.dispatchEvent(new CustomEvent("novHub:employeeContextReady", { detail: context }));
  return context;
}

function readStoredHubEmployeeContext(storage) {
  const raw = storage.getItem(HUB_CONTEXT_KEY);
  if (!raw) return null;
  try {
    const context = JSON.parse(raw);
    const expiresAt = Date.parse(context.expiresAt || "");
    if (expiresAt && Date.now() > expiresAt) {
      storage.removeItem(HUB_CONTEXT_KEY);
      return null;
    }
    const storedAt = Date.parse(context.storedAt || "");
    if (storedAt && Date.now() - storedAt > HUB_CONTEXT_MAX_AGE_MS) {
      storage.removeItem(HUB_CONTEXT_KEY);
      return null;
    }
    return isUsableContext(context) ? context : null;
  } catch (error) {
    console.warn("NOV HUB context could not be parsed.", error);
    storage.removeItem(HUB_CONTEXT_KEY);
    return null;
  }
}

export function readHubEmployeeContext() {
  const urlContext = readHubEmployeeContextFromUrl();
  if (urlContext) return urlContext;
  return readStoredHubEmployeeContext(sessionStorage) || readStoredHubEmployeeContext(localStorage);
}

export function clearHubEmployeeContext() {
  sessionStorage.removeItem(HUB_CONTEXT_KEY);
  localStorage.removeItem(HUB_CONTEXT_KEY);
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
    schema: HUB_CONTEXT_SCHEMA,
    schemaVersion: HUB_CONTEXT_SCHEMA_VERSION,
    build: buildHubEmployeeContext,
    encodeForUrl: encodeHubContextForUrl,
    decodeFromUrlValue: decodeHubContextFromUrlValue,
    readFromUrl: readHubEmployeeContextFromUrl,
    read: readHubEmployeeContext,
    clear: clearHubEmployeeContext,
    summary: getHubEmployeeContextSummary
  };
}
