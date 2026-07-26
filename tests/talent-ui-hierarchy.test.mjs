import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBulkTriageCounts, buildMatchOnlyReviewProposal, buildMonthlyFollowUpFilter, buildOnboardingHandoffDraft, buildSchoolFollowUpFilter, buildSingleStudentReviewProposal, buildSummaryFollowUpFilter, classifyTalentStudentFollowUp, filterTalentStudents, getTalentStudentMonthKey, getTalentStudentProgressKey, isNewApplicantCandidate, sortTalentStudentsByFollowUp } from "../portal/talent/app.mjs";

const root = new URL("../portal/talent/", import.meta.url);

test("Talent exposes recruitment and workforce as accessible primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /aria-label="人財投資管理の業務区分"/);
  assert.match(html, /data-primary-tab="recruitment"[\s\S]*求人管理/);
  assert.match(html, /data-primary-tab="workforce"[\s\S]*現職者管理/);
  for (const key of ["onboarding", "transfer", "leave", "retirement"]) {
    assert.match(html, new RegExp(`data-workforce-open="${key}"`));
  }
  assert.match(html, /id="panel-recruitment"[\s\S]*role="tabpanel"/);
  assert.match(html, /id="panel-workforce"[\s\S]*role="tabpanel"/);
  assert.match(html, /assets\/icons\/human-resources\.svg/);
  assert.match(html, /assets\/icons\/growth\.svg/);
  assert.match(html, /assets\/icons\/assignment\.svg/);
  assert.match(html, /assets\/icons\/refresh\.svg/);
});

test("recruitment subtabs stay visually and semantically below the primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /class="secondary-tabs"[\s\S]*全体サマリー/);
  assert.match(html, /data-secondary-tab="students"[\s\S]*学生フォロー/);
  assert.match(html, /data-secondary-tab="fairs"[\s\S]*フェア分析/);
  assert.match(html, /data-secondary-tab="schools"[\s\S]*学校分析/);
});

test("school analysis leads directly to a focused student follow-up list", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.deepEqual(buildSchoolFollowUpFilter(" NOV美容専門学校 "), {
    query: "NOV美容専門学校",
    source: "ALL",
    state: "ALL",
    progress: "ALL"
  });
  assert.equal(buildSchoolFollowUpFilter(""), null);
  assert.match(html, /<th>フォロー<\/th>/);
  assert.match(app, /button\.textContent = "学生を見る"/);
  assert.match(app, /openSchoolStudentWorkspace/);
  assert.match(app, /data-secondary-tab="students"/);
});

test("summary shortcuts open the intended student queues without changing records", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const rows = [
    { displayName: "確認対象", sourceCode: "CONTACTS_27", classification: "OWNER_REVIEW", statusCode: "CONTACT" },
    { displayName: "隔離対象", sourceCode: "OFFERS_27", classification: "QUARANTINE", statusCode: "OFFER" },
    { displayName: "確認済み", sourceCode: "ENTRIES_27", classification: "IMPORTABLE", statusCode: "INTERVIEW" }
  ];

  assert.deepEqual(buildSummaryFollowUpFilter("offers"), { query: "", source: "OFFERS_27", state: "ALL", progress: "ALL" });
  assert.deepEqual(buildSummaryFollowUpFilter("needsAction"), { query: "", source: "ALL", state: "NEEDS_ACTION", progress: "ALL" });
  assert.deepEqual(buildSummaryFollowUpFilter("overdueFollowUp"), { query: "", source: "ALL", state: "ALL", progress: "ALL", followUp: "OVERDUE" });
  assert.deepEqual(buildSummaryFollowUpFilter("nextWeekFollowUp"), { query: "", source: "ALL", state: "ALL", progress: "ALL", followUp: "NEXT_7_DAYS" });
  assert.equal(buildSummaryFollowUpFilter("unknown"), null);
  assert.deepEqual(filterTalentStudents(rows, buildSummaryFollowUpFilter("needsAction")).map((row) => row.displayName), ["確認対象", "隔離対象"]);
  assert.match(html, /data-summary-followup="needsAction"/);
  assert.match(html, /data-summary-followup="overdueFollowUp"/);
  assert.match(html, /id="summary-followup-overdue-count"/);
  assert.match(html, /id="summary-followup-next-week-count"/);
  assert.match(html, /option value="NEEDS_ACTION">要確認・隔離<\/option>/);
  assert.match(app, /buildSummaryFollowUpFilter/);
  assert.match(app, /renderSummaryFollowUpCounts/);
  assert.match(app, /openStudentWorkspace/);
});

test("fair analysis opens a student queue scoped to its selected record month", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const rows = [
    { displayName: "4月", businessDate: "2026-04-01", sourceCode: "CONTACTS_27", classification: "IMPORTABLE" },
    { displayName: "5月", lineRegistrationDate: "2026-05-12", sourceCode: "ENTRIES_27", classification: "IMPORTABLE" }
  ];

  assert.deepEqual(buildMonthlyFollowUpFilter("2026-05"), { query: "", source: "ALL", state: "ALL", progress: "ALL", month: "2026-05" });
  assert.equal(buildMonthlyFollowUpFilter("2026-5"), null);
  assert.deepEqual(filterTalentStudents(rows, buildMonthlyFollowUpFilter("2026-05")).map((row) => row.displayName), ["5月"]);
  assert.equal(getTalentStudentMonthKey(rows[0]), "2026-04");
  assert.equal(classifyTalentStudentFollowUp({ nextActionAt: "2026-07-20" }, "2026-07-26"), "OVERDUE");
  assert.equal(classifyTalentStudentFollowUp({ nextActionAt: "2026-07-30" }, "2026-07-26"), "NEXT_7_DAYS");
  assert.equal(classifyTalentStudentFollowUp({ nextActionAt: "2026-08-10" }, "2026-07-26"), "SCHEDULED");
  assert.equal(classifyTalentStudentFollowUp({}, "2026-07-26"), "UNSCHEDULED");
  assert.deepEqual(sortTalentStudentsByFollowUp([
    { displayName: "未設定" },
    { displayName: "予定", nextActionAt: "2026-08-10" },
    { displayName: "期限超過", nextActionAt: "2026-07-20" },
    { displayName: "直近", nextActionAt: "2026-07-30" }
  ], "FOLLOW_UP", "2026-07-26").map((row) => row.displayName), ["期限超過", "直近", "予定", "未設定"]);
  assert.match(html, /id="student-month-filter"/);
  assert.match(html, /id="student-follow-up-filter"/);
  assert.match(html, /id="student-sort-filter"/);
  assert.match(app, /student-list-followup/);
  assert.match(html, /id="student-filter-reset"/);
  assert.match(app, /updateStudentFilterResetState/);
  assert.match(html, /id="student-detail-next-action"/);
  assert.match(app, /student-detail-next-action/);
  assert.match(html, /<th>記録月<\/th>[\s\S]*<th>フォロー<\/th>/);
  assert.match(app, /button\.textContent = "対象月を見る"/);
  assert.match(app, /renderStudentMonthFilterOptions/);
});

test("workforce management exposes four accessible procedure tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /aria-label="現職者管理メニュー"/);
  for (const key of ["onboarding", "transfer", "leave", "retirement"]) {
    assert.match(html, new RegExp(`data-workforce-tab="${key}"`));
    assert.match(html, new RegExp(`id="workforce-${key}"[\\s\\S]*role="tabpanel"`));
  }
  assert.match(html, /data-workforce-tab="transfer" data-procedure-type="TRANSFER"/);
  assert.match(html, /data-workforce-tab="retirement" data-procedure-type="RETIREMENT"/);
  for (const procedureType of ["ONBOARDING", "TRANSFER", "LEAVE", "RETIREMENT"]) {
    assert.match(html, new RegExp(`data-procedure-new="${procedureType}"`));
  }
  assert.match(app, /WORKFORCE_TABS/);
  assert.match(app, /data-workforce-tab/);
  assert.match(app, /data-workforce-open/);
});

test("workforce procedure tabs expose bounded Core DB case queues", async () => {
  const html = await readFile("portal/talent/index.html", "utf8");
  const source = await readFile("portal/talent/workforce-readiness.mjs", "utf8");

  for (const key of ["onboarding", "leave", "retirement"]) {
    assert.match(html, new RegExp(`id="workforce-queue-${key}"`));
  }
  assert.match(source, /procedureQueues/);
  assert.match(source, /contactValuesReturned: false/);
});

test("workforce exposes an audited procedure case desk without employee-master controls", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const source = await readFile(new URL("workforce-procedures.mjs", root), "utf8");

  assert.match(html, /id="workforce-procedure-desk"/);
  assert.match(html, /id="workforce-case-form"/);
  assert.match(html, /name="procedureType"/);
  assert.match(html, /name="caseStatus"/);
  assert.match(html, /id="workforce-case-new"/);
    assert.match(html, /id="workforce-case-overview"/);
    assert.match(html, /data-case-status-filter="OPEN"/);
  assert.match(html, /data-case-status-filter="READY_FOR_REVIEW"/);
  assert.match(html, /id="workforce-case-steps"/);
    assert.match(html, /id="workforce-case-priority-status"/);
    assert.match(html, /id="workforce-case-procedure-filter"/);
    assert.match(html, /id="workforce-case-search"/);
    assert.match(html, /id="workforce-case-filter-reset"/);
  assert.match(html, /data-case-priority-filter="OVERDUE"/);
  assert.match(html, /社員マスタは変更しません/);
  assert.match(source, /employeeMasterMutation: false/);
  assert.match(source, /const resetFilters/);
  assert.match(source, /procedure-case-empty-reset/);
  assert.match(source, /optimisticConcurrency: true/);
  assert.match(source, /filterWorkforceProcedureCases/);
  assert.match(source, /checklistTracking: true/);
  assert.match(source, /isWorkforceProcedureCaseReadyToConfirm/);
  assert.match(source, /sortWorkforceProcedureCases/);
  assert.match(source, /filterWorkforceProcedureCasesByType/);
    assert.match(source, /filterWorkforceProcedureCasesByPriority/);
    assert.match(source, /filterWorkforceProcedureCasesByQuery/);
    assert.match(source, /nov-talent:open-procedure-case/);
    assert.match(html, /id="workforce-queue-onboarding"/);
});

test("student editing supports canonical profiles and unmapped staging rows", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-edit-open"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(html, /id="student-action-guide"/);
  assert.match(app, /editButton\.disabled = !editable/);
  assert.match(app, /renderStudentActionGuide/);
  assert.match(app, /取込原本は保護された状態です/);
  assert.match(app, /student\.mappingStatus === "UNMAPPED"/);
  assert.match(app, /staging補足情報を保存しています/);
  assert.match(app, /createTalentStagingSupplementController/);
});

test("student detail exposes an individual confirmation action without replacing the bulk flow", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-confirm-open"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(app, /buildSingleStudentReviewProposal/);
  assert.match(app, /student\.suggestionCategory === "EXACT1"/);
  assert.match(app, /confirmButton\.disabled = !historicalReviewController\.enabled/);
  assert.match(app, /この候補だけを確認/);
  assert.match(app, /既存名簿との一致だけを反映しますか/);
  assert.match(html, /id="student-review-target"/);
  assert.match(app, /ENTRIES_27/, "manual mapping is available for entry records");
  assert.match(app, /OFFERS_27/, "manual mapping is available for offer records");
});

test("ready offers can hand off a bounded draft to onboarding without creating a case", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const ready = buildOnboardingHandoffDraft({
    applicationNo: "NT-2027-000001",
    displayName: "対象者",
    statusCode: "OFFER",
    expectedJoinDate: "2027-04-01"
  });

  assert.deepEqual(ready, {
    procedureType: "ONBOARDING",
    subjectLabel: "対象者",
    effectiveDate: "2027-04-01"
  });
  assert.equal(buildOnboardingHandoffDraft({ ...ready, applicationNo: "", statusCode: "OFFER" }), null);
  assert.equal(buildOnboardingHandoffDraft({ ...ready, applicationNo: "NT-2027-000001", statusCode: "CONTACT" }), null);
  assert.match(html, /id="student-onboarding-open"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(app, /nov-talent:open-procedure-case/);
  assert.match(app, /保存するまで案件は作成されません/);
});

test("single link confirmation includes an unmapped contact target as the primary step", () => {
  const proposal = buildSingleStudentReviewProposal({
    recordId: "00000000-0000-4000-8000-000000000002",
    mappingStatus: "UNMAPPED",
    primaryEligible: false,
    suggestionCategory: "EXACT1",
    suggestedTargetRecordId: "00000000-0000-4000-8000-000000000001"
  }, {
    students: [{
      recordId: "00000000-0000-4000-8000-000000000001",
      sourceCode: "CONTACTS_27",
      mappingStatus: "UNMAPPED"
    }]
  });

  assert.deepEqual(proposal.primaryRecordIds, ["00000000-0000-4000-8000-000000000001"]);
  assert.equal(proposal.linkPairs.length, 1);
});

test("single review can build a manually selected contact mapping", () => {
  const proposal = buildSingleStudentReviewProposal({
    recordId: "00000000-0000-4000-8000-000000000012",
    mappingStatus: "UNMAPPED",
    primaryEligible: false,
    suggestionCategory: "NONE"
  }, {
    students: [{
      recordId: "00000000-0000-4000-8000-000000000013",
      sourceCode: "CONTACTS_27",
      mappingStatus: "UNMAPPED"
    }]
  }, "00000000-0000-4000-8000-000000000013");

  assert.deepEqual(proposal.primaryRecordIds, ["00000000-0000-4000-8000-000000000013"]);
  assert.deepEqual(proposal.linkPairs, [{
    sourceRecordId: "00000000-0000-4000-8000-000000000012",
    targetRecordId: "00000000-0000-4000-8000-000000000013"
  }]);
});

test("student review KPIs separate owner review, quarantine, and confirmed states", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  for (const id of ["student-owner-review", "student-quarantine", "student-importable"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(app, /"student-owner-review": overview\.ownerReview/);
  assert.match(app, /"student-quarantine": overview\.quarantined/);
  assert.match(app, /"student-importable": overview\.mapped/);
});

test("bulk triage separates exact matches, new candidates, ambiguous rows, and holds", () => {
  const counts = buildBulkTriageCounts([
    { mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "EXACT1" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "AMBIGUOUS" },
    { mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" },
    { mappingStatus: "OWNER_CONFIRMED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }
  ]);

  assert.deepEqual(counts, { exact1: 1, newApplicant: 1, ambiguous: 1, hold: 1 });
});

test("new applicant candidate filtering stays limited to unmapped entry and offer rows", () => {
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "NONE" }), true);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" }), true);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "OWNER_CONFIRMED", sourceCode: "ENTRIES_27", suggestionCategory: "NONE" }), false);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }), false);
});

test("student list filter keeps new candidates visible and narrows review queues", () => {
  const rows = [
    { displayName: "接触候補", sourceCode: "CONTACTS_27", classification: "OWNER_REVIEW", mappingStatus: "UNMAPPED", suggestionCategory: "NONE", statusCode: "CONTACT" },
    { displayName: "新規候補", sourceCode: "ENTRIES_27", classification: "OWNER_REVIEW", mappingStatus: "UNMAPPED", suggestionCategory: "NONE", statusCode: "INTERVIEW" },
    { displayName: "確認済み", sourceCode: "OFFERS_27", classification: "IMPORTABLE", mappingStatus: "OWNER_CONFIRMED", suggestionCategory: "NONE", statusCode: "OFFER" },
    { displayName: "隔離", sourceCode: "OFFERS_27", classification: "QUARANTINE", mappingStatus: "UNMAPPED", suggestionCategory: "AMBIGUOUS", statusCode: "WITHDRAWN" },
    { displayName: "未登録", sourceCode: "CONTACTS_27", classification: "IMPORTABLE", mappingStatus: "OWNER_CONFIRMED", suggestionCategory: "NONE", statusCode: null }
  ];

  assert.deepEqual(filterTalentStudents(rows, { state: "NEW_CANDIDATE" }).map((row) => row.displayName), ["新規候補"]);
  assert.deepEqual(filterTalentStudents(rows, { state: "QUARANTINE" }).map((row) => row.displayName), ["隔離"]);
  assert.deepEqual(filterTalentStudents(rows, { source: "ENTRIES_27" }).map((row) => row.displayName), ["新規候補"]);
  assert.deepEqual(filterTalentStudents(rows, { progress: "OFFER" }).map((row) => row.displayName), ["確認済み"]);
  assert.deepEqual(filterTalentStudents(rows, { progress: "WITHDRAWN" }).map((row) => row.displayName), ["隔離"]);
  assert.deepEqual(filterTalentStudents(rows, { progress: "UNSET" }).map((row) => row.displayName), ["未登録"]);
  assert.equal(getTalentStudentProgressKey({ statusCode: null }), "UNSET");
});

test("student list keeps safe review reasons visible before selection", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(app, /student.reasonLabels\.filter\(Boolean\)\.slice\(0, 2\)/);
  assert.match(app, /確認事項: \$\{reasons\.join\("・"\)\}/);
  assert.match(css, /\.student-list-reason\s*\{/);
});

test("student quick filters expose their queue counts", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-filter-review"[^>]*data-label="要確認"/);
  assert.match(html, /id="student-progress-filter"/);
  assert.match(html, /option value="UNSET">選考状況 未登録<\/option>/);
  assert.match(html, /option value="WITHDRAWN">辞退・保管<\/option>/);
  assert.match(app, /filterTalentStudents\(students, \{ state: value \}\)\.length/);
  assert.match(app, /button\.setAttribute\("aria-label", `\$\{label\} \$\{count\}件`\)/);
});

test("bulk confirmation proposal contains only exact roster links", () => {
  const proposal = buildMatchOnlyReviewProposal({ students: [
    { recordId: "00000000-0000-4000-8000-000000000001", mappingStatus: "UNMAPPED", primaryEligible: true, sourceCode: "CONTACTS_27" },
    { recordId: "00000000-0000-4000-8000-000000000002", mappingStatus: "UNMAPPED", suggestionCategory: "EXACT1", suggestedTargetRecordId: "00000000-0000-4000-8000-000000000003", sourceCode: "ENTRIES_27" },
    { recordId: "00000000-0000-4000-8000-000000000004", mappingStatus: "UNMAPPED", suggestionCategory: "NONE", sourceCode: "OFFERS_27" }
  ] });
  assert.deepEqual(proposal.primaryRecordIds, []);
  assert.deepEqual(proposal.linkPairs, [{
    sourceRecordId: "00000000-0000-4000-8000-000000000002",
    targetRecordId: "00000000-0000-4000-8000-000000000003"
  }]);
});

test("navigation supports keyboard movement and responsive one-column layouts", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(app, /ArrowRight/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /Home/);
  assert.match(app, /End/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /\.primary-tabs\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.workforce-summary\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
