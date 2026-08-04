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
  assert.match(config, /runtimeMode:\s*"staging"/);
  assert.match(config, /stagingCandidateDataset:\s*true/);
  assert.match(config, /writeEnabled:\s*true/);
  assert.match(config, /writeApiBaseUrl/);
  assert.doesNotMatch(config, /service_role|serviceRole|password|secret/i);
});
