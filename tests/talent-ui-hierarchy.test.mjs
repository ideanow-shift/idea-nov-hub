import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBulkTriageCounts, buildBulkTriageQueueFilter, buildMatchOnlyReviewProposal, buildMonthlyFollowUpFilter, buildOnboardingHandoffDraft, buildReviewWorkloadApprovalGuide, buildReviewWorkloadGuide, buildReviewWorkloadSteps, buildSchoolFollowUpFilter, buildSingleStudentReviewProposal, buildStudentDailyCompletionChecklist, buildStudentDailyOperation, buildStudentDailyQueueStartFilter, buildStudentDailyQueueStartGuide, buildStudentDailyQueueSummary, buildStudentEmptyState, buildStudentFilterSummary, buildStudentReviewBoundary, buildStudentReviewDecisionGuide, buildStudentReviewLaneSteps, buildStudentReviewModeCopy, buildStudentReviewQueuePriority, buildSummaryFollowUpFilter, classifyTalentStudentFollowUp, filterTalentStudents, getTalentStudentMonthKey, getTalentStudentProgressKey, isNewApplicantCandidate, sortTalentStudentsByFollowUp } from "../portal/talent/app.mjs";

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

test("daily command center opens safe work areas without writes", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="talent-daily-command"/);
  assert.match(html, /data-talent-daily-open="students"/);
  assert.match(html, /data-talent-daily-open="workforce"/);
  assert.match(html, /data-talent-daily-open="csv28"/);
  assert.match(css, /\.talent-daily-command/);
  assert.match(css, /\.talent-daily-command-actions/);
  assert.match(app, /data-talent-daily-open/);
  assert.match(app, /student-daily-queue-start-guide/);
  assert.match(app, /workforce-case-operation-start-guide/);
  assert.match(app, /talent-28-csv-title/);
  assert.doesNotMatch(html, /data-talent-daily-open[\s\S]{0,260}(commit|promotion|LINE履歴|社員マスタへ直接反映)/i);
});

test("recruitment subtabs stay visually and semantically below the primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /class="secondary-tabs"[\s\S]*全体サマリー/);
  assert.match(html, /data-secondary-tab="students"[\s\S]*学生フォロー/);
  assert.match(html, /data-secondary-tab="fairs"[\s\S]*フェア分析/);
  assert.match(html, /data-secondary-tab="schools"[\s\S]*学校分析/);
  assert.match(html, /id="talent-28-csv-file"/);
  assert.match(html, /id="talent-28-csv-template"/);
  assert.match(html, /csv-source-type-legend/);
  assert.match(html, /CONTACTS_28/);
  assert.match(html, /id="talent-28-csv-plan"/);
  assert.match(html, /id="talent-28-csv-receipt"/);
  assert.match(html, /id="talent-28-csv-fix-guide"/);
  assert.match(html, /28卒CSV 形式検証/);
  assert.match(app, /initializeTalent28CsvPreflight/);
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
  assert.match(html, /id="school-top-open"/);
  assert.match(app, /button\.textContent = "学生を見る"/);
  assert.match(app, /openSchoolStudentWorkspace/);
  assert.match(app, /dataset\.schoolName/);
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

test("student workspace summarizes active filters from analysis shortcuts", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.deepEqual(buildStudentFilterSummary().labels, []);
  assert.deepEqual(buildStudentFilterSummary({
    query: "NOV美容専門学校",
    source: "ALL",
    state: "NEEDS_ACTION",
    progress: "ALL",
    month: "2026-05",
    followUp: "NEXT_7_DAYS",
    sort: "FOLLOW_UP"
  }), {
    active: true,
    title: "条件を絞って表示中",
    labels: [
      "検索: NOV美容専門学校",
      "状態: 要確認・隔離",
      "記録月: 2026-05",
      "対応期限: 7日以内",
      "並び順: 対応期限順"
    ]
  });
  assert.match(html, /id="student-filter-summary"/);
  assert.match(html, /id="student-filter-summary-chips"/);
  assert.match(app, /renderStudentFilterSummary/);
  assert.match(app, /buildStudentFilterSummary\(\{ query, source, state, progress, month, followUp, sort \}\)/);
});

test("student workspace empty state explains missing data versus active filters", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.equal(buildStudentEmptyState({ total: 0, visible: 0 }).canReset, false);
  assert.match(buildStudentEmptyState({ total: 0, visible: 0 }).title, /まだありません/);
  assert.equal(buildStudentEmptyState({ total: 4, visible: 0, hasActiveFilters: true }).canReset, true);
  assert.match(buildStudentEmptyState({ total: 4, visible: 0, hasActiveFilters: true }).copy, /条件をゆるめる/);
  assert.equal(buildStudentEmptyState({ total: 4, visible: 2, hasActiveFilters: true }).visible, false);
  assert.match(html, /id="student-empty-title"/);
  assert.match(html, /id="student-empty-reset"/);
  assert.match(app, /renderStudentEmptyState/);
  assert.match(app, /hasActiveStudentFilters/);
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
  assert.match(html, /id="student-detail-followup-state"/);
  assert.match(app, /student-detail-next-action/);
  assert.match(app, /期限超過: 優先対応/);
  assert.match(html, /<th>記録月<\/th>[\s\S]*<th>フォロー<\/th>/);
  assert.match(html, /id="fair-latest-month-open"/);
  assert.match(app, /button\.textContent = "対象月を見る"/);
  assert.match(app, /dataset\.monthKey/);
  assert.match(app, /renderStudentMonthFilterOptions/);
});

test("student detail guides the daily operation without exposing raw values", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-daily-operation"/);
  assert.match(html, /id="student-daily-operation-badge"/);
  assert.match(html, /id="student-daily-operation-steps"/);
  assert.match(app, /buildStudentDailyOperation/);
  assert.match(app, /renderStudentDailyOperation/);
  assert.match(app, /判断できないものは隔離維持/);
  assert.match(app, /一括反映ではなく、この学生だけを確認できます/);

  assert.equal(buildStudentDailyOperation(null).category, "NO_SELECTION");
  assert.equal(buildStudentDailyOperation({
    applicationNo: "NT-2027-000001",
    statusCode: "OFFER",
    expectedJoinDate: "2027-04-01",
    nextActionAt: "2026-07-20"
  }, { onboardingReady: true, editable: true }, "2026-07-26").category, "ONBOARDING_HANDOFF");
  assert.equal(buildStudentDailyOperation({
    nextActionAt: "2026-07-20",
    classification: "IMPORTABLE"
  }, { editable: true }, "2026-07-26").category, "OVERDUE_FOLLOW_UP");
  assert.equal(buildStudentDailyOperation({
    nextActionAt: "2026-07-30",
    classification: "OWNER_REVIEW"
  }, { confirmable: true }, "2026-07-26").category, "NEXT_WEEK_FOLLOW_UP");
  assert.equal(buildStudentDailyOperation({
    classification: "OWNER_REVIEW",
    mappingStatus: "UNMAPPED"
  }, { confirmable: true }, "2026-07-26").category, "OWNER_REVIEW");
  assert.equal(buildStudentDailyOperation({
    classification: "QUARANTINE",
    mappingStatus: "UNMAPPED"
  }, { editable: true }, "2026-07-26").category, "QUARANTINE_REVIEW");
});

test("student detail explains completion evidence after the next action", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");
  const overdue = buildStudentDailyCompletionChecklist(buildStudentDailyOperation({
    nextActionAt: "2026-07-20",
    classification: "IMPORTABLE"
  }, { editable: true }, "2026-07-26"));
  const onboarding = buildStudentDailyCompletionChecklist(buildStudentDailyOperation({
    statusCode: "OFFER",
    expectedJoinDate: "2027-04-01",
    nextActionAt: "2026-07-20"
  }, { onboardingReady: true, editable: true }, "2026-07-26"));

  assert.equal(overdue.category, "OVERDUE_FOLLOW_UP");
  assert.match(overdue.title, /overdue follow-up/);
  assert.equal(overdue.rawValuesIncluded, false);
  assert.equal(overdue.canonicalWriteReachable, false);
  assert.equal(overdue.lineHistoryWriteReachable, false);
  assert.equal(overdue.automaticPromotionReachable, false);
  assert.equal(onboarding.category, "ONBOARDING_HANDOFF");
  assert.match(onboarding.copy, /local/);
  assert.match(html, /id="student-daily-completion"/);
  assert.match(html, /id="student-daily-completion-steps"/);
  assert.match(app, /renderStudentDailyCompletionChecklist/);
  assert.match(css, /student-daily-completion/);
});

test("student workspace summarizes today's follow-up queue before selecting a row", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");
  const summary = buildStudentDailyQueueSummary([
    { nextActionAt: "2026-07-20", classification: "IMPORTABLE" },
    { nextActionAt: "2026-07-30", classification: "OWNER_REVIEW" },
    { classification: "QUARANTINE" },
    { statusCode: "OFFER", expectedJoinDate: "2027-04-01", classification: "IMPORTABLE" }
  ], "2026-07-26");

  assert.equal(summary.category, "OVERDUE_FIRST");
  assert.equal(summary.counts.overdue, 1);
  assert.equal(summary.counts.nextWeek, 1);
  assert.equal(summary.counts.ownerReview, 1);
  assert.equal(summary.counts.quarantine, 1);
  assert.equal(summary.counts.onboardingReady, 1);
  assert.deepEqual(summary.steps.map((step) => step.category), ["OPEN_OVERDUE", "UPDATE_NEXT_ACTION", "LEAVE_AUDIT"]);
  assert.equal(summary.rawValuesIncluded, false);
  assert.equal(summary.canonicalWriteReachable, false);
  assert.equal(summary.lineHistoryWriteReachable, false);
  const startGuide = buildStudentDailyQueueStartGuide(summary);
  assert.equal(startGuide.category, "START_OVERDUE_FILTER");
  assert.equal(startGuide.filterCategory, "FOLLOW_UP_OVERDUE");
  assert.equal(startGuide.rawValuesIncluded, false);
  assert.equal(startGuide.canonicalWriteReachable, false);
  assert.equal(startGuide.lineHistoryWriteReachable, false);
  assert.equal(startGuide.automaticPromotionReachable, false);
  assert.deepEqual(buildStudentDailyQueueStartFilter(startGuide.filterCategory), {
    query: "",
    source: "ALL",
    state: "ALL",
    progress: "ALL",
    month: "ALL",
    followUp: "OVERDUE",
    sort: "FOLLOW_UP",
    rawValuesIncluded: false,
    canonicalWriteReachable: false,
    lineHistoryWriteReachable: false,
    automaticPromotionReachable: false
  });
  const reviewGuide = buildStudentDailyQueueStartGuide(buildStudentDailyQueueSummary([
    { classification: "OWNER_REVIEW" }
  ], "2026-07-26"));
  assert.equal(reviewGuide.category, "START_OWNER_REVIEW_FILTER");
  assert.equal(reviewGuide.filterCategory, "STATE_OWNER_REVIEW");
  assert.equal(buildStudentDailyQueueStartFilter(reviewGuide.filterCategory).state, "OWNER_REVIEW");
  assert.match(html, /id="student-daily-queue-summary"/);
  assert.match(html, /id="student-daily-queue-steps"/);
  assert.match(html, /id="student-daily-queue-start-guide"/);
  assert.match(html, /id="student-daily-queue-start-steps"/);
  assert.match(html, /id="student-daily-queue-start-button"/);
  assert.match(app, /renderStudentDailyQueueSummary/);
  assert.match(app, /renderStudentDailyQueueStartGuide/);
  assert.match(app, /buildStudentDailyQueueStartFilter/);
  assert.match(css, /student-daily-queue-summary/);
  assert.match(css, /student-daily-queue-start-guide/);
});

test("student detail marks safe review lanes for bulk, individual, and quarantine work", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.equal(buildStudentReviewBoundary({
    mappingStatus: "UNMAPPED",
    suggestionCategory: "EXACT1",
    suggestedTargetRecordId: "target-1"
  }).category, "BULK_SAFE_EXACT_LINK");
  assert.equal(buildStudentReviewBoundary({
    mappingStatus: "UNMAPPED",
    sourceCode: "OFFERS_27",
    suggestionCategory: "NONE"
  }, { confirmable: true }).category, "INDIVIDUAL_REVIEW");
  assert.equal(buildStudentReviewBoundary({
    mappingStatus: "UNMAPPED",
    classification: "QUARANTINE",
    suggestionCategory: "AMBIGUOUS"
  }).category, "QUARANTINE_HOLD");
  const bulkLaneSteps = buildStudentReviewLaneSteps(buildStudentReviewBoundary({
    mappingStatus: "UNMAPPED",
    suggestionCategory: "EXACT1",
    suggestedTargetRecordId: "target-1"
  }));
  const bulkPriority = buildStudentReviewQueuePriority(buildStudentReviewBoundary({
    mappingStatus: "UNMAPPED",
    suggestionCategory: "EXACT1",
    suggestedTargetRecordId: "target-1"
  }));
  const quarantineDecision = buildStudentReviewDecisionGuide(buildStudentReviewBoundary({
    mappingStatus: "UNMAPPED",
    classification: "QUARANTINE",
    suggestionCategory: "AMBIGUOUS"
  }));
  assert.deepEqual(bulkLaneSteps.steps.map((step) => step.order), [1, 2, 3]);
  assert.deepEqual(bulkLaneSteps.steps.map((step) => step.label), ["一括対象に含める", "新規・隔離を混ぜない", "反映後に確認済みへ進める"]);
  assert.equal(bulkLaneSteps.rawValuesIncluded, false);
  assert.equal(bulkLaneSteps.canonicalWriteReachable, false);
  assert.equal(bulkLaneSteps.lineHistoryWriteReachable, false);
  assert.equal(bulkPriority.label, "整理順 1: 一括対象");
  assert.equal(bulkPriority.rawValuesIncluded, false);
  assert.equal(bulkPriority.automaticPromotionReachable, false);
  assert.equal(quarantineDecision.label, "判断: 隔離を維持");
  assert.equal(quarantineDecision.rawValuesIncluded, false);
  assert.equal(quarantineDecision.automaticPromotionReachable, false);
  assert.match(buildStudentReviewBoundary({ mappingStatus: "OWNER_CONFIRMED" }).caution, /staging原本は変更しません/);
  assert.match(html, /id="student-review-boundary"/);
  assert.match(html, /id="student-review-boundary-allowed"/);
  assert.match(html, /id="student-review-boundary-steps"/);
  assert.match(html, /id="student-review-decision"/);
  assert.match(html, /id="student-review-decision-command"/);
  assert.match(app, /buildStudentReviewLaneSteps/);
  assert.match(app, /buildStudentReviewDecisionGuide/);
  assert.match(app, /buildStudentReviewQueuePriority/);
  assert.match(app, /renderStudentReviewBoundary/);
  assert.match(app, /student-review-decision-label/);
  assert.match(app, /自動昇格・一括混入/);
  assert.match(css, /\.student-review-boundary/);
  assert.match(css, /\.student-review-boundary-steps/);
  assert.match(css, /\.student-review-decision/);
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

test("workforce management explains read-only and approval boundaries above cases", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(html, /id="workforce-operation-boundaries"/);
  assert.match(html, /社員マスタは正本参照だけ/);
  assert.match(html, /日常作業は案件で管理/);
  assert.match(html, /Core反映は別承認/);
  assert.match(html, /大量更新・削除は別の承認導線/);
  assert.match(css, /\.workforce-operation-boundaries/);
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
  assert.match(html, /id="workforce-case-form-guide"/);
  assert.match(html, /id="workforce-case-form-guide-list"/);
  assert.match(html, /id="workforce-case-transition-plan"/);
  assert.match(html, /id="workforce-case-transition-plan-list"/);
  assert.match(html, /id="workforce-case-checklist-plan"/);
  assert.match(html, /id="workforce-case-checklist-plan-list"/);
  assert.match(html, /name="procedureType"/);
  assert.match(html, /name="caseStatus"/);
  assert.match(html, /id="workforce-case-new"/);
    assert.match(html, /id="workforce-case-overview"/);
    assert.match(html, /data-case-status-filter="OPEN"/);
  assert.match(html, /data-case-status-filter="READY_FOR_REVIEW"/);
  assert.match(html, /id="workforce-case-steps"/);
    assert.match(html, /id="workforce-case-priority-status"/);
    assert.match(html, /id="workforce-case-operation-summary"/);
    assert.match(html, /class="procedure-case-operation-actions"/);
    assert.match(html, /id="workforce-case-operation-steps"/);
    assert.match(html, /data-workforce-operation-filter="OVERDUE"/);
    assert.match(html, /data-workforce-operation-filter="READY_FOR_REVIEW"/);
    assert.match(html, /id="workforce-case-type-summary"/);
    assert.match(html, /id="workforce-case-type-onboarding-open"/);
    assert.match(html, /data-procedure-type-summary="ONBOARDING"/);
    assert.match(html, /id="workforce-case-procedure-filter"/);
    assert.match(html, /id="workforce-case-search"/);
    assert.match(html, /id="workforce-case-filter-reset"/);
  assert.match(html, /data-case-priority-filter="OVERDUE"/);
  assert.match(html, /社員マスタは変更しません/);
  assert.match(source, /employeeMasterMutation: false/);
  assert.match(source, /const resetFilters/);
  assert.match(source, /procedure-case-empty-reset/);
  assert.match(source, /buildWorkforceProcedureEmptyState/);
  assert.match(source, /procedure-case-empty-new/);
  assert.match(source, /buildWorkforceProcedureTypeSummary/);
  assert.match(source, /data-procedure-type-summary/);
  assert.match(source, /optimisticConcurrency: true/);
  assert.match(source, /filterWorkforceProcedureCases/);
  assert.match(source, /checklistTracking: true/);
  assert.match(source, /isWorkforceProcedureCaseReadyToConfirm/);
  assert.match(source, /buildWorkforceProcedureConfirmationReadiness/);
  assert.match(source, /READY_TO_CONFIRM/);
  assert.match(source, /sortWorkforceProcedureCases/);
  assert.match(source, /buildWorkforceProcedureCaseNextAction/);
  assert.match(source, /procedure-case-next-action/);
  assert.match(source, /procedure-case-next-action-chips/);
  assert.match(source, /safetyBoundary/);
  assert.match(source, /buildWorkforceProcedureOperationSummary/);
  assert.match(source, /buildWorkforceProcedureOperationFilter/);
  assert.match(source, /buildWorkforceProcedureOperationSteps/);
  assert.match(source, /data-workforce-operation-filter/);
  assert.match(source, /buildWorkforceProcedureCaseFormGuide/);
  assert.match(source, /buildWorkforceProcedureFormSubmitReadiness/);
  assert.match(source, /renderFormGuide/);
  assert.match(source, /requiredReady/);
  assert.match(source, /buildWorkforceProcedureStatusTransitionPlan/);
  assert.match(source, /renderTransitionPlan/);
  assert.match(source, /invalid_status_transition/);
  assert.match(source, /buildWorkforceProcedureChecklistPlan/);
  assert.match(source, /renderChecklistPlan/);
  assert.match(source, /buildWorkforceProcedureAuditSummary/);
  assert.match(source, /dataset\.nextAction/);
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
  assert.match(html, /id="student-next-action-open"[^>]*disabled[^>]*aria-disabled="true"/);
  assert.match(html, /id="student-action-guide"/);
  assert.match(app, /editButton\.disabled = !editable/);
  assert.match(app, /openStudentProfileDialog\(\{ documentObject, student, focusField: "profile-next-action" \}\)/);
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
  assert.match(html, /id="student-review-mode-note"/);
  assert.match(app, /renderStudentReviewMode/);
  assert.match(html, /id="student-review-target"/);
  assert.match(app, /ENTRIES_27/, "manual mapping is available for entry records");
  assert.match(app, /OFFERS_27/, "manual mapping is available for offer records");
});

test("student review dialog explains bulk and individual confirmation modes", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");
  const bulk = buildStudentReviewModeCopy("BULK_MATCH_ONLY");
  const single = buildStudentReviewModeCopy("SINGLE_STUDENT");

  assert.deepEqual(bulk, {
    mode: "BULK_MATCH_ONLY",
    title: "一括反映は一致候補だけに限定します",
    copy: "新規候補・曖昧行・隔離行は含めず、個別確認に残します。"
  });
  assert.equal(single.mode, "SINGLE_STUDENT");
  assert.match(single.title, /この学生だけ/);
  assert.match(single.copy, /一括反映とは別/);
  assert.match(html, /id="student-review-mode-title"/);
  assert.match(html, /id="student-review-mode-copy"/);
  assert.match(css, /\.review-mode-note/);
  assert.match(css, /\[data-mode="SINGLE_STUDENT"\]/);
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
  assert.deepEqual(buildBulkTriageQueueFilter("newApplicant"), { query: "", source: "ALL", state: "NEW_CANDIDATE", progress: "ALL" });
  assert.deepEqual(buildBulkTriageQueueFilter("ambiguous"), { query: "", source: "ALL", state: "NEEDS_ACTION", progress: "ALL" });
  assert.deepEqual(buildBulkTriageQueueFilter("hold"), { query: "", source: "ALL", state: "NEEDS_ACTION", progress: "ALL" });
  assert.equal(buildBulkTriageQueueFilter("unknown"), null);
});

test("review workload guide separates bulk-safe, individual, and quarantine work", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const guide = buildReviewWorkloadGuide([
    { mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "EXACT1" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" },
    { mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "AMBIGUOUS" },
    { mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" },
    { mappingStatus: "OWNER_CONFIRMED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }
  ]);

  assert.equal(guide.nextAction, "BULK_MATCH_ONLY");
  assert.equal(guide.nextFilterState, "OWNER_REVIEW");
  assert.equal(guide.bulk, 1);
  assert.equal(guide.individual, 1);
  assert.equal(guide.quarantine, 2);
  const steps = buildReviewWorkloadSteps(guide);
  const approvalGuide = buildReviewWorkloadApprovalGuide(guide);
  assert.deepEqual(steps.map((step) => step.category), ["BULK_MATCH_ONLY", "INDIVIDUAL_REVIEW", "KEEP_QUARANTINED"]);
  assert.equal(steps[0].isCurrent, true);
  assert.equal(steps[2].countCategory, "MULTIPLE");
  assert.equal(approvalGuide.category, "BULK_APPROVAL_READY");
  assert.equal(approvalGuide.approvalReachable, true);
  assert.equal(approvalGuide.canonicalWriteReachable, false);
  assert.equal(approvalGuide.lineHistoryWriteReachable, false);
  assert.equal(approvalGuide.rawValuesIncluded, false);
  assert.equal(buildReviewWorkloadApprovalGuide(buildReviewWorkloadGuide([{ mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" }])).category, "INDIVIDUAL_REVIEW_REQUIRED");
  assert.match(guide.nextTitle, /一致候補/);
  assert.match(guide.bulkCopy, /新規・曖昧行は混ぜません/);
  assert.match(html, /id="student-review-workload"/);
  assert.match(html, /id="review-workload-title"/);
  assert.match(html, /id="review-workload-open"/);
  assert.match(html, /id="review-workload-bulk"/);
  assert.match(html, /id="review-workload-individual"/);
  assert.match(html, /id="review-workload-quarantine"/);
  assert.match(html, /id="review-workload-steps"/);
  assert.match(html, /id="review-workload-approval-guide"/);
  assert.match(html, /id="triage-ambiguous-open"/);
  assert.match(html, /id="triage-hold-open"/);
  assert.match(html, /data-triage-queue="ambiguous"/);
  assert.match(app, /renderReviewWorkloadGuide/);
  assert.match(app, /buildReviewWorkloadSteps/);
  assert.match(app, /buildReviewWorkloadApprovalGuide/);
  assert.match(app, /buildBulkTriageQueueFilter/);
  assert.match(app, /nextFilterState/);
  assert.match(app, /review-workload-open/);
  assert.match(app, /data-triage-queue/);
  assert.match(app, /dataset\.nextAction = guide\.nextAction/);
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

test("student list exposes review lane badges before opening details", async () => {
  const app = await readFile(new URL("app.mjs", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  assert.match(app, /student-list-review-lane/);
  assert.match(app, /student-list-review-priority/);
  assert.match(app, /buildStudentReviewBoundary\(student/);
  assert.match(app, /isStudentIndividuallyConfirmable/);
  assert.match(css, /\.student-list-review-lane/);
  assert.match(css, /\.student-list-review-priority/);
  assert.match(css, /\[data-category="BULK_SAFE_EXACT_LINK"\]/);
  assert.match(css, /\[data-category="BULK_FIRST"\]/);
  assert.match(css, /\[data-category="QUARANTINE_HOLD"\]/);
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
