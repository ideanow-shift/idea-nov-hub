const FULL_PORTAL_VIEWER_ROLES = new Set(["super_admin", "executive"]);
const HR_RELEASED_APP_VIEWER_ROLES = new Set([
  "backoffice",
  "hr.staff",
  "hr.admin",
]);
const MASTER_ADMIN_VIEWER_ROLES = new Set([
  "super_admin",
  "executive",
  "department_manager",
  "backoffice",
  "accounting",
  "hr.staff",
  "hr.admin",
]);
const MASTER_ADMIN_EDITOR_ROLES = new Set([
  "super_admin",
  "backoffice",
  "hr.staff",
  "hr.admin",
]);

export const HR_RELEASED_APP_IDS = new Set([
  "core-master-admin",
  "master-admin",
  "jinnjibu",
  "human-capital-investment",
]);

function normalizeRoleKeys(values) {
  return new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean));
}

function hasAnyRole(roleKeys, allowedRoles) {
  return [...allowedRoles].some((roleKey) => roleKeys.has(roleKey));
}

export function classifyHubPortalAccess(roleValues) {
  const roleKeys = normalizeRoleKeys(roleValues);
  if (hasAnyRole(roleKeys, FULL_PORTAL_VIEWER_ROLES)) return "all";
  if (hasAnyRole(roleKeys, HR_RELEASED_APP_VIEWER_ROLES)) return "hr_released";
  return "idea_link_only";
}

export function getMasterAdminPermissions(roleValues) {
  const roleKeys = normalizeRoleKeys(roleValues);
  return {
    canView: hasAnyRole(roleKeys, MASTER_ADMIN_VIEWER_ROLES),
    canEdit: hasAnyRole(roleKeys, MASTER_ADMIN_EDITOR_ROLES),
  };
}

export function selectReleasedApps(roleValues, apps, predicates) {
  const access = classifyHubPortalAccess(roleValues);
  if (access === "all") return [...apps];
  if (access === "hr_released") {
    return apps.filter((app) => predicates.isIdeaLinkApp(app)
      || predicates.isHrReleasedApp(app));
  }
  return apps.filter(predicates.isIdeaLinkApp);
}
