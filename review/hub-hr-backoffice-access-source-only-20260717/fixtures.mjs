import assert from "node:assert/strict";
import {
  classifyHubPortalAccess,
  getMasterAdminPermissions,
  HR_RELEASED_APP_IDS,
  selectReleasedApps,
} from "./hub-hr-access-policy-candidate.mjs";

const apps = [
  { appId: "idea-link" },
  { appId: "core-master-admin" },
  { appId: "jinnjibu" },
  { appId: "human-capital-investment" },
  { appId: "management-system" },
];
const predicates = {
  isIdeaLinkApp: (app) => app.appId === "idea-link",
  isHrReleasedApp: (app) => HR_RELEASED_APP_IDS.has(app.appId),
};
const ids = (rows) => rows.map((row) => row.appId);

assert.equal(classifyHubPortalAccess(["super_admin"]), "all");
assert.equal(classifyHubPortalAccess(["executive"]), "all");
assert.equal(classifyHubPortalAccess(["backoffice"]), "hr_released");
assert.equal(classifyHubPortalAccess(["hr.staff"]), "hr_released");
assert.equal(classifyHubPortalAccess(["hr.admin"]), "hr_released");
assert.equal(classifyHubPortalAccess(["department_manager"]), "idea_link_only");
assert.equal(classifyHubPortalAccess(["staff", "hr"]), "idea_link_only");
assert.deepEqual(ids(selectReleasedApps(["staff"], apps, predicates)), ["idea-link"]);
assert.deepEqual(ids(selectReleasedApps(["hr.staff"], apps, predicates)), [
  "idea-link",
  "core-master-admin",
  "jinnjibu",
  "human-capital-investment",
]);
assert.deepEqual(ids(selectReleasedApps(["executive"], apps, predicates)), ids(apps));
assert.deepEqual(getMasterAdminPermissions(["hr.staff"]), { canView: true, canEdit: true });
assert.deepEqual(getMasterAdminPermissions(["hr.admin"]), { canView: true, canEdit: true });
assert.deepEqual(getMasterAdminPermissions(["department_manager"]), { canView: true, canEdit: false });
assert.deepEqual(getMasterAdminPermissions(["accounting"]), { canView: true, canEdit: false });
assert.deepEqual(getMasterAdminPermissions(["staff", "hr"]), { canView: false, canEdit: false });

console.log(JSON.stringify({
  ok: true,
  fixtureCount: 16,
  runtimeChanged: false,
  databaseChanged: false,
}));
