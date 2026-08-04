export const STATUS_LABELS: Record<string, string> = Object.freeze({
  LINE_REGISTERED: "LINE登録", APPLICATION_RECEIVED: "応募受付",
  SALON_TOUR_PLANNED: "サロン見学［予定］", SALON_TOUR_COMPLETED: "サロン見学［済］",
  INTERVIEW_PLANNED: "面接［予定］", INTERVIEW_COMPLETED: "面接［済］",
  UNDER_REVIEW: "合否検討中", OFFERED: "内定", OFFER_ACCEPTED: "内定承諾",
  EXPECTED_JOIN: "入社予定", OFFERED_ELSEWHERE: "他社内定",
  WITHDRAWN: "辞退・離脱", REJECTED: "不採用"
});

const ROLE_GROUPS = Object.freeze({
  full: new Set(["super_admin", "backoffice", "hr.admin"]),
  recruiter: new Set(["hr.staff"]), executive: new Set(["executive"])
});

export function resolveAccess(roleKeys: unknown) {
  const roles = new Set((Array.isArray(roleKeys) ? roleKeys : []).map((v) => String(v || "").trim().toLowerCase()));
  if ([...ROLE_GROUPS.full].some((v) => roles.has(v))) return "full";
  if ([...ROLE_GROUPS.recruiter].some((v) => roles.has(v))) return "recruiter";
  if ([...ROLE_GROUPS.executive].some((v) => roles.has(v))) return "executive";
  return null;
}

export function cleanCandidate(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const graduationYear = Number(value.graduationYear);
  const studentName = clean(value.displayName, 120);
  const status = String(value.currentStatus || "");
  const expectedVersion = value.expectedVersion === undefined ? null : Number(value.expectedVersion);
  const reason = clean(value.changeReason, 500);
  if (!Number.isInteger(graduationYear) || graduationYear < 2026 || graduationYear > 2035 || !studentName
    || !STATUS_LABELS[status] || !reason
    || (expectedVersion !== null && (!Number.isInteger(expectedVersion) || expectedVersion < 1))) return null;
  const email = clean(value.email, 254)?.toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return null;
  return Object.freeze({
    graduationYear, studentName, studentNameKana: clean(value.kana, 120), schoolName: clean(value.school, 180),
    facultyName: clean(value.faculty, 180), phone: clean(value.phone, 40), email,
    lineIdentifier: clean(value.lineIdentifier, 160), currentStatus: status,
    acquisitionSource: clean(value.acquisitionSource, 180), assignedTo: clean(value.assignedTo, 120),
    notes: clean(value.notes, 4000), expectedVersion, reason
  });
}

const EVENT_CODES = new Set([
  "CONTACT_RECORDED", "LINE_REGISTERED", "SALON_TOUR_PLANNED",
  "SALON_TOUR_COMPLETED", "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED"
]);
const SELECTION_CODES = new Set([
  "APPLICATION_RECEIVED", "SALON_TOUR_PLANNED", "SALON_TOUR_COMPLETED",
  "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "UNDER_REVIEW", "OFFERED",
  "OFFER_ACCEPTED", "OFFERED_ELSEWHERE", "WITHDRAWN", "REJECTED"
]);
const ACTION_CODES = new Set(["FOLLOW_UP", "SALON_TOUR_FOLLOW_UP", "INTERVIEW_FOLLOW_UP", "OFFER_FOLLOW_UP"]);

export function cleanActivity(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const entityType = String(value.entityType || "");
  const operation = String(value.operation || "");
  const candidateId = clean(value.candidateId, 40);
  const entityId = clean(value.entityId, 40);
  const expectedVersion = value.expectedVersion === undefined || value.expectedVersion === null
    ? null : Number(value.expectedVersion);
  const reason = clean(value.reason, 500);
  if (!candidateId || !reason || !["EVENT", "SELECTION", "NEXT_ACTION"].includes(entityType)
    || !["CREATE", "UPDATE", "COMPLETE", "DEACTIVATE", "RESTORE"].includes(operation)
    || (operation !== "CREATE" && (!entityId || !Number.isInteger(expectedVersion) || Number(expectedVersion) < 1))) return null;
  const code = String(value.code || "");
  const allowedCodes = entityType === "EVENT" ? EVENT_CODES : entityType === "SELECTION" ? SELECTION_CODES : ACTION_CODES;
  if (["CREATE", "UPDATE"].includes(operation) && !allowedCodes.has(code)) return null;
  const date = clean(value.date, 10);
  if (entityType !== "NEXT_ACTION" && ["CREATE", "UPDATE"].includes(operation) && !/^\d{4}-\d{2}-\d{2}$/u.test(date || "")) return null;
  if (entityType === "NEXT_ACTION" && date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const state = entityType === "EVENT" ? String(value.state || "COMPLETED")
    : entityType === "NEXT_ACTION" ? String(value.state || "OPEN") : null;
  if (entityType === "EVENT" && !["PLANNED", "COMPLETED"].includes(state || "")) return null;
  if (entityType === "NEXT_ACTION" && !["OPEN", "COMPLETED", "CANCELLED"].includes(state || "")) return null;
  return Object.freeze({
    entityType, operation, candidateId, entityId, expectedVersion, reason, code, date,
    name: clean(value.name, 180), state, content: clean(value.content, 1000),
    assignedTo: clean(value.assignedTo, 120), notes: clean(value.notes, 2000)
  });
}

export function cleanSourceFactLink(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const candidateId = clean(value.candidateId, 40);
  const sourceType = String(value.sourceType || "");
  const sourceRowNo = Number(value.sourceRowNo);
  const factCode = String(value.factCode || "");
  const expectedVersion = Number(value.expectedVersion);
  const reason = clean(value.reason, 500);
  if (!candidateId || sourceType !== "ENTRIES_27" || factCode !== "INTERVIEW_COMPLETED" || !reason
    || !Number.isInteger(sourceRowNo) || sourceRowNo < 1 || !Number.isInteger(expectedVersion) || expectedVersion < 1) return null;
  return Object.freeze({ candidateId, sourceType, sourceRowNo, factCode, expectedVersion, reason });
}

export function cleanRecruitmentMaster(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const entityType = String(value.entityType || "");
  const operation = String(value.operation || "");
  const entityId = clean(value.entityId, 40);
  const expectedVersion = value.expectedVersion === undefined || value.expectedVersion === null ? null : Number(value.expectedVersion);
  const reason = clean(value.reason, 500);
  if (!reason || !["SCHOOL", "FAIR"].includes(entityType) || !["CREATE", "UPDATE", "DEACTIVATE", "RESTORE"].includes(operation)
    || (operation !== "CREATE" && (!entityId || !Number.isInteger(expectedVersion) || Number(expectedVersion) < 1))) return null;
  if (entityType === "SCHOOL") {
    const schoolName = clean(value.schoolName, 180);
    if (["CREATE", "UPDATE"].includes(operation) && !schoolName) return null;
    return Object.freeze({ entityType, operation, entityId, expectedVersion, reason,
      payload: { schoolName, facultyName: clean(value.facultyName, 180), assignedTo: clean(value.assignedTo, 120) } });
  }
  const fairName = clean(value.fairName, 180);
  const eventDate = clean(value.eventDate, 10);
  if (["CREATE", "UPDATE"].includes(operation) && (!fairName || !/^\d{4}-\d{2}-\d{2}$/u.test(eventDate || ""))) return null;
  const counts = ["participationFee", "participantCount", "contactCount", "lineRegistrationCount", "salonTourCount", "interviewCount", "offerCount", "hireCount"];
  const numeric = Object.fromEntries(counts.map((key) => [key, Number(value[key] ?? 0)]));
  if (Object.values(numeric).some((number) => !Number.isInteger(number) || number < 0)) return null;
  return Object.freeze({ entityType, operation, entityId, expectedVersion, reason,
    payload: { fairName, eventDate, venue: clean(value.venue, 180), assignedTo: clean(value.assignedTo, 120), ...numeric } });
}

function clean(value: unknown, max: number) {
  const result = String(value ?? "").normalize("NFKC").trim();
  return result ? result.slice(0, max) : null;
}
