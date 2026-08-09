import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildDailyWorkflowQueue,
  buildSuggestedActions,
  classifyNextActionPriority,
  DAILY_WORKFLOW_CONTRACT_SCHEMA,
  DAILY_WORKFLOW_CONTRACT_VERSION,
  jstDateTimeLocalToRfc3339,
  validateDailyWorkflowResponse
} from "../portal/talent/daily-workflow.mjs";
import { canonicalizeStrictRfc3339, cleanCommunicationCommand, cleanNextActionCommand } from "../supabase/functions/nov-talent-staging-api/domain.ts";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const root = new URL("../", import.meta.url);
const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR = "10000000-0000-4000-8000-000000009999";
const CANDIDATE = "10000000-0000-4000-8000-000000000001";
const ACTION = "10000000-0000-4000-8000-000000000002";
const ASSIGNEE = "10000000-0000-4000-8000-000000000003";
const dateTimeVectors = JSON.parse(await readFile(new URL("./fixtures/nov-talent-outcome2-rfc3339-vectors.json", import.meta.url), "utf8"));

const communication = Object.freeze({ candidateId: CANDIDATE, expectedCandidateVersion: 2,
  communicationAt: "2026-08-09T01:30:00.000Z", method: "LINE", direction: "OUTBOUND", result: "REACHED",
  summary: "日程を案内", awaitingReply: true, createNextAction: true, nextActionCode: "FOLLOW_UP",
  nextActionDueDate: "2026-08-10", nextActionText: "返信を確認", nextActionAssignedTo: "採用担当",
  nextActionAssignedEmployeeId: ASSIGNEE, reason: "連絡事実の登録" });

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

function handler(outcome2WritesEnabled, { failNextActions = false, communications = [], nextActions = [] } = {}) {
  const calls = [];
  return { calls, run: createHandler({ hubApiUrl: "https://hub.example.invalid", supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "fixture", outcome1WritesEnabled: true, outcome2WritesEnabled,
    async fetchImpl(url, init = {}) {
      const target = String(url);
      if (target.includes("hub.example.invalid")) {
        const body = JSON.parse(String(init.body || "{}"));
        if (body.action === "talentWorkflowAssigneesRead") return Response.json({ ok: true, assignees: [{ employeeId: ASSIGNEE, displayName: "採用担当" }] });
        return Response.json({ ok: true, employee: { id: ACTOR, roleKeys: ["hr.admin"] } });
      }
      const rpcName = /\/rpc\/([^?]+)/u.exec(target)?.[1];
      if (rpcName) { calls.push({ rpcName, body: JSON.parse(String(init.body || "{}")) }); return Response.json([{ event_id: ACTION, next_action_id: null }]); }
      if (target.includes("nov_talent_candidates_v1")) return Response.json([{ candidate_id: CANDIDATE, graduation_year: 2027, student_name: "fixture", version: 2, is_active: true }]);
      if (failNextActions && target.includes("nov_talent_next_actions_v1")) return Response.json({ code: "fixture" }, { status: 503 });
      if (target.includes("nov_talent_recruitment_events_v1")) return Response.json(communications);
      if (target.includes("nov_talent_next_actions_v1")) return Response.json(nextActions);
      return Response.json([]);
    } }) };
}

test("Communication command minimizes data and requires explicit follow-up creation", () => {
  assert.ok(cleanCommunicationCommand(communication));
  assert.equal(cleanCommunicationCommand({ ...communication, communicationAt: null }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, method: "CHAT_APP" }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, summary: "" }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, createNextAction: true, nextActionDueDate: null }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, nextActionAssignedEmployeeId: null }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, communicationAt: "2026-08-09T10:30:00" }), null);
  assert.equal(cleanCommunicationCommand({ ...communication, communicationAt: "2026-02-30T10:30:00+09:00" }), null);
  const without = cleanCommunicationCommand({ ...communication, createNextAction: false, nextActionDueDate: null, nextActionText: null });
  assert.equal(without.createNextAction, false);
  assert.equal(without.nextActionDueDate, null);
});

test("Communication timestamp is strict RFC3339 and JST local input has explicit +09:00 without drift", () => {
  assert.equal(jstDateTimeLocalToRfc3339("2026-08-09T10:30"), "2026-08-09T10:30:00+09:00");
  assert.equal(canonicalizeStrictRfc3339("2026-08-09T10:30:00+09:00"), "2026-08-09T10:30:00+09:00");
  assert.equal(Date.parse("2026-08-09T10:30:00+09:00"), Date.parse("2026-08-09T01:30:00Z"));
  assert.equal(jstDateTimeLocalToRfc3339("2026-02-30T10:30"), null);
  for (const value of dateTimeVectors.accepted) assert.equal(canonicalizeStrictRfc3339(value), value, `accepted: ${value}`);
  for (const value of dateTimeVectors.rejected) assert.equal(canonicalizeStrictRfc3339(value), null, `rejected: ${value}`);
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
  assert.ok(cleanNextActionCommand({ operation: "CREATE", candidateId: CANDIDATE, actionCode: "FOLLOW_UP", dueDate: "2026-08-10", actionText: "返信確認", assignedEmployeeId: ASSIGNEE, reason: "担当者確認" }));
  assert.equal(cleanNextActionCommand({ operation: "CREATE", candidateId: CANDIDATE, actionCode: "FOLLOW_UP", dueDate: "2026-08-10", actionText: "返信確認", reason: "担当者確認" }), null);
  assert.ok(cleanNextActionCommand({ operation: "ASSIGN", candidateId: CANDIDATE, nextActionId: ACTION, expectedVersion: 1, assignedEmployeeId: ASSIGNEE, reason: "担当変更" }));
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
  assert.equal(enabled.calls[0].body.p_next_action_assigned_employee_id, ASSIGNEE);
  assert.equal(enabled.calls[0].body.p_next_action_assigned_to, "採用担当");
  assert.equal("actorEmployeeId" in enabled.calls[0].body, false);
  const invalid = handler(true);
  const rejected = await invalid.run(post("/api/talent/v1/communications", { ...communication,
    nextActionAssignedEmployeeId: "10000000-0000-4000-8000-000000000099" }));
  assert.equal(rejected.status, 400);
  assert.equal(invalid.calls.length, 0);
});

test("Communication corrections retain history while effective projection and reply queue use only the latest tip", async () => {
  const original = "10000000-0000-4000-8000-000000000010";
  const correction = "10000000-0000-4000-8000-000000000011";
  const fixture = handler(false, { communications: [
    { event_id: original, candidate_id: CANDIDATE, communication_at: "2026-08-09T01:00:00Z", communication_method: "LINE",
      communication_direction: "OUTBOUND", communication_result: "NO_RESPONSE", contact_content: "訂正前", awaiting_reply: true,
      next_follow_up_date: "2026-08-10", correction_of_event_id: null, correction_reason: null, created_at: "2026-08-09T01:00:01Z", version: 1 },
    { event_id: correction, candidate_id: CANDIDATE, communication_at: "2026-08-09T01:05:00Z", communication_method: "LINE",
      communication_direction: "OUTBOUND", communication_result: "REPLY_RECEIVED", contact_content: "訂正後", awaiting_reply: false,
      next_follow_up_date: null, correction_of_event_id: original, correction_reason: "結果訂正", created_at: "2026-08-09T01:06:00Z", version: 1 }
  ] });
  const response = await fixture.run(get("/api/talent/v1/daily-workflow"));
  assert.equal(response.status, 200);
  const envelope = await response.json();
  assert.equal(envelope.data.communications.length, 2);
  assert.equal(envelope.data.communications.find((row) => row.id === original).isEffective, false);
  assert.equal(envelope.data.communications.find((row) => row.id === correction).isEffective, true);
  assert.equal(buildDailyWorkflowQueue(envelope.data, "2026-08-09").rows.filter((row) => row.category === "AWAITING_REPLY").length, 0);
});

test("Priority and Queue are deterministic and partial data never becomes zero", () => {
  assert.equal(classifyNextActionPriority("2026-08-08", "2026-08-09"), "OVERDUE");
  assert.equal(classifyNextActionPriority("2026-08-09", "2026-08-09"), "TODAY");
  assert.equal(classifyNextActionPriority("2026-08-10", "2026-08-09"), "FUTURE");
  assert.equal(classifyNextActionPriority(null, "2026-08-09"), "UNSCHEDULED");
  assert.equal(buildDailyWorkflowQueue({ sourceCoverageState: "PREPARING", nextActions: [] }, "2026-08-09").state, "PREPARING");
  const queue = buildDailyWorkflowQueue({ sourceCoverageState: "COMPLETE", communications: [
    { id: "4", candidateId: "c4", awaitingReply: true, isEffective: true, summary: "返信確認", nextFollowUpDate: null },
    { id: "5", candidateId: "c4", awaitingReply: true, isEffective: false, summary: "訂正前", nextFollowUpDate: null }
  ], nextActions: [
    { id: "3", state: "OPEN", dueDate: "2026-08-10", isMine: true }, { id: "2", state: "ON_HOLD", dueDate: "2026-08-08", isMine: false },
    { id: "1", state: "OPEN", dueDate: "2026-08-08", isMine: true }
  ] }, "2026-08-09");
  assert.deepEqual(queue.rows.map((row) => row.category), ["OVERDUE", "AWAITING_REPLY", "ON_HOLD", "FUTURE"]);
  assert.deepEqual(buildSuggestedActions({}, { enabled: false }), { state: "DISABLED", suggestions: [] });
});

test("Daily Workflow read contract is separate from Workspace 1.0.0", () => {
  const exact = { ok: true, data: {
    daily_workflow_contract_version: "1.1.0", sourceCoverageState: "COMPLETE", generatedAt: "2026-08-09T00:00:00.000Z",
    assignees: [{ employeeId: ASSIGNEE, displayName: "採用担当" }],
    communications: [{ id: "10000000-0000-4000-8000-000000000010", candidateId: CANDIDATE,
      occurredAt: "2026-08-09T10:30:00+09:00", method: "LINE", direction: "OUTBOUND", result: "REPLY_RECEIVED",
      summary: "日程確認", awaitingReply: false, nextFollowUpDate: null,
      correctsCommunicationId: "10000000-0000-4000-8000-000000000009", correctionReason: "結果訂正",
      correctionCreatedAt: "2026-08-09T10:31:00+09:00", isCorrection: true, isEffective: true, version: 1 }],
    nextActions: [{ id: ACTION, candidateId: CANDIDATE, code: "FOLLOW_UP", dueDate: "2026-08-10", text: "返信確認",
      assignedTo: "採用担当", assignedEmployeeId: ASSIGNEE, assigneeState: "REGISTERED", isMine: false,
      state: "OPEN", holdReason: null, version: 1, creationBasis: "MANUAL", originCommunicationId: null }]
  } };
  assert.equal(DAILY_WORKFLOW_CONTRACT_VERSION, "1.1.0");
  assert.equal(DAILY_WORKFLOW_CONTRACT_SCHEMA["x-daily-workflow-contract-version"], "1.1.0");
  assert.equal(validateDailyWorkflowResponse(exact).ok, true);
  for (const mutate of [
    (value) => { delete value.data.assignees; },
    (value) => { value.data.nextActions[0].assignedEmployeeId = 123; },
    (value) => { value.data.communications[0].correctionReason = 123; },
    (value) => { value.data.communications[0].isEffective = "true"; },
    (value) => { value.data.unexpected = true; },
    (value) => { value.data.daily_workflow_contract_version = "1.0.0"; }
  ]) {
    const invalid = structuredClone(exact); mutate(invalid);
    assert.equal(validateDailyWorkflowResponse(invalid).ok, false);
  }
  const preparing = { ok: true, data: { daily_workflow_contract_version: "1.1.0", sourceCoverageState: "PREPARING",
    generatedAt: "2026-08-09T00:00:00.000Z", communications: [{}], nextActions: [], assignees: [] } };
  assert.equal(validateDailyWorkflowResponse(preparing).ok, false);
});

test("Daily Workflow generated validator is byte-for-contract synchronized with the committed schema", async () => {
  const schema = JSON.parse(await readFile(new URL("../contracts/nov-talent/daily-workflow-v1.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(DAILY_WORKFLOW_CONTRACT_SCHEMA, schema);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.data.additionalProperties, false);
});

test("Migration and UI pin append-only, transaction, custom dialog, and no priority column", async () => {
  const [migration, rollback, html, app, workspaceSchema, hubApi] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260809102904_nov_talent_outcome2_daily_workflow.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/rollback/20260809102904_nov_talent_outcome2_daily_workflow.rollback.sql", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../contracts/nov-talent/workspace/v1.schema.json", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8")
  ]);
  assert.match(migration, /communication_append_only/u);
  assert.match(migration, /communication_already_corrected/u);
  assert.match(migration, /nov_talent_next_actions_v1_assignee_check/u);
  assert.match(migration, /p_assigned_employee_id uuid/u);
  assert.match(migration, /next_action_physical_delete_forbidden/u);
  assert.match(migration, /set_config\('nov_talent\.outcome2_communication_write','allowed',true\)/u);
  assert.match(migration, /COMMUNICATION_FOLLOW_UP/u);
  assert.doesNotMatch(migration, /add column priority/iu);
  assert.match(rollback, /outcome2_rollback_business_facts_present/u);
  assert.match(html, /candidate-activity-confirm-dialog/u);
  assert.match(html, /activity-communication-method/u);
  assert.match(html, /activity-correction-reason/u);
  assert.match(html, /activity-assignee[^>]*><option/u);
  assert.match(hubApi, /action === "talentWorkflowAssigneesRead"/u);
  assert.match(hubApi, /employeeId: String\(row\.id/u);
  assert.doesNotMatch(hubApi.slice(hubApi.indexOf("async function listTalentWorkflowAssignees"), hubApi.indexOf("function indexById")), /email|firebase_uid|source_row/iu);
  assert.doesNotMatch(app.slice(app.indexOf("completeCandidateNextAction"), app.indexOf("renderStudentDailyOperation")), /\.confirm\?/u);
  assert.equal(JSON.parse(workspaceSchema)["x-workspace-contract-version"], "1.0.0");
});
