import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildSelectionFactCoverage,
  isWritableActivityCode
} from "../portal/talent/app.mjs";
import {
  cleanActivity,
  cleanCandidate,
  cleanSourceFactLink
} from "../supabase/functions/nov-talent-staging-api/domain.ts";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const root = new URL("../", import.meta.url);
const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR_ID = "10000000-0000-4000-8000-000000009999";
const CANDIDATE_ID = "10000000-0000-4000-8000-000000000001";

const candidate = Object.freeze({
  candidate_id: CANDIDATE_ID,
  graduation_year: 2027,
  student_name: "fixture",
  student_name_kana: null,
  school_id: null,
  fair_id: null,
  school_name: null,
  faculty_name: null,
  phone: null,
  email: null,
  line_identifier: null,
  current_status_code: "APPLICATION_RECEIVED",
  acquisition_source: null,
  assigned_to: null,
  notes: null,
  source_type: "NOV_TALENT_UI",
  source_row_no: null,
  version: 3,
  is_active: true
});

function writeHandler({ outcome1WritesEnabled = true, rpcReply = () => Response.json([{
  selection_history_id: "10000000-0000-4000-8000-000000000010",
  selection_version: 1,
  candidate_version: 4,
  projected_status_code: "INTERVIEW_COMPLETED"
}]) } = {}) {
  const rpcNames = [];
  const rpcBodies = [];
  const handler = createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    outcome1WritesEnabled,
    async fetchImpl(url, init = {}) {
      const target = String(url);
      if (target.includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { id: ACTOR_ID, roleKeys: ["hr.admin"] } });
      }
      const rpc = /\/rest\/v1\/rpc\/([^?]+)/u.exec(target)?.[1];
      if (rpc) {
        rpcNames.push(rpc);
        rpcBodies.push(JSON.parse(String(init.body || "{}")));
        return rpcReply(rpc);
      }
      if (target.includes("nov_talent_candidates_v1")) return Response.json([candidate]);
      if (target.includes("/rest/v1/")) return Response.json([]);
      throw new Error(`unexpected request: ${target}`);
    }
  });
  return { handler, rpcNames, rpcBodies };
}

function request(path, body) {
  return new Request(`https://staging.example.invalid/functions/v1/nov-talent-staging-api${path}`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      authorization: `Bearer ${"a".repeat(32)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

test("Selection writes are append-only and require Candidate optimistic concurrency", () => {
  const base = {
    entityType: "SELECTION",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    code: "INTERVIEW_COMPLETED",
    date: "2026-08-08",
    reason: "fixture"
  };
  assert.ok(cleanActivity(base));
  assert.equal(cleanActivity({ ...base, expectedCandidateVersion: null }), null);
  assert.equal(cleanActivity({ ...base, operation: "UPDATE", entityId: ACTOR_ID, expectedVersion: 1 }), null);
  assert.equal(cleanActivity({ ...base, code: "UNDER_REVIEW" }), null);
  assert.equal(cleanActivity({ ...base, code: "OFFERED_ELSEWHERE" }), null);
  assert.equal(isWritableActivityCode("SELECTION", "INTERVIEW_COMPLETED"), true);
  assert.equal(isWritableActivityCode("SELECTION", "UNDER_REVIEW"), false);
  assert.equal(isWritableActivityCode("EVENT", "COMMUNICATION_RECORDED"), true);
  for (const code of [
    "APPLICATION_RECEIVED", "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED",
    "OFFERED", "OFFER_ACCEPTED", "WITHDRAWN", "REJECTED"
  ]) assert.ok(cleanActivity({ ...base, code }), code);
});

test("new Candidate starts unregistered and cannot masquerade as an official Selection projection", async () => {
  const base = {
    graduationYear: 2027,
    displayName: "fixture",
    currentStatus: "",
    changeReason: "fixture"
  };
  assert.equal(cleanCandidate(base)?.currentStatus, null);
  assert.equal(cleanCandidate({ ...base, currentStatus: "OFFERED" })?.currentStatus, "OFFERED");

  const forbidden = writeHandler();
  const forbiddenResponse = await forbidden.handler(request("/api/talent/v1/candidates", {
    ...base,
    currentStatus: "OFFERED"
  }));
  assert.equal(forbiddenResponse.status, 400);
  assert.deepEqual(forbidden.rpcNames, []);

  const allowed = writeHandler({ rpcReply: () => Response.json([{
    candidate_id: CANDIDATE_ID,
    candidate_version: 1
  }]) });
  const allowedResponse = await allowed.handler(request("/api/talent/v1/candidates", base));
  assert.equal(allowedResponse.status, 201);
  assert.deepEqual(allowed.rpcNames, ["nov_talent_create_candidate_v1"]);
  assert.equal(allowed.rpcBodies[0].p_current_status_code, null);
});

test("Source Fact link requires exact Candidate version and stable non-PII evidence reference", () => {
  const base = {
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    sourceType: "ENTRIES_27",
    sourceRowNo: 42,
    factCode: "INTERVIEW_COMPLETED",
    expectedVersion: 1,
    evidenceReference: "SOURCE:ENTRIES_27:ROW:42:INTERVIEW_COMPLETED",
    reason: "human review"
  };
  assert.ok(cleanSourceFactLink(base));
  assert.equal(cleanSourceFactLink({ ...base, expectedCandidateVersion: null }), null);
  assert.equal(cleanSourceFactLink({ ...base, evidenceReference: "SOURCE:ENTRIES_27:ROW:41:INTERVIEW_COMPLETED" }), null);
  assert.equal(cleanSourceFactLink({ ...base, evidenceReference: "student@example.com" }), null);
});

test("Selection API calls only the atomic append-and-project RPC with HUB-resolved actor", async () => {
  const fixture = writeHandler();
  const response = await fixture.handler(request("/api/talent/v1/activities", {
    entityType: "SELECTION",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    code: "INTERVIEW_COMPLETED",
    date: "2026-08-08",
    assignedTo: "fixture",
    notes: null,
    reason: "human-confirmed transition"
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(fixture.rpcNames, ["nov_talent_append_selection_transition_v1"]);
  assert.deepEqual(fixture.rpcBodies[0], {
    p_actor_employee_id: ACTOR_ID,
    p_actor_role: "hr.admin",
    p_reason: "human-confirmed transition",
    p_candidate_id: CANDIDATE_ID,
    p_expected_candidate_version: 3,
    p_selection_code: "INTERVIEW_COMPLETED",
    p_effective_date: "2026-08-08",
    p_assigned_to: "fixture",
    p_notes: null
  });
});

test("Outcome 1 writes are disabled by default while existing Event writes remain healthy", async () => {
  const disabled = writeHandler({ outcome1WritesEnabled: false });
  const selectionResponse = await disabled.handler(request("/api/talent/v1/activities", {
    entityType: "SELECTION",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    code: "APPLICATION_RECEIVED",
    date: "2026-08-08",
    reason: "fixture"
  }));
  assert.equal(selectionResponse.status, 503);
  assert.equal((await selectionResponse.json()).safeCode, "OUTCOME1_MIGRATION_REQUIRED");

  const communicationResponse = await disabled.handler(request("/api/talent/v1/activities", {
    entityType: "EVENT",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    code: "COMMUNICATION_RECORDED",
    date: "2026-08-08",
    reason: "fixture"
  }));
  assert.equal(communicationResponse.status, 503);
  assert.deepEqual(disabled.rpcNames, []);

  const compatible = writeHandler({ outcome1WritesEnabled: false });
  const existingEventResponse = await compatible.handler(request("/api/talent/v1/activities", {
    entityType: "EVENT",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    code: "CONTACT_RECORDED",
    date: "2026-08-08",
    reason: "fixture"
  }));
  assert.equal(existingEventResponse.status, 201);
  assert.deepEqual(compatible.rpcNames, ["nov_talent_mutate_recruiting_activity_v1"]);
});

test("pre-migration Edge state fails closed and never falls back to an unsafe legacy RPC", async () => {
  const fixture = writeHandler({ rpcReply: () => Response.json({ code: "PGRST202" }, { status: 404 }) });
  const response = await fixture.handler(request("/api/talent/v1/activities", {
    entityType: "SELECTION",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    code: "OFFERED",
    date: "2026-08-08",
    reason: "fixture"
  }));
  const envelope = await response.json();
  assert.equal(response.status, 503);
  assert.equal(envelope.safeCode, "OUTCOME1_MIGRATION_REQUIRED");
  assert.deepEqual(fixture.rpcNames, ["nov_talent_append_selection_transition_v1"]);
  assert.equal(fixture.rpcNames.includes("nov_talent_mutate_recruiting_activity_v1"), false);
});

test("contract and authorization rejections never trigger legacy fallback", async () => {
  const fixture = writeHandler({ rpcReply: () => Response.json({ code: "42501" }, { status: 400 }) });
  const response = await fixture.handler(request("/api/talent/v1/activities", {
    entityType: "SELECTION",
    operation: "CREATE",
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    code: "REJECTED",
    date: "2026-08-08",
    reason: "fixture"
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(fixture.rpcNames, ["nov_talent_append_selection_transition_v1"]);
});

test("Source Fact API uses v2 evidence link without creating a Selection fact", async () => {
  const fixture = writeHandler({ rpcReply: () => Response.json([{
    source_row_no: 42,
    source_version: 2,
    candidate_version: 3
  }]) });
  const response = await fixture.handler(request("/api/talent/v1/unlinked-selection/link", {
    candidateId: CANDIDATE_ID,
    expectedCandidateVersion: 3,
    sourceType: "ENTRIES_27",
    sourceRowNo: 42,
    factCode: "INTERVIEW_COMPLETED",
    expectedVersion: 1,
    evidenceReference: "SOURCE:ENTRIES_27:ROW:42:INTERVIEW_COMPLETED",
    reason: "human-confirmed evidence"
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.rpcNames, ["nov_talent_link_source_fact_v2"]);
  assert.equal(fixture.rpcBodies[0].p_resolution_method, "HUMAN_CONFIRMED");
  assert.equal(fixture.rpcBodies[0].p_expected_candidate_version, 3);
  assert.equal(fixture.rpcNames.includes("nov_talent_append_selection_transition_v1"), false);
});

test("Coverage separates official Selection rows, unique Candidates, and unlinked Evidence", () => {
  const coverage = buildSelectionFactCoverage({
    partialStatus: { state: "complete", unavailableViews: [] },
    overview: { remainingManual: 2 },
    students: [
      { recordId: "a", statusCode: "OFFERED", selectionHistory: [
        { active: true, code: "APPLICATION_RECEIVED" },
        { active: true, code: "APPLICATION_RECEIVED" }
      ] },
      { recordId: "b", statusCode: "OFFERED", selectionHistory: [] }
    ],
    unlinkedSelectionHistory: [
      { code: "INTERVIEW_COMPLETED" },
      { code: "INTERVIEW_COMPLETED" }
    ]
  });
  const applications = coverage.metrics.find((metric) => metric.code === "APPLICATION_RECEIVED");
  const interviews = coverage.metrics.find((metric) => metric.code === "INTERVIEW_COMPLETED");
  const offers = coverage.metrics.find((metric) => metric.code === "OFFERED");
  assert.deepEqual({ state: applications.state, candidates: applications.candidateCount, rows: applications.officialRowCount },
    { state: "RECORDED", candidates: 1, rows: 2 });
  assert.deepEqual({ state: interviews.state, candidates: interviews.candidateCount, unlinked: interviews.unlinkedEvidenceCount },
    { state: "PARTIAL", candidates: null, unlinked: 2 });
  assert.equal(offers.state, "NOT_REGISTERED");
  assert.equal(offers.candidateCount, null);
  assert.equal(coverage.state, "PARTIAL");
});

test("Coverage fails closed when a source is unavailable or the v1 display list is capped", () => {
  const unavailable = buildSelectionFactCoverage({
    partialStatus: { unavailableViews: ["source_facts"] },
    overview: { remainingManual: 0 },
    students: [],
    unlinkedSelectionHistory: []
  });
  assert.equal(unavailable.state, "PREPARING");
  assert.ok(unavailable.metrics.every((metric) => metric.state === "PREPARING"));

  const capped = buildSelectionFactCoverage({
    partialStatus: { unavailableViews: [] },
    overview: { remainingManual: 101 },
    students: [],
    unlinkedSelectionHistory: Array.from({ length: 100 }, () => ({ code: "INTERVIEW_COMPLETED" }))
  });
  assert.equal(capped.evidenceListTruncated, true);
  assert.equal(capped.state, "PREPARING");

  const selectionCapped = buildSelectionFactCoverage({
    partialStatus: { unavailableViews: [] },
    dashboard: { selectionHistoryCount: 101 },
    overview: { remainingManual: 0 },
    students: [{ recordId: CANDIDATE_ID, selectionHistory: Array.from({ length: 100 }, () => ({
      active: true,
      code: "APPLICATION_RECEIVED"
    })) }],
    unlinkedSelectionHistory: []
  });
  assert.equal(selectionCapped.selectionListTruncated, true);
  assert.equal(selectionCapped.state, "PREPARING");
});

test("Migration makes Selection atomic, append-only, auditable, and RPC-only", async () => {
  const sql = await readFile(new URL(
    "supabase/migrations/20260808083752_nov_talent_official_recruiting_facts.sql", root
  ), "utf8");
  assert.match(sql, /nov_talent_append_selection_transition_v1/iu);
  assert.match(sql, /from public\.nov_talent_candidates_v1[\s\S]*for update/iu);
  assert.match(sql, /candidate_version_conflict/iu);
  assert.match(sql, /insert into public\.nov_talent_selection_history_v1[\s\S]*update public\.nov_talent_candidates_v1/iu);
  assert.match(sql, /current_status_projection_source = 'SELECTION_HISTORY'/iu);
  assert.match(sql, /selection_history_append_only/iu);
  assert.match(sql, /recruitment_activity_audit_append_only/iu);
  assert.doesNotMatch(sql, /terminal_selection_transition_conflict/iu);
  assert.doesNotMatch(sql, /case\s+s\.selection_code/iu);
  assert.match(sql, /order by s\.effective_date desc, s\.created_at desc, s\.selection_history_id desc/iu);
  assert.match(sql, /currentStatusProjectionSource/iu);
  assert.match(sql, /'INITIAL'/iu);
  assert.match(sql, /evidence_hash = v_source_old\.source_fingerprint/iu);
  assert.match(sql, /resolution_method = p_resolution_method/iu);
  assert.match(sql, /grant select on public\.nov_talent_selection_history_v1 to service_role/iu);
  assert.match(sql, /grant select on public\.nov_talent_recruitment_source_facts_v1 to service_role/iu);
  assert.doesNotMatch(sql, /grant\s+(?:select,\s*)?insert[^;]*nov_talent_selection_history_v1[^;]*service_role/iu);
  assert.doesNotMatch(sql, /grant\s+(?:select,\s*)?update[^;]*nov_talent_recruitment_source_facts_v1[^;]*service_role/iu);
  assert.doesNotMatch(sql, /idea-nov-core|employee_core|line_history/iu);
});

test("rollout keeps reads healthy and fails only new formal writes closed before migration", async () => {
  const edge = await readFile(new URL("supabase/functions/nov-talent-staging-api/index.ts", root), "utf8");
  const guide = await readFile(new URL(
    "docs/nov_talent/release_1_0/outcome-1-official-recruiting-facts.md", root
  ), "utf8");
  assert.match(edge, /selections\.slice\(0, 100\)/u);
  assert.match(guide, /新Edge[^\n]*flag=false[^\n]*確認/u);
  assert.match(guide, /flag=false確認後[^\n]*Pages/u);
  assert.match(guide, /503 OUTCOME1_MIGRATION_REQUIRED/u);
  assert.match(guide, /従来RPCへのfallbackは行わない/u);
  assert.match(guide, /Fresh isolated PostgreSQL 17\.6[^\n]*確認済み/u);
  assert.match(guide, /Selection \/ Source link \/ COMMUNICATION_RECORDED/u);
});

test("review-only rollback fails closed on every Outcome 1 business fact and never deletes data", async () => {
  const rollback = await readFile(new URL(
    "supabase/rollback/20260808083752_nov_talent_official_recruiting_facts.rollback.sql", root
  ), "utf8");
  assert.match(rollback, /source_type = 'NOV_TALENT_UI'/u);
  assert.match(rollback, /current_status_projection_source = 'SELECTION_HISTORY'/u);
  assert.match(rollback, /resolution_method is not null/u);
  assert.match(rollback, /event_code = 'COMMUNICATION_RECORDED'/u);
  assert.match(rollback, /outcome1_rollback_business_facts_present/u);
  assert.doesNotMatch(rollback, /\bdelete\s+from\b/iu);
  assert.doesNotMatch(rollback, /\bcascade\b/iu);
  const guide = await readFile(new URL(
    "docs/nov_talent/release_1_0/outcome-1-official-recruiting-facts.md", root
  ), "utf8");
  assert.match(guide, /NOV_TALENT_OUTCOME1_WRITES_ENABLED=false[^\n]*確認/u);
  assert.match(guide, /business-fact guard/u);
});

test("Workspace Contract remains exact v1.0.0 without hand-added Coverage keys", async () => {
  const schema = JSON.parse(await readFile(new URL("contracts/nov-talent/workspace/v1.schema.json", root), "utf8"));
  assert.equal(schema["x-workspace-contract-version"], "1.0.0");
  assert.equal(schema.$defs.WorkspaceDataV1.additionalProperties, false);
  assert.equal(Object.hasOwn(schema.$defs.WorkspaceDataV1.properties, "selectionCoverage"), false);
});
