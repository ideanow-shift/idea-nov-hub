import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SYNTHETIC_STORES } from "../supabase/functions/store-sales-projection/synthetic-data.js";

const app = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../portal/store-sales/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../portal/store-sales/styles.css", import.meta.url), "utf8");

test("dashboard first-level information order remains unchanged", () => {
  const positions = ["summary-heading", "actions-heading", "drivers-heading", "stores-heading"].map((id) => html.indexOf(`id="${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test("business drivers contain the seven decision questions", () => {
  for (const question of ["売上は上がっているか", "利益は出ているか", "集客できているか", "単価は上がっているか", "人と時間を活かせているか", "商品は売れているか", "ECは動かせているか"]) {
    assert.match(app, new RegExp(question));
  }
  assert.match(app, /signal\("sales"/);
  assert.match(app, /signal\("productivity"/);
  assert.match(app, /signal\("ec"/);
  assert.match(app, /aria-label", "7つの経営シグナル"/);
});

test("customer, ticket and retail decisions use canonical comparison fields", () => {
  for (const key of ["customerYearOverYear", "ticketYearOverYear", "retailYearOverYear", "retailBudgetRatio"]) {
    assert.match(app, new RegExp(key));
  }
  assert.match(app, /店販売上 予算比/);
  assert.match(app, /店販売上前年比/);
  assert.doesNotMatch(app, /店販購買率 前年比/);
});

test("one shared trend supports seven metrics and three periods", () => {
  assert.match(app, /trendMetric: "sales", trendPeriod: "six_months"/);
  for (const label of ["前年対比", "直近6か月", "12か月"]) assert.match(app, new RegExp(label));
  assert.equal((app.match(/createElementNS\([^\n]*"svg"/g) || []).length, 1);
  assert.match(app, /カードまたは指標を選ぶと、このグラフだけが切り替わります/);
});

test("shared trend exposes numeric and month axis graduations", () => {
  assert.match(app, /Array\.from\(\{ length: 5 \}/);
  assert.match(app, /trend-gridline/);
  assert.match(app, /trend-axis-label trend-axis-label-y/);
  assert.match(app, /trend-axis-label trend-axis-label-x/);
  assert.match(app, /trendAxisUnit/);
  assert.match(css, /\.trend-gridline\{[^}]*stroke:/);
  assert.match(css, /\.trend-axis-label\{[^}]*font-size:/);
});

test("every signal opens a metric-specific analysis with store comparison", () => {
  assert.match(app, /renderSignalAnalysis\(selected, stores\)/);
  assert.match(app, /data-analysis-signal/);
  assert.match(app, /分解して確認するポイント/);
  assert.match(app, /上位店舗/);
  assert.match(app, /要確認店舗/);
  for (const key of ["sales", "profit", "customers", "ticket", "productivity", "retail", "ec"]) {
    assert.match(app, new RegExp(`\\n    ${key}: \\{`));
  }
  assert.match(css, /\.signal-analysis-kpis\{[^}]*grid-template-columns:repeat\(4/);
});

test("productivity drill-down separates outcome, labor and coverage", () => {
  for (const label of ["総生産性（店舗平均）", "技術生産性（店舗平均）", "実労働FTE合計", "FTE当たり売上", "FTE未反映店舗"]) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /rankKey: "productivity", rankLabel: "総生産性", targetTab: "value"/);
});

test("confirmed attention count remains visible when only part of the store scope is preparing", () => {
  assert.match(app, /const evaluatedStatusCount = stores\.length - preparingStatusCount/);
  assert.match(app, /const statusReady = evaluatedStatusCount > 0/);
  assert.match(app, /判定済み\$\{evaluatedStatusCount\}店舗のうち\$\{attention\}店舗に対応が必要/);
  assert.match(app, /\$\{preparingStatusCount\}店舗は判定準備中です/);
  assert.doesNotMatch(app, /const statusReady = stores\.every\(\(store\) => store\.status !== "Preparing"\)/);
});

test("EC dashboard signal is explicitly company-wide", () => {
  assert.match(app, /全社EC売上/);
  assert.match(app, /全社EC 目標比/);
  assert.match(app, /稼働店舗数/);
});

test("signal conclusions do not depend on color alone", () => {
  assert.match(app, /signal-conclusion/);
  for (const conclusion of ["確定", "集計中", "改善", "横ばい", "要対応"]) assert.match(app, new RegExp(conclusion));
});

test("FC profit summary preserves the V1 out-of-scope conclusion", () => {
  assert.match(app, /const profitConclusion = signals\.find\(\(item\) => item\.key === "profit"\)\?\.conclusion/);
  assert.match(app, /profitConclusion === "V1対象外" \? "V1対象外" : "集計中"/);
  assert.doesNotMatch(app, /profit: signals\.find\([^\n]+\? "良好" : "集計中"/);
});

test("signal grid is readable at desktop, tablet and mobile widths", () => {
  assert.match(css, /decision-signal-grid\{[^}]*repeat\(3/);
  assert.match(css, /max-width:1023px[^\n]*decision-signal-grid\{[^}]*repeat\(2/);
  assert.match(css, /max-width:560px[^\n]*decision-signal-grid\{grid-template-columns:1fr/);
});

test("synthetic fixture supplies requested comparison metrics without wire contract changes", () => {
  const keys = ["budgetRatio", "yearOverYearRatio", "profitYearOverYear", "customerYearOverYear", "ticketYearOverYear", "retailYearOverYear", "ecTargetRatio", "ecYearOverYear"];
  assert.ok(SYNTHETIC_STORES.every((store) => keys.every((key) => store.detail_metrics[key]?.data_state === "available")));
});
