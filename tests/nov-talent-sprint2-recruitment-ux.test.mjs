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
const workspace = { students: candidates };

for (const [key, label, code] of [
  ["entries", "エントリー", "CONTACT"], ["salonTours", "見学", "SALON_TOUR"],
  ["interviews", "面接", "INTERVIEW"], ["offers", "内定", "OFFER"],
  ["accepted", "承諾", "PASSED"], ["expectedJoiners", "入社予定", "EXPECTED_JOIN"]
]) {
  test(`Sprint 2 dashboard exposes ${label} from existing ${code} rows`, () => {
    const metric = buildRecruitmentDashboardDecision(workspace).metrics.find((item) => item.key === key);
    assert.equal(metric.label, label);
    assert.equal(metric.value, candidates.filter((candidate) => candidate.statusCode === code).length);
  });
}

test("dashboard puts overdue work in the morning conclusion", () => {
  const view = buildRecruitmentDashboardDecision(workspace, [{ priority: "高" }]);
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
  assert.equal(buildRecruitmentTaskBoard([{ candidateId: "a" }])[0].source, "EXISTING_MOCK_DATA");
});

test("event ROI refuses to estimate missing cost", () => {
  const roi = buildEventRoiView(workspace);
  assert.equal(roi.category, "ROI_UNAVAILABLE_COST_MISSING");
  assert.equal(roi.costAvailable, false);
  assert.equal(roi.estimated, false);
});

for (const [key, label] of [["entryRate", "エントリー到達率"], ["offerRate", "内定到達率"], ["acceptedRate", "承諾到達率"]]) {
  test(`event ROI shows ${label} from existing counts`, () => {
    const metric = buildEventRoiView(workspace).metrics.find((item) => item.key === key);
    assert.equal(metric.label, label);
    assert.match(metric.value, /^\d+%$/);
  });
}

test("candidate history summary separates three history types", () => {
  const summary = buildCandidateHistorySummary(candidates[3]);
  assert.equal(summary.total, summary.contactCount + summary.eventCount + summary.selectionCount);
});

for (const state of ["loading", "ready", "empty", "unauthorized", "forbidden", "validation_error", "timeout", "offline", "maintenance"]) {
  test(`Mock Runtime presents ${state} with an operator message`, () => {
    const view = buildMockRuntimePresentation(state);
    assert.ok(view.title.length > 0);
    assert.ok(view.copy.length > 0);
    assert.equal(view.category, state.toUpperCase());
  });
}

test("unknown Mock Runtime states fail closed as validation errors", () => {
  assert.equal(buildMockRuntimePresentation("unknown").category, "VALIDATION_ERROR");
});

test("Sprint 2 UI orders the morning conclusion before six metrics and tasks", async () => {
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
