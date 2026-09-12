import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { getNaviLaunchState, getVisibleNaviSystemTitles } from "../portal/js/nov-navi-dashboard.js";
import { resolveNovTalentAccess } from "../portal/js/nov-talent-access.js";

const main = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
const api = readFileSync(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
function fn(source, name) {
  const match = source.match(new RegExp("^function " + name + "\\([\\s\\S]*?^}", "m"));
  assert.ok(match, name);
  return match[0];
}
function constant(name) {
  const match = main.match(new RegExp("^const " + name + " = [\\s\\S]*?;", "m"));
  assert.ok(match, name);
  return match[0];
}
const uiNames = ["isCoreMasterAdminApp", "isIdeaLinkApp", "isLegacyTalentUrl", "isTalentApp",
  "isBackofficeReleasedApp", "isStoreSalesPreviewApp", "getEmployeeRoleKeys",
  "canPreviewStoreSales", "selectReleasedAppsForEmployee"];
const constants = ["TALENT_APP_IDS", "TALENT_LEGACY_ORIGIN", "TALENT_LEGACY_PATH",
  "STORE_SALES_APP_IDS", "STORE_SALES_ALLOWED_ROLE_KEYS", "DEVELOPMENT_APP_VIEWER_ROLE_KEYS",
  "HR_RELEASED_APP_VIEWER_ROLE_KEYS", "BACKOFFICE_RELEASED_APP_IDS"];
const selectApps = runInNewContext(
  constants.map(constant).join("\n") + "\n" + uiNames.map(name => fn(main, name)).join("\n")
    + "\nselectReleasedAppsForEmployee;",
  { resolveNovTalentAccess, URL, window: { location: { href: "http://localhost/" } } }
);
const apiNames = ["normalizeList", "normalizeEmail", "getRoleLevel", "canViewMasterAdmin",
  "canEditMasterAdmin", "canAccessApp"];
const backend = runInNewContext(stripTypeScriptTypes(
  apiNames.map(name => fn(api, name)).join("\n") + "\n({getRoleLevel, canViewMasterAdmin, canEditMasterAdmin, canAccessApp});"
));
const master = { appId: "core-master-admin", appName: "社員・店舗マスタ管理",
  url: "./master-admin/", isActive: true, requiredLevel: 4, allowedTags: [],
  targetDepartment: [], targetPosition: [] };
const ideaLink = { ...master, appId: "idea-link", appName: "サンクスコイン", url: "./idea-link/", requiredLevel: 1 };
const other = { ...master, appId: "unrelated", appName: "別アプリ", url: "./other/" };
const actor = (roleKeys, extra = {}) => ({ status: "active", roleKeys,
  roleLevel: backend.getRoleLevel(roleKeys), tags: roleKeys, ...extra });
const pipeline = employee => selectApps(employee, [master, ideaLink, other].filter(app => backend.canAccessApp(employee, app)));
for (const roles of [["area_manager", "idea_link.staff", "hr.viewer"], ["hr.viewer"], ["executive"], ["super_admin"]]) {
  const employee = actor(roles);
  const app = pipeline(employee).find(app => app.appId === master.appId);
  assert.ok(app, roles.join(",") + " retains directory through both filters");
  assert.equal(getNaviLaunchState({ status: "available" }, app).enabled, true);
}
for (const roles of [["hr.viewer"], ["area_manager", "hr.viewer"]]) {
  const employee = actor(roles);
  assert.equal(backend.canViewMasterAdmin(employee), true);
  assert.equal(backend.canEditMasterAdmin(employee), false, "viewer remains read-only");
  assert.equal(getVisibleNaviSystemTitles(employee).includes("社員名簿"), true);
  assert.equal(pipeline(employee).some(app => app.appId === other.appId), false);
  for (const id of ["master-admin", "core-master-admin"]) {
    assert.equal(backend.canAccessApp(employee, { ...master, appId: id }), true);
  }
}
for (const employee of [
  actor(["staff"]), actor(["area_manager"]),
  actor(["staff"], { tags: ["hr.viewer"], department: "総務人事部" }),
  actor(["staff"], { roleLevel: 5 })
]) {
  assert.equal(selectApps(employee, [master]).length, 0, "no new launch permission from level, tags or department");
}
const viewer = actor(["hr.viewer"]);
assert.equal(backend.canAccessApp({ ...viewer, status: "inactive" }, master), false);
assert.equal(backend.canAccessApp(viewer, { ...master, isActive: false }), false);
for (const override of [{ allowedTags: ["restricted"] }, { targetDepartment: ["restricted"] }, { targetPosition: ["restricted"] }]) {
  assert.equal(backend.canAccessApp(viewer, { ...master, ...override }), false, "app scope restrictions are retained");
}
assert.equal(selectApps(viewer, []).length, 0, "client never invents an app omitted by server");
assert.equal(getNaviLaunchState({ status: "available" }, undefined).enabled, false);
for (const roles of [[{ roleKey: "hr.viewer" }], [{ role_key: "hr.viewer" }]]) {
  assert.equal(selectApps({ roles }, [master]).length, 1);
}
const editor = api.match(/function canEditMasterAdmin[\s\S]*?\n}/)[0];
assert.doesNotMatch(editor, /hr\.viewer/);
console.log("Master Admin directory launch pipeline: PASS");
