import test from "node:test";
import assert from "node:assert/strict";
import { createWorkforceProcedureCaseController, filterWorkforceProcedureCases, WORKFORCE_PROCEDURE_CASE_CONTRACT } from "../portal/talent/workforce-procedures.mjs";

const config = { writeApiEnabled: true, writeApiBaseUrl: "https://example.test/functions/v1/nov-talent-write-api" };
const helper = { getSessionToken: async () => "fixture-token" };

test("workforce procedure cases read and save through the audited API only", async () => {
  const calls = [];
  const controller = createWorkforceProcedureCaseController({
    config,
    helper,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "GET") return new Response(JSON.stringify({ ok: true, data: { cases: [] } }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, data: { caseId: "00000000-0000-4000-8000-000000000001", caseVersion: 1, operation: "CREATE" } }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const loaded = await controller.load();
  assert.equal(loaded.ok, true);
  const saved = await controller.save({ caseId: null, expectedVersion: 0, procedureType: "ONBOARDING", caseStatus: "DRAFT", subjectLabel: "テスト 対象者", effectiveDate: "2026-08-01", detail: null });
  assert.equal(saved.data.operation, "CREATE");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.employeeMasterMutation, false);
});

test("workforce procedure cases fail closed on malformed drafts", async () => {
  const controller = createWorkforceProcedureCaseController({ config, helper, fetchImpl: async () => { throw new Error("unexpected"); } });
  const result = await controller.save({ caseId: null, expectedVersion: 0, procedureType: "ONBOARDING", caseStatus: "DRAFT", subjectLabel: "", effectiveDate: "invalid", detail: null });
  assert.equal(result.category, "invalid_request");
  assert.equal(result.requestCount, 0);
});

test("workforce procedure case history is bounded and read-only", async () => {
  const calls = [];
  const controller = createWorkforceProcedureCaseController({
    config,
    helper,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, data: { entries: [{ action: "UPDATE", changedFields: ["caseStatus"], caseVersion: 2, occurredAt: "2026-07-26T00:00:00Z" }] } }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const result = await controller.loadAudit("00000000-0000-4000-8000-000000000001");
  assert.equal(result.ok, true);
  assert.equal(result.data[0].changedFields[0], "caseStatus");
  assert.equal(calls[0].init.method, "GET");
  assert.match(calls[0].url, /procedure-cases\/audit\?caseId=/);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.auditHistory, true);
});

test("workforce procedure cases filter by progress without mutating rows", () => {
  const cases = Object.freeze([
    Object.freeze({ caseStatus: "DRAFT" }),
    Object.freeze({ caseStatus: "CONFIRMED" }),
    Object.freeze({ caseStatus: "DRAFT" })
  ]);
  assert.equal(filterWorkforceProcedureCases(cases, "DRAFT").length, 2);
  assert.equal(filterWorkforceProcedureCases(cases, "ALL").length, 3);
  assert.equal(filterWorkforceProcedureCases(cases, "INVALID").length, 0);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.statusFilters, true);
});
