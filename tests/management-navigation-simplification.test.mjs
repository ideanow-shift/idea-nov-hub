import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../portal/management-app/", import.meta.url);

test("Management navigation contains only corporate and business-data sections", async () => {
  const [app, html, css] = await Promise.all([
    readFile(new URL("app-v2.js", appRoot), "utf8"),
    readFile(new URL("index.html", appRoot), "utf8"),
    readFile(new URL("styles.css", appRoot), "utf8"),
  ]);

  assert.match(app, /elements\.corporateViewTabs\.hidden = !CORPORATE_VIEWS\.has\(state\.view\)/);
  assert.match(app, /elements\.corporationTabs\.hidden = !FINANCE_VIEWS\.has\(state\.view\)/);
  assert.match(app, /function renderDataGuide\(\)/);
  assert.match(html, /id="data-guide"/);
  assert.match(html, /① 法人経営管理/);
  assert.match(html, /② 経営データ管理/);
  assert.doesNotMatch(html, /data-section="stores"|id="stores-view"|data-href="\.\.\/store-sales\/"/);
  assert.doesNotMatch(app, /const VIEWS = new Set\(\[\.\.\.CORPORATE_VIEWS, "stores"\]\)/);
  assert.match(css, /\.store-pl-quick-intake/);
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.data-guide-grid/);
});
