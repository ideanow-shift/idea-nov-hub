import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const base = new URL("docs/store_sales_management/production_readiness/entity_mapping/master_verification/", root);
const csv = await readFile(new URL("master-verification-diff.csv", base), "utf8");
const report = await readFile(new URL("master-verification-report.md", base), "utf8");
const summary = await readFile(new URL("master-verification-summary.md", base), "utf8");
const evidence = await readFile(new URL("master-verification-evidence.md", base), "utf8");
const rows = csv.trim().split(/\r?\n/);
const columns = rows[0].split(",");

test("master verification diff has 20 records and 21 columns", () => {
  assert.equal(rows.length - 1, 20);
  assert.equal(columns.length, 21);
});

test("all required diff columns exist", () => {
  for (const name of ["core_uuid", "core_store_code", "match_status", "blocking_flag", "human_question", "evidence_source"]) {
    assert.ok(columns.includes(name), name);
  }
});

test("Core values are not guessed", () => {
  assert.equal(rows.slice(1).every((row) => row.includes(",TBD,TBD,TBD,")), true);
});

test("tri-source result is blocked and unknown", () => {
  assert.match(report, /\*\*BLOCKED\*\*/);
  assert.match(summary, /\|unknown\|20\|/);
  assert.match(summary, /\|Blocking\|20\|/);
});

test("Google and Board align on 20 current stores without claiming Core match", () => {
  assert.match(report, /Google現行店舗との候補対応: 20\/20/);
  assert.match(report, /Core実値を含む三者一致: 0\/20/);
});

test("sensitive and monetary source columns are not exported", () => {
  assert.doesNotMatch(csv, /PASS|管理者|家賃|坪単価|席単価|¥/i);
});

test("evidence distinguishes live reference from mock", () => {
  assert.match(evidence, /Google店舗マスター\|live reference/);
  assert.match(evidence, /Staging synthetic fixture\|mock/);
});

test("no local absolute path or Supabase secret appears", () => {
  const all = `${csv}\n${report}\n${summary}\n${evidence}`;
  assert.doesNotMatch(all, /[A-Za-z]:\\|C:\/Users\/|service_role_key|SUPABASE_SERVICE_ROLE/i);
});
