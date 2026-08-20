import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessApp, DEMO_APPS } from "../portal/js/apps.js";
import { DEMO_EMPLOYEES } from "../portal/js/employees.js";
import { resolvePreviewFixture, restoreStoreSalesPreviewContext, saveStoreSalesPreviewContext } from "../portal/store-sales/preview-context.js";

const main = readFileSync(new URL("../portal/js/main.js", import.meta.url), "utf8");
const navi = readFileSync(new URL("../portal/js/nov-navi-dashboard.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const runtimeConfig = readFileSync(new URL("../portal/store-sales/runtime-config.js", import.meta.url), "utf8");
const productionRuntimeConfig = readFileSync(new URL("../portal/store-sales/runtime-config.production.js", import.meta.url), "utf8");
const adapterConfig = readFileSync(new URL("../portal/store-sales/adapters/config.js", import.meta.url), "utf8");
const storeSales = DEMO_APPS.find((item) => item.appId === "store-sales-management");
const employee = (email) => DEMO_EMPLOYEES.find((item) => item.email === email);

test("HUB registry exposes the approved card copy and same-origin route", () => {
  assert.equal(storeSales?.appName, "店舗営業管理");
  assert.equal(storeSales?.description, "売上・利益・KPI・店舗運営を確認");
  assert.equal(storeSales?.url, "./store-sales/index.html");
  assert.match(main, /window\.location\.assign\(launchUrl\)/);
  assert.match(navi, /title: "店舗営業管理"/);
  assert.match(navi, /aliases: \["store-sales-management", "store-sales-preview"\]/);
});

test("general employees cannot see the card while approved HUB roles can", () => {
  assert.equal(canAccessApp(employee("staff@example.com"), storeSales), false);
  for (const email of ["hq@example.com", "department@example.com", "area@example.com", "manager@example.com"]) {
    assert.equal(canAccessApp(employee(email), storeSales), true, email);
  }
});

test("HUB roles map to the approved preview identities and scopes", () => {
  assert.equal(resolvePreviewFixture(["executive"]), "executive");
  assert.equal(resolvePreviewFixture(["department_manager"]), "sales_manager");
  assert.equal(resolvePreviewFixture(["area_manager"]), "area_manager");
  assert.equal(resolvePreviewFixture(["store_manager"]), "store_manager");
  assert.equal(resolvePreviewFixture(["staff"]), "employee-denied");
});

test("HUB launch context synchronizes Mock Identity without URL role claims", () => {
  const values = new Map();
  globalThis.sessionStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  saveStoreSalesPreviewContext({ roleKeys: ["area_manager"] });
  assert.equal(restoreStoreSalesPreviewContext()?.mockRole, "area_manager");
  delete globalThis.sessionStorage;
  assert.match(app, /hubLaunchContext\?\.mockRole && hubLaunchSessionAvailable \? createStoreSalesMockIdentity/);
  assert.doesNotMatch(main + app, /[?&](?:role|scope)=/);
});

test("direct preview URL cannot mint Mock Identity without a HUB launch context", () => {
  assert.match(app, /const hubLaunchContext = restoreStoreSalesPreviewContext\(\)/);
  assert.match(runtimeConfig, /requireHubSession:\s*true/);
  assert.match(main, /saveStoreSalesPreviewContext\(\{ roleKeys: getEmployeeRoleKeys\(state\.employee\) \}\)/);
});

test("production remains fail-closed and no integration boundary is changed", () => {
  assert.match(adapterConfig, /PRODUCTION_NOT_APPROVED/);
  assert.doesNotMatch(runtimeConfig, /featureFlag:\s*"production"/);
  assert.match(productionRuntimeConfig, /featureFlag:\s*"production"/);
  assert.match(productionRuntimeConfig, /preview:\s*false/);
  assert.match(productionRuntimeConfig, /contractVersion:\s*"STORE_MONTHLY_ACTUAL_V1"/);
  assert.doesNotMatch(productionRuntimeConfig, /mock|synthetic/iu);
});
