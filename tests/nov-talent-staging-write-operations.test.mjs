import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createStagingCandidateClient, stagingWriteEnabled } from "../portal/talent/staging-write.mjs";

const root = new URL("../", import.meta.url);

test("Staging write feature flag remains explicit and Mock stays disabled", () => {
  assert.equal(stagingWriteEnabled({ NOV_TALENT_CONFIG: { runtimeMode: "staging", networkEnabled: true, writeEnabled: true, writeApiBaseUrl: "https://example.test/f" } }), true);
  assert.equal(stagingWriteEnabled({ NOV_TALENT_CONFIG: { runtimeMode: "mock", networkEnabled: false, writeEnabled: true, writeApiBaseUrl: "https://example.test/f" } }), false);
});

test("browser client writes only through server API with HUB bearer", async () => {
  const calls = [];
  const globalObject = {
    NOV_TALENT_CONFIG: { runtimeMode: "staging", networkEnabled: true, writeEnabled: true, writeApiBaseUrl: "https://example.test/functions/v1/nov-talent-staging-api" },
    NovHubSession: { getSessionToken: async () => "signed-hub-session-token-value" },
    fetch: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201, json: async () => ({ ok: true, data: { candidate_id: "11111111-1111-4111-8111-111111111111", candidate_version: 1 } }) }; }
  };
  const result = await createStagingCandidateClient({ globalObject }).create({ graduationYear: 2028 });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "POST");
  assert.match(calls[0].init.headers.Authorization, /^Bearer /);
  assert.doesNotMatch(JSON.stringify(globalObject.NOV_TALENT_CONFIG), /service.role|secret|password/i);
});

test("save flow confirms before mutation and checks duplicates without automatic merge", async () => {
  const [app, api] = await Promise.all([
    readFile(new URL("portal/talent/app.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8")
  ]);
  assert.match(app, /入力内容で候補者(?:情報を更新|を登録)します/);
  assert.match(app, /checkDuplicates/);
  assert.match(api, /STRONG_KEY_MATCH/);
  assert.match(api, /NAME_SCHOOL_YEAR_MATCH/);
  assert.match(api, /automaticMerge: false/);
  assert.doesNotMatch(api, /target\.name\s*===\s*text\(row\.student_name\)\s*\)\s*;/);
});

test("migration is Staging Candidate-only, append-only audited and optimistic", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260803225229_nov_talent_staging_write_operations.sql", root), "utf8");
  assert.match(sql, /nov_talent_candidates_v1/);
  assert.match(sql, /nov_talent_candidate_audit_log_v1/);
  assert.match(sql, /before update or delete/);
  assert.match(sql, /candidate_version_conflict/);
  assert.match(sql, /v_expected <> 636/);
  assert.doesNotMatch(sql, /idea-nov-core|employee_core|line_history/i);
});

test("audit payload migration records before and after snapshots", async () => {
  const sql = await readFile(new URL("supabase/migrations/20260803231957_nov_talent_candidate_audit_values.sql", root), "utf8");
  assert.match(sql, /before_values/);
  assert.match(sql, /after_values/);
  assert.match(sql, /candidate_audit_snapshot_v1\(v_old\)/);
  assert.match(sql, /candidate_audit_snapshot_v1\(v_new\)/);
});

test("formal status choices and reversible deactivation are fixed", async () => {
  const [html, domain, sql] = await Promise.all([
    readFile(new URL("portal/talent/index.html", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/domain.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/20260803225229_nov_talent_staging_write_operations.sql", root), "utf8")
  ]);
  for (const label of ["LINE登録", "サロン見学［予定］", "サロン見学［済］", "面接待ち", "内定", "他社内定", "離脱", "合否検討中", "不採用"]) assert.match(`${html}\n${domain}`, new RegExp(label.replace(/[［］]/gu, ".")));
  assert.match(sql, /'DEACTIVATE','RESTORE'/);
  assert.doesNotMatch(sql, /delete from public\.nov_talent_candidates_v1/i);
});

test("server API enforces origin, server role and hides service key", async () => {
  const source = await readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8");
  assert.match(source, /ORIGIN_NOT_ALLOWED/);
  assert.match(source, /actor\.profile === "executive"/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  const browser = await readFile(new URL("portal/talent/staging-write.mjs", root), "utf8");
  assert.doesNotMatch(browser, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
});

test("candidate form is responsive and requires a change reason", async () => {
  const [html, css] = await Promise.all([readFile(new URL("portal/talent/index.html", root), "utf8"), readFile(new URL("portal/talent/style.css", root), "utf8")]);
  assert.match(html, /id="profile-change-reason"[^>]*required/);
  assert.match(html, /id="student-profile-deactivate"/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /\.profile-form-grid \{ grid-template-columns: 1fr; \}/);
});
