import assert from "node:assert/strict";
import test from "node:test";
import { buildTalentAnalytics } from "../portal/talent/analytics.mjs";

const students = [
  student("CONTACTS_27", "表示用美容学校", "2026-05-01", "2026-05-02", "OWNER_REVIEW"),
  student("CONTACTS_27", "表示用美容学校", "2026-06-01", null, "IMPORTABLE"),
  student("ENTRIES_27", "表示用美容学校", "2026-06-05", null, "IMPORTABLE"),
  student("OFFERS_27", "別の美容学校", "2026-07-01", null, "QUARANTINE"),
  student("CONTACTS_27", null, null, null, "OWNER_REVIEW")
];

test("buildTalentAnalytics builds truthful summary, monthly flow, and school analysis", () => {
  const result = buildTalentAnalytics({
    dashboard: { lineRegistrations: 1, availability: { eventCount: true, lineRegistrations: true, salonTourCompleted: true, entries: true, interviewHistory: true, offers: true, schoolCount: true } },
    overview: {
      total: 5,
      contacts: 3,
      entries: 1,
      offers: 1,
      mapped: 2,
      ownerReview: 2,
      quarantined: 1
    },
    fairMasters: [
      { fair_id: "may", fair_name: "5月Fair", event_date: "2026-05-01", contact_count: 1, line_registration_count: 1, is_active: true },
      { fair_id: "june", fair_name: "6月Fair", event_date: "2026-06-01", contact_count: 1, line_registration_count: 0, is_active: true },
      { fair_id: "july", fair_name: "7月Fair", event_date: "2026-07-01", contact_count: 1, line_registration_count: 0, is_active: true }
    ],
    schoolMasters: [
      { school_id: "display", school_name: "表示用美容学校", is_active: true },
      { school_id: "other", school_name: "別の美容学校", is_active: true }
    ],
    students
  });

  assert.deepEqual(
    result.summary.map(({ key, value }) => [key, value]),
    [
      ["total", 5],
      ["contacts", 3],
      ["lineRegistrations", 1],
      ["entries", 1],
      ["offers", 1],
      ["mapped", 2],
      ["needsAction", 3]
    ]
  );
  assert.equal(result.flow.length, 3);
  assert.equal(result.flow[0].key, "2026-07");
  assert.equal(result.flow[0].label, "7月Fair");
  assert.equal(result.schools.length, 2);
  assert.equal(result.schools[0].school, "表示用美容学校");
  assert.equal(result.schools[0].entryRate, null);
  assert.equal(result.coverage.schoolMissing, 1);
  assert.equal(result.coverage.lineRegistrationRate, null);
});

test("buildTalentAnalytics never invents rates when the denominator is zero", () => {
  const result = buildTalentAnalytics({
    dashboard: { lineRegistrations: 0, availability: { eventCount: true, lineRegistrations: true, salonTourCompleted: true, entries: true, interviewHistory: true, offers: true, schoolCount: true } },
    overview: {
      total: 0,
      contacts: 0,
      entries: 0,
      offers: 0,
      mapped: 0,
      ownerReview: 0,
      quarantined: 0
    },
    schoolMasters: [],
    students: []
  });
  assert.equal(result.coverage.lineRegistrationRate, null);
  assert.deepEqual(result.flow, []);
  assert.deepEqual(result.schools, []);
});

function student(sourceCode, school, businessDate, lineRegistrationDate, classification) {
  const contactHistory = [];
  const selectionHistory = [];
  if (sourceCode.startsWith("CONTACTS_")) contactHistory.push({ active: true, code: "CONTACT_RECORDED" });
  if (lineRegistrationDate) contactHistory.push({ active: true, code: "LINE_REGISTERED" });
  if (sourceCode.startsWith("ENTRIES_")) selectionHistory.push({ active: true, code: "APPLICATION_RECEIVED" });
  if (sourceCode.startsWith("OFFERS_")) selectionHistory.push({ active: true, code: "OFFERED" });
  return {
    sourceCode,
    schoolId: school === "表示用美容学校" ? "display" : school === "別の美容学校" ? "other" : null,
    school,
    businessDate,
    lineRegistrationDate,
    classification,
    contactHistory,
    eventHistory: [],
    selectionHistory
  };
}
