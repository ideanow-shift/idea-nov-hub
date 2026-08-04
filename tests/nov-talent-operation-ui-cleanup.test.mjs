import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../portal/talent/", import.meta.url);

test("daily operation shell excludes setup terminology and keeps recruiting actions", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const daily = html.match(/<section id="talent-daily-command"[\s\S]*?<\/section>/)?.[0] || "";

  assert.match(daily, /今日の作業/);
  assert.match(daily, /今日やること/);
  assert.match(daily, /候補者/);
  assert.match(daily, /候補者追加/);
  assert.doesNotMatch(daily, /Migration|CSV|Staging|Dataset|Quarantine|preflight|隔離|Employee Core/i);
  assert.doesNotMatch(html, />要確認・隔離を確認</);
  assert.match(html, />要対応を確認</);
  assert.doesNotMatch(html, /Staging候補者を取得できません|対象Dataset|取込元・進捗/);
  assert.match(html, /候補者一覧の検索と絞り込み/);
});

test("setup tools live behind an administrator-only management tab", async () => {
  const [html, app, css, csv] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.mjs", root), "utf8"),
    readFile(new URL("style.css", root), "utf8"),
    readFile(new URL("csv-import-preflight.mjs", root), "utf8")
  ]);

  assert.match(html, /data-secondary-tab="management" data-talent-management-tab hidden>管理ツール/);
  assert.match(html, /id="recruitment-management"[^>]*hidden/);
  for (const section of ["csv-import", "validation", "dataset", "audit"]) {
    assert.match(html, new RegExp(`data-management-section="${section}"`));
  }
  assert.match(app, /export function configureTalentOperationUi/);
  assert.match(app, /const isAdministrator = accessProfile === "full"/);
  assert.match(app, /authorization\.access\?\.profile === "full"/);
  assert.match(css, /\.talent-management-only \{ display: none !important; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.management-tool-index/);
  assert.doesNotMatch(csv, /DOMContentLoaded/);
});

test("daily operation role controls fail closed", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(app, /managementTab\.hidden = !isAdministrator/);
  assert.match(app, /section\.hidden = !isAdministrator/);
  assert.match(app, /item\.hidden = !canWriteCandidates/);
  assert.match(app, /\["full", "recruiter"\]\.includes\(accessProfile\)/);
});
