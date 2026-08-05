import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildBulkTriageCounts, buildBulkTriageQueueFilter, buildMatchOnlyReviewProposal, buildMonthlyFollowUpFilter, buildOnboardingHandoffDraft, buildReviewWorkloadApprovalGuide, buildReviewWorkloadGuide, buildReviewWorkloadSteps, buildSchoolFollowUpFilter, buildSingleStudentReviewProposal, buildStudentDailyCompletionChecklist, buildStudentDailyOperation, buildStudentDailyQueueStartFilter, buildStudentDailyQueueStartGuide, buildStudentDailyQueueSummary, buildStudentEmptyState, buildStudentFilterSummary, buildStudentReviewBoundary, buildStudentReviewDecisionGuide, buildStudentReviewLaneSteps, buildStudentReviewModeCopy, buildStudentReviewQueuePriority, buildSummaryFollowUpFilter, classifyTalentStudentFollowUp, filterTalentStudents, getTalentStudentMonthKey, getTalentStudentProgressKey, isContactShortageQuarantineReleaseCandidate, isNewApplicantCandidate, sortTalentStudentsByFollowUp } from "../portal/talent/app.mjs";

const root = new URL("../portal/talent/", import.meta.url);

test("NOV Talent exposes candidate recruitment only and separates NOV People", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /aria-label="求人管理の業務区分"/);
  assert.match(html, /data-primary-tab="recruitment"[\s\S]*求人管理/);
  assert.doesNotMatch(html, /data-primary-tab="workforce"/);
  assert.match(html, /id="panel-recruitment"[\s\S]*role="tabpanel"/);
  assert.match(html, /id="panel-workforce" class="primary-panel sprint1-separated"[\s\S]*aria-hidden="true"/);
  assert.match(html, /NOV Peopleへ分離/);
  assert.match(html, /assets\/icons\/human-resources\.svg/);
});

test("public branding describes the recruitment scope through planned entry", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const activeUi = html.split('<section id="panel-workforce"')[0];

  assert.match(html, /<title>NOV Talent \| 求人管理プラットフォーム<\/title>/);
  assert.match(activeUi, /<h1 id="dashboard-title">求人管理プラットフォーム<\/h1>/);
  assert.match(activeUi, /学生・フェア・学校・採用活動を、入社予定まで一元管理します。/);
  assert.match(activeUi, /学生・選考・入社予定/);
  assert.doesNotMatch(activeUi, /採用意思決定プラットフォーム|現職者管理|Employee Coreへ引継ぎ|NOV People/);
});

test("today dashboard starts daily work without navigation cards", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="talent-today-dashboard"/);
  assert.match(html, /TODAY'S DASHBOARD/);
  for (const label of ["今日やること", "期限超過", "今日の見学", "今日の面接", "連絡待ち", "新規学生", "最近更新された学生"]) {
    assert.match(html, new RegExp(label));
  }
  assert.doesNotMatch(html, /今日の作業|今日の業務をここから始める/);
  assert.doesNotMatch(html, /data-talent-daily-open|talent-daily-command-status|talent-daily-completion-checklist/);
  assert.doesNotMatch(html, /01 今日やること|02 学生|03 学生追加/);
  assert.match(css, /\.talent-today-dashboard-grid \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-today-dashboard-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.talent-today-dashboard-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(app, /export function buildTalentTodayDashboard/);
  assert.match(app, /renderTalentTodayDashboard/);
  assert.doesNotMatch(app, /data-talent-daily-open|announceDailyCommandRoute|focusDailyCommandTarget/);
  assert.doesNotMatch(html, /START HERE|TODAY'S WORK|NEXT OPERATION|FOLLOW-UP SHORTCUTS/);
  assert.doesNotMatch(app, /START HERE/);
  assert.doesNotMatch(html, /talent-today-dashboard[\s\S]{0,1200}(commit|promotion|LINE履歴|社員マスタへ直接反映)/i);
});

test("operator landing area hides implementation labels and stays mobile-safe", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const css = await readFile(new URL("style.css", root), "utf8");

  for (const internalLabel of ["BUILD PROGRESS", "FINAL READINESS", "HANDOFF SUMMARY", "100%完了", "残り0%", "READY_FOR_DAILY_USE_WITH_APPROVAL_GATES", "DAILY_OPERATION_UI_COMPLETE"]) {
    assert.doesNotMatch(html, new RegExp(internalLabel));
  }
  for (const removedId of ["talent-implementation-progress", "talent-final-readiness", "talent-launch-checklist", "talent-first-day-runbook", "talent-operation-handoff"]) {
    assert.doesNotMatch(html, new RegExp(`id="${removedId}"`));
  }
  assert.match(css, /body \{[\s\S]*overflow-x: hidden;/);
  assert.match(css, /\.dashboard-shell \{[\s\S]*overflow-x: hidden;/);
  assert.match(css, /\.summary-followup \{[\s\S]*display: grid;/);
  assert.match(html, /id="talent-analytics-action-guide"[\s\S]*hidden/);
  assert.match(css, /\.talent-analytics-action-guide\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.talent-analytics-action-steps \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.procedure-case-operation-summary \{[\s\S]*display: grid;/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-today-dashboard-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.summary-followup \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.summary-followup-actions \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-analytics-action-steps \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.talent-today-dashboard-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.summary-followup-actions \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.procedure-case-operation-action-mix dl/);
  assert.match(html, /id="operator-invalidation-code"[\s\S]*value="CANCELLED">キャンセル/);
  assert.match(html, /id="operator-invalidation-code"[\s\S]*value="NO_SHOW">無断欠席/);
  assert.match(html, /id="operator-invalidation-code"[\s\S]*value="DELETED">誤登録・削除/);
  assert.match(html, /id="operator-invalidation-code"[\s\S]*value="WITHDRAWN">辞退/);
  assert.doesNotMatch(html, />CANCELLED<|>NO_SHOW<|>DELETED<|>WITHDRAWN</);
  assert.doesNotMatch(css, /\.talent-implementation-progress|\.talent-final-readiness|\.talent-operation-handoff/);
  return;

  assert.match(html, /id="talent-implementation-progress"/);
  assert.match(html, /id="talent-next-build-targets"/);
  assert.match(html, /data-complete-percent="100" data-remaining-percent="0"/);
  assert.match(html, /id="talent-final-readiness"/);
  assert.match(html, /READY_FOR_DAILY_USE_WITH_APPROVAL_GATES/);
  assert.match(html, /id="talent-launch-checklist"/);
  assert.match(html, /LAUNCH_READY_WITH_APPROVAL_BOUNDARIES/);
  assert.match(html, /id="talent-first-day-runbook"/);
  assert.match(html, /FIRST_DAY_READY_WITH_SEPARATE_APPROVALS/);
  assert.match(html, /id="talent-operation-handoff"/);
  assert.match(html, /DAILY_OPERATION_UI_COMPLETE/);
  for (const area of ["DAILY_OPERATION", "OWNER_APPROVAL", "PUBLICATION"]) {
    assert.match(html, new RegExp(`data-readiness-area="${area}"`));
  }
  for (const category of ["START_FROM_DAILY_COMMAND", "USE_LIST_FILTERS", "VERIFY_APPROVAL_TEXT", "NO_DIRECT_PROMOTION"]) {
    assert.match(html, new RegExp(`data-category="${category}"`));
  }
  for (const category of ["CHECK_PUBLIC_PAGE", "OPEN_DAILY_COMMAND", "PROCESS_SAFE_QUEUES", "ESCALATE_APPROVAL_GATES", "REPORT_OS_PUBLICATION"]) {
    assert.match(html, new RegExp(`data-category="${category}"`));
  }
  for (const category of ["UI_READY", "APPROVALS_SEPARATE", "PUBLISHING_BY_OS"]) {
    assert.match(html, new RegExp(`data-category="${category}"`));
  }
  for (const area of ["STUDENT_FOLLOWUP", "ANALYTICS_ACTION", "CSV28_INTAKE", "WORKFORCE_CASES"]) {
    assert.match(html, new RegExp(`data-progress-area="${area}"`));
  }
  for (const target of ["WORKFORCE_HANDOFF", "CSV28_PREVIEW", "STUDENT_REVIEW"]) {
    assert.match(html, new RegExp(`data-next-build-target="${target}"`));
  }
  assert.match(html, /DB書込み、canonical昇格、LINE履歴、promotion、社員マスタ反映は別承認まで停止/);
  assert.match(css, /\.talent-implementation-progress/);
  assert.match(css, /\.talent-progress-grid/);
  assert.match(css, /\.talent-next-build-targets/);
  assert.match(css, /\.talent-final-readiness/);
  assert.match(css, /\.talent-launch-checklist/);
  assert.match(css, /\.talent-first-day-runbook/);
  assert.match(css, /\.talent-operation-handoff/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-progress-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-next-build-targets \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-final-readiness dl/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-launch-checklist ul \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-first-day-runbook ol \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.talent-operation-handoff \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.talent-progress-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.talent-launch-checklist ul \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.talent-first-day-runbook ol \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.talent-operation-handoff ul \{ grid-template-columns: 1fr; \}/);
  assert.doesNotMatch(html, /talent-implementation-progress[\s\S]{0,1200}(data-.*write|commit|社員マスタへ直接反映)/i);
});

test("recruitment subtabs stay visually and semantically below the primary tabs", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /class="secondary-tabs"[\s\S]*ダッシュボード/);
  assert.match(html, /data-secondary-tab="students"[\s\S]*学生一覧/);
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
    { displayName: "確認対象", sourceCode: "CONTACTS_27", classification: "OWNER_REVIEW", statusCode: "LINE_REGISTERED" },
    { displayName: "隔離対象", sourceCode: "OFFERS_27", classification: "QUARANTINE", statusCode: "OFFERED" },
    { displayName: "確認済み", sourceCode: "ENTRIES_27", classification: "IMPORTABLE", statusCode: "INTERVIEW_COMPLETED" }
  ];

  assert.deepEqual(buildSummaryFollowUpFilter("offers"), { query: "", source: "ALL", state: "ALL", progress: "OFFERED" });
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
    statusCode: "OFFERED",
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
    statusCode: "OFFERED",
    expectedJoinDate: "2027-04-01",
    nextActionAt: "2026-07-20"
  }, { onboardingReady: true, editable: true }, "2026-07-26"));

  assert.equal(overdue.category, "OVERDUE_FOLLOW_UP");
  assert.match(overdue.title, /期限超過/);
  assert.equal(overdue.rawValuesIncluded, false);
  assert.equal(overdue.canonicalWriteReachable, false);
  assert.equal(overdue.lineHistoryWriteReachable, false);
  assert.equal(overdue.automaticPromotionReachable, false);
  assert.equal(onboarding.category, "ONBOARDING_HANDOFF");
  assert.match(onboarding.copy, /入社予定/);
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
    { statusCode: "OFFERED", expectedJoinDate: "2027-04-01", classification: "IMPORTABLE" }
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
  assert.equal(reviewGuide.category, "START_STEADY_LIST");
  assert.equal(reviewGuide.filterCategory, "ALL_STUDENTS");
  assert.equal(buildStudentDailyQueueStartFilter(reviewGuide.filterCategory).state, "ALL");
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

test("NOV People procedure source is frozen and excluded from active navigation", async () => {
  const html = await readFile("portal/talent/index.html", "utf8");
  const source = await readFile("portal/talent/workforce-readiness.mjs", "utf8");

  assert.match(html, /id="panel-workforce" class="primary-panel sprint1-separated"/);
  assert.doesNotMatch(html, /data-primary-tab="workforce"/);
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

test("Sprint 1 keeps candidate write controls unreachable in Mock Runtime", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const app = await readFile(new URL("app.mjs", root), "utf8");

  assert.match(html, /id="student-edit-open"[^>]*sprint1-mock-write[^>]*hidden/);
  assert.match(html, /id="student-next-action-open"[^>]*sprint1-mock-write[^>]*hidden/);
  assert.match(html, /id="student-action-guide"/);
  assert.match(app, /createTalentWorkspaceExecutor/);
  assert.doesNotMatch(app, /^import .*student-profile/m);
  assert.doesNotMatch(app, /^import .*staging-supplement/m);
});

test("Sprint 1 separates historical confirmation actions from candidate detail", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");

  assert.match(html, /id="student-confirm-open"[^>]*sprint1-mock-write[^>]*hidden/);
  assert.match(html, /id="student-review-open"[^>]*sprint1-mock-write[^>]*hidden/);
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

test("Candidate to Employee handoff stays separated from NOV Talent Sprint 1", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  const ready = buildOnboardingHandoffDraft({
    applicationNo: "NT-2027-000001",
    displayName: "対象者",
    statusCode: "OFFERED",
    expectedJoinDate: "2027-04-01"
  });

  assert.deepEqual(ready, {
    procedureType: "ONBOARDING",
    subjectLabel: "対象者",
    effectiveDate: "2027-04-01"
  });
  assert.equal(buildOnboardingHandoffDraft({ ...ready, applicationNo: "", statusCode: "OFFERED" }), null);
  assert.equal(buildOnboardingHandoffDraft({ ...ready, applicationNo: "NT-2027-000001", statusCode: "LINE_REGISTERED" }), null);
  assert.doesNotMatch(html, /id="student-onboarding-open"/);
  assert.match(html, /id="panel-workforce" class="primary-panel sprint1-separated"/);
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
    { mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE", reasonCodes: ["SOURCE_KEY_UNPROVEN"] },
    { mappingStatus: "OWNER_CONFIRMED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }
  ]);

  assert.deepEqual(counts, { exact1: 1, newApplicant: 1, contactShortageRelease: 1, ambiguous: 1, hold: 0 });
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
    { mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE", reasonCodes: ["SOURCE_KEY_UNPROVEN"] },
    { mappingStatus: "OWNER_CONFIRMED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }
  ]);

  assert.equal(guide.nextAction, "BULK_MATCH_ONLY");
  assert.equal(guide.nextFilterState, "OWNER_REVIEW");
  assert.equal(guide.bulk, 1);
  assert.equal(guide.individual, 2);
  assert.equal(guide.contactShortageRelease, 1);
  assert.equal(guide.quarantine, 1);
  const steps = buildReviewWorkloadSteps(guide);
  const approvalGuide = buildReviewWorkloadApprovalGuide(guide);
  assert.deepEqual(steps.map((step) => step.category), ["BULK_MATCH_ONLY", "INDIVIDUAL_REVIEW", "KEEP_QUARANTINED"]);
  assert.equal(steps[0].isCurrent, true);
  assert.equal(steps[2].countCategory, "ONE");
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

test("contactless 27卒 contact rows move from quarantine hold to individual review", () => {
  const contactless = {
    mappingStatus: "UNMAPPED",
    sourceCode: "CONTACTS_27",
    suggestionCategory: "NONE",
    reason_codes: ["SOURCE_KEY_UNPROVEN"],
    phone: "",
    email: "",
    lineName: ""
  };

  assert.equal(isContactShortageQuarantineReleaseCandidate(contactless), true);
  assert.equal(isContactShortageQuarantineReleaseCandidate({ ...contactless, email: "masked@example.test" }), false);
  assert.equal(isContactShortageQuarantineReleaseCandidate({ ...contactless, reason_codes: [] }), false);
  assert.equal(isContactShortageQuarantineReleaseCandidate({ ...contactless, sourceCode: "OFFERS_27" }), false);

  const guide = buildReviewWorkloadGuide([contactless]);
  assert.equal(guide.nextAction, "INDIVIDUAL_REVIEW");
  assert.equal(guide.individual, 1);
  assert.equal(guide.quarantine, 0);
  assert.deepEqual(filterTalentStudents([{ ...contactless, displayName: "候補", classification: "QUARANTINE" }], { state: "NEW_CANDIDATE" }).map((row) => row.displayName), ["候補"]);
});

test("new applicant candidate filtering stays limited to unmapped entry and offer rows", () => {
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "ENTRIES_27", suggestionCategory: "NONE" }), true);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "OFFERS_27", suggestionCategory: "NONE" }), true);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "OWNER_CONFIRMED", sourceCode: "ENTRIES_27", suggestionCategory: "NONE" }), false);
  assert.equal(isNewApplicantCandidate({ mappingStatus: "UNMAPPED", sourceCode: "CONTACTS_27", suggestionCategory: "NONE" }), false);
});

test("student list filter keeps new candidates visible and narrows review queues", () => {
  const rows = [
    { displayName: "接触候補", sourceCode: "CONTACTS_27", classification: "OWNER_REVIEW", mappingStatus: "UNMAPPED", suggestionCategory: "NONE", statusCode: "LINE_REGISTERED" },
    { displayName: "新規候補", sourceCode: "ENTRIES_27", classification: "OWNER_REVIEW", mappingStatus: "UNMAPPED", suggestionCategory: "NONE", statusCode: "INTERVIEW_COMPLETED" },
    { displayName: "確認済み", sourceCode: "OFFERS_27", classification: "IMPORTABLE", mappingStatus: "OWNER_CONFIRMED", suggestionCategory: "NONE", statusCode: "OFFERED" },
    { displayName: "隔離", sourceCode: "OFFERS_27", classification: "QUARANTINE", mappingStatus: "UNMAPPED", suggestionCategory: "AMBIGUOUS", statusCode: "WITHDRAWN" },
    { displayName: "未登録", sourceCode: "CONTACTS_27", classification: "IMPORTABLE", mappingStatus: "OWNER_CONFIRMED", suggestionCategory: "NONE", statusCode: null }
  ];

  assert.deepEqual(filterTalentStudents(rows, { state: "NEW_CANDIDATE" }).map((row) => row.displayName), ["新規候補"]);
  assert.deepEqual(filterTalentStudents(rows, { state: "QUARANTINE" }).map((row) => row.displayName), ["隔離"]);
  assert.deepEqual(filterTalentStudents(rows, { source: "ENTRIES_27" }).map((row) => row.displayName), ["新規候補"]);
  assert.deepEqual(filterTalentStudents(rows, { progress: "OFFERED" }).map((row) => row.displayName), ["確認済み"]);
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
  assert.match(html, /option value="WITHDRAWN">辞退・離脱<\/option>/);
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
