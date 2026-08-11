import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";
import { cleanRecruitingTargetDraft, cleanRecruitingTargetStateCommand, RECRUITING_TARGET_CONTRACT_VERSION } from "../supabase/functions/nov-talent-staging-api/recruiting-target-v1.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR = "10000000-0000-4000-8000-000000000001";
const TARGET = "20000000-0000-4000-8000-000000000001";
const migrationUrl = new URL("../supabase/migrations/20260811050625_nov_talent_recruiting_target_foundation.sql", import.meta.url);

function draftBody(extra = {}) { return { graduationYear: 2028, targetType: "OFFERED", targetPeriodCode: "FY2028", targetPeriodStart: "2027-04-01", targetPeriodEnd: "2028-03-31", scopeType: "COMPANY", targetCount: 40, effectiveFrom: "2026-08-11", effectiveTo: "2028-03-31", reason: "Owner承認済み目標の初期設定", ...extra }; }
function targetRow(state = "DRAFT") { return { target_id: TARGET, graduation_year: 2028, target_type: "OFFERED", target_period_code: "FY2028", target_period_start: "2027-04-01", target_period_end: "2028-03-31", scope_type: "COMPANY", scope_id: null, target_count: 40, version: 1, row_version: state === "DRAFT" ? 1 : 2, record_state: state, effective_from: "2026-08-11", effective_to: "2028-03-31", reason: "Owner承認済み目標の初期設定", approved_by: state === "DRAFT" ? null : ACTOR, approved_at: state === "DRAFT" ? null : "2026-08-11T00:00:00Z", superseded_by_target_id: null, superseded_at: null, created_at: "2026-08-11T00:00:00Z", updated_at: "2026-08-11T00:00:00Z" }; }
function fixture({ enabled = false, role = "hr.admin" } = {}) {
  const calls = [];
  return { calls, handler: createHandler({ hubApiUrl: "https://hub.invalid", supabaseUrl: "https://staging.invalid", serviceRoleKey: "fixture", recruitingTargetWritesEnabled: enabled,
    async fetchImpl(url, init = {}) {
      const target = String(url); calls.push({ target, method: init.method || "GET", body: init.body ? JSON.parse(String(init.body)) : null });
      if (target === "https://hub.invalid") return Response.json({ ok: true, employee: { id: ACTOR, roleKeys: [role] } });
      if (target.includes("nov_talent_recruiting_targets_v1")) return Response.json([]);
      if (target.includes("/rpc/nov_talent_create_recruiting_target_draft_v1")) return Response.json([targetRow()]);
      if (target.includes("/rpc/nov_talent_approve_recruiting_target_v1")) return Response.json([targetRow("APPROVED")]);
      return Response.json({ code: "unexpected" }, { status: 400 });
    } }) };
}
function request(path, method = "GET", body) { return new Request(`https://staging.invalid/functions/v1/nov-talent-staging-api${path}`, { method, headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }

test("Contract 1.0.0 and Phase 1 cleaner preserve formal zero and reject expansion", async () => {
  assert.equal(RECRUITING_TARGET_CONTRACT_VERSION, "1.0.0");
  assert.equal(cleanRecruitingTargetDraft(draftBody({ targetCount: 0 })).targetCount, 0);
  assert.equal(cleanRecruitingTargetDraft(draftBody({ targetCount: null })), null);
  assert.equal(cleanRecruitingTargetDraft(draftBody({ targetType: "EXPECTED_JOIN" })), null);
  assert.equal(cleanRecruitingTargetDraft(draftBody({ scopeType: "STORE" })), null);
  assert.equal(cleanRecruitingTargetDraft({ ...draftBody(), actorEmployeeId: ACTOR }), null);
  assert.equal(cleanRecruitingTargetStateCommand({ expectedRowVersion: "1" }), null);
  const schema = JSON.parse(await readFile(new URL("../contracts/nov-talent/recruiting-target-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(schema["x-recruiting-target-contract-version"], "1.0.0");
});

test("Migration owns additive versioned, approved-immutable, RPC-only tables and audit", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.nov_talent_recruiting_targets_v1/i);
  assert.match(sql, /create table public\.nov_talent_recruiting_target_audit_v1/i);
  assert.match(sql, /target_count integer not null check \(target_count >= 0\)/i);
  assert.match(sql, /record_state in \('DRAFT', 'APPROVED', 'SUPERSEDED'\)/i);
  assert.match(sql, /where record_state = 'APPROVED'/i);
  assert.match(sql, /APPROVED_RECRUITING_TARGET_IMMUTABLE/i);
  assert.match(sql, /RECRUITING_TARGET_AUDIT_APPEND_ONLY/i);
  assert.equal((sql.match(/force row level security/gi) || []).length, 2);
  assert.match(sql, /revoke all on public\.nov_talent_recruiting_targets_v1 from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant execute on function public\.nov_talent_approve_recruiting_target_v1[^;]+to service_role/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /RECRUITING_TARGET_STALE_VERSION/i);
  assert.match(sql, /RECRUITING_TARGET_PERIOD_OVERLAP/i);
  assert.doesNotMatch(sql, /alter table public\.nov_talent_(candidates|selection_history|recruitment_events|next_actions|candidate_fair)/i);
});

test("read routes use HUB authorization and service-side read-only target source", async () => {
  const run = fixture();
  const response = await run.handler(request("/api/talent/v1/recruiting-targets/current"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.recruiting_target_contract_version, "1.0.0");
  assert.deepEqual(body.data.targets, []);
  assert.equal(run.calls.some((call) => call.target.includes("/rpc/")), false);
  assert.equal((await fixture({ role: "general" }).handler(request("/api/talent/v1/recruiting-targets/current"))).status, 403);
});

test("write flag is default-off and actor/role are resolved only from HUB Session", async () => {
  const off = fixture();
  assert.equal((await off.handler(request("/api/talent/v1/recruiting-targets/drafts", "POST", draftBody()))).status, 503);
  assert.equal(off.calls.some((call) => call.target.includes("/rpc/")), false);
  const on = fixture({ enabled: true });
  const response = await on.handler(request("/api/talent/v1/recruiting-targets/drafts", "POST", draftBody()));
  assert.equal(response.status, 201);
  const call = on.calls.find((item) => item.target.includes("/rpc/nov_talent_create_recruiting_target_draft_v1"));
  assert.equal(call.body.p_actor_employee_id, ACTOR);
  assert.equal(call.body.p_actor_role, "hr.admin");
  assert.equal(call.body.p_target_count, 40);
});

test("approval command uses optimistic row version and never accepts actor input", async () => {
  const run = fixture({ enabled: true });
  const response = await run.handler(request(`/api/talent/v1/recruiting-targets/${TARGET}/approve`, "POST", { expectedRowVersion: 1 }));
  assert.equal(response.status, 200);
  const call = run.calls.find((item) => item.target.includes("/rpc/nov_talent_approve_recruiting_target_v1"));
  assert.deepEqual(call.body, { p_actor_employee_id: ACTOR, p_actor_role: "hr.admin", p_target_id: TARGET, p_expected_row_version: 1 });
  assert.equal((await run.handler(request(`/api/talent/v1/recruiting-targets/${TARGET}/approve`, "POST", { expectedRowVersion: 1, actorRole: "super_admin" }))).status, 400);
});
