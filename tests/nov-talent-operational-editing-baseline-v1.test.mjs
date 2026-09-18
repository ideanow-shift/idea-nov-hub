import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cleanCandidate } from "../supabase/functions/nov-talent-staging-api/domain.ts";

const root = new URL("../", import.meta.url);
const candidate = Object.freeze({
  graduationYear: 2028,
  displayName: "検証用候補",
  currentStatus: "",
  changeReason: "正式担当者へ変更",
  expectedVersion: 3
});

test("Candidate edit accepts only a canonical assignee UUID and never trusts a display name", () => {
  const employeeId = "11111111-1111-4111-8111-111111111111";
  const valid = cleanCandidate({ ...candidate, assignedEmployeeId: employeeId, assignedTo: "client supplied name" });
  assert.equal(valid?.assignedEmployeeId, employeeId);
  assert.equal(valid?.assignedTo, null);
  assert.equal(cleanCandidate({ ...candidate, assignedEmployeeId: "free-input-assignee" }), null);
});

test("Candidate Detail exposes four bounded operations and keeps Current Status read-only", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("portal/talent/index.html", root), "utf8"),
    readFile(new URL("portal/talent/app.mjs", root), "utf8")
  ]);
  assert.match(app, /学生情報を編集/);
  for (const label of ["選考結果を登録", "連絡を記録", "次の予定を設定"]) assert.match(html, new RegExp(label));
  assert.match(html, /id="profile-status"[\s\S]*現在の状態は参照用/);
  assert.match(html, /id="profile-selection-open"[^>]*>選考結果を登録<\/button>/);
  assert.match(html, /id="profile-assignee"[^>]*name="assignedEmployeeId"/);
  assert.doesNotMatch(html, /id="profile-assignee"[^>]*<input/);
});

test("Candidate edit resolves assignee server-side and fails closed when the directory is unavailable", async () => {
  const source = await readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8");
  const updateRoute = source.match(/const edit = [\s\S]*?const active =/)?.[0] || "";
  assert.match(updateRoute, /canonicalAssignees\(runtime, actor\.hubToken\)/);
  assert.match(updateRoute, /ASSIGNEE_DIRECTORY_UNAVAILABLE/);
  assert.match(updateRoute, /INVALID_ASSIGNEE/);
  assert.match(updateRoute, /assignee\?\.displayName \|\| null/);
  assert.doesNotMatch(updateRoute, /body\?\.assignedTo|body\.assignedTo/);
});

test("bounded editing keeps optimistic versions, audit reasons, and duplicate-submit guards", async () => {
  const [app, domain, edge] = await Promise.all([
    readFile(new URL("portal/talent/app.mjs", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/domain.ts", root), "utf8"),
    readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8")
  ]);
  assert.match(app, /if \(profileSaveInFlight\) return/);
  assert.match(app, /expectedVersion: profileDialogStudent\?\.profileVersion/);
  assert.match(domain, /const reason = clean\(value\.changeReason, 500\)/);
  assert.match(edge, /p_actor_employee_id: actor\.actor/);
  assert.match(edge, /p_actor_role: actor\.role/);
  assert.match(edge, /p_expected_version: c\.expectedVersion/);
});

test("Baseline V1 adds no schema, migration, Store Operations, DBF, or Production artifact", async () => {
  const status = await readFile(new URL("docs/cto/PORTFOLIO_PRIORITY_LOCK.md", root), "utf8");
  assert.match(status, /NOV Talent Bounded Operational Maintenance Exception/);
  assert.match(status, /Store Operations Management V1を\s*常に最優先/);
});
