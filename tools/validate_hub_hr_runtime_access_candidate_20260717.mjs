import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const main = fs.readFileSync(path.join(root, "portal", "js", "main.js"), "utf8");
const index = fs.readFileSync(path.join(root, "portal", "index.html"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase", "functions", "nov-hub-api", "index.ts"), "utf8");

const checks = {
  hubUsesExplicitHrRoles: main.includes('const HR_RELEASED_APP_VIEWER_ROLE_KEYS = new Set(["backoffice", "hr.staff", "hr.admin"]);'),
  hubMainCacheBoundaryUpdated: index.includes('./js/main.js?v=hub-hr-access-20260717-1'),
  hubDoesNotUseDepartmentNameForAccess: !/selectReleasedAppsForEmployee[\s\S]{0,1000}(departmentName|総務|人事)/.test(main),
  releasedAppsRemainFixed: ["core-master-admin", "master-admin", "jinnjibu", "human-capital-investment"].every((id) => main.includes(`"${id}"`)),
  generalEmployeeRemainsIdeaLinkOnly: main.includes("return apps.filter(isIdeaLinkApp);"),
  backendViewIncludesHrRoles: /\["super_admin", "executive", "department_manager", "backoffice", "accounting", "hr\.staff", "hr\.admin"\]/.test(edge),
  backendEditIncludesHrRoles: /\["super_admin", "backoffice", "hr\.staff", "hr\.admin"\]/.test(edge),
  backendDoesNotTrustClientDepartment: !/canEditMasterAdmin[\s\S]{0,700}(departmentName|department_name)/.test(edge),
  noRoleMutation: !/insert.*employee_roles|update.*employee_roles|delete.*employee_roles/is.test(main)
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  checkCount: Object.keys(checks).length,
  failedChecks: failed,
  productionRoleMutationExecuted: false,
  edgeDeployed: false,
  frontendPublished: false
}));
if (failed.length) process.exitCode = 1;
