export const STORE_OPERATIONS_PRODUCTION_PROJECT_REF = "nkmxevmioczcmnldreyo";

export const STORE_OPERATIONS_PRODUCTION_ROLLOUT = Object.freeze({
  DISABLED: "DISABLED",
  OWNER_PILOT: "OWNER_PILOT",
  GENERAL: "GENERAL",
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function projectRefFromSupabaseUrl(value) {
  const match = String(value || "").match(/^https:\/\/([a-z0-9]{20})\.supabase\.co(?:\/|$)/u);
  return match?.[1] || "";
}

export function hasStoreOperationsUatMarker(value) {
  const record = value && typeof value === "object" ? value : {};
  const authType = String(record.authType || record.auth_type || "");
  return authType === "store_operations_staging_session"
    || Boolean(record.uat_actor)
    || Boolean(record.uat_scenario)
    || Boolean(record.uat_assumption_key)
    || Boolean(record.uatActor)
    || Boolean(record.uatScenario)
    || Boolean(record.uatAssumptionKey)
    || Boolean(record.technical_assumption)
    || Boolean(record.technicalAssumption);
}

export function evaluateStoreOperationsProductionRollout(input = {}) {
  const projectRef = String(input.projectRef || "");
  const state = String(input.state || "").trim().toUpperCase();
  const employeeId = String(input.employeeId || "").trim();
  const ownerEmployeeId = String(input.ownerEmployeeId || "").trim();

  if (projectRef !== STORE_OPERATIONS_PRODUCTION_PROJECT_REF) {
    return { allowed: false, code: "PRODUCTION_PROJECT_MISMATCH" };
  }
  if (hasStoreOperationsUatMarker(input.session)) {
    return { allowed: false, code: "PRODUCTION_UAT_SESSION_DENIED" };
  }
  if (!Object.values(STORE_OPERATIONS_PRODUCTION_ROLLOUT).includes(state)) {
    return { allowed: false, code: "PRODUCTION_ROLLOUT_CONFIG_DENIED" };
  }
  if (state === STORE_OPERATIONS_PRODUCTION_ROLLOUT.DISABLED) {
    return { allowed: false, code: "PRODUCTION_ROLLOUT_DISABLED" };
  }
  if (!UUID_PATTERN.test(employeeId)) {
    return { allowed: false, code: "PRODUCTION_EMPLOYEE_RESOLUTION_DENIED" };
  }
  if (state === STORE_OPERATIONS_PRODUCTION_ROLLOUT.OWNER_PILOT) {
    if (!UUID_PATTERN.test(ownerEmployeeId) || employeeId !== ownerEmployeeId) {
      return { allowed: false, code: "PRODUCTION_OWNER_PILOT_DENIED" };
    }
  }
  return { allowed: true, code: "PRODUCTION_ROLLOUT_ALLOWED", state };
}
