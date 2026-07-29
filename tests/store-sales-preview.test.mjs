import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessApp, DEMO_APPS } from "../portal/js/apps.js";
import { DEMO_EMPLOYEES } from "../portal/js/employees.js";
import { resolvePreviewFixture } from "../portal/store-sales/preview-context.js";
import { getReviewFixture } from "../portal/store-sales/review-fixtures.js";
import { createMockAdapter } from "../portal/store-sales/adapters/mock.js";

const main = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
const hubHtml = readFileSync(new URL("../portal/index.html", import.meta.url), "utf8");
const appJson = JSON.parse(readFileSync(new URL("../portal/apps.json", import.meta.url), "utf8"));
const storeHtml = readFileSync(new URL("../portal/store-sales/index.html", import.meta.url), "utf8");
const storeApp = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const storeCss = readFileSync(new URL("../portal/store-sales/styles.css", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../portal/store-sales/runtime-config.js", import.meta.url), "utf8");
const mock = readFileSync(new URL("../portal/store-sales/adapters/mock.js", import.meta.url), "utf8");
const session = readFileSync(new URL("../portal/js/nov-hub-session-candidate.js", import.meta.url), "utf8");
const runtimeSource = readFileSync(new URL("../portal/store-sales/runtime/store-sales-runtime.js", import.meta.url), "utf8");
const runtimeErrors = readFileSync(new URL("../portal/store-sales/runtime/error-mapping.js", import.meta.url), "utf8");
const previewApp = DEMO_APPS.find((app) => app.appId === "store-sales-preview");
const employee = (email) => DEMO_EMPLOYEES.find((item) => item.email === email);

test("NOV HUB has the Store Sales card", () => assert.equal(previewApp?.appName, "店舗営業管理"));
test("employee cannot see the card", () => assert.equal(canAccessApp(employee("staff@example.com"), previewApp), false));
test("store manager can see the card", () => assert.equal(canAccessApp(employee("manager@example.com"), previewApp), true));
test("card uses the same-tab Store Sales route", () => {
  assert.equal(previewApp.url, "./store-sales/");
  assert.match(main, /window\.location\.assign\(launchUrl\)/);
});
test("relative URL has no fixed origin", () => assert.doesNotMatch(previewApp.url, /https?:|^[A-Za-z]:/));
test("existing sales icon is reused", () => {
  const icon = appJson.apps.find((app) => app.appId === "store-sales-preview")?.icon;
  assert.equal(icon, "./assets/icons/sales.svg");
});
test("Preview banner is semantic and initially hidden", () => {
  assert.match(storeHtml, /id="preview-banner"[\s\S]*role="status"[\s\S]*hidden/);
  assert.match(storeApp, /\["mock", "preview"\]\.includes\(snapshot\.featureFlag\)/);
});
test("Preview banner identifies synthetic non-production data", () => {
  assert.match(storeHtml, /サンプルデータ/);
  assert.match(storeHtml, /実会計データ・本番環境には接続していません/);
});
test("runtime is mock-only Preview", () => {
  assert.match(runtime, /featureFlag:\s*"preview"/);
  assert.match(runtime, /preview:\s*true/);
  assert.match(runtime, /requireHubSession:\s*true/);
});
test("production remains blocked", () => assert.match(readFileSync(new URL("../portal/store-sales/adapters/config.js", import.meta.url), "utf8"), /PRODUCTION_NOT_APPROVED/));
test("Store Sales requires canonical HUB session", () => {
  assert.match(runtimeSource, /getNovHubSessionStatus/);
  assert.match(runtimeSource, /restoreNovHubSession/);
  assert.match(runtimeSource, /runtimeConfig\.requireHubSession/);
});
test("missing session has a HUB return instruction", () => assert.match(runtimeErrors, /HUBログインが必要です/));
test("expired session has a distinct state", () => {
  assert.match(session, /return "expired"/);
  assert.match(runtimeErrors, /セッションの有効期限が切れました/);
});
test("logout clears preview context", () => assert.match(main, /clearStoreSalesPreviewContext\(\)/));
test("executive resolves to executive fixture", () => assert.equal(resolvePreviewFixture(["executive"]), "executive"));
test("department manager has only assigned stores", () => assert.equal(getReviewFixture("department-manager").stores.length, 6));
test("store manager has one store and manager audience", () => {
  const fixture = getReviewFixture("manager");
  assert.equal(fixture.stores.length, 1);
  assert.equal(fixture.audience, "store_manager");
});
test("franchise owner has only five FC stores", () => {
  const fixture = getReviewFixture("franchise-owner");
  assert.equal(fixture.stores.length, 5);
  assert.ok(fixture.stores.every((store) => store.ownership === "FC"));
});
test("employee fixture is access denied", async () => {
  const adapter = createMockAdapter({ mode: "mock", fixture: "executive" }, { getPreviewFixtureName: () => "employee-denied" });
  await assert.rejects(() => adapter.loadDashboard(), (error) => error.code === "ACTOR_SCOPE_DENIED" && error.status === 403);
  assert.match(storeApp, /snapshot\.presentation\?\.blocking/);
  assert.match(storeApp, /document\.querySelector\("main"\)\.hidden = true/);
});
test("HUB return link is relative", () => assert.match(storeHtml, /href="\.\.\/">← NOV HUBへ戻る/));
test("browser Back remains native history", () => assert.doesNotMatch(storeApp, /history\.(replaceState|pushState)|location\.replace/));
test("320px CSS remains card based", () => {
  assert.match(storeCss, /@media \(max-width: 620px\)/);
  assert.match(storeCss, /\.table-scroll \{ display: none; \}/);
  assert.match(storeCss, /\.store-cards \{ display: block; \}/);
});
test("keyboard and focus affordances remain", () => {
  assert.match(storeApp, /ArrowLeft/);
  assert.match(storeApp, /ArrowRight/);
  assert.match(storeCss, /:focus-visible/);
});
test("ARIA remains on Preview, notice, tabs, and state values", () => {
  for (const value of ["aria-label=\"プレビューモード\"", "aria-live=\"polite\"", "role=\"tablist\"", "role=\"tabpanel\""]) assert.match(storeHtml, new RegExp(value));
  assert.match(storeApp, /metricAriaLabel/);
});
test("mock adapter performs no external request", () => assert.doesNotMatch(mock, /fetch\s*\(|XMLHttpRequest/));
test("no service role or token is embedded in Preview runtime", () => assert.doesNotMatch(runtime + storeHtml + mock, /service_role|sb_secret_|eyJ[a-zA-Z0-9_-]{20,}/i));
test("NOV HUB shell remains intact", () => {
  assert.match(hubHtml, /id="featured-apps"/);
  assert.match(hubHtml, /id="category-apps"/);
});
