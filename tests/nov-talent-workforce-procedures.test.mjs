import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildWorkforceProcedureActionMix, buildWorkforceProcedureAuditSummary, buildWorkforceProcedureCaseActionRoute, buildWorkforceProcedureCaseActionRouteSteps, buildWorkforceProcedureCaseBoundary, buildWorkforceProcedureCaseFormGuide, buildWorkforceProcedureCaseNextAction, buildWorkforceProcedureChecklistPlan, buildWorkforceProcedureConfirmationReadiness, buildWorkforceProcedureCoreHandoffFinalCheck, buildWorkforceProcedureCoreHandoffQueue, buildWorkforceProcedureCoreHandoffReadback, buildWorkforceProcedureCoreHandoffSteps, buildWorkforceProcedureEmptyState, buildWorkforceProcedureFormSavePreview, buildWorkforceProcedureFormSubmitReadiness, buildWorkforceProcedureOperationFilter, buildWorkforceProcedureOperationStartGuide, buildWorkforceProcedureOperationSteps, buildWorkforceProcedureOperationSummary, buildWorkforceProcedureSaveFollowUpPlan, buildWorkforceProcedureStatusMessage, buildWorkforceProcedureStatusTransitionPlan, buildWorkforceProcedureStepProgress, buildWorkforceProcedureTypeQueueFilter, buildWorkforceProcedureTypeSummary, classifyWorkforceProcedureCasePriority, createWorkforceProcedureCaseController, filterWorkforceProcedureCases, filterWorkforceProcedureCasesByPriority, filterWorkforceProcedureCasesByQuery, filterWorkforceProcedureCasesByType, getActiveWorkforceProcedureType, isWorkforceProcedureCaseReadyToConfirm, normalizeWorkforceProcedureCasePrefill, sortWorkforceProcedureCases, WORKFORCE_PROCEDURE_CASE_CONTRACT } from "../portal/talent/workforce-procedures.mjs";

const config = { writeApiEnabled: true, writeApiBaseUrl: "https://example.test/functions/v1/nov-talent-write-api" };
const helper = { getSessionToken: async () => "fixture-token" };
const root = new URL("../portal/talent/", import.meta.url);

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

test("workforce procedure audit summary reports categories without raw field values", () => {
  const empty = buildWorkforceProcedureAuditSummary([]);
  const statusChanged = buildWorkforceProcedureAuditSummary([
    { action: "UPDATE", changedFields: ["detail"], caseVersion: 1, occurredAt: "2026-07-26T00:00:00Z" },
    { action: "UPDATE", changedFields: ["caseStatus", "effectiveDate"], caseVersion: 2, occurredAt: "2026-07-27T00:00:00Z" }
  ]);
  assert.equal(empty.category, "NO_HISTORY");
  assert.equal(statusChanged.category, "STATUS_CHANGED");
  assert.equal(statusChanged.updateCount, 2);
  assert.equal(statusChanged.changedFieldCount, 3);
  assert.equal(statusChanged.rawValuesIncluded, false);
  assert.doesNotMatch(statusChanged.copy, /2026-07-27|detail|caseStatus/);
});

test("workforce procedure cases filter by progress without mutating rows", () => {
  const cases = Object.freeze([
    Object.freeze({ caseStatus: "DRAFT" }),
    Object.freeze({ caseStatus: "CONFIRMED" }),
    Object.freeze({ caseStatus: "DRAFT" })
  ]);
  assert.equal(filterWorkforceProcedureCases(cases, "DRAFT").length, 2);
  assert.equal(filterWorkforceProcedureCases(cases, "OPEN").length, 2);
  assert.equal(filterWorkforceProcedureCases(cases, "ALL").length, 3);
  assert.equal(filterWorkforceProcedureCases(cases, "INVALID").length, 0);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.statusFilters, true);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.openCaseFilter, true);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.filterReset, true);
});

test("workforce procedure cases can be scoped to the active procedure", () => {
  const cases = Object.freeze([
    Object.freeze({ procedureType: "ONBOARDING", caseStatus: "DRAFT" }),
    Object.freeze({ procedureType: "TRANSFER", caseStatus: "DRAFT" }),
    Object.freeze({ procedureType: "ONBOARDING", caseStatus: "CONFIRMED" })
  ]);
  assert.equal(filterWorkforceProcedureCasesByType(cases, "ONBOARDING").length, 2);
  assert.equal(filterWorkforceProcedureCasesByType(cases, "ALL").length, 3);
  assert.equal(filterWorkforceProcedureCasesByType(cases, "INVALID").length, 0);
});

test("workforce procedure cases can be narrowed to urgent work without a new request", () => {
  const cases = Object.freeze([
    Object.freeze({ procedureType: "ONBOARDING", caseStatus: "DRAFT", effectiveDate: "2026-07-20" }),
    Object.freeze({ procedureType: "ONBOARDING", caseStatus: "DRAFT", effectiveDate: "2026-07-29" }),
    Object.freeze({ procedureType: "ONBOARDING", caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" })
  ]);
  assert.equal(filterWorkforceProcedureCasesByPriority(cases, "OVERDUE", "2026-07-26").length, 1);
  assert.equal(filterWorkforceProcedureCasesByPriority(cases, "NEXT_7_DAYS", "2026-07-26").length, 1);
  assert.equal(filterWorkforceProcedureCasesByPriority(cases, "SCHEDULED", "2026-07-26").length, 0);
  assert.equal(filterWorkforceProcedureCasesByPriority(cases, "INVALID", "2026-07-26").length, 0);
});

test("workforce procedure cases can be searched locally by subject or memo", () => {
  const cases = Object.freeze([
    Object.freeze({ subjectLabel: "総務 花子", detail: "社会保険の手続き" }),
    Object.freeze({ subjectLabel: "営業 太郎", detail: "引継ぎメモ" })
  ]);
  assert.deepEqual(filterWorkforceProcedureCasesByQuery(cases, "総務"), [cases[0]]);
  assert.deepEqual(filterWorkforceProcedureCasesByQuery(cases, "引継ぎ"), [cases[1]]);
  assert.equal(filterWorkforceProcedureCasesByQuery(cases, "該当なし").length, 0);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.caseSearch, true);
});

test("workforce procedure empty state points to the next safe local action", () => {
  const empty = buildWorkforceProcedureEmptyState({ total: 0, activeProcedureType: "RETIREMENT" });
  const filtered = buildWorkforceProcedureEmptyState({ total: 3, hasActiveFilters: true });
  assert.equal(empty.category, "NO_CASES");
  assert.match(empty.copy, /退職/);
  assert.equal(empty.action, "案件を登録");
  assert.equal(filtered.category, "FILTERED_EMPTY");
  assert.equal(filtered.canReset, true);
  assert.equal(filtered.rawValuesIncluded, false);
  assert.equal(filtered.employeeMasterMutation, false);
});

test("new workforce cases inherit the active procedure tab", () => {
  assert.equal(getActiveWorkforceProcedureType({
    querySelector: () => ({ dataset: { procedureType: "RETIREMENT" } })
  }), "RETIREMENT");
  assert.equal(getActiveWorkforceProcedureType({
    querySelector: () => ({ dataset: { procedureType: "UNKNOWN" } })
  }), "ONBOARDING");
});

test("procedure case prefill only accepts a bounded onboarding draft", () => {
  const documentObject = { querySelector: () => ({ dataset: { procedureType: "TRANSFER" } }) };
  assert.deepEqual(normalizeWorkforceProcedureCasePrefill({
    procedureType: "ONBOARDING",
    subjectLabel: " 対象者 ",
    effectiveDate: "2027-04-01",
    detail: " 事前確認メモ "
  }, documentObject), {
    procedureType: "ONBOARDING",
    subjectLabel: "対象者",
    effectiveDate: "2027-04-01",
    detail: "事前確認メモ"
  });
  assert.deepEqual(normalizeWorkforceProcedureCasePrefill({
    procedureType: "INVALID",
    subjectLabel: 42,
    effectiveDate: "invalid"
  }, documentObject), {
    procedureType: "TRANSFER",
    subjectLabel: "",
    effectiveDate: "",
    detail: ""
  });
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
  assert.equal(buildWorkforceProcedureConfirmationReadiness(ready).category, "READY_TO_CONFIRM");
  assert.equal(buildWorkforceProcedureConfirmationReadiness([{ ...ready[0], isCompleted: false }, ...ready.slice(1)]).category, "CHECKLIST_INCOMPLETE");
  assert.equal(buildWorkforceProcedureConfirmationReadiness(ready.slice(0, 3)).category, "CHECKLIST_SHAPE_INVALID");
  assert.equal(buildWorkforceProcedureConfirmationReadiness(ready).rawValuesIncluded, false);
  assert.equal(buildWorkforceProcedureConfirmationReadiness(ready).employeeMasterMutation, false);
});

test("workforce procedure step progress points to the next incomplete checklist item", async () => {
  const source = await readFile(new URL("../portal/talent/workforce-procedures.mjs", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const progress = buildWorkforceProcedureStepProgress([
    { stepKey: "BASIC_INFO", isCompleted: true },
    { stepKey: "DOCUMENTS", isCompleted: false },
    { stepKey: "APPROVAL", isCompleted: false },
    { stepKey: "CORE_HANDOFF", isCompleted: false }
  ]);
  assert.equal(progress.category, "IN_PROGRESS");
  assert.equal(progress.completed, 1);
  assert.equal(progress.pending, 3);
  assert.equal(progress.nextStepCategory, "PRESENT");
  assert.equal(progress.canConfirm, false);
  assert.equal(progress.rawValuesIncluded, false);
  assert.equal(progress.employeeMasterMutation, false);
  assert.equal(buildWorkforceProcedureStepProgress([
    { isCompleted: true },
    { isCompleted: true },
    { isCompleted: true },
    { isCompleted: true }
  ]).category, "ALL_COMPLETE");
  assert.match(source, /progressCategory/);
  assert.match(source, /padStart/);
  assert.match(css, /procedure-case-step em/);
});

test("workforce procedure checklist plans stay scoped by procedure type", async () => {
  const onboarding = buildWorkforceProcedureChecklistPlan("ONBOARDING");
  const transfer = buildWorkforceProcedureChecklistPlan("TRANSFER");
  const leave = buildWorkforceProcedureChecklistPlan("LEAVE");
  const retirement = buildWorkforceProcedureChecklistPlan("RETIREMENT");

  assert.deepEqual(onboarding.steps.map((step) => step.stepKey), ["BASIC_INFO", "DOCUMENTS", "APPROVAL", "CORE_HANDOFF"]);
  assert.deepEqual(transfer.steps.map((step) => step.stepKey), ["CHANGE_DETAILS", "STAKEHOLDER_CONFIRMATION", "APPROVAL", "CORE_HANDOFF"]);
  assert.deepEqual(leave.steps.map((step) => step.stepKey), ["APPLICATION", "REQUIRED_PROCEDURES", "RETURN_PLAN", "CORE_HANDOFF"]);
  assert.deepEqual(retirement.steps.map((step) => step.stepKey), ["RETIREMENT_DATE", "DOCUMENTS", "ASSET_RETURN", "CORE_HANDOFF"]);
  assert.equal(buildWorkforceProcedureChecklistPlan("UNKNOWN").procedureType, "ONBOARDING");
  assert.match(retirement.copy, /貸与物返却/);
});

test("workforce procedure status transitions fail closed before unsafe workflow jumps", () => {
  const draft = buildWorkforceProcedureStatusTransitionPlan("DRAFT", "READY_FOR_REVIEW");
  const reviewToConfirm = buildWorkforceProcedureStatusTransitionPlan("READY_FOR_REVIEW", "CONFIRMED");
  const confirmedToDraft = buildWorkforceProcedureStatusTransitionPlan("CONFIRMED", "DRAFT");
  const cancelledToDraft = buildWorkforceProcedureStatusTransitionPlan("CANCELLED", "DRAFT");

  assert.equal(draft.isAllowed, true);
  assert.equal(reviewToConfirm.category, "CONFIRM_REQUIRES_CHECKLIST");
  assert.equal(confirmedToDraft.isAllowed, false);
  assert.equal(confirmedToDraft.category, "CONFIRMED_LOCKED");
  assert.deepEqual(confirmedToDraft.allowedStatuses, ["CONFIRMED"]);
  assert.equal(cancelledToDraft.isAllowed, true);
  assert.equal(buildWorkforceProcedureStatusTransitionPlan("UNKNOWN", "CONFIRMED").isAllowed, false);
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

test("workforce procedure cases summarize today's operation queue without mutating rows", async () => {
  const summary = buildWorkforceProcedureOperationSummary([
    { caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-07-25" },
    { caseStatus: "DRAFT", effectiveDate: "2026-07-30" },
    { caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-20" },
    { caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" }
  ], "2026-07-26");
  assert.equal(summary.nextAction, "OVERDUE");
  assert.equal(summary.overdue, 1);
  assert.equal(summary.soon, 1);
  assert.equal(summary.review, 2);
  assert.equal(summary.draft, 1);
  assert.deepEqual(buildWorkforceProcedureOperationFilter("OVERDUE"), {
    status: "ALL",
    priority: "OVERDUE",
    label: "期限超過の案件へ絞り込み",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
  assert.deepEqual(buildWorkforceProcedureOperationFilter("READY_FOR_REVIEW"), {
    status: "READY_FOR_REVIEW",
    priority: "ALL",
    label: "確認待ちへ絞り込み",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
  const steps = buildWorkforceProcedureOperationSteps(summary);
  assert.deepEqual(steps.steps.map((step) => step.order), [1, 2, 3]);
  assert.equal(steps.steps[0].label, "期限超過だけに絞り込む");
  assert.equal(steps.rawValuesIncluded, false);
  assert.equal(steps.employeeMasterMutation, false);
  assert.equal(steps.canonicalWriteReachable, false);
  const start = buildWorkforceProcedureOperationStartGuide(summary);
  assert.equal(start.category, "OVERDUE");
  assert.equal(start.filterStatus, "ALL");
  assert.equal(start.filterPriority, "OVERDUE");
  assert.equal(start.rawValuesIncluded, false);
  assert.equal(start.employeeMasterMutation, false);
  assert.equal(start.canonicalWriteReachable, false);
  assert.equal(start.lineHistoryWriteReachable, false);
  const reviewStart = buildWorkforceProcedureOperationStartGuide(buildWorkforceProcedureOperationSummary([
    { caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-20" }
  ], "2026-07-26"));
  assert.equal(reviewStart.category, "READY_FOR_REVIEW");
  assert.equal(reviewStart.filterStatus, "READY_FOR_REVIEW");
  assert.equal(reviewStart.filterPriority, "ALL");
  const html = await readFile(new URL("index.html", root), "utf8");
  const source = await readFile(new URL("workforce-procedures.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");
  assert.match(html, /workforce-case-operation-start-guide/);
  assert.match(html, /workforce-case-operation-start-button/);
  assert.match(source, /buildWorkforceProcedureOperationStartGuide/);
  assert.match(css, /procedure-case-operation-start-guide/);
});

test("workforce procedure type summary separates workload without raw values", () => {
  const summary = buildWorkforceProcedureTypeSummary([
    { procedureType: "ONBOARDING", caseStatus: "DRAFT", effectiveDate: "2026-07-25" },
    { procedureType: "ONBOARDING", caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-01" },
    { procedureType: "TRANSFER", caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-10" },
    { procedureType: "RETIREMENT", caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" }
  ], "2026-07-26");
  assert.equal(summary.ONBOARDING.open, 2);
  assert.equal(summary.ONBOARDING.overdue, 1);
  assert.equal(summary.ONBOARDING.nextCategory, "OVERDUE");
  assert.equal(summary.TRANSFER.review, 1);
  assert.equal(summary.TRANSFER.nextCategory, "READY_FOR_REVIEW");
  assert.equal(summary.LEAVE.nextCategory, "CLEAR");
  assert.equal(summary.RETIREMENT.open, 0);
  assert.equal(summary.RETIREMENT.rawValuesIncluded, false);
  assert.deepEqual(buildWorkforceProcedureTypeQueueFilter(summary.ONBOARDING), {
    category: "OVERDUE",
    status: "ALL",
    priority: "OVERDUE",
    label: "期限超過を先に表示",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
  assert.deepEqual(buildWorkforceProcedureTypeQueueFilter(summary.TRANSFER), {
    category: "READY_FOR_REVIEW",
    status: "READY_FOR_REVIEW",
    priority: "ALL",
    label: "確認待ちを表示",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
  assert.equal(buildWorkforceProcedureTypeQueueFilter(summary.LEAVE).status, "ALL");
});

test("workforce procedure case next action guides daily work from each row", () => {
  assert.equal(buildWorkforceProcedureCaseNextAction({ caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-20" }, "2026-07-26").primaryAction, "確認項目");
  assert.equal(buildWorkforceProcedureCaseNextAction({ caseStatus: "DRAFT", effectiveDate: "2026-07-20" }, "2026-07-26").category, "OVERDUE_REVIEW");
  assert.equal(buildWorkforceProcedureCaseNextAction({ caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" }, "2026-07-26").category, "CORE_HANDOFF_READY");
  assert.match(buildWorkforceProcedureCaseNextAction({ caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" }, "2026-07-26").copy, /別承認/);
  const overdue = buildWorkforceProcedureCaseNextAction({ caseStatus: "DRAFT", effectiveDate: "2026-07-20" }, "2026-07-26");
  assert.equal(overdue.safetyBoundary, "この案件だけ保存");
  assert.equal(overdue.rawValuesIncluded, false);
  assert.equal(overdue.employeeMasterMutation, false);
});

test("workforce procedure row action route highlights the safest next button", async () => {
  const source = await readFile(new URL("../portal/talent/workforce-procedures.mjs", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  assert.equal(buildWorkforceProcedureCaseActionRoute({ category: "CHECKLIST_REVIEW" }).action, "CHECKLIST");
  assert.equal(buildWorkforceProcedureCaseActionRoute({ category: "CORE_HANDOFF_READY" }).action, "AUDIT");
  const overdue = buildWorkforceProcedureCaseActionRoute({ category: "OVERDUE_REVIEW" });
  assert.equal(overdue.action, "EDIT");
  assert.equal(overdue.rawValuesIncluded, false);
  assert.equal(overdue.employeeMasterMutation, false);
  assert.match(source, /caseRowAction/);
  assert.match(source, /dataset\.recommended/);
  assert.match(source, /buildWorkforceProcedureCaseActionRouteSteps/);
  assert.match(css, /\.case-edit-button\[data-recommended="true"\]/);
  assert.match(css, /procedure-case-row-action-steps/);
});

test("workforce procedure row action steps explain why the recommended button is safe", () => {
  const edit = buildWorkforceProcedureCaseActionRouteSteps({ action: "EDIT", category: "OVERDUE_REVIEW" });
  const checklist = buildWorkforceProcedureCaseActionRouteSteps({ action: "CHECKLIST", category: "CHECKLIST_REVIEW" });
  const audit = buildWorkforceProcedureCaseActionRouteSteps({ action: "AUDIT", category: "CORE_HANDOFF_READY" });

  assert.deepEqual(edit.steps.map((step) => step.category), ["EDIT_STEP_1", "EDIT_STEP_2", "EDIT_STEP_3"]);
  assert.deepEqual(checklist.steps.map((step) => step.category), ["CHECKLIST_STEP_1", "CHECKLIST_STEP_2", "CHECKLIST_STEP_3"]);
  assert.deepEqual(audit.steps.map((step) => step.category), ["AUDIT_STEP_1", "AUDIT_STEP_2", "AUDIT_STEP_3"]);
  assert.equal(audit.employeeMasterMutation, false);
  assert.equal(audit.canonicalWriteReachable, false);
  assert.equal(audit.lineHistoryWriteReachable, false);
  assert.equal(audit.rawValuesIncluded, false);
});

test("workforce procedure case boundary explains local-only and handoff limits", async () => {
  const source = await readFile(new URL("../portal/talent/workforce-procedures.mjs", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const confirmed = buildWorkforceProcedureCaseBoundary({ caseStatus: "CONFIRMED" });
  const cancelled = buildWorkforceProcedureCaseBoundary({ caseStatus: "CANCELLED" });
  const review = buildWorkforceProcedureCaseBoundary({ caseStatus: "READY_FOR_REVIEW" });
  assert.equal(confirmed.category, "CORE_HANDOFF_SEPARATE_APPROVAL");
  assert.equal(cancelled.category, "CANCELLED_REOPEN_WITH_REASON");
  assert.equal(review.category, "CHECKLIST_GATE");
  assert.equal(confirmed.employeeMasterMutation, false);
  assert.equal(confirmed.canonicalWriteReachable, false);
  assert.equal(confirmed.lineHistoryWriteReachable, false);
  assert.equal(cancelled.rawValuesIncluded, false);
  assert.match(source, /procedure-case-boundary-note/);
  assert.match(source, /buildWorkforceProcedureCaseBoundary/);
  assert.match(css, /procedure-case-boundary-note/);
});

test("workforce procedure action mix summarizes visible row actions without writes", async () => {
  const source = await readFile(new URL("../portal/talent/workforce-procedures.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const mix = buildWorkforceProcedureActionMix([
    { caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-20" },
    { caseStatus: "DRAFT", effectiveDate: "2026-07-20" },
    { caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" }
  ], "2026-07-26");
  assert.equal(mix.edit, 1);
  assert.equal(mix.checklist, 1);
  assert.equal(mix.audit, 1);
  assert.equal(mix.nextAction, "EDIT");
  assert.equal(mix.rawValuesIncluded, false);
  assert.equal(mix.employeeMasterMutation, false);
  assert.equal(mix.canonicalWriteReachable, false);
  assert.equal(buildWorkforceProcedureActionMix([{ caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-20" }], "2026-07-26").nextAction, "CHECKLIST");
  assert.match(source, /renderOperationActionMix/);
  assert.match(html, /workforce-case-operation-action-mix/);
  assert.match(css, /procedure-case-operation-action-mix/);
});

test("workforce procedure core handoff queue keeps employee master writes separate", async () => {
  const source = await readFile(new URL("../portal/talent/workforce-procedures.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const queue = buildWorkforceProcedureCoreHandoffQueue([
    { caseStatus: "CONFIRMED" },
    { caseStatus: "DRAFT" },
    { caseStatus: "READY_FOR_REVIEW" },
    { caseStatus: "CANCELLED" }
  ]);
  const inProgress = buildWorkforceProcedureCoreHandoffQueue([{ caseStatus: "DRAFT" }]);

  assert.equal(queue.category, "SEPARATE_CORE_APPROVAL_REQUIRED");
  assert.equal(queue.handoffReady, 1);
  assert.equal(queue.localInProgress, 2);
  assert.equal(queue.cancelled, 1);
  assert.equal(queue.handoffReadyCategory, "ONE");
  assert.equal(queue.localInProgressCategory, "MULTIPLE");
  assert.equal(queue.coreDbWriteRequiresSeparateApproval, true);
  assert.equal(queue.employeeMasterMutation, false);
  assert.equal(queue.canonicalWriteReachable, false);
  assert.equal(queue.lineHistoryWriteReachable, false);
  assert.equal(queue.rawValuesIncluded, false);
  assert.equal(inProgress.category, "LOCAL_CASES_IN_PROGRESS");
  const steps = buildWorkforceProcedureCoreHandoffSteps(queue);
  assert.equal(steps.category, "SEPARATE_CORE_APPROVAL_REQUIRED");
  assert.deepEqual(steps.steps.map((step) => step.category), ["QUEUE_SCOPE", "APPROVAL_BOUNDARY", "NEXT_LOCAL_ACTION"]);
  assert.equal(steps.employeeMasterMutation, false);
  assert.equal(steps.coreDbWriteRequiresSeparateApproval, true);
  const readback = buildWorkforceProcedureCoreHandoffReadback(queue);
  assert.equal(readback.category, "SEPARATE_CORE_APPROVAL_REQUIRED");
  assert.deepEqual(readback.steps.map((step) => step.category), ["CONFIRMED_ONLY", "NO_IN_PROGRESS", "SEPARATE_APPROVAL"]);
  assert.equal(readback.employeeMasterMutation, false);
  assert.equal(readback.coreDbWriteRequiresSeparateApproval, true);
  assert.equal(readback.canonicalWriteReachable, false);
  assert.equal(readback.lineHistoryWriteReachable, false);
  assert.equal(readback.rawValuesIncluded, false);
  const finalCheck = buildWorkforceProcedureCoreHandoffFinalCheck(queue);
  const readyOnly = buildWorkforceProcedureCoreHandoffFinalCheck(buildWorkforceProcedureCoreHandoffQueue([{ caseStatus: "CONFIRMED" }]));
  assert.equal(finalCheck.category, "HANDOFF_READY_WITH_LOCAL_WORK");
  assert.equal(readyOnly.category, "HANDOFF_READY_FOR_SEPARATE_APPROVAL");
  assert.deepEqual(readyOnly.steps.map((step) => step.category), ["CONFIRMED_ONLY", "READBACK_COUNTS", "SEPARATE_MASTER_APPROVAL"]);
  assert.equal(finalCheck.employeeMasterMutation, false);
  assert.equal(finalCheck.coreDbWriteRequiresSeparateApproval, true);
  assert.equal(finalCheck.canonicalWriteReachable, false);
  assert.equal(finalCheck.lineHistoryWriteReachable, false);
  assert.equal(finalCheck.rawValuesIncluded, false);
  assert.match(source, /buildWorkforceProcedureCoreHandoffQueue/);
  assert.match(source, /buildWorkforceProcedureCoreHandoffSteps/);
  assert.match(source, /buildWorkforceProcedureCoreHandoffReadback/);
  assert.match(source, /buildWorkforceProcedureCoreHandoffFinalCheck/);
  assert.match(source, /renderCoreHandoffQueue/);
  assert.match(html, /workforce-case-core-handoff-queue/);
  assert.match(html, /workforce-case-core-handoff-steps/);
  assert.match(html, /workforce-case-core-handoff-readback/);
  assert.match(css, /procedure-case-core-handoff-queue/);
  assert.match(css, /procedure-case-core-handoff-steps/);
  assert.match(css, /procedure-case-core-handoff-readback/);
  assert.equal(WORKFORCE_PROCEDURE_CASE_CONTRACT.coreHandoffQueue, true);
});

test("workforce procedure form guide keeps the next edit action local and status-based", () => {
  assert.equal(buildWorkforceProcedureCaseFormGuide({ caseStatus: "DRAFT", effectiveDate: "2026-07-20" }, "2026-07-26").category, "OVERDUE");
  assert.equal(buildWorkforceProcedureCaseFormGuide({ caseStatus: "READY_FOR_REVIEW", effectiveDate: "2026-08-20" }, "2026-07-26").category, "READY_FOR_REVIEW");
  assert.equal(buildWorkforceProcedureCaseFormGuide({ caseStatus: "CONFIRMED", effectiveDate: "2026-07-20" }, "2026-07-26").category, "CONFIRMED");
  assert.match(buildWorkforceProcedureCaseFormGuide({ caseStatus: "DRAFT", effectiveDate: "2026-08-20" }, "2026-07-26").copy, /下書き/);
  const missing = buildWorkforceProcedureCaseFormGuide({ caseStatus: "DRAFT", subjectLabel: "", effectiveDate: "", detail: "" }, "2026-07-26");
  const ready = buildWorkforceProcedureCaseFormGuide({ caseStatus: "DRAFT", subjectLabel: "対象", effectiveDate: "2026-08-20", detail: "補足" }, "2026-07-26");
  assert.equal(missing.requiredReady, false);
  assert.deepEqual(missing.requirements.map((item) => item.category), ["MISSING_REQUIRED", "MISSING_REQUIRED", "OPTIONAL"]);
  assert.equal(ready.requiredReady, true);
  assert.equal(ready.rawValuesIncluded, false);
  assert.equal(ready.employeeMasterMutation, false);
  assert.deepEqual(buildWorkforceProcedureFormSubmitReadiness({ subjectLabel: "", effectiveDate: "", detail: "" }), {
    category: "MISSING_REQUIRED_FIELDS",
    canSubmit: false,
    missingRequiredCount: 2,
    missingRequiredKeys: Object.freeze(["SUBJECT", "EFFECTIVE_DATE"]),
    statusCategory: "invalid_request",
    rawValuesIncluded: false,
    employeeMasterMutation: false
  });
  assert.equal(buildWorkforceProcedureFormSubmitReadiness({ subjectLabel: "対象", effectiveDate: "2026-08-20" }).canSubmit, true);
});

test("workforce procedure save preview explains blockers before submit", async () => {
  const source = await readFile(new URL("../portal/talent/workforce-procedures.mjs", import.meta.url), "utf8");
  const html = await readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../portal/talent/style.css", import.meta.url), "utf8");
  const missing = buildWorkforceProcedureFormSavePreview({ caseStatus: "DRAFT", subjectLabel: "", effectiveDate: "" }, "NEW");
  const ready = buildWorkforceProcedureFormSavePreview({ caseStatus: "DRAFT", subjectLabel: "対象", effectiveDate: "2026-08-20" }, "NEW");
  const confirmNew = buildWorkforceProcedureFormSavePreview({ caseStatus: "CONFIRMED", subjectLabel: "対象", effectiveDate: "2026-08-20" }, "NEW");
  const confirmExisting = buildWorkforceProcedureFormSavePreview({ caseId: "00000000-0000-4000-8000-000000000001", caseStatus: "CONFIRMED", subjectLabel: "対象", effectiveDate: "2026-08-20" }, "READY_FOR_REVIEW");
  assert.equal(missing.category, "MISSING_REQUIRED_FIELDS");
  assert.equal(ready.category, "READY_TO_SAVE");
  assert.equal(confirmNew.category, "CONFIRM_REQUIRES_EXISTING_CASE");
  assert.equal(confirmExisting.category, "CHECKLIST_REQUIRED_BEFORE_CONFIRM");
  assert.equal(confirmExisting.requiresChecklistRead, true);
  assert.equal(confirmExisting.rawValuesIncluded, false);
  assert.equal(confirmExisting.employeeMasterMutation, false);
  assert.equal(confirmExisting.canonicalWriteReachable, false);
  const missingFollowUp = buildWorkforceProcedureSaveFollowUpPlan(missing);
  const readyFollowUp = buildWorkforceProcedureSaveFollowUpPlan(ready);
  const confirmFollowUp = buildWorkforceProcedureSaveFollowUpPlan(confirmExisting);
  assert.equal(missingFollowUp.category, "MISSING_REQUIRED_FIELDS");
  assert.match(missingFollowUp.title, /required fields/);
  assert.equal(readyFollowUp.category, "READY_TO_SAVE");
  assert.match(readyFollowUp.copy, /audit trail/);
  assert.equal(confirmFollowUp.category, "CHECKLIST_REQUIRED_BEFORE_CONFIRM");
  assert.equal(confirmFollowUp.employeeMasterMutation, false);
  assert.equal(confirmFollowUp.canonicalWriteReachable, false);
  assert.equal(confirmFollowUp.lineHistoryWriteReachable, false);
  assert.match(source, /renderSavePreview/);
  assert.match(source, /buildWorkforceProcedureSaveFollowUpPlan/);
  assert.match(html, /workforce-case-save-preview/);
  assert.match(html, /workforce-case-save-follow-up/);
  assert.match(css, /procedure-case-save-preview/);
  assert.match(css, /procedure-case-save-follow-up/);
});

test("workforce procedure status messages explain safe boundaries without raw errors", () => {
  assert.match(buildWorkforceProcedureStatusMessage("feature_disabled"), /保存はまだ行えません/);
  assert.match(buildWorkforceProcedureStatusMessage("write_forbidden"), /権限/);
  assert.match(buildWorkforceProcedureStatusMessage("saved"), /社員マスタへの反映は別/);
  assert.match(buildWorkforceProcedureStatusMessage("invalid_response"), /値は表示せず/);
  assert.doesNotMatch(buildWorkforceProcedureStatusMessage("request_failed"), /Error|Exception|http|SQL/i);
});
