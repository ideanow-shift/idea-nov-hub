import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCandidateHistorySummary,
  buildEventRoiView,
  buildMockRuntimePresentation,
  buildRecruitmentDashboardDecision,
  buildRecruitmentTaskBoard
} from "../portal/talent/recruitment-ux.mjs";
import { buildAnonymousTalentSeeds } from "../portal/talent/mock-seeds.mjs";

const candidates = buildAnonymousTalentSeeds({ now: new Date("2026-08-01T12:00:00+09:00") }).candidates;
const workspace = {
  students: candidates,
  summary: { contacts: 84 },
  dashboard: {
    candidateCount: 147,
    entries: 42,
    salonTourPlanned: 9,
    interviewPlanned: 7,
    offers: 35,
    withdrawals: 2,
    schoolCount: 5,
    fairCount: 45,
    availability: {
      candidateCount: true, eventCount: true, entries: true, salonTourPlanned: true, interviewPlanned: true,
      offers: true, withdrawals: true, schoolCount: true, fairCount: true, todayActions: false
    }
  }
};

for (const [key, label, value] of [
  ["candidateCount", "学生", 147], ["entries", "応募", 42],
  ["salonTourPlanned", "見学予定", 9], ["interviewPlanned", "面接予定", 7],
  ["offers", "内定", 35], ["withdrawals", "辞退", 2],
  ["schoolCount", "学校", 5], ["fairCount", "フェア", 45]
]) {
  test(`Recruiting Dashboard exposes ${label} from the server aggregation`, () => {
    const metric = buildRecruitmentDashboardDecision(workspace).metrics.find((item) => item.key === key);
    assert.equal(metric.label, label);
    assert.equal(metric.value, value);
  });
}

test("unconnected dashboard metrics show 集計準備中 instead of a false zero", () => {
  const preparing = {
    ...workspace,
    dashboard: { ...workspace.dashboard, availability: { ...workspace.dashboard.availability, salonTourPlanned: false } }
  };
  const metric = buildRecruitmentDashboardDecision(preparing).metrics.find((item) => item.key === "salonTourPlanned");
  assert.equal(metric.value, "集計準備中");
});

test("dashboard puts overdue work in the morning conclusion", () => {
  const view = buildRecruitmentDashboardDecision(workspace, [{ dueDate: "2026-07-31" }], "2026-08-01");
  assert.equal(view.category, "OVERDUE_FIRST");
  assert.match(view.title, /期限超過/);
});

test("dashboard puts review work before offer follow-up", () => {
  const view = buildRecruitmentDashboardDecision(workspace, []);
  assert.equal(view.category, "REVIEW_FIRST");
});

test("dashboard explains the empty state", () => {
  const view = buildRecruitmentDashboardDecision({ students: [] }, []);
  assert.equal(view.category, "EMPTY");
  assert.match(view.title, /まだありません/);
});

test("dashboard decision never includes raw values", () => {
  assert.equal(buildRecruitmentDashboardDecision(workspace).rawValuesIncluded, false);
});

test("today task board keeps at most five existing tasks", () => {
  const tasks = Array.from({ length: 8 }, (_, index) => ({ candidateId: `mock-${index}` }));
  assert.equal(buildRecruitmentTaskBoard(tasks).length, 5);
});

test("today task board preserves source order", () => {
  const tasks = [{ candidateId: "a" }, { candidateId: "b" }];
  assert.deepEqual(buildRecruitmentTaskBoard(tasks).map((task) => task.candidateId), ["a", "b"]);
});

test("today task board identifies existing data as its only source", () => {
  assert.equal(buildRecruitmentTaskBoard([{ candidateId: "a" }])[0].source, "STAGING_NEXT_ACTION");
});

test("Fair ROI waits for confirmed Fair origin attribution", () => {
  const roi = buildEventRoiView(workspace);
  assert.equal(roi.category, "FAIR_ATTRIBUTION_PREPARING");
  assert.match(roi.title, /フェア起点確認後/u);
  assert.equal(roi.costAvailable, false);
  assert.equal(roi.estimated, false);
});

for (const [key, label] of [["entryRate", "応募到達率"], ["offerRate", "内定到達率"]]) {
  test(`Fair ROI keeps ${label} preparing even when global Selection totals exist`, () => {
    const metric = buildEventRoiView(workspace).metrics.find((item) => item.key === key);
    assert.equal(metric.label, label);
    assert.equal(metric.value, "集計準備中");
  });
}

test("Fair ROI never uses Candidate or global Event count as its denominator", () => {
  const metric = buildEventRoiView({
    ...workspace,
    summary: { contacts: 2 },
    dashboard: { ...workspace.dashboard, candidateCount: 10, entries: 1 }
  }).metrics.find((item) => item.key === "entryRate");
  assert.equal(metric.value, "集計準備中");
});

test("Fair ROI does not promote a global confirmed zero to a Fair-specific rate", () => {
  const roi = buildEventRoiView({
    ...workspace,
    summary: { contacts: 0 },
    dashboard: { ...workspace.dashboard, entries: 0, offers: 0 }
  });
  assert.equal(roi.category, "FAIR_ATTRIBUTION_PREPARING");
  assert.equal(roi.metrics.find((item) => item.key === "entryRate").value, "集計準備中");
});

test("event ROI keeps the unconnected acceptance rate in preparing state", () => {
  assert.equal(buildEventRoiView(workspace).metrics.find((item) => item.key === "acceptedRate").value, "集計準備中");
});

test("candidate history summary separates three history types", () => {
  const summary = buildCandidateHistorySummary(candidates[3]);
  assert.equal(summary.total, summary.contactCount + summary.eventCount + summary.selectionCount);
});

for (const state of ["loading", "ready", "empty", "auth_required", "unauthorized", "forbidden", "api_error", "invalid_response", "validation_error", "timeout", "offline", "maintenance"]) {
  test(`Mock Runtime presents ${state} with an operator message`, () => {
    const view = buildMockRuntimePresentation(state);
    assert.ok(view.title.length > 0);
    assert.ok(view.copy.length > 0);
    assert.equal(view.category, state.toUpperCase());
  });
}

test("unknown runtime states fail closed as API errors", () => {
  assert.equal(buildMockRuntimePresentation("unknown").category, "API_ERROR");
});

test("Staging authentication and API failures are not mislabeled as Mock format errors", () => {
  for (const state of ["auth_required", "forbidden", "api_error", "invalid_response"]) {
    const view = buildMockRuntimePresentation(state);
    assert.doesNotMatch(`${view.title} ${view.copy}`, /Mockデータの形式|入力形式を直して/);
  }
});

test("Recruiting Dashboard orders the morning conclusion before eight metrics and tasks", async () => {
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const decision = html.indexOf('id="recruitment-decision-summary"');
  const metrics = html.indexOf('id="historical-summary-metrics"');
  const tasks = html.indexOf('id="today-task-list"');
  assert.ok(decision > 0 && decision < metrics && metrics < tasks);
});

test("Sprint 2 mobile CSS prevents horizontal page overflow", async () => {
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  assert.match(css, /body[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*event-roi-metrics[\s\S]*grid-template-columns:\s*1fr/);
});

test("Sprint 2 remains Mock-only and does not import Supabase", async () => {
  const runtime = await readFile(new URL("../portal/talent/runtime.mjs", import.meta.url), "utf8");
  const app = await readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(`${runtime}\n${app}`, /createClient|supabase-js|SUPABASE_URL/);
});
