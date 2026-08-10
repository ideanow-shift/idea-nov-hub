import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../portal/talent/", import.meta.url);

test("normal navigation has four daily-work destinations and separates diagnostics", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const tabs = [...html.matchAll(/data-secondary-tab="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map((match) => [match[1], match[2].trim()]);
  assert.deepEqual(tabs.slice(0, 4), [
    ["summary", "今日やること"],
    ["students", "学生"],
    ["fairs", "就職フェア"],
    ["schools", "分析"]
  ]);
  assert.deepEqual(tabs[4], ["management", "管理・診断"]);
  assert.match(html, /NOV Talent β/);
  assert.match(html, /現在、総務人事部で試験運用中です/);
  assert.match(html, /id="recruitment-schools"[\s\S]*id="simplified-analysis-title">採用状況/);
});

test("today view exposes the five operational states without adding a write path", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.mjs", root), "utf8")
  ]);
  for (const category of ["OVERDUE", "TODAY", "AWAITING_REPLY", "FUTURE", "CLOSED"]) {
    assert.match(html, new RegExp(`data-workflow-home-filter="${category}"`));
  }
  assert.match(app, /function renderDailyWorkflowHome/);
  assert.match(app, /buildDailyWorkflowQueue\(data, japanBusinessDateIso\(\)\)/);
  assert.doesNotMatch(app.match(/function renderDailyWorkflowHome[\s\S]*?\n}\n\nfunction renderDailyWorkflowQueue/)?.[0] || "", /fetch\(|POST|PATCH|DELETE/);
});

test("student daily view prioritizes basics, next action, and three clear actions", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("style.css", root), "utf8")
  ]);
  assert.match(html, /id="student-detail-graduation-year"/);
  assert.match(html, /class="detail-next-action"[\s\S]*次にやること/);
  assert.match(html, />連絡を記録<\/button>/);
  assert.match(html, />次の予定を設定<\/button>/);
  assert.match(html, />選考結果を登録<\/button>/);
  assert.match(html, /id="student-detail-profile-version"[^>]*>[\s\S]*ui-diagnostic|class="ui-diagnostic"><dt>プロフィール版/);
  assert.match(css, /\.ui-diagnostic,[\s\S]*\[data-ui-supporting\] \{ display: none !important; \}/);
});

test("UI Simplification remains frontend-only", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /nov-talent-workspace-contract-version" content="1\.0\.0"/);
  assert.match(html, /20260811-ui-simplification-v1/);
});
