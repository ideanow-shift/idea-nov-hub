import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildSchoolFactRow,
  buildTalentAnalytics,
  buildTalentAnalyticsActionGuide,
  normalizeFairEventMonth
} from "../portal/talent/analytics.mjs";
import {
  buildFairMasterMutationPayload,
  buildAnalyticsListState,
  buildImportOverviewViewModel,
  buildRecruitmentMasterViewState,
  buildTalentTodayDashboard,
  isWritableActivityCode,
  parseNullableFairNumber,
  studentMatchesSchoolMaster,
  talentStudentPriorityLabel
} from "../portal/talent/app.mjs";
import {
  buildRecruitmentDashboardDecision,
  buildRecruitmentTaskBoard,
  classifyRecruitmentTaskPriority,
  japanBusinessDateIso
} from "../portal/talent/recruitment-ux.mjs";

const root = new URL("../", import.meta.url);

test("Staging runtime preserves the Workspace todayTasks response as the canonical source", async () => {
  const source = await readFile(new URL("portal/talent/runtime.mjs", root), "utf8");
  assert.doesNotMatch(source, /import \{[^}]*buildTodayTasks/u);
  assert.doesNotMatch(source, /todayTasks:\s*buildTodayTasks/u);
  assert.match(source, /runtimeMode:\s*"staging"/u);
});

test("Today Task priority is derived only from dueDate and the reference date", () => {
  assert.equal(japanBusinessDateIso("2026-08-08T15:30:00.000Z"), "2026-08-09");
  assert.equal(classifyRecruitmentTaskPriority({ dueDate: "2026-08-07", priority: "通常" }, "2026-08-08"), "OVERDUE");
  assert.equal(classifyRecruitmentTaskPriority({ dueDate: "2026-08-08", priority: "高" }, "2026-08-08"), "DUE_TODAY");
  assert.equal(classifyRecruitmentTaskPriority({ dueDate: "2026-08-09", priority: "高" }, "2026-08-08"), "SCHEDULED");
  assert.equal(classifyRecruitmentTaskPriority({ priority: "高" }, "2026-08-08"), "UNSCHEDULED");
  assert.equal(buildRecruitmentTaskBoard([{ dueDate: "2026-08-07" }], "2026-08-08")[0].priorityCategory, "OVERDUE");
  assert.equal(buildRecruitmentDashboardDecision({ students: [], dashboard: {} }, [{ dueDate: "2026-08-07" }], "2026-08-08").category, "OVERDUE_FIRST");
  assert.equal(talentStudentPriorityLabel({ nextActionAt: "2026-08-07", priority: "通常" }, "2026-08-08"), "高（期限超過）");
  assert.equal(talentStudentPriorityLabel({ priority: "高" }, "2026-08-08"), "未登録");
});

test("Today's Dashboard uses the complete server count while TodayTasks remain a display list", () => {
  const workspace = {
    students: [],
    todayTasks: [
      { candidateId: "fixture", dueDate: "2026-08-08", label: "今日" },
      { candidateId: "ignored", date: "2026-08-08", label: "契約外" }
    ],
    dashboard: { todayActions: 7, availability: { todayActions: true } }
  };
  assert.equal(buildTalentTodayDashboard(workspace, "2026-08-08").actions, 7);
  assert.equal(buildTalentTodayDashboard({ ...workspace, dashboard: { todayActions: 7, availability: { todayActions: false } } }, "2026-08-08").actions, null);
});

test("Today's Dashboard keeps Event and Selection source responsibilities separate", () => {
  const fact = (code) => ({ active: true, code, date: "2026-08-08" });
  const workspace = {
    students: [
      {
        recordId: "wrong-source", businessDate: "2026-08-01", contactHistory: [], nextActions: [],
        eventHistory: [fact("INTERVIEW_PLANNED"), fact("APPLICATION_RECEIVED")],
        selectionHistory: [fact("SALON_TOUR_PLANNED")]
      },
      {
        recordId: "formal-source", businessDate: "2026-08-01", contactHistory: [], nextActions: [],
        eventHistory: [fact("SALON_TOUR_PLANNED")],
        selectionHistory: [fact("INTERVIEW_PLANNED"), fact("APPLICATION_RECEIVED")]
      }
    ],
    todayTasks: [],
    dashboard: { todayActions: 0, availability: { todayActions: true, entries: true, salonTourPlanned: true, interviewPlanned: true } }
  };
  const view = buildTalentTodayDashboard(workspace, "2026-08-08");
  assert.deepEqual({ visits: view.visits, interviews: view.interviews, newStudents: view.newStudents }, {
    visits: 1, interviews: 1, newStudents: 1
  });
  assert.equal(view.recentStudents, null);
});

test("Today's Dashboard fails closed for unavailable Next Action and Selection facts", () => {
  const workspace = {
    students: [{
      recordId: "mixed-dates",
      businessDate: "2026-08-08",
      lineRegistrationDate: "2026-08-08",
      contactHistory: [{ active: true, code: "APPLICATION_RECEIVED", date: "2026-08-08" }],
      eventHistory: [],
      selectionHistory: [],
      nextActions: [{ active: true, code: "CONTACT", date: "2026-08-07", label: "連絡" }]
    }],
    dashboard: { todayActions: 1, availability: { todayActions: false, entries: false } }
  };
  const view = buildTalentTodayDashboard(workspace, "2026-08-08");
  assert.deepEqual({ actions: view.actions, overdue: view.overdue, awaitingContact: view.awaitingContact,
    newStudents: view.newStudents, recentStudents: view.recentStudents }, {
    actions: null, overdue: null, awaitingContact: null, newStudents: null, recentStudents: null
  });
});

test("Fair event dates normalize to one YYYY-MM month contract", () => {
  assert.equal(normalizeFairEventMonth("2026-08-07"), "2026-08");
  assert.equal(normalizeFairEventMonth("2026-08"), "2026-08");
  assert.equal(normalizeFairEventMonth("not-a-date"), "");
  const analytics = buildTalentAnalytics({
    students: [],
    fairMasters: [
      { fair_id: "a", fair_name: "A", event_date: "2026-08-07", is_active: true },
      { fair_id: "b", fair_name: "B", event_date: "2026-08-01", is_active: true },
      { fair_id: "c", fair_name: "C", event_date: "2026-07-31", is_active: true }
    ]
  });
  assert.deepEqual(analytics.flow.map((row) => row.key), ["2026-08", "2026-08", "2026-07"]);
  assert.equal(analytics.coverage.monthCount, 2);
});

test("Fair analytics never promotes legacy interview, offer, or hire columns", () => {
  const analytics = buildTalentAnalytics({ students: [], fairMasters: [{
    fair_id: "legacy", fair_name: "Legacy", event_date: "2026-08-01", is_active: true,
    contact_count: 10, line_registration_count: 5, participant_count: 9,
    interview_count: 8, offer_count: 7, hire_count: 6, participation_fee: 100000
  }] });
  const row = analytics.flow[0];
  assert.equal(row.contacts, 10);
  assert.equal(row.entries, null);
  assert.equal(row.offers, null);
  assert.equal(row.needsAction, null);
  assert.equal(row.hires, null);
  assert.equal(row.hireRate, null);
  assert.equal(row.hireCost, null);
  assert.equal(row.legacyKpiStatus, "PREPARING");
  assert.equal(row.candidateLinkReady, false);
});

test("Fair analytics preserves missing and null counts separately from confirmed zero", () => {
  const rows = buildTalentAnalytics({ students: [], fairMasters: [
    { fair_id: "missing", fair_name: "Missing", event_date: "2026-08-03", is_active: true },
    { fair_id: "null", fair_name: "Null", event_date: "2026-08-02", is_active: true, contact_count: null },
    { fair_id: "zero", fair_name: "Zero", event_date: "2026-08-01", is_active: true, contact_count: 0 }
  ] }).flow;
  assert.deepEqual(rows.map((row) => row.contacts), [null, null, 0]);
});

test("Fair mutation payload preserves null separately from confirmed zero and omits legacy KPI writes", () => {
  assert.equal(parseNullableFairNumber(""), null);
  assert.equal(parseNullableFairNumber("0"), 0);
  assert.equal(parseNullableFairNumber("12"), 12);
  assert.throws(() => parseNullableFairNumber("-1"), /invalid_fair_number/u);
  const payload = buildFairMasterMutationPayload({ values: {
    name: "フェア", date: "2026-08-08", fee: "", participants: "0", contacts: "",
    line: "0", tours: "3", venue: "会場", owner: "担当", reason: "確認"
  } });
  assert.equal(payload.participationFee, null);
  assert.equal(payload.participantCount, 0);
  assert.equal(payload.contactCount, null);
  assert.equal(payload.lineRegistrationCount, 0);
  assert.equal(payload.salonTourCount, 3);
  for (const key of ["interviewCount", "offerCount", "hireCount"]) assert.equal(Object.hasOwn(payload, key), false);
});

test("Fair form starts nullable values blank and legacy KPI fields disabled", async () => {
  const html = await readFile(new URL("portal/talent/index.html", root), "utf8");
  for (const suffix of ["fee", "participants", "contacts", "line", "tours"]) {
    const input = html.match(new RegExp(`<input id="fair-master-${suffix}"[^>]*>`, "u"))?.[0] || "";
    assert.doesNotMatch(input, /\svalue=/u);
  }
  for (const suffix of ["interviews", "offers", "hires"]) {
    const input = html.match(new RegExp(`<input id="fair-master-${suffix}"[^>]*>`, "u"))?.[0] || "";
    assert.match(input, /\sdisabled(?:\s|>)/u);
    assert.match(input, /aria-disabled="true"/u);
  }
  assert.doesNotMatch(html, /採用実績を入力すると採用率・採用単価へ即時反映/u);
});

test("Activity input keeps Event and Selection source responsibilities separate", () => {
  assert.equal(isWritableActivityCode("EVENT", "SALON_TOUR_COMPLETED"), true);
  assert.equal(isWritableActivityCode("EVENT", "INTERVIEW_COMPLETED"), false);
  assert.equal(isWritableActivityCode("SELECTION", "INTERVIEW_COMPLETED"), true);
  assert.equal(isWritableActivityCode("SELECTION", "SALON_TOUR_COMPLETED"), false);
});

test("Legacy reverse-source activity rows remain readable and deactivatable but cannot be edited", async () => {
  const source = await readFile(new URL("portal/talent/app.mjs", root), "utf8");
  assert.match(source, /save\.hidden = row\?\.active === false \|\| legacyReadOnly/u);
  assert.match(source, /if \(field\) field\.disabled = legacyReadOnly/u);
  assert.match(source, /deactivate\.hidden = !row/u);
  assert.match(source, /legacyReadOnly \|\| \(row && !isWritableActivityCode\(entityType, row\.code\)\)/u);
});

test("School metrics use active Event and Selection facts, never membership or current status", () => {
  const rows = [
    {
      statusCode: "OFFERED",
      contactHistory: [{ active: true, code: "CONTACT_RECORDED" }, { active: true, code: "CONTACT_RECORDED" }, { active: true, code: "LINE_REGISTERED" }],
      eventHistory: [{ active: true, code: "SALON_TOUR_COMPLETED" }],
      selectionHistory: [{ active: true, code: "APPLICATION_RECEIVED" }, { active: true, code: "INTERVIEW_COMPLETED" }, { active: true, code: "OFFERED" }]
    },
    {
      statusCode: "OFFERED",
      contactHistory: [],
      eventHistory: [{ active: false, code: "CONTACT_RECORDED" }],
      selectionHistory: []
    }
  ];
  const school = buildSchoolFactRow("school", "学校", rows, {
    eventCount: true, lineRegistrations: true, salonTourCompleted: true,
    entries: true, interviewHistory: true, offers: true
  });
  assert.deepEqual({
    contacts: school.contacts,
    line: school.lineRegistrations,
    tours: school.salonTours,
    entries: school.entries,
    interviews: school.interviews,
    offers: school.offers
  }, { contacts: 2, line: 1, tours: 1, entries: 1, interviews: 1, offers: 1 });
  assert.equal(school.entryRate, null);
  assert.equal(school.offerRate, null);
});

test("School lower-funnel metrics stay preparing when Selection coverage is unavailable", () => {
  const school = buildSchoolFactRow("school", "学校", [{
    contactHistory: [{ active: true, code: "CONTACT_RECORDED" }],
    selectionHistory: [{ active: true, code: "OFFERED" }]
  }], { eventCount: true, lineRegistrations: false, salonTourCompleted: false, entries: false, interviewHistory: false, offers: false });
  assert.equal(school.contacts, 1);
  assert.equal(school.lineRegistrations, null);
  assert.equal(school.salonTours, null);
  assert.equal(school.entries, null);
  assert.equal(school.interviews, null);
  assert.equal(school.offers, null);
  assert.equal(school.hires, null);
  assert.equal(school.entryRate, null);
  assert.equal(school.offerRate, null);
  assert.equal(school.hireRate, null);
});

test("School action guide never promotes an unavailable or zero-contact school as top", () => {
  const base = { summary: [{ key: "total", value: 1 }, { key: "needsAction", value: 0 }], flow: [], coverage: {} };
  const partial = buildTalentAnalyticsActionGuide({ ...base, schools: [{ school: "未取得校", contacts: null }] });
  const formalZero = buildTalentAnalyticsActionGuide({ ...base, schools: [{ school: "0件校", contacts: 0 }] });
  const positive = buildTalentAnalyticsActionGuide({ ...base, schools: [{ school: "接触あり校", contacts: 2 }] });
  assert.notEqual(partial.category, "SCHOOL_FOLLOW_UP");
  assert.notEqual(formalZero.category, "SCHOOL_FOLLOW_UP");
  assert.equal(positive.category, "SCHOOL_FOLLOW_UP");
});

test("School identity requires school_id and never promotes a name-only match", () => {
  const contact = { active: true, code: "CONTACT_RECORDED" };
  const analytics = buildTalentAnalytics({
    students: [
      { schoolId: "school-a", school: "旧表示名", contactHistory: [contact], eventHistory: [], selectionHistory: [] },
      { schoolId: "other-id", school: "学校A", contactHistory: [contact], eventHistory: [], selectionHistory: [] },
      { schoolId: null, school: " 学校Ａ ", contactHistory: [contact], eventHistory: [], selectionHistory: [] }
    ],
    schoolMasters: [{ school_id: "school-a", school_name: "学校A", is_active: true }],
    fairMasters: [],
    dashboard: { availability: { eventCount: true, lineRegistrations: true, salonTourCompleted: true } }
  });
  assert.equal(analytics.schools[0].contacts, 1);
  assert.equal(studentMatchesSchoolMaster({ schoolId: "school-a", school: "別名" }, { school_id: "school-a", school_name: "学校A" }), true);
  assert.equal(studentMatchesSchoolMaster({ schoolId: null, school: " 学校Ａ " }, { school_id: "school-a", school_name: "学校A" }), false);
  assert.equal(studentMatchesSchoolMaster({ schoolId: "other-id", school: "学校A" }, { school_id: "school-a", school_name: "学校A" }), false);
});

test("School ranking uses active School Master as the sole source and preserves formal zero", () => {
  const analytics = buildTalentAnalytics({
    students: [
      { schoolId: null, school: "Candidate表示だけの学校", contactHistory: [{ active: true, code: "CONTACT_RECORDED" }] },
      { schoolId: "inactive", school: "無効校", contactHistory: [] },
      { schoolId: "unknown", school: "未知校", contactHistory: [] }
    ],
    schoolMasters: [{ school_id: "inactive", school_name: "無効校", is_active: false }], fairMasters: [],
    dashboard: { availability: { schoolCount: true, eventCount: true, lineRegistrations: true, salonTourCompleted: true } }
  });
  assert.equal(analytics.schoolSourceAvailable, true);
  assert.deepEqual(analytics.schools, []);
  assert.equal(analytics.coverage.schoolRegistered, 0);
  assert.equal(analytics.coverage.schoolMissing, 3);
});

test("Master management distinguishes unavailable sources from a formal empty master", () => {
  const partial = buildRecruitmentMasterViewState({
    canWrite: true,
    fairMasters: [], schoolMasters: [],
    dashboard: { availability: { fairCount: false, schoolCount: false } }
  });
  assert.deepEqual({ fairReady: partial.fairReady, schoolReady: partial.schoolReady,
    canManageFair: partial.canManageFair, canManageSchool: partial.canManageSchool }, {
    fairReady: false, schoolReady: false, canManageFair: false, canManageSchool: false
  });
  const formalEmpty = buildRecruitmentMasterViewState({
    canWrite: true,
    fairMasters: [], schoolMasters: [],
    dashboard: { availability: { fairCount: true, schoolCount: true } }
  });
  assert.deepEqual({ fairReady: formalEmpty.fairReady, schoolReady: formalEmpty.schoolReady,
    canManageFair: formalEmpty.canManageFair, canManageSchool: formalEmpty.canManageSchool,
    fairCount: formalEmpty.fairMasters.length, schoolCount: formalEmpty.schoolMasters.length }, {
    fairReady: true, schoolReady: true, canManageFair: true, canManageSchool: true,
    fairCount: 0, schoolCount: 0
  });
});

test("Fair and School analysis lists distinguish partial sources from formal empty data", () => {
  assert.deepEqual(buildAnalyticsListState({ sourceAvailable: false, count: 0, unit: "校" }), {
    countLabel: "集計準備中", emptyText: "集計準備中", controlsDisabled: true, showEmpty: true
  });
  assert.deepEqual(buildAnalyticsListState({ sourceAvailable: true, count: 0, unit: "校", emptyText: "学校なし" }), {
    countLabel: "0校", emptyText: "学校なし", controlsDisabled: false, showEmpty: true
  });
});

test("Analytics summary keeps unavailable Event facts preparing instead of zero", () => {
  const analytics = buildTalentAnalytics({
    overview: { total: 1, contacts: 0, entries: 0, offers: 0 },
    students: [], fairMasters: [],
    dashboard: { lineRegistrations: 0, availability: { eventCount: false, lineRegistrations: false, entries: false, offers: false } }
  });
  assert.equal(analytics.summary.find((metric) => metric.key === "contacts").value, "集計準備中");
  assert.equal(analytics.summary.find((metric) => metric.key === "lineRegistrations").value, "集計準備中");
  assert.equal(analytics.coverage.lineRegistrationRate, null);

  const missingFormalLineCount = buildTalentAnalytics({
    overview: { total: 1, contacts: 1, entries: 0, offers: 0 },
    students: [{ lineRegistrationDate: "2026-08-08" }], fairMasters: [],
    dashboard: { availability: { eventCount: true, lineRegistrations: true, entries: true, offers: true } }
  });
  assert.equal(missingFormalLineCount.summary.find((metric) => metric.key === "lineRegistrations").value, "集計準備中");
});

test("Analytics never divides unique LINE candidates by Event contact rows", () => {
  const analytics = buildTalentAnalytics({
    overview: { total: 636, contacts: 34, entries: 0, offers: 0 },
    students: [], fairMasters: [], schoolMasters: [],
    dashboard: { lineRegistrations: 615, availability: {
      eventCount: true, lineRegistrations: true, entries: true, offers: true,
      fairCount: true, schoolCount: true
    } }
  });
  assert.equal(analytics.summary.find((metric) => metric.key === "contacts").value, 34);
  assert.equal(analytics.summary.find((metric) => metric.key === "lineRegistrations").value, 615);
  assert.equal(analytics.coverage.lineRegistrationRate, null);
});

test("student overview fails closed per unavailable formal source", () => {
  const base = {
    overview: { total: 636, contacts: 712, entries: 84, offers: 26, manual: 3, ownerReview: 4, quarantined: 2, mapped: 630 },
    dashboard: { availability: { eventCount: true, entries: true, offers: true } },
    partialStatus: { unavailableViews: [] }
  };
  const eventPartial = buildImportOverviewViewModel({ ...base, partialStatus: { unavailableViews: ["recruitment_events"] } });
  assert.equal(eventPartial.values["student-total"], 636);
  assert.equal(eventPartial.values["student-contacts"], "集計準備中");
  assert.equal(eventPartial.values["student-entries"], 84);

  const selectionPartial = buildImportOverviewViewModel({ ...base, partialStatus: { unavailableViews: ["selection_history"] } });
  assert.equal(selectionPartial.values["student-entries"], "集計準備中");
  assert.equal(selectionPartial.values["student-offers"], "集計準備中");

  const sourcePartial = buildImportOverviewViewModel({ ...base, partialStatus: { unavailableViews: ["source_facts"] } });
  assert.equal(sourcePartial.sourceFactsReady, false);
  assert.equal(sourcePartial.values["student-owner-review"], "集計準備中");
  assert.equal(sourcePartial.values["student-needs-review"], "集計準備中");
  assert.equal(sourcePartial.values["student-quarantine"], 2);
  assert.equal(sourcePartial.values["student-importable"], 630);
});
