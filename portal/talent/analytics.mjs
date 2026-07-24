const SOURCE_CODES = Object.freeze({
  CONTACTS_27: "contacts",
  ENTRIES_27: "entries",
  OFFERS_27: "offers"
});

const SUMMARY_METRICS = Object.freeze([
  ["total", "取込データ"],
  ["contacts", "接触"],
  ["lineRegistrations", "LINE登録"],
  ["entries", "エントリー"],
  ["offers", "内定"],
  ["mapped", "紐付け済み"],
  ["needsAction", "要確認・隔離"]
]);

export function buildTalentAnalytics(workspace) {
  const students = Array.isArray(workspace?.students) ? workspace.students : [];
  const overview = workspace?.overview || {};
  const lineRegistrations = countBy(students, (student) => Boolean(student.lineRegistrationDate));
  const summaryValues = {
    total: safeCount(overview.total),
    contacts: safeCount(overview.contacts),
    lineRegistrations,
    entries: safeCount(overview.entries),
    offers: safeCount(overview.offers),
    mapped: safeCount(overview.mapped),
    needsAction: safeCount(overview.ownerReview) + safeCount(overview.quarantined)
  };

  return Object.freeze({
    summary: Object.freeze(SUMMARY_METRICS.map(([key, label]) => Object.freeze({
      key,
      label,
      value: summaryValues[key]
    }))),
    flow: Object.freeze(buildMonthlyFlow(students)),
    schools: Object.freeze(buildSchoolRows(students)),
    coverage: Object.freeze({
      lineRegistrationRate: percentage(lineRegistrations, summaryValues.contacts),
      schoolRegistered: countBy(students, (student) => Boolean(cleanText(student.school))),
      schoolMissing: countBy(students, (student) => !cleanText(student.school)),
      monthCount: new Set(students.map(monthKey).filter(Boolean)).size
    })
  });
}

function buildMonthlyFlow(students) {
  const groups = new Map();
  students.forEach((student) => {
    const key = monthKey(student);
    if (!key) return;
    const row = groups.get(key) || {
      key,
      label: formatMonth(key),
      contacts: 0,
      lineRegistrations: 0,
      entries: 0,
      offers: 0,
      needsAction: 0
    };
    const metric = SOURCE_CODES[student.sourceCode];
    if (metric) row[metric] += 1;
    if (student.lineRegistrationDate) row.lineRegistrations += 1;
    if (student.classification === "OWNER_REVIEW" || student.classification === "QUARANTINE") {
      row.needsAction += 1;
    }
    groups.set(key, row);
  });
  return [...groups.values()]
    .sort((left, right) => right.key.localeCompare(left.key))
    .map((row) => Object.freeze({ ...row }));
}

function buildSchoolRows(students) {
  const groups = new Map();
  students.forEach((student) => {
    const school = cleanText(student.school);
    if (!school) return;
    const key = normalizeGroupKey(school);
    const row = groups.get(key) || {
      key,
      school,
      contacts: 0,
      lineRegistrations: 0,
      entries: 0,
      offers: 0,
      needsAction: 0
    };
    const metric = SOURCE_CODES[student.sourceCode];
    if (metric) row[metric] += 1;
    if (student.lineRegistrationDate) row.lineRegistrations += 1;
    if (student.classification === "OWNER_REVIEW" || student.classification === "QUARANTINE") {
      row.needsAction += 1;
    }
    groups.set(key, row);
  });
  return [...groups.values()]
    .map((row) => Object.freeze({
      ...row,
      entryRate: percentage(row.entries, row.contacts),
      offerRate: percentage(row.offers, row.contacts)
    }))
    .sort((left, right) => (
      right.contacts - left.contacts
      || right.entries - left.entries
      || left.school.localeCompare(right.school, "ja")
    ));
}

function monthKey(student) {
  const value = String(student?.businessDate || student?.lineRegistrationDate || "");
  return /^\d{4}-\d{2}(?:-\d{2})?$/u.test(value) ? value.slice(0, 7) : "";
}

function formatMonth(key) {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
}

function cleanText(value) {
  return String(value || "").normalize("NFKC").trim();
}

function normalizeGroupKey(value) {
  return cleanText(value)
    .replace(/\s+/gu, "")
    .toLocaleLowerCase("ja-JP");
}

function countBy(values, predicate) {
  return values.reduce((count, value) => count + (predicate(value) ? 1 : 0), 0);
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
