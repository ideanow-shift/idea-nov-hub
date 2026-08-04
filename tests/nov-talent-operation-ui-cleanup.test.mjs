import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../portal/talent/", import.meta.url);

test("daily operation shell starts with today's dashboard and no navigation cards", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const daily = html.match(/<section id="talent-today-dashboard"[\s\S]*?<\/section>/)?.[0] || "";

  assert.match(daily, /TODAY'S DASHBOARD/);
  assert.match(daily, /今日やること/);
  assert.match(daily, /期限超過/);
  assert.match(daily, /今日の見学/);
  assert.match(daily, /今日の面接/);
  assert.match(daily, /連絡待ち/);
  assert.match(daily, /新規学生/);
  assert.match(daily, /最近更新された学生/);
  assert.doesNotMatch(daily, /今日の作業|今日の業務をここから始める|01 今日やること|02 学生|03 学生追加/);
  assert.doesNotMatch(daily, /Migration|CSV|Staging|Dataset|Quarantine|preflight|隔離|Employee Core/i);
  assert.doesNotMatch(html, />要確認・隔離を確認</);
  assert.match(html, />要対応を確認</);
  assert.doesNotMatch(html, /Staging学生を取得できません|対象Dataset|取込元・進捗/);
  assert.match(html, /学生一覧の検索と絞り込み/);
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
  assert.match(html, /id="management-daily-title">日常管理/);
  assert.match(html, /id="management-maintenance-title">データメンテナンス/);
  assert.match(html, /<strong>Migration Archive<\/strong>/);
  assert.match(html, /data-management-open-tab="students"/);
  assert.match(html, /data-management-open-tab="schools"/);
  assert.match(html, /data-management-open-tab="fairs"/);
  for (const section of ["csv-import", "dataset", "validation"]) {
    assert.match(html, new RegExp(`data-management-section="${section}" data-management-tier="archive"`));
  }
  assert.match(html, /data-management-section="audit" data-management-tier="maintenance"/);
  const archiveStart = html.indexOf('<details class="management-tier management-tier-archive">');
  const archiveEnd = html.indexOf("</details>", archiveStart);
  const archive = html.slice(archiveStart, archiveEnd);
  const outsideArchive = `${html.slice(0, archiveStart)}${html.slice(archiveEnd + 10)}`;
  assert.ok(archiveStart >= 0 && archiveEnd > archiveStart);
  assert.doesNotMatch(html.slice(archiveStart, archiveStart + 90), /\sopen(?:\s|>)/);
  assert.match(archive, /data-management-section="dataset"/);
  assert.match(archive, /data-management-section="csv-import"/);
  assert.match(archive, /data-management-section="validation"/);
  assert.doesNotMatch(outsideArchive, /data-management-section="(?:dataset|csv-import|validation)"/);
  assert.doesNotMatch(html, /<nav class="management-tool-index" aria-label="管理ツール一覧">/);
  assert.match(app, /export function configureTalentOperationUi/);
  assert.match(app, /const isAdministrator = accessProfile === "full"/);
  assert.match(app, /authorization\.access\?\.profile === "full"/);
  assert.doesNotMatch(app, /destination\.append\(section\)/);
  assert.match(app, /data-management-open-tab/);
  assert.match(css, /\.talent-management-only \{ display: none !important; \}/);
  assert.match(css, /\.management-daily-grid/);
  assert.match(css, /\.management-tier-archive/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.management-tool-index,[\s\S]*\.management-daily-grid/);
  assert.doesNotMatch(csv, /DOMContentLoaded/);
});

test("daily operation role controls fail closed", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(app, /managementTab\.hidden = !isAdministrator/);
  assert.match(app, /section\.hidden = !isAdministrator/);
  assert.match(app, /item\.hidden = !canWriteCandidates/);
  assert.match(app, /\["full", "recruiter"\]\.includes\(accessProfile\)/);
});
