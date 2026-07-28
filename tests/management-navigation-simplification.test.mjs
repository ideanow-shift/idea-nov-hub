import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../portal/management-app/", import.meta.url);

test("store section hides corporate-only navigation and exposes a simple data guide", async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL("app-v2.js", appRoot), "utf8"),
    readFile(new URL("index.html", appRoot), "utf8"),
    readFile(new URL("styles.css", appRoot), "utf8"),
  ]);

  assert.match(app, /elements\.corporateViewTabs\.hidden = !CORPORATE_VIEWS\.has\(state\.view\)/);
  assert.match(app, /elements\.corporationTabs\.hidden = !FINANCE_VIEWS\.has\(state\.view\)/);
  assert.match(app, /function renderDataGuide\(\)/);
  assert.match(app, /店舗別月次人数CSV（生産性）/);
  assert.match(app, /来店区分CSV（客数・単価・リピート）/);
  assert.match(app, /メニュー月次CSV（メニュー分析）/);
  assert.match(html, /id="data-guide"/);
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.data-guide-grid/);
});
