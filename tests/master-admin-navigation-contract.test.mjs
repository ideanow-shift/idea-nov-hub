import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const standardHtml = readFileSync(new URL("../portal/master-admin/index.html", import.meta.url), "utf8");
const stableHtml = readFileSync(new URL("../portal/master-admin-stable/index.html", import.meta.url), "utf8");
const frontend = readFileSync(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../portal/master-admin/master-admin.css", import.meta.url), "utf8");
const visualFixture = readFileSync(new URL("./fixtures/master-admin-navigation-visual.html", import.meta.url), "utf8");

for (const html of [standardHtml, stableHtml]) {
  assert.match(html, /class="master-command-bar"/);
  assert.match(html, /id="view-description"/);
  assert.match(html, /class="context-actions" aria-label="現在の画面の操作"/);
  assert.match(html, /id="refresh"[^>]*aria-label="現在のマスタ情報を更新">更新</);
  assert.match(html, /class="primary-navigation" aria-label="主要マスタ"/);
  assert.equal((html.match(/class="segmented primary-tab/g) || []).length, 5);
  assert.match(html, /data-view="employees"[^>]*aria-current="page"/);
  assert.match(html, /id="management-tools-trigger"[^>]*aria-expanded="false"[^>]*aria-controls="management-tools-menu"/);
  assert.match(html, /id="management-tools-menu" role="menu"/);
  assert.equal((html.match(/class="management-menu-item"/g) || []).length, 4);
  assert.match(html, /data-view="firebase"[^>]*role="menuitem"[^>]*aria-label="Firebase UID未連携社員を確認"/);
  assert.match(html, /data-view="readiness"[^>]*role="menuitem"/);
  assert.match(html, /data-view="logs"[^>]*role="menuitem"/);
  assert.match(html, /data-view="data-intake"[^>]*role="menuitem"/);
}

assert.match(stableHtml, /id="open-dbf-staging"[^>]*aria-label="DBF経営データ管理 Stagingを開く"/);
assert.match(stableHtml, /class="staging-badge">STAGING</);
assert.match(stableHtml, /DBF経営データ管理/);
assert.doesNotMatch(standardHtml, /id="open-dbf-staging"/);

assert.match(frontend, /const MANAGEMENT_TOOL_VIEWS = new Set\(\["firebase", "readiness", "logs", "data-intake"\]\)/);
assert.match(frontend, /function setManagementToolsOpen\(/);
assert.match(frontend, /aria-expanded/);
assert.match(frontend, /event\.key !== "Escape"/);
assert.match(frontend, /closest\?\.\("\.management-tools"\)/);
assert.match(frontend, /openDbfStagingFromAuthorizedAdmin/);
assert.equal((frontend.match(/elements\.openDbfStaging\?\.addEventListener\("click", handleOpenDbfStaging\)/g) || []).length, 1);
assert.equal((frontend.match(/elements\.refresh\.addEventListener\("click", loadData\)/g) || []).length, 1);
assert.match(frontend, /button\.setAttribute\("aria-current", "page"\)/);
assert.match(frontend, /viewCounts\.firebase > 0 \|\| viewCounts\.readiness > 0/);

assert.match(stylesheet, /\.master-command-bar\s*\{[\s\S]*?justify-content:\s*space-between/);
assert.match(stylesheet, /\.primary-navigation\s*\{[\s\S]*?overflow-x:\s*auto/);
assert.match(stylesheet, /\.primary-navigation::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none/);
assert.match(stylesheet, /\.management-tools-menu\s*\{[\s\S]*?position:\s*absolute/);
assert.match(stylesheet, /\.management-tools-menu\[hidden\]\s*\{[\s\S]*?display:\s*none/);
assert.match(stylesheet, /\.context-actions \.button,[\s\S]*?min-height:\s*44px/);
assert.match(stylesheet, /@media \(max-width: 900px\)[\s\S]*?\.secondary-navigation\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(stylesheet, /\.primary-navigation \.primary-tab\s*\{[\s\S]*?white-space:\s*nowrap/);

assert.match(visualFixture, /レイアウト確認用の合成データ/);
assert.match(visualFixture, /id="management-tools-trigger"/);
assert.match(visualFixture, /id="management-tools-menu"/);
assert.match(visualFixture, /DBF経営データ管理/);
assert.match(visualFixture, /event\.key === 'Escape'/);

console.log("master admin navigation contract: PASS");
