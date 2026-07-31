import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getReviewFixture, STORE_NAMES } from "../portal/store-sales/review-fixtures.js";
import {
  allowedScopes, canSelectScope, emptyScopeMessage, normalizeScope, scopeHeading
} from "../portal/store-sales/permission-scope.js";

const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../portal/store-sales/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../portal/store-sales/styles.css", import.meta.url), "utf8");

test("Sprint 1 uses all 20 official store names and mock identifiers", () => {
  assert.equal(STORE_NAMES.length, 20);
  assert.deepEqual(STORE_NAMES.slice(0, 3), ["所沢店", "高田馬場店", "上石神井店"]);
  assert.ok(getReviewFixture("executive").stores.every((store) => store.storeKey.startsWith("mock-store-")));
});

test("dashboard sections retain the decision order", () => {
  const positions = ["summary-heading", "actions-heading", "drivers-heading", "stores-heading"].map((id) => html.indexOf(`id="${id}"`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("role fixtures provide required scopes and manager landing", () => {
  assert.equal(getReviewFixture("sales_manager").stores.length, 13);
  assert.equal(getReviewFixture("area_manager").stores.length, 5);
  assert.equal(getReviewFixture("store_manager").stores.length, 1);
  assert.equal(getReviewFixture("store_manager").audience, "store_manager");
});

test("priority actions are capped and target related tabs", () => {
  const fixture = getReviewFixture("executive");
  assert.ok(fixture.priorityActions.length <= 3);
  assert.ok(fixture.priorityActions.every((action) => action.targetTab));
  assert.match(app, /actions\.slice\(0, 3\)/);
});

test("store list supports state filters, five sorts, and preserved return state", () => {
  for (const value of ["status", "sales-desc", "profit-desc", "repeat-desc", "productivity-desc"]) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(app, /statusFilter/);
  assert.match(app, /listScroll/);
  assert.match(app, /window\.scrollTo\(\{ top: state\.listScroll/);
});

test("detail exposes exactly four Japanese tabs", () => {
  const tabs = [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((match) => match[1]);
  assert.deepEqual(tabs, ["サマリー", "売上・利益", "顧客・リピート", "価値・生産性"]);
});

test("profit states never display collecting as zero", () => {
  for (const mode of ["collecting", "preparing"]) {
    const profit = getReviewFixture("executive", { profitMode: mode }).stores[0].metrics.operatingProfit;
    assert.equal(profit.displayValue, null);
    assert.equal(profit.dataState, mode);
  }
  assert.doesNotMatch(app, /collecting[^]*0円/);
});

test("responsive UI uses cards without horizontal page overflow", () => {
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /@media\(max-width:1023px\)/);
  assert.match(css, /\.table-wrap\{display:none\}/);
  assert.match(css, /\.store-cards\{display:grid/);
});

test("development controls cover roles, runtime states, profit and missing data", () => {
  for (const id of ["dev-role", "dev-runtime", "dev-profit", "dev-missing"]) assert.match(html, new RegExp(`id="${id}"`));
  for (const status of ["loading", "ready", "empty", "unauthorized", "forbidden", "validation_error", "timeout", "offline", "maintenance"]) assert.match(html, new RegExp(`>${status}<`));
});

test("keyboard, focus and 44px controls remain explicit", () => {
  assert.match(app, /event\.key === "Enter"/);
  assert.match(app, /\["Enter", " "\]/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /:focus-visible/);
});

test("ready hides Loading before revealing the rendered projection", () => {
  const readyBranch = app.slice(app.indexOf("function renderRuntimeSnapshot"), app.indexOf("function renderAll"));
  assert.match(readyBranch, /elements\.notice\.hidden = hasProjection/);
  assert.match(readyBranch, /if \(!hasProjection \|\| isBlocking\)[\s\S]*main"\)\.hidden = true/);
  assert.ok(readyBranch.indexOf("renderAll();") < readyBranch.indexOf('document.querySelector("main").hidden = false'));
});

test("profit state wording consistently uses 集計中", () => {
  assert.doesNotMatch(html, />確認中</);
  assert.match(html, /id="meta-state">集計中</);
  assert.match(app, /pending: "集計中"/);
  assert.match(app, /collecting: "集計中"/);
});

test("business driver signal template expressions are syntactically closed", () => {
  assert.match(app, /`\$\{signal\.label\}、\$\{signal\.conclusion\}/);
  assert.match(app, /`\$\{selected\.label\}: \$\{formatTrendValue/);
});

test("internal review UI uses Japanese headings without duplicate English labels", () => {
  for (const label of ["STORE OPERATIONS", "EXECUTIVE SUMMARY", "PRIORITY ACTIONS", "BUSINESS DRIVERS", "STORE LIST", "STORE DETAIL"]) {
    assert.doesNotMatch(html, new RegExp(label));
  }
  for (const label of ["店舗営業管理", "全店の状況", "優先して確認すること", "業績を動かした要因", "店舗一覧"]) {
    assert.match(html, new RegExp(label));
  }
});

test("sales metric states its monthly or cumulative target period", () => {
  assert.match(app, /salesPeriodNote/);
  assert.match(app, /までの累計/);
  assert.match(app, /reason: salesPeriodNote/);
});

test("Mock controls are hidden by default and only revealed by mock or preview flags", () => {
  assert.match(html, /id="dev-controls"[^>]*hidden/);
  assert.match(app, /isPreviewMode = \["mock", "preview"\]\.includes\(snapshot\.featureFlag\)/);
  assert.match(app, /elements\.devControls\.hidden = !isPreviewMode/);
});

test("Preview visibly identifies sample values as non-actual data", () => {
  assert.match(html, /現在は画面確認用のサンプルデータを表示しています。実績値ではありません。実会計データ・本番環境には接続していません。/);
});

test("Preview scope choices follow the approved role permissions", () => {
  assert.deepEqual(allowedScopes("representative"), ["All", "Direct", "FC"]);
  assert.deepEqual(allowedScopes("sales_manager"), ["Direct"]);
  assert.deepEqual(allowedScopes("area_manager"), ["Assigned"]);
  assert.deepEqual(allowedScopes("store_manager"), ["Self"]);
});

test("out-of-scope choices are rejected and normalized", () => {
  assert.equal(canSelectScope("sales_manager", "FC"), false);
  assert.equal(canSelectScope("area_manager", "All"), false);
  assert.equal(canSelectScope("store_manager", "Direct"), false);
  assert.equal(normalizeScope("sales_manager", "FC"), "Direct");
  assert.match(app, /if \(!canSelectScope\(state\.effectiveRole, button\.dataset\.scope\)\) return/);
  assert.match(app, /state\.scope = allowedScopes\(state\.development\.role\)\[0\] \|\| null/);
});

test("scope headings reflect the permitted visible range", () => {
  assert.equal(scopeHeading("representative", "All"), "全店の状況");
  assert.equal(scopeHeading("representative", "Direct"), "直営店舗の状況");
  assert.equal(scopeHeading("representative", "FC"), "FC店舗の状況");
  assert.equal(scopeHeading("area_manager", "Assigned"), "担当店舗の状況");
  assert.equal(scopeHeading("store_manager", "Self", "所沢店"), "所沢店の状況");
});

test("permission denial, zero results, and collecting are distinct states", () => {
  assert.equal(emptyScopeMessage({ permitted: false }), "この店舗範囲は権限対象外です。");
  assert.equal(emptyScopeMessage({ permitted: true }), "選択した条件に該当する店舗データは0件です。");
  assert.equal(emptyScopeMessage({ permitted: true, collecting: true }), "対象店舗のデータを集計中です。");
});
