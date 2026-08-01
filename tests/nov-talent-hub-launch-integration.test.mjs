import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getFormalRoleKeys, resolveNovTalentAccess } from "../portal/js/nov-talent-access.js";
import { resolveNovTalentLaunchAuthorization } from "../portal/talent/hub-auth.mjs";

const validSession = Object.freeze({ sessionToken: "fixture", audience: "nov_hub", expiresAt: "2099-01-01T00:00:00.000Z" });
const sources = {
  main: await readFile(new URL("../portal/js/main.js", import.meta.url), "utf8"),
  apps: await readFile(new URL("../portal/js/apps.js", import.meta.url), "utf8"),
  dashboard: await readFile(new URL("../portal/js/nov-navi-dashboard.js", import.meta.url), "utf8"),
  talentHtml: await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"),
  talentCss: await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8"),
  talentApp: await readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8")
};

const accessCases = [
  ["super admin", ["super_admin"], "full", true, true, true],
  ["HR admin", ["hr.admin"], "full", true, true, true],
  ["backoffice", ["backoffice"], "full", true, true, true],
  ["recruiter", ["hr.staff"], "recruiter", true, true, false],
  ["executive", ["executive"], "executive", true, false, false],
  ["ordinary staff", ["staff"], "denied", false, false, false],
  ["department manager", ["department_manager"], "denied", false, false, false],
  ["accounting", ["accounting"], "denied", false, false, false]
];

for (const [name, roleKeys, profile, allowed, contact, settings] of accessCases) {
  test(`formal role mapping: ${name}`, () => {
    const access = resolveNovTalentAccess({ roleKeys });
    assert.equal(access.profile, profile);
    assert.equal(access.allowed, allowed);
    assert.equal(access.canViewCandidateContact, contact);
    assert.equal(access.canManageSettings, settings);
  });
}

test("formal roles can be read from existing role objects without inventing a role", () => {
  assert.deepEqual(getFormalRoleKeys({ roles: [{ role_key: "hr.staff" }, { roleKey: "executive" }] }), ["hr.staff", "executive"]);
});

test("missing HUB session fails closed to auth required", () => {
  const result = resolveNovTalentLaunchAuthorization({ session: null, context: { roleKeys: ["hr.admin"] }, hostname: "localhost" });
  assert.equal(result.category, "AUTH_REQUIRED");
  assert.equal(result.allowed, false);
});

test("missing HUB employee context fails closed to auth required", () => {
  const result = resolveNovTalentLaunchAuthorization({ session: validSession, context: null, hostname: "localhost" });
  assert.equal(result.category, "AUTH_REQUIRED");
});

test("unauthorized formal role receives 403 category", () => {
  const result = resolveNovTalentLaunchAuthorization({ session: validSession, context: { roleKeys: ["staff"] }, hostname: "localhost" });
  assert.equal(result.category, "FORBIDDEN");
});

test("authorized HR role inherits the HUB session", () => {
  const result = resolveNovTalentLaunchAuthorization({ session: validSession, context: { roleKeys: ["hr.admin"] }, hostname: "localhost" });
  assert.equal(result.category, "AUTHORIZED");
  assert.equal(result.access.profile, "full");
});

test("local demo identity is allowed only on loopback", () => {
  const context = { authType: "demo", roleKeys: ["hr.staff"] };
  assert.equal(resolveNovTalentLaunchAuthorization({ session: validSession, context, hostname: "127.0.0.1" }).allowed, true);
  assert.equal(resolveNovTalentLaunchAuthorization({ session: validSession, context, hostname: "ideanow-shift.github.io" }).allowed, false);
});

test("HUB registry presents NOV Talent as 求人管理", () => {
  assert.match(sources.apps, /appId: "nov-talent", appName: "求人管理"/);
  assert.match(sources.apps, /候補者・選考・イベント・次回対応を管理/);
  assert.doesNotMatch(sources.apps, /appId: "nov-talent"[^\n]*現職者管理/);
});

test("HUB card keeps NOV People responsibilities out of NOV Talent", () => {
  const card = sources.dashboard.match(/title: "求人管理"[^\n]+/)?.[0] || "";
  assert.match(card, /候補者・選考・イベント・次回対応/);
  assert.doesNotMatch(card, /現職者管理|入社手続き|異動|休職|退職/);
});

test("HUB filters and launch both use the shared access resolver", () => {
  assert.match(sources.main, /const talentAccess = resolveNovTalentAccess\(employee\)/);
  assert.match(sources.main, /!isTalentApp\(app\) \|\| talentAccess\.allowed/);
  assert.match(sources.main, /求人管理の利用権限がありません/);
});

test("production Talent launch uses canonical same-origin session without another login", () => {
  assert.match(sources.main, /await ensureTalentHubSessionFreshness\(\)/);
  assert.match(sources.main, /window\.location\.assign\(launchUrl\)/);
  assert.match(sources.talentApp, /installNovTalentAuthGuard\(\)/);
  assert.doesNotMatch(sources.talentHtml, /メールとPINでログイン|Googleでログイン/);
});

test("Auth Guard provides HUB return and 403 states", () => {
  assert.match(sources.talentHtml, /NOV HUBへ戻る/);
  assert.match(sources.talentCss, /\.talent-auth-guard/);
  assert.match(sources.talentApp, /if \(!authorization\.allowed\) return authorization/);
});

test("executive candidate contact, notes, and writes are hidden", () => {
  assert.match(sources.talentHtml, /class="talent-contact-private"/);
  assert.match(sources.talentHtml, /talent-private-notes/);
  assert.match(sources.talentCss, /data-talent-access="executive"[^\n]*\.talent-contact-private/);
  assert.match(sources.talentCss, /data-talent-access="executive"[^\n]*\.sprint1-mock-write/);
});

test("NOV People source remains frozen and unreachable from active Talent navigation", () => {
  assert.match(sources.talentHtml, /id="panel-workforce" class="primary-panel sprint1-separated"/);
  assert.doesNotMatch(sources.talentHtml, /data-primary-tab="workforce"/);
  assert.match(sources.talentCss, /#panel-workforce\[aria-label="NOV Peopleへ分離済み"\] \{ display: none !important; \}/);
});

test("local integration demo creates only a loopback HUB session and navigates through the HUB card", () => {
  assert.match(sources.main, /sessionToken: "local-integration-session"/);
  assert.match(sources.main, /refreshHubEmployeeContext\(\)/);
  assert.match(sources.main, /window\.location\.assign\(appUrl\)/);
  assert.match(sources.main, /shouldEnableLocalNovNaviDemo/);
});

test("local integration can reproduce an expired HUB session without enabling it in production", () => {
  assert.match(sources.main, /localIntegrationParams\.get\("talent_session"\) === "expired"/);
  assert.match(sources.main, /shouldEnableLocalNovNaviDemo/);
});

test("HUB launch integration does not add Supabase or production mutation code", () => {
  const combined = `${sources.main}\n${sources.talentApp}`;
  assert.doesNotMatch(combined, /createClient\(|supabase\.from\(|service_role|ALTER TABLE|INSERT INTO/);
});

console.log("NOV Talent HUB launch integration fixtures: PASS");
