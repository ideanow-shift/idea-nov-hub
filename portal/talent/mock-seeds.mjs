const SCHOOL_NAMES = Object.freeze([
  "架空大学 A", "架空大学 B", "架空専門学校 C", "架空短期大学 D", "学校未設定"
]);

const STATUS_DEFINITIONS = Object.freeze([
  "LINE_REGISTERED", "SALON_TOUR_COMPLETED", "INTERVIEW_COMPLETED",
  "OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"
]);

export const MOCK_SEED_INVENTORY = Object.freeze({
  source27Rows: 27,
  source28Rows: 120,
  totalRows: 147,
  containsRealPersonalValues: false,
  sourceFilesMutated: false
});

export function buildAnonymousTalentSeeds({ now = new Date() } = {}) {
  const source27 = buildCohort(27, MOCK_SEED_INVENTORY.source27Rows, now);
  const source28 = buildCohort(28, MOCK_SEED_INVENTORY.source28Rows, now);
  return Object.freeze({
    source27: Object.freeze(source27),
    source28: Object.freeze(source28),
    candidates: Object.freeze([...source27, ...source28])
  });
}

function buildCohort(cohort, rowCount, now) {
  return Array.from({ length: rowCount }, (_, index) => buildCandidate({ cohort, index, now }));
}

function buildCandidate({ cohort, index, now }) {
  const serial = String(index + 1).padStart(3, "0");
  const statusCode = STATUS_DEFINITIONS[index % STATUS_DEFINITIONS.length];
  const status = CANDIDATE_STATUS_LABELS[statusCode];
  const sourceType = ["OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(statusCode)
    ? "OFFERS"
    : statusCode === "LINE_REGISTERED" ? "CONTACTS" : "ENTRIES";
  const classification = index % 19 === 0
    ? "QUARANTINE"
    : index % 13 === 0 ? "OWNER_REVIEW" : "IMPORTABLE";
  const nextActionAt = index % 4 === 3 ? "" : offsetDate(now, (index % 10) - 4);
  const offerDate = ["OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(statusCode)
    ? offsetDate(now, -((index % 20) + 2))
    : "";
  const expectedJoinDate = statusCode === "EXPECTED_JOIN" ? offsetDate(now, 30 + (index % 45)) : "";
  const graduationYear = 2000 + cohort;
  const recordId = mockCandidateId(cohort, index);
  const lineRegistrationDate = index % 3 === 0 ? offsetDate(now, -((index % 75) + 1)) : "";
  const eventCodes = [];
  if (lineRegistrationDate) eventCodes.push("LINE_REGISTERED");
  if (["SALON_TOUR_COMPLETED", "INTERVIEW_COMPLETED", "OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(statusCode)) {
    eventCodes.push("SALON_TOUR_COMPLETED");
  }
  const selectionCodes = [];
  if (sourceType !== "CONTACTS") selectionCodes.push("APPLICATION_RECEIVED");
  if (["INTERVIEW_COMPLETED", "OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(statusCode)) {
    selectionCodes.push("INTERVIEW_COMPLETED");
  }
  if (["OFFERED", "OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(statusCode)) selectionCodes.push("OFFERED");
  if (["OFFER_ACCEPTED", "EXPECTED_JOIN"].includes(statusCode)) selectionCodes.push("OFFER_ACCEPTED");

  return Object.freeze({
    applicationNo: `MOCK-${graduationYear}-${serial}`,
    assignee: index % 3 === 0 ? "採用担当 A" : index % 3 === 1 ? "採用担当 B" : "採用チーム",
    businessDate: offsetDate(now, -((index % 90) + 1)),
    classification,
    classificationLabel: classification === "QUARANTINE"
      ? "隔離"
      : classification === "OWNER_REVIEW" ? "要確認" : "確認済み",
    displayName: `学生 ${cohort}-${serial}`,
    email: "",
    kana: "",
    lineRegistrationDate,
    legacyNoPresent: false,
    mappingStatus: classification === "IMPORTABLE" ? "OWNER_CONFIRMED" : "UNMAPPED",
    nextActionAt,
    nextActionLabel: statusCode === "OFFERED" ? "内定承諾を確認" : statusCode === "SALON_TOUR_COMPLETED" ? "見学後フォロー" : "次回連絡",
    offerDate,
    expectedJoinDate,
    plannedStore: statusCode === "EXPECTED_JOIN" ? "配属未定" : "",
    phone: "",
    preferredStore: "",
    priority: nextActionAt && nextActionAt <= offsetDate(now, 0) ? "高" : index % 3 === 0 ? "中" : "通常",
    primaryEligible: false,
    profileVersion: 1,
    supplementVersion: 0,
    reasonLabels: Object.freeze(classification === "IMPORTABLE" ? [] : ["Mock確認対象"]),
    recordId,
    school: SCHOOL_NAMES[index % SCHOOL_NAMES.length],
    sourceCode: `${sourceType}_${cohort}`,
    sourceLabel: `${cohort}卒 匿名seed`,
    sourceKeyStatus: "MOCK_ONLY",
    status,
    statusCode,
    suggestedTargetRecordId: "",
    suggestionCategory: "NONE"
    ,contactHistory: Object.freeze([{ active: true, code: "CONTACT_RECORDED", date: offsetDate(now, -((index % 90) + 1)), label: "接触記録", detail: "匿名Mock記録" }])
    ,eventHistory: Object.freeze(eventCodes.map((code) => Object.freeze({ active: true, code, date: offsetDate(now, -((index % 60) + 2)), label: CANDIDATE_STATUS_LABELS[code] || code, detail: "匿名Mockイベント" })))
    ,selectionHistory: Object.freeze(selectionCodes.map((code) => Object.freeze({ active: true, code, date: offsetDate(now, -((index % 45) + 1)), label: CANDIDATE_STATUS_LABELS[code] || code, detail: "匿名Mock選考記録" })))
  });
}

function mockCandidateId(cohort, index) {
  const suffix = `${String(cohort).padStart(2, "0")}${String(index + 1).padStart(10, "0")}`;
  return `00000000-0000-4000-8000-${suffix}`;
}

function offsetDate(base, days) {
  const value = new Date(base);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
import { CANDIDATE_STATUS_LABELS } from "./status-dictionary.mjs";
