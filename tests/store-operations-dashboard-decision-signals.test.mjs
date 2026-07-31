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

test("business drivers contain exactly the six decision questions", () => {
  for (const question of ["売上は上がっているか", "利益は出ているか", "集客できているか", "単価は上がっているか", "商品は売れているか", "ECは動かせているか"]) {
    assert.match(app, new RegExp(question));
  }
  assert.match(app, /signal\("sales"/);
  assert.match(app, /signal\("ec"/);
});

test("one shared trend supports six metrics and three periods", () => {
  assert.match(app, /trendMetric: "sales", trendPeriod: "six_months"/);
  for (const label of ["前年対比", "直近6か月", "12か月"]) assert.match(app, new RegExp(label));
  assert.equal((app.match(/createElementNS\([^\n]*"svg"/g) || []).length, 1);
  assert.match(app, /カードまたは指標を選ぶと、このグラフだけが切り替わります/);
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

test("signal grid is readable at desktop, tablet and mobile widths", () => {
  assert.match(css, /decision-signal-grid\{[^}]*repeat\(3/);
  assert.match(css, /max-width:1023px[^\n]*decision-signal-grid\{[^}]*repeat\(2/);
  assert.match(css, /max-width:560px[^\n]*decision-signal-grid\{grid-template-columns:1fr/);
});

test("synthetic fixture supplies requested comparison metrics without wire contract changes", () => {
  const keys = ["budgetRatio", "yearOverYearRatio", "profitYearOverYear", "customerYearOverYear", "ticketYearOverYear", "retailYearOverYear", "ecTargetRatio", "ecYearOverYear"];
  assert.ok(SYNTHETIC_STORES.every((store) => keys.every((key) => store.detail_metrics[key]?.data_state === "available")));
});
