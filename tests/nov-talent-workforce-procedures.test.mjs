import test from "node:test";
import assert from "node:assert/strict";
import { classifyWorkforceProcedureCasePriority, createWorkforceProcedureCaseController, filterWorkforceProcedureCases, isWorkforceProcedureCaseReadyToConfirm, sortWorkforceProcedureCases, WORKFORCE_PROCEDURE_CASE_CONTRACT } from "../portal/talent/workforce-procedures.mjs";

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

test("workforce procedure checklists read and update one bounded step", async () => {
  const calls = [];
  const controller = createWorkforceProcedureCaseController({
    config,
    helper,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "GET") return new Response(JSON.stringify({ ok: true, data: { procedureType: "ONBOARDING", steps: [
        { stepKey: "BASIC_INFO", isCompleted: false, version: 0, updatedAt: null },
        { stepKey: "DOCUMENTS", isCompleted: false, version: 0, updatedAt: null },
        { stepKey: "APPROVAL", isCompleted: false, version: 0, updatedAt: null },
        { stepKey: "CORE_HANDOFF", isCompleted: false, version: 0, updatedAt: null }
      ] } }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, data: { caseId: "00000000-0000-4000-8000-000000000001", stepKey: "BASIC_INFO", stepVersion: 1, operation: "COMPLETE" } }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const loaded = await controller.loadSteps("00000000-0000-4000-8000-000000000001");
  const saved = await controller.saveStep({ caseId: "00000000-0000-4000-8000-000000000001", stepKey: "BASIC_INFO", completed: true, expectedVersion: 0 });
  assert.equal(loaded.data.steps.length, 4);
  assert.equal(saved.data.operation, "COMPLETE");
  assert.match(calls[0].url, /procedure-cases\/steps\?caseId=/);
  assert.equal(calls[1].init.method, "POST");
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.checklistTracking, true);
});

test("workforce procedure confirmation requires every checklist item", () => {
  const ready = [{ isCompleted: true }, { isCompleted: true }, { isCompleted: true }, { isCompleted: true }];
  assert.equal(isWorkforceProcedureCaseReadyToConfirm(ready), true);
  assert.equal(isWorkforceProcedureCaseReadyToConfirm([{ ...ready[0], isCompleted: false }, ...ready.slice(1)]), false);
  assert.equal(isWorkforceProcedureCaseReadyToConfirm(ready.slice(0, 3)), false);
});

test("workforce procedure cases prioritize overdue and near-term open work", () => {
  const referenceDate = "2026-07-26";
  const overdue = { caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-07-25" };
  const nearTerm = { caseStatus: "DRAFT", effectiveDate: "2026-07-30" };
  const closed = { caseStatus: "CONFIRMED", effectiveDate: "2026-07-01" };
  assert.equal(classifyWorkforceProcedureCasePriority(overdue, referenceDate), "OVERDUE");
  assert.equal(classifyWorkforceProcedureCasePriority(nearTerm, referenceDate), "NEXT_7_DAYS");
  assert.equal(classifyWorkforceProcedureCasePriority(closed, referenceDate), "CLOSED");
  assert.deepEqual(sortWorkforceProcedureCases([closed, nearTerm, overdue], referenceDate), [overdue, nearTerm, closed]);
});
