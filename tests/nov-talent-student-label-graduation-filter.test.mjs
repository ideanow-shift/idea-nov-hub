import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { graduationYearWorkspace, normalizeGraduationYearFilter } from "../portal/talent/app.mjs";

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
  assert.match(html, /id="recruitment-summary-title">27卒・28卒 採用状況/);
  assert.match(app, /renderStudentWorkspace\(documentObject\);[\s\S]*renderTalentAnalytics\(documentObject\);[\s\S]*renderTodayTasks/);
});

test("graduation-year workspace filters students, dashboard, actions, fairs, and schools together", () => {
  const student = (recordId, graduationYear, schoolId, fairId, code) => ({
    recordId, graduationYear, schoolId, fairId, school: `学校${schoolId}`,
    statusCode: code, classification: "IMPORTABLE", selectionHistory: [], eventHistory: [], contactHistory: []
  });
  const workspace = {
    students: [student("27-a", 2027, "school-27", "fair-27", "OFFERED"), student("28-a", 2028, "school-28", "fair-28", "LINE_REGISTERED")],
    todayTasks: [{ candidateId: "27-a", label: "27対応" }, { candidateId: "28-a", label: "28対応" }],
    schoolMasters: [{ school_id: "school-27", school_name: "学校school-27" }, { school_id: "school-28", school_name: "学校school-28" }],
    fairMasters: [{ fair_id: "fair-27" }, { fair_id: "fair-28" }],
    dashboard: { availability: { candidateCount: true, offers: true, lineRegistrations: true } },
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
  assert.equal(filtered.dashboard.offers, 1);
  assert.equal(normalizeGraduationYearFilter("invalid"), "ALL");
  assert.equal(graduationYearWorkspace(workspace, "ALL"), workspace);
});
