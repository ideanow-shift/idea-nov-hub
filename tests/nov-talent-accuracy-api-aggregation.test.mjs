import assert from "node:assert/strict";
import test from "node:test";

import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";
import { cleanActivity, cleanRecruitmentMaster } from "../supabase/functions/nov-talent-staging-api/domain.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR_ID = "10000000-0000-4000-8000-000000009999";

function uuid(index) {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function candidate(index, status) {
  return {
    candidate_id: uuid(index), graduation_year: index < 4 ? 2027 : 2028,
    student_name: `fixture-${index}`, student_name_kana: null,
    school_id: null, fair_id: null, school_name: "fixture-school", faculty_name: null,
    phone: null, email: null, line_identifier: null, current_status_code: status,
    acquisition_source: null, assigned_to: null, notes: null,
    source_type: "CONTACTS_27", source_row_no: index, version: 1, is_active: true
  };
}

function event(index, candidateId, code, active = true) {
  return {
    event_id: uuid(100 + index), candidate_id: candidateId, event_code: code,
    event_date: "2026-08-01", event_name: null, event_state: "COMPLETED",
    contact_content: null, assigned_to: null, notes: null, version: 1, is_active: active
  };
}

function selection(index, candidateId, code, active = true) {
  return {
    selection_history_id: uuid(200 + index), candidate_id: candidateId,
    selection_code: code, effective_date: "2026-08-01", assigned_to: null,
    notes: null, version: 1, is_active: active
  };
}

const CANDIDATES = [
  candidate(1, "LINE_REGISTERED"),
  candidate(2, "LINE_REGISTERED"),
  candidate(3, "OFFERED"),
  candidate(4, "EXPECTED_JOIN")
];

const EVENTS = [
  event(1, uuid(1), "CONTACT_RECORDED"),
  event(2, uuid(1), "CONTACT_RECORDED"),
  event(3, uuid(2), "CONTACT_RECORDED", false),
  event(4, uuid(1), "LINE_REGISTERED"),
  event(5, uuid(1), "SALON_TOUR_COMPLETED"),
  event(6, uuid(2), "INTERVIEW_COMPLETED")
];

const SELECTIONS = [
  selection(1, uuid(1), "APPLICATION_RECEIVED"),
  selection(2, uuid(1), "APPLICATION_RECEIVED"),
  selection(3, uuid(1), "INTERVIEW_COMPLETED"),
  selection(4, uuid(2), "SALON_TOUR_COMPLETED"),
  selection(5, uuid(1), "OFFERED"),
  selection(6, uuid(1), "OFFERED"),
  selection(7, uuid(2), "WITHDRAWN"),
  selection(8, uuid(3), "OFFERED_ELSEWHERE"),
  selection(9, uuid(4), "REJECTED"),
  selection(10, uuid(2), "OFFERED", false)
];

const SOURCE_FACTS = [
  { source_type: "ENTRIES_27", source_row_no: 1, fact_code: "APPLICATION_RECEIVED", fact_date: "2026-08-01", candidate_id: null, version: 1 },
  { source_type: "ENTRIES_27", source_row_no: 4, fact_code: "APPLICATION_RECEIVED", fact_date: "2026-08-01", candidate_id: null, version: 1 },
  { source_type: "ENTRIES_27", source_row_no: 2, fact_code: "INTERVIEW_COMPLETED", fact_date: "2026-08-01", candidate_id: null, version: 1 },
  { source_type: "ENTRIES_27", source_row_no: 3, fact_code: "INTERVIEW_COMPLETED", fact_date: "2026-08-01", candidate_id: null, version: 1 },
  { source_type: "OFFERS_27", source_row_no: 1, fact_code: "OFFERED", fact_date: "2026-08-01", candidate_id: null, version: 1 },
  { source_type: "OFFERS_27", source_row_no: 2, fact_code: "OFFERED", fact_date: "2026-08-01", candidate_id: null, version: 1 },
  { source_type: "CONTACTS_27", source_row_no: 4, fact_code: "WITHDRAWN", fact_date: "2026-08-01", candidate_id: null, version: 1 }
];

const VIEW_ROWS = Object.freeze({
  nov_talent_candidates_v1: CANDIDATES,
  nov_talent_recruitment_events_v1: EVENTS,
  nov_talent_selection_history_v1: SELECTIONS,
  nov_talent_next_actions_v1: [],
  nov_talent_fair_metrics_v1: [],
  nov_talent_recruitment_source_facts_v1: SOURCE_FACTS,
  nov_talent_school_masters_v1: [],
  nov_talent_fair_masters_v1: []
});

function fixtureHandler({ viewRows = VIEW_ROWS, now } = {}) {
  return createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    now,
    async fetchImpl(url) {
      if (String(url).includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { id: ACTOR_ID, roleKeys: ["hr.admin"] } });
      }
      const view = Object.keys(viewRows).find((name) => String(url).includes(name));
      assert.ok(view, `unexpected downstream view: ${String(url)}`);
      return Response.json(viewRows[view]);
    }
  });
}

async function readWorkspace(options) {
  const response = await fixtureHandler(options)(new Request(
    "https://staging.example.invalid/functions/v1/nov-talent-staging-api/api/talent/v1/workspace",
    { headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}` } }
  ));
  return { response, envelope: await response.json() };
}

test("contact metrics count active CONTACT_RECORDED Event rows, not Candidate rows", async () => {
  const { response, envelope } = await readWorkspace();
  assert.equal(response.status, 200);
  assert.equal(envelope.data.dashboard.candidateCount, 4);
  assert.equal(envelope.data.summary.contacts, 2);
  assert.equal(envelope.data.overview.contacts, 2);
  assert.equal(envelope.data.summary.lineRegistrations, 1);
  assert.equal(envelope.data.summary.salonTours, 1);
  assert.equal(envelope.data.dashboard.lineRegistrations, 1);
  assert.equal(envelope.data.dashboard.salonTourCompleted, 1);
});

test("official dashboard metrics never mix Candidate status, Source Fact, Event, and Selection counts", async () => {
  const { response, envelope } = await readWorkspace();
  assert.equal(response.status, 200);

  // Selection History is the only lower-funnel source; duplicate facts count one Candidate.
  assert.equal(envelope.data.dashboard.entries, 1);
  assert.equal(envelope.data.dashboard.interviewHistory, 1);
  assert.equal(envelope.data.dashboard.offers, 1);
  assert.equal(envelope.data.dashboard.offeredElsewhere, 0);
  assert.equal(envelope.data.dashboard.withdrawals, 1);
  assert.equal(envelope.data.dashboard.rejected, 1);
  assert.equal(envelope.data.summary.interviews, 1);
  assert.equal(envelope.data.summary.offers, 1);

  // Evidence rows remain review-only and are not added to the official Selection count.
  assert.equal(envelope.data.dashboard.selectionHistoryCount, 9);
  assert.equal(envelope.data.dashboard.unlinkedInterviewHistoryCount, 2);
  assert.equal(envelope.data.unlinkedSelectionHistory.length, 6);

  // Historical Selection coverage is not complete, so lower-funnel cards fail closed.
  for (const key of ["entries", "interviewHistory", "interviewPlanned", "offers", "offeredElsewhere", "withdrawals", "rejected"]) {
    assert.equal(envelope.data.dashboard.availability[key], false, key);
  }
  assert.equal(envelope.data.dashboard.availability.lineRegistrations, true);
  assert.equal(envelope.data.dashboard.availability.salonTourCompleted, true);
  assert.equal(envelope.data.dashboard.availability.todayActions, true);

  // Expected join remains an explicit current-state projection, never part of a max/fallback.
  assert.equal(envelope.data.summary.expectedJoiners, 1);
});

test("Fair nullable integers distinguish missing, null, confirmed zero, and invalid input", () => {
  const base = {
    entityType: "FAIR", operation: "CREATE", entityId: null, expectedVersion: null,
    reason: "fixture", fairName: "fixture-fair", eventDate: "2026-08-08"
  };
  const created = cleanRecruitmentMaster(base);
  assert.ok(created);
  for (const key of [
    "participationFee", "participantCount", "contactCount", "lineRegistrationCount", "salonTourCount",
    "expectedContacts", "totalAttendance", "participatingSalons"
  ]) assert.equal(created.payload[key], null, key);
  for (const key of ["interviewCount", "offerCount", "hireCount"]) {
    assert.equal(Object.hasOwn(created.payload, key), false, key);
  }

  const updateBase = { ...base, operation: "UPDATE", entityId: uuid(900), expectedVersion: 1 };
  const omitted = cleanRecruitmentMaster(updateBase);
  assert.ok(omitted);
  assert.equal(Object.hasOwn(omitted.payload, "interviewCount"), false);
  assert.equal(Object.hasOwn(omitted.payload, "offerCount"), false);
  assert.equal(Object.hasOwn(omitted.payload, "hireCount"), false);

  const explicit = cleanRecruitmentMaster({ ...updateBase, participationFee: null, contactCount: 0, expectedContacts: 12 });
  assert.ok(explicit);
  assert.equal(explicit.payload.participationFee, null);
  assert.equal(explicit.payload.contactCount, 0);
  assert.equal(explicit.payload.expectedContacts, 12);

  for (const invalid of ["", "0", true, -1, 1.5, Number.NaN]) {
    assert.equal(cleanRecruitmentMaster({ ...updateBase, contactCount: invalid }), null);
  }

  for (const key of ["interviewCount", "offerCount", "hireCount"]) {
    assert.equal(cleanRecruitmentMaster({ ...base, [key]: 0 }), null, `${key} create`);
    assert.equal(cleanRecruitmentMaster({ ...updateBase, [key]: 1 }), null, `${key} update`);
  }
});

test("Fair API rejects every legacy KPI input instead of silently ignoring it", async () => {
  let rpcCount = 0;
  const handler = createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    async fetchImpl(url) {
      const target = String(url);
      if (target.includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { id: ACTOR_ID, roleKeys: ["hr.admin"] } });
      }
      if (target.includes("/rest/v1/rpc/nov_talent_mutate_recruitment_master_v1")) {
        rpcCount += 1;
        return Response.json([{ entity_id: uuid(901), entity_version: 2 }]);
      }
      if (target.includes("/rest/v1/")) return Response.json([]);
      throw new Error(`unexpected request: ${target}`);
    }
  });

  for (const key of ["interviewCount", "offerCount", "hireCount"]) {
    for (const operation of ["CREATE", "UPDATE"]) {
      const response = await handler(new Request(
        "https://staging.example.invalid/functions/v1/nov-talent-staging-api/api/talent/v1/masters",
        {
          method: "POST",
          headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}`, "content-type": "application/json" },
          body: JSON.stringify({
            entityType: "FAIR", operation,
            entityId: operation === "UPDATE" ? uuid(901) : null,
            expectedVersion: operation === "UPDATE" ? 1 : null,
            reason: "fixture", fairName: "fixture-fair", eventDate: "2026-08-08", [key]: 0
          })
        }
      ));
      assert.equal(response.status, 400, `${key} ${operation}`);
    }
  }
  assert.equal(rpcCount, 0);
});

test("activity mutations keep Event and Selection responsibilities disjoint", () => {
  const base = {
    candidateId: uuid(1), operation: "CREATE", entityId: null, expectedVersion: null,
    expectedCandidateVersion: 1, reason: "fixture", date: "2026-08-08"
  };
  for (const code of ["CONTACT_RECORDED", "LINE_REGISTERED", "SALON_TOUR_PLANNED", "SALON_TOUR_COMPLETED"]) {
    assert.ok(cleanActivity({ ...base, entityType: "EVENT", code }), `EVENT ${code}`);
  }
  for (const code of ["INTERVIEW_PLANNED", "INTERVIEW_COMPLETED"]) {
    assert.equal(cleanActivity({ ...base, entityType: "EVENT", code }), null, `EVENT ${code} CREATE`);
    assert.equal(cleanActivity({ ...base, entityType: "EVENT", operation: "UPDATE", entityId: uuid(700), expectedVersion: 1, code }), null, `EVENT ${code} UPDATE`);
  }
  for (const code of ["INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "OFFERED"]) {
    assert.ok(cleanActivity({ ...base, entityType: "SELECTION", code }), `SELECTION ${code}`);
  }
  for (const code of ["SALON_TOUR_PLANNED", "SALON_TOUR_COMPLETED"]) {
    assert.equal(cleanActivity({ ...base, entityType: "SELECTION", code }), null, `SELECTION ${code} CREATE`);
    assert.equal(cleanActivity({ ...base, entityType: "SELECTION", operation: "UPDATE", entityId: uuid(701), expectedVersion: 1, code }), null, `SELECTION ${code} UPDATE`);
  }

  assert.ok(cleanActivity({
    ...base, entityType: "EVENT", operation: "DEACTIVATE", entityId: uuid(702), expectedVersion: 1,
    code: "INTERVIEW_COMPLETED"
  }), "legacy Event remains deactivatable");
  assert.equal(cleanActivity({
    ...base, entityType: "SELECTION", operation: "DEACTIVATE", entityId: uuid(703), expectedVersion: 1,
    code: "SALON_TOUR_COMPLETED"
  }), null, "Selection History remains append-only");
});

test("Fair UPDATE RPC payload omits legacy KPI fields instead of writing default zero", async () => {
  const rpcBodies = [];
  const handler = createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    async fetchImpl(url, init = {}) {
      const target = String(url);
      if (target.includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { id: ACTOR_ID, roleKeys: ["hr.admin"] } });
      }
      if (target.includes("/rest/v1/rpc/nov_talent_mutate_recruitment_master_v1")) {
        rpcBodies.push(JSON.parse(String(init.body)));
        return Response.json([{ entity_id: uuid(901), entity_version: 2 }]);
      }
      if (target.includes("/rest/v1/")) return Response.json([]);
      throw new Error(`unexpected request: ${target}`);
    }
  });
  const response = await handler(new Request(
    "https://staging.example.invalid/functions/v1/nov-talent-staging-api/api/talent/v1/masters",
    {
      method: "POST",
      headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}`, "content-type": "application/json" },
      body: JSON.stringify({
        entityType: "FAIR", operation: "UPDATE", entityId: uuid(901), expectedVersion: 1,
        reason: "fixture", fairName: "fixture-fair", eventDate: "2026-08-08",
        participationFee: null, participantCount: 0, contactCount: 0,
        lineRegistrationCount: null, salonTourCount: 1
      })
    }
  ));
  assert.equal(response.status, 200);
  assert.equal(rpcBodies.length, 1);
  const payload = rpcBodies[0].p_payload;
  assert.equal(payload.participationFee, null);
  assert.equal(payload.participantCount, 0);
  assert.equal(payload.contactCount, 0);
  assert.equal(payload.lineRegistrationCount, null);
  assert.equal(payload.salonTourCount, 1);
  assert.equal(Object.hasOwn(payload, "interviewCount"), false);
  assert.equal(Object.hasOwn(payload, "offerCount"), false);
  assert.equal(Object.hasOwn(payload, "hireCount"), false);
});

test("Asia/Tokyo business date includes midnight actions in both dashboard and Workspace tasks", async () => {
  const actions = [
    { next_action_id: uuid(950), candidate_id: uuid(1), action_code: "FOLLOW_UP", due_date: "2026-08-07",
      action_text: "overdue", assigned_to: null, notes: null, state: "OPEN", completed_at: null, version: 1, is_active: true },
    { next_action_id: uuid(951), candidate_id: uuid(2), action_code: "FOLLOW_UP", due_date: "2026-08-08",
      action_text: "today in Tokyo", assigned_to: null, notes: null, state: "OPEN", completed_at: null, version: 1, is_active: true },
    { next_action_id: uuid(952), candidate_id: uuid(3), action_code: "FOLLOW_UP", due_date: "2026-08-09",
      action_text: "tomorrow", assigned_to: null, notes: null, state: "OPEN", completed_at: null, version: 1, is_active: true }
  ];
  // 2026-08-07 15:30 UTC is 2026-08-08 00:30 in Asia/Tokyo.
  const { response, envelope } = await readWorkspace({
    now: () => new Date("2026-08-07T15:30:00.000Z"),
    viewRows: { ...VIEW_ROWS, nov_talent_next_actions_v1: actions }
  });
  assert.equal(response.status, 200);
  assert.equal(envelope.meta.generatedAt, "2026-08-07T15:30:00.000Z");
  assert.equal(envelope.data.dashboard.todayActions, 2);
  assert.deepEqual(envelope.data.todayTasks.map((task) => task.dueDate), ["2026-08-07", "2026-08-08"]);
});

test("facts and actions linked to inactive Candidates never enter metrics, histories, or today tasks", async () => {
  const inactiveCandidateId = uuid(990);
  const inactiveFacts = {
    ...VIEW_ROWS,
    nov_talent_recruitment_events_v1: [
      ...EVENTS,
      event(90, inactiveCandidateId, "CONTACT_RECORDED"),
      event(91, inactiveCandidateId, "LINE_REGISTERED"),
      event(92, inactiveCandidateId, "SALON_TOUR_COMPLETED")
    ],
    nov_talent_selection_history_v1: [
      ...SELECTIONS,
      selection(90, inactiveCandidateId, "APPLICATION_RECEIVED"),
      selection(91, inactiveCandidateId, "INTERVIEW_COMPLETED"),
      selection(92, inactiveCandidateId, "OFFERED")
    ],
    nov_talent_next_actions_v1: [
      { next_action_id: uuid(980), candidate_id: uuid(1), action_code: "FOLLOW_UP", due_date: "2026-08-08",
        action_text: "active candidate", assigned_to: null, notes: null, state: "OPEN", completed_at: null, version: 1, is_active: true },
      { next_action_id: uuid(981), candidate_id: inactiveCandidateId, action_code: "FOLLOW_UP", due_date: "2026-08-08",
        action_text: "inactive candidate", assigned_to: null, notes: null, state: "OPEN", completed_at: null, version: 1, is_active: true }
    ]
  };
  const { response, envelope } = await readWorkspace({
    now: () => new Date("2026-08-07T15:30:00.000Z"), viewRows: inactiveFacts
  });
  assert.equal(response.status, 200);
  assert.equal(envelope.data.summary.contacts, 2);
  assert.equal(envelope.data.summary.lineRegistrations, 1);
  assert.equal(envelope.data.summary.salonTours, 1);
  assert.equal(envelope.data.dashboard.entries, 1);
  assert.equal(envelope.data.dashboard.interviewHistory, 1);
  assert.equal(envelope.data.dashboard.offers, 1);
  assert.equal(envelope.data.dashboard.selectionHistoryCount, 9);
  assert.equal(envelope.data.dashboard.todayActions, 1);
  assert.deepEqual(envelope.data.todayTasks.map((task) => task.candidateId), [uuid(1)]);
  assert.equal(envelope.data.students.some((student) => student.recordId === inactiveCandidateId), false);
});
