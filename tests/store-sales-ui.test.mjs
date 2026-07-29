import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../portal/store-sales/index.html", import.meta.url), "utf8");
const management = readFileSync(new URL("../portal/management-app/index.html", import.meta.url), "utf8");
const fixtures = readFileSync(new URL("../portal/store-sales/review-fixtures.js", import.meta.url), "utf8");
const mockAdapter = readFileSync(new URL("../portal/store-sales/adapters/mock.js", import.meta.url), "utf8");
const projectionAdapter = readFileSync(new URL("../portal/store-sales/adapters/projection.js", import.meta.url), "utf8");
const storeRuntime = readFileSync(new URL("../portal/store-sales/runtime/store-sales-runtime.js", import.meta.url), "utf8");

test("UI consumes only the Store Sales Runtime", () => {
  assert.match(app, /createStoreSalesRuntime/);
  assert.match(storeRuntime, /createStoreSalesAdapter/);
  assert.match(projectionAdapter, /validateProjectionResponse/);
  assert.doesNotMatch(app, /callApiAction|createStoreSalesAdapter|fetch\s*\(/);
  assert.doesNotMatch(app, /accounting-kpis|accounting\/stores|managementStoresSummary|DirectoryAdapter/);
});

test("required accounting metadata is present in the top-right header", () => {
  for (const id of ["meta-sales-period", "meta-accounting-period", "meta-state", "meta-updated"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /class="accounting-meta"/);
});

test("store detail starts with this-month actions capped by the renderer", () => {
  assert.match(html, /今月やること/);
  assert.match(app, /items\.slice\(0, 3\)/);
});

test("store statuses are not calculated in UI", () => {
  assert.doesNotMatch(app, /operatingProfitMarginDisplay|ordinaryProfitNegative|salesTargetAchievementDisplay/);
});

test("existing management app links to the Phase 5 surface", () => {
  assert.match(management, /data-href="\.\.\/store-sales\/"/);
});

test("review fixtures cover all requested non-production states", () => {
  for (const fixture of ["manager", "pending", "validation", "empty", "all-preparing"]) {
    assert.match(fixtures, new RegExp(`name === "${fixture}"`));
  }
  assert.match(mockAdapter, /fixture === "timeout"/);
  assert.match(fixtures, /storeNames\.map/);
});

test("sales month and confirmed accounting month are separate", () => {
  assert.match(app, /meta-sales-period/);
  assert.match(app, /confirmedThroughPeriod/);
  assert.match(app, /確定値/);
});

test("mobile store cards expose required comparison fields", () => {
  assert.match(html, /id="store-cards"/);
  for (const label of ["売上", "営業利益率", "経常利益率", "主な確認理由"]) assert.match(app, new RegExp(label));
  assert.match(app, /statusReason/);
});

test("store manager audience bypasses executive UI", () => {
  assert.match(fixtures, /"store_manager"/);
  assert.match(app, /state\.audience === "store_manager"/);
  assert.match(app, /showDetail\(ownStore\.storeKey, true\)/);
});

test("all data states have distinct Japanese labels", () => {
  for (const label of ["集計中", "準備中", "データ確認が必要", "取得できません"]) assert.match(app, new RegExp(label));
  assert.match(app, /metricAriaLabel/);
});

test("empty projection and empty drivers have safe states", () => {
  assert.match(app, /projection\.stores\.length === 0/);
  assert.match(app, /hasEntries/);
  assert.match(app, /表示できる店舗がありません/);
  assert.match(app, /権限または対象月をご確認ください/);
  assert.match(fixtures, /businessDrivers: stores\.length/);
});

test("tabs support keyboard arrow navigation", () => {
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /\.focus\(\)/);
});
