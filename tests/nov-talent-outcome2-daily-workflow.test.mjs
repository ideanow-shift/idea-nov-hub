import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildDailyWorkflowQueue, buildSuggestedActions, classifyNextActionPriority, validateDailyWorkflowResponse } from "../portal/talent/daily-workflow.mjs";
import { cleanCommunicationCommand, cleanNextActionCommand } from "../supabase/functions/nov-talent-staging-api/domain.ts";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const root = new URL("../", import.meta.url);
const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR = "10000000-0000-4000-8000-000000009999";
const CANDIDATE = "10000000-0000-4000-8000-000000000001";
const ACTION = "10000000-0000-4000-8000-000000000002";

const communication = Object.freeze({ candidateId: CANDIDATE, expectedCandidateVersion: 2,
  communicationAt: "2026-08-09T01:30:00.000Z", method: "LINE", direction: "OUTBOUND", result: "REACHED",
  summary: "日程を案内", awaitingReply: true, createNextAction: true, nextActionCode: "FOLLOW_UP",
  nextActionDueDate: "2026-08-10", nextActionText: "返信を確認", nextActionAssignedTo: "採用担当", reason: "連絡事実の登録" });

function post(path, body) {
  return new Request(`https://staging.example.invalid/functions/v1/nov-talent-staging-api${path}`, {
    method: "POST", headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function get(path) {
  return new Request(`https://staging.example.invalid/functions/v1/nov-talent-staging-api${path}`, {
    method: "GET", headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}` }
  });
}

function handler(outcome2WritesEnabled, { failNextActions = false } = {}) {
  const calls = [];
  return { calls, run: createHandler({ hubApiUrl: "https://hub.example.invalid", supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "fixture", outcome1WritesEnabled: true, outcome2WritesEnabled,
    async fetchImpl(url, init = {}) {
      const target = String(url);
      if (target.includes("hub.example.invalid")) return Response.json({ ok: true, employee: { id: ACTOR, roleKeys: ["hr.admin"] } });
      const rpcName = /\/rpc\/([^?]+)/u.exec(target)?.[1];
      if (rpcName) { calls.push({ rpcName, body: JSON.parse(String(init.body || "{}")) }); return Response.json([{ event_id: ACTION, next_action_id: null }]); }
      if (target.includes("nov_talent_candidates_v1")) return Response.json([{ candidate_id: CANDIDATE, graduation_year: 2027, student_name: "fixture", version: 2, is_active: true }]);
      if (failNextActions && target.includes("nov_talent_next_actions_v1")) return Response.json({ code: "fixture" }, { status: 503 });
      return Response.json([]);
    } }) };
}

test("Communication command minimizes data and requires explicit follow-up creation", () => {
  assert.ok(cleanCommunicationCommand(communication));
  assert.equal(cleanCommunicationCommand({ ...communication, communicationAt: null }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, method: "CHAT_APP" }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, summary: "" }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, createNextAction: true, nextActionDueDate: null }), null);
  const without = cleanCommunicationCommand({ ...communication, createNextAction: false, nextActionDueDate: null, nextActionText: null });
  assert.equal(without.createNextAction, false);
  assert.equal(without.nextActionDueDate, null);
});

test("Daily Workflow partial failure returns PREPARING without false-zero rows and leaves Workspace route independent", async () => {
  const fixture = handler(false, { failNextActions: true });
  const response = await fixture.run(get("/api/talent/v1/daily-workflow"));
  assert.equal(response.status, 200);
  const envelope = await response.json();
  assert.equal(envelope.data.sourceCoverageState, "PREPARING");
  assert.deepEqual(envelope.data.communications, []);
  assert.deepEqual(envelope.data.nextActions, []);
});

test("Next Action lifecycle commands fail closed at the request boundary", () => {
  assert.ok(cleanNextActionCommand({ operation: "CREATE", candidateId: CANDIDATE, actionCode: "FOLLOW_UP", dueDate: "2026-08-10", actionText: "返信確認", reason: "担当者確認" }));
  assert.ok(cleanNextActionCommand({ operation: "HOLD", candidateId: CANDIDATE, nextActionId: ACTION, expectedVersion: 1, holdReason: "本人確認待ち", reason: "保留理由" }));
  assert.equal(cleanNextActionCommand({ operation: "HOLD", candidateId: CANDIDATE, nextActionId: ACTION, expectedVersion: 1, reason: "fixture" }), null);
  assert.equal(cleanNextActionCommand({ operation: "DELETE", candidateId: CANDIDATE, nextActionId: ACTION, expectedVersion: 1, reason: "fixture" }), null);
});

test("Outcome 2 writes are default-off and use dedicated RPCs only", async () => {
  const disabled = handler(false);
  const stopped = await disabled.run(post("/api/talent/v1/communications", communication));
  assert.equal(stopped.status, 503);
  assert.equal(disabled.calls.length, 0);
  const enabled = handler(true);
  const saved = await enabled.run(post("/api/talent/v1/communications", communication));
  assert.equal(saved.status, 201);
  assert.equal(enabled.calls[0].rpcName, "nov_talent_record_communication_v1");
  assert.equal(enabled.calls[0].body.p_actor_employee_id, ACTOR);
  assert.equal("actorEmployeeId" in enabled.calls[0].body, false);
});

test("Priority and Queue are deterministic and partial data never becomes zero", () => {
  assert.equal(classifyNextActionPriority("2026-08-08", "2026-08-09"), "OVERDUE");
  assert.equal(classifyNextActionPriority("2026-08-09", "2026-08-09"), "TODAY");
  assert.equal(classifyNextActionPriority("2026-08-10", "2026-08-09"), "FUTURE");
  assert.equal(classifyNextActionPriority(null, "2026-08-09"), "UNSCHEDULED");
  assert.equal(buildDailyWorkflowQueue({ sourceCoverageState: "PREPARING", nextActions: [] }, "2026-08-09").state, "PREPARING");
  const queue = buildDailyWorkflowQueue({ sourceCoverageState: "COMPLETE", communications: [
    { id: "4", candidateId: "c4", awaitingReply: true, summary: "返信確認", nextFollowUpDate: null }
  ], nextActions: [
    { id: "3", state: "OPEN", dueDate: "2026-08-10", isMine: true }, { id: "2", state: "ON_HOLD", dueDate: "2026-08-08", isMine: false },
    { id: "1", state: "OPEN", dueDate: "2026-08-08", isMine: true }
  ] }, "2026-08-09");
  assert.deepEqual(queue.rows.map((row) => row.category), ["OVERDUE", "AWAITING_REPLY", "ON_HOLD", "FUTURE"]);
  assert.deepEqual(buildSuggestedActions({}, { enabled: false }), { state: "DISABLED", suggestions: [] });
});

test("Daily Workflow read contract is separate from Workspace 1.0.0", () => {
  assert.equal(validateDailyWorkflowResponse({ ok: true, data: { daily_workflow_contract_version: "1.0.0", sourceCoverageState: "COMPLETE", generatedAt: "2026-08-09T00:00:00.000Z", communications: [], nextActions: [] } }), true);
  assert.equal(validateDailyWorkflowResponse({ ok: true, data: { daily_workflow_contract_version: "1.0.0", sourceCoverageState: "PREPARING", generatedAt: "2026-08-09T00:00:00.000Z", communications: [{}], nextActions: [] } }), false);
});

test("Migration and UI pin append-only, transaction, custom dialog, and no priority column", async () => {
  const [migration, rollback, html, app, workspaceSchema] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260809102904_nov_talent_outcome2_daily_workflow.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/rollback/20260809102904_nov_talent_outcome2_daily_workflow.rollback.sql", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../contracts/nov-talent/workspace/v1.schema.json", import.meta.url), "utf8")
  ]);
  assert.match(migration, /communication_append_only/u);
  assert.match(migration, /next_action_physical_delete_forbidden/u);
  assert.match(migration, /set_config\('nov_talent\.outcome2_communication_write','allowed',true\)/u);
  assert.match(migration, /COMMUNICATION_FOLLOW_UP/u);
  assert.doesNotMatch(migration, /add column priority/iu);
  assert.match(rollback, /outcome2_rollback_business_facts_present/u);
  assert.match(html, /candidate-activity-confirm-dialog/u);
  assert.match(html, /activity-communication-method/u);
  assert.doesNotMatch(app.slice(app.indexOf("completeCandidateNextAction"), app.indexOf("renderStudentDailyOperation")), /\.confirm\?/u);
  assert.equal(JSON.parse(workspaceSchema)["x-workspace-contract-version"], "1.0.0");
});
