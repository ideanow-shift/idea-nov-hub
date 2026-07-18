import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../portal/talent/", import.meta.url);

test("Talent exposes recruitment and workforce as accessible primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /aria-label="人財投資管理の業務区分"/);
  assert.match(html, /data-primary-tab="recruitment"[\s\S]*求人管理/);
  assert.match(html, /data-primary-tab="workforce"[\s\S]*現職者管理/);
  assert.match(html, /id="panel-recruitment"[\s\S]*role="tabpanel"/);
  assert.match(html, /id="panel-workforce"[\s\S]*role="tabpanel"/);
});

test("recruitment subtabs stay visually and semantically below the primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /class="secondary-tabs"[\s\S]*全体サマリー/);
  assert.match(html, /data-secondary-tab="students"[\s\S]*学生フォロー/);
  assert.match(html, /data-secondary-tab="fairs"[\s\S]*フェア分析/);
  assert.match(html, /data-secondary-tab="schools"[\s\S]*学校分析/);
});

test("workforce management exposes four accessible procedure tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /aria-label="現職者管理メニュー"/);
  for (const key of ["onboarding", "transfer", "leave", "retirement"]) {
    assert.match(html, new RegExp(`data-workforce-tab="${key}"`));
    assert.match(html, new RegExp(`id="workforce-${key}"[\\s\\S]*role="tabpanel"`));
  }
  assert.match(app, /WORKFORCE_TABS/);
  assert.match(app, /data-workforce-tab/);
});

test("navigation supports keyboard movement and responsive one-column layouts", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /Home/);
  assert.match(app, /End/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /\.primary-tabs\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.workforce-summary\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
