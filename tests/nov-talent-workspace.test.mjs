import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createTalentWorkspaceExact1Executor } from "../portal/talent/exact1.mjs";
import { createTalentWorkspaceExecutor } from "../portal/talent/runtime.mjs";

const root = new URL("../", import.meta.url);

function globalFixture() {
  return {
    NOV_TALENT_CONFIG: {
      readonlyApiEnabled: true,
      readonlyApiBaseUrl:
        "https://example.test/functions/v1/nov-talent-readonly-api-v2"
    },
    NOV_HUB_SESSION_CONTRACT: { audience: "nov_hub" },
    NovHubSession: {
      async getSessionToken() {
        return "fixture-session-token-value-not-real";
      }
    }
  };
}

function student(overrides = {}) {
  return {
    applicationNo: null,
    recordId: "00000000-0000-4000-8000-000000000001",
    displayName: "表示用氏名",
    kana: "ヒョウジヨウシメイ",
    school: "表示用学校",
    phone: null,
    email: null,
    preferredStore: null,
    sourceCode: "CONTACTS_27",
    sourceLabel: "接触",
    classification: "OWNER_REVIEW",
    classificationLabel: "要確認",
    mappingStatus: "UNMAPPED",
    nextActionAt: null,
    offerDate: null,
    expectedJoinDate: null,
    plannedStore: null,
    profileVersion: null,
    status: "要確認",
    statusCode: null,
    businessDate: "2026-07-01",
    lineRegistrationDate: "2026-07-01",
    legacyNoPresent: false,
    reasonLabels: ["担当者確認が必要"],
    primaryEligible: true,
    sourceKeyStatus: "UNPROVEN",
    suggestedTargetRecordId: null,
    suggestionCategory: "NONE",
    ...overrides
  };
}

function envelope() {
  return {
    ok: true,
    data: {
      fiscalYear: "2027",
      payloadMode: "workspace",
      overview: {
        total: 1,
        contacts: 1,
        entries: 0,
        exactLinkSuggestions: 0,
        offers: 0,
        ownerReview: 1,
        quarantined: 0,
        mapped: 0,
        manual: 0,
        primaryCandidates: 1,
        remainingManual: 0
      },
      students: [student()]
    },
    meta: {
      generatedAt: "2026-07-25T00:00:00.000Z",
      requestId: "fixture",
      source: "fixture",
      version: "2"
    }
  };
}

test("workspace executor reads the 147 anonymous candidates without network I/O", async () => {
  const executor = createTalentWorkspaceExecutor({
    globalObject: {
      NOV_TALENT_CONFIG: { mockState: "ready" },
      location: { search: "" }
    }
  });
  const result = await executor.run();
  const duplicate = await executor.run();

  assert.equal(result.okBoolean, true);
  assert.equal(result.runtimeMode, "mock");
  assert.equal(result.networkOperationCount, 0);
  assert.equal(result.requestCount, 0);
  assert.equal(result.data.students.length, 147);
  assert.ok(result.data.todayTasks.length <= 5);
  assert.equal(duplicate.stopCategory, "duplicate_startup_prevented");
});

test("workspace executor fails closed on row count and schema drift", async () => {
  const malformed = envelope();
  malformed.data.overview.total = 2;
  const executor = createTalentWorkspaceExact1Executor({
    globalObject: globalFixture(),
    hubContract: { audience: "nov_hub" },
    fetchImpl: async () => ({
      status: 200,
      headers: { get: () => "application/json" },
      async json() { return malformed; }
    })
  });
  const result = await executor.run();
  assert.equal(result.okBoolean, false);
  assert.equal(result.stopCategory, "invalid_response");
  assert.equal(result.studentRowsReturned, false);
});

test("public talent UI contains a real list/detail workspace and no pending placeholder", () => {
  const html = readFileSync(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../portal/talent/app.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../portal/talent/runtime.mjs", import.meta.url), "utf8");
  const config = readFileSync(new URL("../portal/talent/runtime-config.candidate.js", import.meta.url), "utf8");

  assert.match(html, /id="student-list"/);
  assert.match(html, /id="student-detail"/);
  assert.match(html, /id="student-review-dialog"/);
  assert.match(html, /id="student-review-open"/);
  assert.match(html, /学生データ/);
  assert.doesNotMatch(html, /学生一覧・詳細接続は次の安全ゲート/);
  assert.match(app, /createTalentWorkspaceExecutor/);
  assert.match(app, /getElementById\("summary-load-button"\)\?\.addEventListener\("click"/);
  assert.match(css, /\.student-workspace/);
  assert.match(runtime, /mode:\s*"staging"/);
  assert.match(runtime, /writeEnabled:\s*config\.writeEnabled === true/);
  assert.match(config, /runtimeMode:\s*"staging"/);
  assert.match(config, /readonlyApiEnabled:\s*true/);
  assert.doesNotMatch(`${runtime}\n${config}`, /service_role|serviceRole|secret/i);
});

for (const [status, safeCode, category] of [
  [401, "AUTH_REQUIRED", "auth_required"],
  [403, "FORBIDDEN", "forbidden"]
]) {
  test(`workspace executor preserves HTTP ${status} and maps ${safeCode}`, async () => {
    const executor = createTalentWorkspaceExact1Executor({
      globalObject: globalFixture(),
      hubContract: { audience: "nov_hub" },
      fetchImpl: async () => ({
        status,
        headers: { get: () => "application/json" },
        async json() {
          return { ok: false, safeCode, message: "safe", requestId: "fixture" };
        }
      })
    });
    const result = await executor.run();
    assert.equal(result.okBoolean, false);
    assert.equal(result.stopCategory, category);
    assert.equal(result.httpStatus, status);
  });
}
