import assert from "node:assert/strict";
import test from "node:test";

import { buildTalentInitialLoadPlan, buildWorkspaceDashboardSummaryViewModel } from "../portal/talent/app.mjs";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR_ID = "10000000-0000-4000-8000-000000000999";

function uuid(index) {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function candidates() {
  return Array.from({ length: 636 }, (_, index) => ({
    candidate_id: uuid(index + 1), graduation_year: index < 528 ? 2027 : 2028,
    student_name: `fixture-${index + 1}`, student_name_kana: null,
    school_id: null, fair_id: null, school_name: "fixture-school", faculty_name: null,
    phone: null, email: null, line_identifier: null, current_status_code: "LINE_REGISTERED",
    acquisition_source: null, assigned_to: null, notes: null,
    source_type: index < 528 ? "CONTACTS_27" : "CONTACTS_28",
    source_row_no: index + 1, version: 1, is_active: true
  }));
}

function events() {
  return [
    ...Array.from({ length: 465 }, (_, index) => ({ event_id: uuid(2000 + index), candidate_id: uuid(index + 1), event_code: "LINE_REGISTERED", event_date: "2026-08-01", event_name: null, event_state: "COMPLETED", contact_content: null, assigned_to: null, notes: null, version: 1, is_active: true })),
    ...Array.from({ length: 188 }, (_, index) => ({ event_id: uuid(3000 + index), candidate_id: uuid(index + 1), event_code: "SALON_TOUR_COMPLETED", event_date: "2026-08-01", event_name: null, event_state: "COMPLETED", contact_content: null, assigned_to: null, notes: null, version: 1, is_active: true })),
    ...Array.from({ length: 59 }, (_, index) => ({ event_id: uuid(4000 + index), candidate_id: uuid(index + 1), event_code: "CONTACT_RECORDED", event_date: "2026-08-01", event_name: null, event_state: "COMPLETED", contact_content: null, assigned_to: null, notes: null, version: 1, is_active: true }))
  ];
}

function fairs() {
  return Array.from({ length: 46 }, (_, index) => ({
    fair_id: uuid(5000 + index), fair_name: `fixture-fair-${index + 1}`, event_date: "2026-08-01",
    participation_fee: null, venue: null, assigned_to: null, participant_count: null,
    contact_count: null, line_registration_count: null, salon_tour_count: null,
    interview_count: null, offer_count: null, hire_count: null, organizer_name: null,
    event_format: null, expected_contacts: null, total_attendance: null,
    participating_salons: null, note: null, created_at: "2026-08-01T00:00:00.000Z",
    version: 1, is_active: true
  }));
}

const VIEW_ROWS = Object.freeze({
  nov_talent_candidates_v1: candidates(),
  nov_talent_recruitment_events_v1: events(),
  nov_talent_selection_history_v1: [],
  nov_talent_next_actions_v1: [],
  nov_talent_fair_metrics_v1: [],
  nov_talent_recruitment_source_facts_v1: [],
  nov_talent_school_masters_v1: [],
  nov_talent_fair_masters_v1: fairs()
});

function viewName(url) {
  return Object.keys(VIEW_ROWS).find((name) => String(url).includes(name)) || null;
}

function createFixture({ failView = null, failStatus = 503, failCount = 0 } = {}) {
  const counts = new Map();
  const logs = [];
  const handler = createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    logger: { error(message) { logs.push(message); } },
    async fetchImpl(url) {
      if (String(url).includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { id: ACTOR_ID, roleKeys: ["hr.staff"] } });
      }
      const view = viewName(url);
      assert.ok(view, `unexpected downstream URL category: ${new URL(String(url)).pathname}`);
      const nextCount = (counts.get(view) || 0) + 1;
      counts.set(view, nextCount);
      if (view === failView && nextCount <= failCount) {
        return Response.json({ private: "must-not-be-logged" }, { status: failStatus });
      }
      return Response.json(VIEW_ROWS[view]);
    }
  });
  return { handler, counts, logs };
}

function request(path = "workspace") {
  return new Request(`https://staging.example.invalid/functions/v1/nov-talent-staging-api/api/talent/v1/${path}`,
    { headers: { origin: ORIGIN, authorization: `Bearer ${"a".repeat(32)}` } });
}

test("Staging startup selects Workspace as the only initial data request", () => {
  const staging = buildTalentInitialLoadPlan({ NOV_TALENT_CONFIG: {
    runtimeMode: "staging", networkEnabled: true, writeEnabled: false, readonlyApiEnabled: true,
    features: { stagingCandidateDataset: true }
  } });
  const mock = buildTalentInitialLoadPlan({ NOV_TALENT_CONFIG: { runtimeMode: "mock" } });
  assert.deepEqual(staging, { workspace: true, standaloneSummary: false });
  assert.deepEqual(mock, { workspace: true, standaloneSummary: true });
});

test("Workspace fetches Candidate and every auxiliary view once and returns operational counts", async () => {
  const fixture = createFixture();
  const response = await fixture.handler(request());
  const envelope = await response.json();
  assert.equal(response.status, 200);
  assert.equal(envelope.data.students.length, 636);
  assert.equal(envelope.data.dashboard.graduation2027, 528);
  assert.equal(envelope.data.dashboard.graduation2028, 108);
  assert.equal(envelope.data.dashboard.fairCount, 46);
  assert.equal(envelope.data.dashboard.eventCount, 712);
  assert.equal(envelope.data.summary.lineRegistrations, 465);
  assert.equal(envelope.data.summary.salonTours, 188);
  assert.equal(envelope.data.partialStatus.state, "complete");
  for (const name of Object.keys(VIEW_ROWS)) assert.equal(fixture.counts.get(name), 1, name);
});

test("one temporary auxiliary failure retries once and still returns complete HTTP 200", async () => {
  const fixture = createFixture({ failView: "nov_talent_fair_metrics_v1", failCount: 1 });
  const response = await fixture.handler(request());
  const envelope = await response.json();
  assert.equal(response.status, 200);
  assert.equal(envelope.data.partialStatus.state, "complete");
  assert.equal(envelope.data.partialStatus.retryCount, 1);
  assert.equal(fixture.counts.get("nov_talent_fair_metrics_v1"), 2);
  assert.deepEqual(fixture.logs, []);
});

test("persistent auxiliary failure returns HTTP 200 partial and safe fixed-category log", async () => {
  const fixture = createFixture({ failView: "nov_talent_fair_metrics_v1", failCount: 2 });
  const response = await fixture.handler(request());
  const envelope = await response.json();
  assert.equal(response.status, 200);
  assert.equal(envelope.data.partialStatus.state, "partial");
  assert.deepEqual(envelope.data.partialStatus.unavailableViews, ["fair_metrics"]);
  assert.equal(fixture.counts.get("nov_talent_fair_metrics_v1"), 2);
  assert.equal(fixture.logs.length, 1);
  const safeLog = JSON.parse(fixture.logs[0]);
  assert.equal(safeLog.failed_view, "fair_metrics");
  assert.equal(safeLog.retry_count, 1);
  assert.equal(safeLog.partial, true);
  assert.doesNotMatch(fixture.logs[0], /must-not-be-logged|fixture-/u);
});

test("mandatory Candidate failure alone returns 503 and retry remains max one", async () => {
  const fixture = createFixture({ failView: "nov_talent_candidates_v1", failCount: 2 });
  const response = await fixture.handler(request());
  assert.equal(response.status, 503);
  assert.equal(fixture.counts.get("nov_talent_candidates_v1"), 2);
  assert.equal(fixture.counts.has("nov_talent_recruitment_events_v1"), false);
  const safeLog = JSON.parse(fixture.logs[0]);
  assert.equal(safeLog.failed_view, "candidates");
  assert.equal(safeLog.fatal, true);
});

test("non-retryable downstream 4xx is attempted once", async () => {
  const fixture = createFixture({ failView: "nov_talent_school_masters_v1", failStatus: 400, failCount: 1 });
  const response = await fixture.handler(request());
  const envelope = await response.json();
  assert.equal(response.status, 200);
  assert.equal(envelope.data.partialStatus.state, "partial");
  assert.equal(fixture.counts.get("nov_talent_school_masters_v1"), 1);
});

test("partial summary renders affected cards as preparing without converting them to zero", () => {
  const viewModel = buildWorkspaceDashboardSummaryViewModel({
    summary: { contacts: 636, lineRegistrations: 0, salonTours: 0, interviews: 0, passed: 0, offers: 0, expectedJoiners: 0 },
    partialStatus: { state: "partial", unavailableViews: ["recruitment_events"], retryCount: 1 }
  });
  assert.equal(viewModel.find((metric) => metric.key === "contacts").value, 636);
  assert.equal(viewModel.find((metric) => metric.key === "lineRegistrations").value, "集計準備中");
  assert.equal(viewModel.find((metric) => metric.key === "salonTours").value, "集計準備中");
});
