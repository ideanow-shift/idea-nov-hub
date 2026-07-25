import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createTalentWorkspaceExact1Executor } from "../portal/talent/exact1.mjs";

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

test("workspace executor performs one authenticated request and validates students", async () => {
  const calls = [];
  const executor = createTalentWorkspaceExact1Executor({
    globalObject: globalFixture(),
    hubContract: { audience: "nov_hub" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        status: 200,
        headers: { get: () => "application/json" },
        async json() { return envelope(); }
      };
    }
  });
  const result = await executor.run();
  const duplicate = await executor.run();

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    "https://example.test/functions/v1/nov-talent-readonly-api-v2/api/talent/v1/workspace?fiscalYear=2027"
  );
  assert.equal(calls[0].options.method, "GET");
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
  assert.equal(result.okBoolean, true);
  assert.equal(result.studentRowsReturned, true);
  assert.equal(result.data.students.length, 1);
  assert.equal(duplicate.duplicatePrevented, true);
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
  const migration = readFileSync(
    new URL("../supabase/migrations/20260725070000_nov_talent_staging_workspace_read.sql", import.meta.url),
    "utf8"
  );

  assert.match(html, /id="student-list"/);
  assert.match(html, /id="student-detail"/);
  assert.match(html, /id="student-review-dialog"/);
  assert.match(html, /id="student-review-open"/);
  assert.match(html, /27卒 取込状況/);
  assert.doesNotMatch(html, /学生一覧・詳細接続は次の安全ゲート/);
  assert.match(app, /createTalentWorkspaceExact1Executor/);
  assert.match(app, /createTalentHistoricalReviewController/);
  assert.match(app, /getElementById\("summary-load-button"\)\?\.addEventListener\("click"/);
  assert.match(css, /\.student-workspace/);
  assert.match(migration, /assert_nov_talent_accountable_owner_v1/);
  assert.match(migration, /limit 1000/i);
  assert.doesNotMatch(migration, /r\.fiscal_year\s*=\s*p_fiscal_year/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated/i);
});
