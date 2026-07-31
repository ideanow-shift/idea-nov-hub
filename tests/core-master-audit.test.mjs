import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const base = new URL("docs/store_sales_management/production_readiness/core_master_audit/", root);
const report = await readFile(new URL("core-master-audit-report.md", base), "utf8");
const summary = await readFile(new URL("core-master-audit-summary.md", base), "utf8");
const questions = await readFile(new URL("core-master-audit-human-questions.md", base), "utf8");

test("audit is explicitly read-only and blocked", () => {
  assert.match(report, /\*\*BLOCKED\*\*/);
  assert.match(report, /SELECTとsystem catalog参照のみ/);
});

test("public and core stores are distinguished", () => {
  assert.match(report, /`public\.stores`には承認済み20店舗/);
  assert.match(report, /`core\.stores`が別UUID体系/);
});

test("approved store count has no missing or extra current store", () => {
  assert.match(report, /不足店舗: なし/);
  assert.match(report, /余剰現行店舗: なし/);
});

test("data quality counts remain explicit", () => {
  assert.match(report, /\|現行店舗（本部除外）\|20\|/);
  assert.match(report, /\|Direct\|13\|/);
  assert.match(report, /\|FC\|7\|/);
});

test("RLS findings are not overstated", () => {
  assert.match(report, /RLS: enabled/);
  assert.match(report, /Policy: 0件/);
  assert.match(report, /RLS: disabled/);
});

test("history gap remains blocking", () => {
  assert.match(summary, /店舗運営主体履歴とeffective period/);
});

test("human questions are capped at ten", () => {
  const rows = questions.split(/\r?\n/).filter((line) => /^\|CMA-Q\d+/.test(line));
  assert.equal(rows.length, 10);
});

test("report contains no full UUID or secret value", () => {
  assert.doesNotMatch(report, /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/i);
  assert.doesNotMatch(`${report}\n${summary}\n${questions}`, /service_role_key|SUPABASE_SERVICE_ROLE|postgres(?:ql)?:\/\//i);
});
