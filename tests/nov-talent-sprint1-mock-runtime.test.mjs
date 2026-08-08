import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildAnonymousTalentSeeds, MOCK_SEED_INVENTORY } from "../portal/talent/mock-seeds.mjs";
import { createNovTalentMockRepository, MOCK_RUNTIME_STATES } from "../portal/talent/mock-repository.mjs";
import { createDashboardSummaryExecutor, createTalentWorkspaceExecutor, readNovTalentRuntime } from "../portal/talent/runtime.mjs";

const root = new URL("../portal/talent/", import.meta.url);

test("Sprint 1 seed is anonymous and preserves only cohort counts", () => {
  const seed = buildAnonymousTalentSeeds({ now: new Date("2026-07-31T12:00:00+09:00") });
  assert.deepEqual(MOCK_SEED_INVENTORY, {
    source27Rows: 27,
    source28Rows: 120,
    totalRows: 147,
    containsRealPersonalValues: false,
    sourceFilesMutated: false
  });
  assert.equal(seed.source27.length, 27);
  assert.equal(seed.source28.length, 120);
  assert.equal(seed.candidates.length, 147);
  assert.ok(seed.candidates.every((candidate) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u.test(candidate.recordId)));
  assert.ok(seed.candidates.every((candidate) => candidate.phone === "" && candidate.email === ""));
  assert.ok(seed.candidates.every((candidate) => /^(学生|架空|学校未設定|採用)/.test(`${candidate.displayName}${candidate.school}${candidate.assignee}`)));
});

test("Mock Runtime returns dashboard, candidates and at most five tasks without I/O", async () => {
  const globalObject = {
    NOV_TALENT_CONFIG: { mockState: "ready" },
    location: { search: "" }
  };
  const runtime = readNovTalentRuntime({ globalObject });
  assert.equal(runtime.mode, "mock");
  assert.equal(runtime.networkEnabled, false);
  assert.equal(runtime.writeEnabled, false);

  const summary = await createDashboardSummaryExecutor({ globalObject }).run();
  const workspace = await createTalentWorkspaceExecutor({ globalObject }).run();
  assert.equal(summary.okBoolean, true);
  assert.equal(summary.networkOperationCount, 0);
  assert.equal(summary.requestCount, 0);
  assert.equal(workspace.data.students.length, 147);
  assert.ok(workspace.data.todayTasks.length <= 5);
  assert.ok(workspace.data.todayTasks.every((task) => (
    Object.keys(task).sort().join(",") === "assignedTo,candidateId,dueDate,label"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/u.test(task.candidateId)
    && /^\d{4}-\d{2}-\d{2}$/u.test(task.dueDate)
  )));
  assert.equal(workspace.networkOperationCount, 0);
});

test("Mock expected joiners use Candidate current-state projection, never an invented Selection code", async () => {
  const now = new Date("2026-08-08T12:00:00+09:00");
  const seed = buildAnonymousTalentSeeds({ now });
  const result = await createNovTalentMockRepository({ state: "ready", now }).getSummary();
  assert.equal(result.data.summary.expectedJoiners, seed.candidates.filter((candidate) => candidate.statusCode === "EXPECTED_JOIN").length);
  assert.ok(seed.candidates.every((candidate) => !(candidate.selectionHistory || []).some((fact) => fact.code === "EXPECTED_JOIN")));
});

test("Mock Runtime exposes every required safe state", async () => {
  assert.deepEqual(MOCK_RUNTIME_STATES, [
    "loading", "ready", "empty", "unauthorized", "forbidden",
    "validation_error", "timeout", "offline", "maintenance"
  ]);
  for (const state of MOCK_RUNTIME_STATES) {
    const repository = createNovTalentMockRepository({ state });
    const result = await repository.getWorkspace();
    assert.equal(result.state, state);
    assert.equal(result.ok, state === "ready" || state === "empty");
    if (state === "empty") assert.equal(result.data.students.length, 0);
  }
});

test("Published shell uses the approved server-side Staging runtime and retains Mock fallback", async () => {
  const [html, app, config, css] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.mjs", root), "utf8"),
    readFile(new URL("runtime-config.candidate.js", root), "utf8"),
    readFile(new URL("style.css", root), "utf8")
  ]);
  assert.match(html, /運用データ/);
  assert.match(html, /学生一覧/);
  assert.doesNotMatch(html, /data-primary-tab="workforce"/);
  assert.match(html, /id="panel-workforce" class="primary-panel sprint1-separated"/);
  assert.match(app, /from "\.\/runtime\.mjs\?v=20260808-fair-preparation-ui-1"/);
  assert.doesNotMatch(app, /^import .*exact1/m);
  assert.doesNotMatch(app, /^import .*current-api/m);
  assert.match(config, /runtimeMode: "staging"/);
  assert.match(config, /networkEnabled: true/);
  assert.match(config, /readonlyApiEnabled: true/);
  assert.match(config, /stagingCandidateDataset: true/);
  assert.match(config, /writeEnabled: true/);
  assert.doesNotMatch(`${app}\n${config}`, /service[_-]?role|SUPABASE_SERVICE_ROLE_KEY|createClient/i);
  assert.match(css, /\.sprint1-separated/);
  assert.match(css, /@media \(max-width: 520px\)/);
});
