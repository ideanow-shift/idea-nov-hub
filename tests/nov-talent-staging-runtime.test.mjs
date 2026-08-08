import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCandidateSummary,
  buildCandidateWorkspace,
  resolveTalentAccessProfile,
  validateCandidateDatasetRows
} from "../supabase/functions/nov-talent-staging-readonly-api/domain.ts";
import { createHandler } from "../supabase/functions/nov-talent-staging-readonly-api/index.ts";
import {
  loadTalentStudentWorkspace,
  resetTalentStudentWorkspaceForFixture,
  runTalentWorkspaceRenderPipeline
} from "../portal/talent/app.mjs";
import { createTalentWorkspaceExecutor, readNovTalentRuntime } from "../portal/talent/runtime.mjs";

function uuid(index) {
  return `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function rows() {
  return Array.from({ length: 636 }, (_, index) => ({
    candidate_id: uuid(index + 1),
    graduation_year: index < 528 ? 2027 : 2028,
    source_type: index < 528 ? "CONTACTS_27" : "CONTACTS_28",
    source_row_no: index + 1,
    student_name: `候補者${index + 1}`,
    student_name_kana: null,
    school_name: `学校${(index % 12) + 1}`,
    faculty_name: null,
    phone: "000-0000-0000",
    email: `candidate${index + 1}@example.invalid`,
    line_identifier: index % 2 ? null : `line-${index + 1}`
  }));
}

function fakeElement(tagName = "div") {
  const attributes = new Map();
  return {
    tagName: String(tagName).toUpperCase(),
    dataset: {},
    children: [],
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    className: "",
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    addEventListener() {},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    focus() {},
    scrollIntoView() {}
  };
}

function fakeDocument() {
  const elements = new Map();
  return {
    createElement(tagName) { return fakeElement(tagName); },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, fakeElement());
      return elements.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

test("formal HUB roles resolve without inventing a Staging role", () => {
  assert.equal(resolveTalentAccessProfile(["hr.admin"]), "full");
  assert.equal(resolveTalentAccessProfile(["backoffice"]), "full");
  assert.equal(resolveTalentAccessProfile(["hr.staff"]), "recruiter");
  assert.equal(resolveTalentAccessProfile(["executive"]), "executive");
  assert.equal(resolveTalentAccessProfile(["employee"]), null);
});

test("636 ACTIVE Candidate rows build the candidate-only summary and workspace", () => {
  const normalized = validateCandidateDatasetRows(rows());
  assert.equal(normalized.length, 636);
  assert.deepEqual(buildCandidateSummary(normalized), {
    contacts: 636,
    lineRegistrations: 318,
    salonTours: 0,
    interviews: 0,
    passed: 0,
    offers: 0,
    expectedJoiners: 0
  });
  const workspace = buildCandidateWorkspace(normalized, "recruiter");
  assert.equal(workspace.students.length, 636);
  assert.equal(workspace.overview.total, 636);
  assert.equal(workspace.students.filter((row) => row.sourceCode === "CONTACTS_27").length, 528);
  assert.equal(workspace.students.filter((row) => row.sourceCode === "CONTACTS_28").length, 108);
});

test("636 Candidate response completes every frontend render stage before loading is released", () => {
  const workspace = buildCandidateWorkspace(validateCandidateDatasetRows(rows()), "recruiter");
  const completed = [];
  const result = runTalentWorkspaceRenderPipeline({
    stages: [
      "renderStudentMonthFilterOptions",
      "renderStudentWorkspace",
      "renderImportOverview",
      "renderHistoricalReviewSummary",
      "renderBulkTriageSummary",
      "renderTalentAnalytics",
      "renderTodayTasks"
    ].map((name) => ({
      name,
      render() {
        assert.equal(workspace.students.length, 636);
        completed.push(name);
      }
    }))
  });

  assert.equal(result.ok, true);
  assert.equal(result.failedStage, null);
  assert.equal(result.completedStageCount, 7);
  assert.equal(completed.length, 7);
});

test("frontend render boundary reports the exact failed stage without logging Candidate data", () => {
  const messages = [];
  const result = runTalentWorkspaceRenderPipeline({
    logger: { error(message) { messages.push(message); } },
    stages: [
      { name: "renderStudentWorkspace", render() { throw new Error("fixture-private-value-must-not-be-logged"); } },
      { name: "renderTalentAnalytics", render() { assert.fail("later stages must not run"); } }
    ]
  });

  assert.equal(result.ok, false);
  assert.equal(result.failedStage, "renderStudentWorkspace");
  assert.deepEqual(messages, ["[NOV Talent] Candidate rendering failed: renderStudentWorkspace"]);
  assert.doesNotMatch(messages.join(" "), /fixture-private-value/u);
});

test("636 Candidate API response renders through the real frontend pipeline", async () => {
  resetTalentStudentWorkspaceForFixture();
  const candidateWorkspace = buildCandidateWorkspace(validateCandidateDatasetRows(rows()), "recruiter");
  const workspace = {
    ...candidateWorkspace,
    accessProfile: "executive",
    canWrite: false,
    summary: {
      contacts: 636, lineRegistrations: 318, salonTours: 0, interviews: 0,
      passed: 0, offers: 35, expectedJoiners: 0
    },
    partialStatus: { state: "complete", unavailableViews: [], retryCount: 0 },
    schoolMasters: [],
    fairMasters: [
      { fair_id: uuid(701), fair_name: "未登録値テスト", event_date: "2026-08-03", participation_fee: null,
        venue: null, assigned_to: null, participant_count: null, contact_count: null,
        line_registration_count: null, salon_tour_count: null, interview_count: null,
        offer_count: null, hire_count: null, version: 1, is_active: true, organizer_name: null,
        event_format: null, expected_contacts: null, total_attendance: null, participating_salons: null,
        note: null, created_at: "2026-08-03T00:00:00.000Z" },
      { fair_id: uuid(702), fair_name: "確定ゼロテスト", event_date: "2026-08-02", participation_fee: 0,
        venue: null, assigned_to: null, participant_count: 0, contact_count: 0,
        line_registration_count: 0, salon_tour_count: 0, interview_count: 0,
        offer_count: 0, hire_count: 0, version: 1, is_active: true, organizer_name: null,
        event_format: null, expected_contacts: 0, total_attendance: 0, participating_salons: 0,
        note: null, created_at: "2026-08-02T00:00:00.000Z" },
      { fair_id: uuid(703), fair_name: "確定値テスト", event_date: "2026-08-01", participation_fee: 50000,
        venue: null, assigned_to: null, participant_count: 12, contact_count: 10,
        line_registration_count: 8, salon_tour_count: 3, interview_count: 2,
        offer_count: 1, hire_count: 1, version: 1, is_active: true, organizer_name: "運営会社",
        event_format: "対面", expected_contacts: 10, total_attendance: 100, participating_salons: 12,
        note: null, created_at: "2026-08-01T00:00:00.000Z" }
    ],
    todayTasks: [{ assignedTo: null, candidateId: uuid(1), dueDate: "2026-08-04", label: "契約済み対応" }],
    unlinkedSelectionHistory: [],
    dashboard: {
      availability: {
        candidateCount: true, entries: true, eventCount: true, fairCount: true,
        graduation2027: true, graduation2028: true, interviewHistory: true, interviewPlanned: true,
        lineRegistrations: true, offeredElsewhere: true, offers: true, rejected: true,
        salonTourCompleted: true, salonTourPlanned: false, schoolCount: true,
        todayActions: true, withdrawals: true
      },
      candidateCount: 636, entries: 42, eventCount: 672, fairCount: 45,
      graduation2027: 528, graduation2028: 108, interviewHistory: 42, interviewPlanned: 0,
      lineRegistrations: 318, offeredElsewhere: 0, offers: 35, rejected: 5,
      salonTourCompleted: 0, salonTourPlanned: 0, schoolCount: 1,
      selectionHistoryCount: 126, todayActions: 1, undatedActions: 0,
      unlinkedInterviewHistoryCount: 42, withdrawals: 2
    },
    students: candidateWorkspace.students.map((student) => ({ ...student, schoolId: null, fairId: null, nextActions: [] }))
  };
  const documentObject = fakeDocument();
  const consoleMessages = [];
  const globalObject = {
    AbortController,
    console: { error(message) { consoleMessages.push(message); } },
    NOV_TALENT_CONFIG: {
      runtimeMode: "staging",
      networkEnabled: true,
      writeEnabled: false,
      readonlyApiEnabled: true,
      workspaceContractVersion: "1.0.0",
      workspaceContractCompatibility: "legacy-v0-read",
      readonlyApiBaseUrl: "https://staging.example.invalid/functions/v1/nov-talent-staging-api",
      features: { stagingCandidateDataset: true }
    },
    NovHubSession: {
      async getSessionToken() { return "fixture-session-token-value-not-real"; }
    },
    async fetch() {
      return Response.json({
        ok: true,
        data: workspace,
        meta: {
          generatedAt: "2026-08-04T00:00:00.000Z",
          requestId: "fixture-render-636",
          source: "fixture",
          version: "2"
        }
      });
    }
  };

  const result = await loadTalentStudentWorkspace({ globalObject, documentObject });

  assert.equal(result.executed, true, JSON.stringify({ result, consoleMessages }));
  assert.equal(result.studentCount, 636);
  assert.deepEqual(consoleMessages, []);
  assert.equal(documentObject.getElementById("mock-runtime-state").hidden, true);
  assert.equal(documentObject.getElementById("student-status").dataset.state, "ready");
  assert.equal(documentObject.getElementById("student-list").children.length, 636);
  assert.equal(documentObject.getElementById("fair-master-body").children.length, 3);
  assert.match(documentObject.getElementById("fair-master-body").children[0].innerHTML, /未登録/u);
  assert.match(documentObject.getElementById("fair-master-body").children[1].innerHTML, />0件</u);
  assert.equal(documentObject.getElementById("today-task-list").children.length, 1);
  assert.match(documentObject.getElementById("today-task-list").children[0].children[0].innerHTML, /契約済み対応[\s\S]*2026-08-04/u);
  resetTalentStudentWorkspaceForFixture();
});

test("concurrent workspace initialization shares one in-flight Promise", async () => {
  resetTalentStudentWorkspaceForFixture();
  const documentObject = fakeDocument();
  const globalObject = {
    AbortController,
    console,
    location: { search: "" },
    NOV_TALENT_CONFIG: { runtimeMode: "mock", mockState: "ready" }
  };
  const first = loadTalentStudentWorkspace({ globalObject, documentObject });
  const second = loadTalentStudentWorkspace({ globalObject, documentObject });
  assert.equal(first, second);
  const result = await first;
  assert.equal(result.studentRowsReturned, true);
  resetTalentStudentWorkspaceForFixture();
});

test("executive payload removes private contact fields server-side", () => {
  const workspace = buildCandidateWorkspace(validateCandidateDatasetRows(rows()), "executive");
  assert.ok(workspace.students.every((row) => row.phone === null && row.email === null));
});

test("read-only API verifies HUB role before exact ACTIVE dataset reads", async () => {
  const sourceRows = rows();
  const calls = [];
  const handler = createHandler({
    hubApiUrl: "https://hub.example.invalid/functions/v1/nov-hub-api",
    supabaseUrl: "https://staging.example.invalid",
    serviceRoleKey: "server-only-fixture",
    async fetchImpl(url, init) {
      calls.push({ url: String(url), method: init.method });
      if (String(url).includes("nov-hub-api")) {
        return Response.json({ ok: true, employee: { roleKeys: ["hr.staff"] } });
      }
      if (String(url).includes("nov_talent_candidate_datasets_v1")) {
        return Response.json([{ dataset_id: uuid(999), actual_candidate_count: 636, actual_2027_count: 528, actual_2028_count: 108 }]);
      }
      return Response.json(sourceRows);
    }
  });
  const response = await handler(new Request(
    "https://staging.example.invalid/functions/v1/nov-talent-staging-readonly-api/api/talent/v1/workspace?fiscalYear=current",
    { headers: { origin: "https://ideanow-shift.github.io", authorization: `Bearer ${"a".repeat(32)}` } }
  ));
  const envelope = await response.json();
  assert.equal(response.status, 200);
  assert.equal(envelope.data.students.length, 636);
  assert.deepEqual(calls.map(({ method }) => method), ["POST", "GET", "GET"]);
});

test("feature flag can switch between Staging and retained Mock runtime", () => {
  const staging = readNovTalentRuntime({ globalObject: { NOV_TALENT_CONFIG: {
    runtimeMode: "staging", networkEnabled: true, writeEnabled: true, readonlyApiEnabled: true,
    workspaceContractVersion: "1.0.0", workspaceContractCompatibility: "legacy-v0-read",
    features: { stagingCandidateDataset: true }
  } } });
  const mock = readNovTalentRuntime({ globalObject: { NOV_TALENT_CONFIG: { runtimeMode: "mock", mockState: "ready" } } });
  assert.equal(staging.mode, "staging");
  assert.equal(staging.writeEnabled, true);
  assert.equal(mock.mode, "mock");
  assert.equal(mock.networkEnabled, false);
});

test("Staging runtime injects the module session contract without a window global", async () => {
  const requests = [];
  const globalObject = {
    NOV_TALENT_CONFIG: {
      runtimeMode: "staging",
      networkEnabled: true,
      writeEnabled: false,
      readonlyApiEnabled: true,
      workspaceContractVersion: "1.0.0",
      workspaceContractCompatibility: "legacy-v0-read",
      readonlyApiBaseUrl: "https://staging.example.invalid/functions/v1/nov-talent-staging-api",
      features: { stagingCandidateDataset: true }
    },
    NovHubSession: {
      async getSessionToken() {
        return "fixture-session-token-value-not-real";
      }
    },
    async fetch(url, init) {
      requests.push({ url: String(url), authorization: init.headers.Authorization });
      return Response.json(
        { ok: false, safeCode: "AUTH_REQUIRED", message: "safe", requestId: "fixture" },
        { status: 401 }
      );
    }
  };

  assert.equal(globalObject.NOV_HUB_SESSION_CONTRACT, undefined);
  const executor = createTalentWorkspaceExecutor({ globalObject });
  assert.ok(executor);
  const result = await executor.run();

  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/api\/talent\/v1\/workspace\?fiscalYear=current$/);
  assert.equal(requests[0].authorization, "Bearer fixture-session-token-value-not-real");
  assert.equal(result.httpStatus, 401);
  assert.equal(result.stopCategory, "auth_required");
});

test("published config exposes no server credential and only a server-side write endpoint", () => {
  const config = readFileSync(new URL("../portal/talent/runtime-config.candidate.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  assert.match(config, /runtimeMode:\s*"staging"/);
  assert.match(config, /stagingCandidateDataset:\s*true/);
  assert.match(config, /writeEnabled:\s*true/);
  assert.match(config, /writeApiBaseUrl/);
  assert.doesNotMatch(config, /service_role|serviceRole|password|secret/i);
  assert.match(html, /app\.mjs\?v=20260808-selection-coverage-hotfix-1/);
});
