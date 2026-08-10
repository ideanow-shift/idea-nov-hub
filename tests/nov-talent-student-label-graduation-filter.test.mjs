import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTalentTodayDashboard, graduationYearWorkspace, normalizeGraduationYearFilter } from "../portal/talent/app.mjs";
import { buildTalentAnalytics } from "../portal/talent/analytics.mjs";

const root = new URL("../portal/", import.meta.url);

test("visible NOV Talent labels use 学生 and expose one shared graduation-year switcher", async () => {
  const [html, app, ux, hubApps, hubDashboard] = await Promise.all([
    readFile(new URL("talent/index.html", root), "utf8"),
    readFile(new URL("talent/app.mjs", root), "utf8"),
    readFile(new URL("talent/recruitment-ux.mjs", root), "utf8"),
    readFile(new URL("js/apps.js", root), "utf8"),
    readFile(new URL("js/nov-navi-dashboard.js", root), "utf8")
  ]);

  assert.doesNotMatch(`${html}\n${app}\n${ux}\n${hubApps}\n${hubDashboard}`, /候補者/);
  assert.match(html, /data-secondary-tab="students">学生/);
  assert.match(html, /data-graduation-year="ALL"[^>]*aria-pressed="true">すべて/);
  assert.match(html, /data-graduation-year="2027"[^>]*>27卒/);
  assert.match(html, /data-graduation-year="2028"[^>]*>28卒/);
  assert.match(html, /id="recruitment-summary-title">今日、誰に、何をするか/);
  assert.match(app, /renderStudentWorkspace\(documentObject\);[\s\S]*renderTalentAnalytics\(documentObject\);[\s\S]*renderTalentTodayDashboard[\s\S]*renderTodayTasks/);
});

test("today dashboard counts current work from the selected graduation workspace", () => {
  const action = (id, date, code = "FOLLOW_UP", state = "OPEN") => ({ id, active: true, completedAt: null, date, code, state, label: "連絡フォロー" });
  const student = (recordId, graduationYear, nextActionAt, histories = {}, businessDate = "2026-07-20") => ({
    recordId, graduationYear, nextActionAt, nextActionLabel: "次回連絡", businessDate,
    contactHistory: histories.contactHistory || [], eventHistory: histories.eventHistory || [],
    selectionHistory: histories.selectionHistory || [], nextActions: histories.nextActions || []
  });
  const workspace = {
    students: [
      student("27-a", 2027, "2026-08-04", { nextActions: [action("a", "2026-08-04")] }),
      student("27-b", 2027, "2026-08-05", {
        eventHistory: [{ active: true, code: "SALON_TOUR_PLANNED", date: "2026-08-05" }],
        selectionHistory: [{ active: true, code: "APPLICATION_RECEIVED", date: "2026-08-05" }]
      }, "2026-08-05"),
      student("28-a", 2028, "2026-08-05", { selectionHistory: [{ active: true, code: "INTERVIEW_PLANNED", date: "2026-08-05" }] })
    ],
    todayTasks: [{ candidateId: "27-a", dueDate: "2026-08-05", label: "27対応", assignedTo: null },
      { candidateId: "28-a", dueDate: "2026-08-05", label: "28対応", assignedTo: null }],
    dashboard: { availability: { todayActions: true, entries: true, eventCount: true, interviewHistory: true, salonTourPlanned: true, interviewPlanned: true } },
    schoolMasters: [], fairMasters: [], overview: {}
  };
  const view = buildTalentTodayDashboard(graduationYearWorkspace(workspace, "2027"), "2026-08-05");
  assert.deepEqual({
    actions: view.actions, overdue: view.overdue, visits: view.visits, interviews: view.interviews,
    awaitingContact: view.awaitingContact, newStudents: view.newStudents, recentStudents: view.recentStudents
  }, { actions: null, overdue: null, visits: 1, interviews: 0, awaitingContact: null, newStudents: 1, recentStudents: null });
  assert.equal(view.rawValuesIncluded, false);
});

test("graduation-year workspace filters students and uses Event and Selection facts without status fallback", () => {
  const student = (recordId, graduationYear, schoolId, fairId, code, facts = {}) => ({
    recordId, graduationYear, schoolId, fairId, school: `学校${schoolId}`,
    statusCode: code, classification: "IMPORTABLE", mappingStatus: "OWNER_CONFIRMED",
    selectionHistory: facts.selectionHistory || [], eventHistory: facts.eventHistory || [],
    contactHistory: facts.contactHistory || [], nextActions: []
  });
  const workspace = {
    students: [
      student("27-a", 2027, "school-27", "fair-27", "EXPECTED_JOIN", { contactHistory: [
        { active: true, code: "CONTACT_RECORDED" }, { active: true, code: "CONTACT_RECORDED" }
      ] }),
      student("28-a", 2028, "school-28", "fair-28", "LINE_REGISTERED")
    ],
    todayTasks: [{ candidateId: "27-a", label: "27対応" }, { candidateId: "28-a", label: "28対応" }],
    schoolMasters: [{ school_id: "school-27", school_name: "学校school-27", is_active: true }, { school_id: "school-28", school_name: "学校school-28", is_active: true }, { school_id: "inactive", school_name: "学校school-27", is_active: false }],
    fairMasters: [{ fair_id: "fair-27", is_active: true }, { fair_id: "fair-28", is_active: true }, { fair_id: "fair-27", is_active: false }],
    dashboard: { availability: {
      candidateCount: true, eventCount: true, entries: true, offers: true, interviewHistory: true,
      interviewPlanned: true, lineRegistrations: true, salonTourPlanned: true, salonTourCompleted: true,
      offeredElsewhere: true, withdrawals: true, rejected: true, todayActions: true
    } },
    overview: {}
  };

  const filtered = graduationYearWorkspace(workspace, "2027");
  assert.deepEqual(filtered.students.map((row) => row.recordId), ["27-a"]);
  assert.deepEqual(filtered.todayTasks.map((row) => row.candidateId), ["27-a"]);
  assert.deepEqual(filtered.schoolMasters.map((row) => row.school_id), ["school-27"]);
  assert.deepEqual(filtered.fairMasters.map((row) => row.fair_id), ["fair-27"]);
  assert.equal(filtered.dashboard.candidateCount, 1);
  assert.equal(filtered.dashboard.graduation2027, 1);
  assert.equal(filtered.dashboard.graduation2028, 0);
  assert.equal(filtered.dashboard.offers, 0);
  assert.equal(filtered.dashboard.schoolCount, 1);
  assert.equal(filtered.overview.contacts, 2);
  assert.equal(filtered.summary.contacts, 2);
  assert.equal(filtered.summary.expectedJoiners, 1);
  assert.equal(filtered.dashboard.availability.fairCount, false);
  assert.equal(buildTalentAnalytics(filtered).fairSourceAvailable, false);
  assert.deepEqual(buildTalentAnalytics(filtered).flow, []);
  assert.equal(normalizeGraduationYearFilter("invalid"), "ALL");
  assert.equal(graduationYearWorkspace(workspace, "ALL"), workspace);
});

test("graduation-year school count uses active School Master only and preserves formal zero", () => {
  const workspace = {
    students: [{ recordId: "student", graduationYear: 2027, schoolId: null, school: "候補者だけの学校", contactHistory: [], eventHistory: [], selectionHistory: [], nextActions: [] }],
    schoolMasters: [{ school_id: "inactive", school_name: "候補者だけの学校", is_active: false }],
    fairMasters: [], todayTasks: [], overview: {},
    dashboard: { availability: { schoolCount: true } }
  };
  const filtered = graduationYearWorkspace(workspace, "2027");
  assert.equal(filtered.dashboard.schoolCount, 0);
  assert.deepEqual(filtered.schoolMasters, []);
});
