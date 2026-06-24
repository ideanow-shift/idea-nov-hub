export const HUB_CONTEXT_KEY = "novHub.currentEmployee";

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

export function buildHubEmployeeContext(employee = {}, authType = "") {
  const sourceLabel = employee.source === "supabase" ? "Core DB" : employee.source === "spreadsheet" ? "Spreadsheet" : "Demo";
  return {
    source: employee.source || "",
    sourceLabel,
    authType: authType || "",
    id: employee.coreEmployeeId || employee.id || "",
    employeeId: employee.employeeId || "",
    name: employee.name || "",
    email: employee.email || "",
    corporation: employee.corporation || "",
    storeCode: employee.storeCode || "",
    store: employee.store || "",
    department: employee.department || "",
    position: employee.position || "",
    employmentStatus: employee.employmentStatus || "",
    employmentType: employee.employmentType || "",
    roleLevel: Number(employee.roleLevel || 1),
    roleKeys: normalizeArray(employee.roleKeys),
    tags: normalizeArray(employee.tags),
    storedAt: new Date().toISOString()
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
  return [
    `${context.sourceLabel || "HUB"}連携`,
    authLabel,
    context.employeeId ? `社員番号 ${context.employeeId}` : "",
    context.position || "",
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
