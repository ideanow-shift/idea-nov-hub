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
    overview: {
      total: 5,
      contacts: 3,
      entries: 1,
      offers: 1,
      mapped: 2,
      ownerReview: 2,
      quarantined: 1
    },
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
  assert.equal(result.flow[0].label, "2026年7月");
  assert.equal(result.schools.length, 2);
  assert.equal(result.schools[0].school, "表示用美容学校");
  assert.equal(result.schools[0].entryRate, 50);
  assert.equal(result.coverage.schoolMissing, 1);
  assert.equal(result.coverage.lineRegistrationRate, 33.3);
});

test("buildTalentAnalytics never invents rates when the denominator is zero", () => {
  const result = buildTalentAnalytics({
    overview: {
      total: 0,
      contacts: 0,
      entries: 0,
      offers: 0,
      mapped: 0,
      ownerReview: 0,
      quarantined: 0
    },
    students: []
  });
  assert.equal(result.coverage.lineRegistrationRate, 0);
  assert.deepEqual(result.flow, []);
  assert.deepEqual(result.schools, []);
});

function student(sourceCode, school, businessDate, lineRegistrationDate, classification) {
  return {
    sourceCode,
    school,
    businessDate,
    lineRegistrationDate,
    classification
  };
}
