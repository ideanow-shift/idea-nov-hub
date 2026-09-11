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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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
  const rawStatus = String(value.currentStatus || "").trim();
  const status = rawStatus || null;
  const expectedVersion = value.expectedVersion === undefined ? null : Number(value.expectedVersion);
  const reason = clean(value.changeReason, 500);
  const assignedEmployeeId = value.assignedEmployeeId == null || value.assignedEmployeeId === ""
    ? null : clean(value.assignedEmployeeId, 40);
  if (!Number.isInteger(graduationYear) || graduationYear < 2026 || graduationYear > 2035 || !studentName
    || (status !== null && !STATUS_LABELS[status]) || !reason
    || (assignedEmployeeId !== null && !UUID.test(assignedEmployeeId))
    || (expectedVersion !== null && (!Number.isInteger(expectedVersion) || expectedVersion < 1))) return null;
  const email = clean(value.email, 254)?.toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return null;
  return Object.freeze({
    graduationYear, studentName, studentNameKana: clean(value.kana, 120), schoolName: clean(value.school, 180),
    facultyName: clean(value.faculty, 180), phone: clean(value.phone, 40), email,
    lineIdentifier: clean(value.lineIdentifier, 160), currentStatus: status,
    acquisitionSource: clean(value.acquisitionSource, 180), assignedEmployeeId,
    assignedTo: null,
    notes: clean(value.notes, 4000), expectedVersion, reason
  });
}

const EVENT_CODES = new Set([
  "CONTACT_RECORDED", "LINE_REGISTERED", "SALON_TOUR_PLANNED",
  "SALON_TOUR_COMPLETED", "COMMUNICATION_RECORDED"
]);
const SELECTION_CODES = new Set([
  "APPLICATION_RECEIVED", "INTERVIEW_PLANNED", "INTERVIEW_COMPLETED", "OFFERED",
  "OFFER_ACCEPTED", "WITHDRAWN", "REJECTED"
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
  const expectedCandidateVersion = value.expectedCandidateVersion === undefined || value.expectedCandidateVersion === null
    ? null : Number(value.expectedCandidateVersion);
  const reason = clean(value.reason, 500);
  if (!candidateId || !reason || !["EVENT", "SELECTION", "NEXT_ACTION"].includes(entityType)
    || !["CREATE", "UPDATE", "COMPLETE", "DEACTIVATE", "RESTORE"].includes(operation)
    || (operation !== "CREATE" && (!entityId || !Number.isInteger(expectedVersion) || Number(expectedVersion) < 1))) return null;
  if (entityType === "SELECTION" && (operation !== "CREATE"
    || !Number.isInteger(expectedCandidateVersion) || Number(expectedCandidateVersion) < 1)) return null;
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
    entityType, operation, candidateId, entityId, expectedVersion, expectedCandidateVersion, reason, code, date,
    name: clean(value.name, 180), state, content: clean(value.content, 1000),
    assignedTo: clean(value.assignedTo, 120), notes: clean(value.notes, 2000)
  });
}

const COMMUNICATION_METHODS = new Set(["LINE", "PHONE", "EMAIL", "IN_PERSON", "SCHOOL_RELAY", "OTHER"]);
const COMMUNICATION_DIRECTIONS = new Set(["INBOUND", "OUTBOUND"]);
const COMMUNICATION_RESULTS = new Set(["REACHED", "NO_RESPONSE", "REPLY_RECEIVED", "INFORMATION_SHARED", "OTHER"]);
const STRICT_RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/u;

export function canonicalizeStrictRfc3339(input: unknown) {
  const value = clean(input, 35);
  const match = STRICT_RFC3339.exec(value || "");
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction = "", zone, sign, offsetHour = "00", offsetMinute = "00"] = match;
  const offsetMinutes = zone === "Z" ? 0 : (Number(offsetHour) * 60 + Number(offsetMinute)) * (sign === "-" ? -1 : 1);
  if (Number(offsetHour) > 14 || Number(offsetMinute) > 59 || (Number(offsetHour) === 14 && Number(offsetMinute) !== 0)) return null;
  const millis = Number(fraction.padEnd(3, "0"));
  const localMillis = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), millis);
  const local = new Date(localMillis);
  if (local.getUTCFullYear() !== Number(year) || local.getUTCMonth() + 1 !== Number(month) || local.getUTCDate() !== Number(day)
    || local.getUTCHours() !== Number(hour) || local.getUTCMinutes() !== Number(minute) || local.getUTCSeconds() !== Number(second)) return null;
  const instant = new Date(localMillis - offsetMinutes * 60_000);
  if (Number.isNaN(instant.getTime())) return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction ? `.${fraction}` : ""}${zone}`;
}

export function cleanCommunicationCommand(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const candidateId = clean(value.candidateId, 40);
  const expectedCandidateVersion = Number(value.expectedCandidateVersion);
  const communicationAt = canonicalizeStrictRfc3339(value.communicationAt);
  const method = String(value.method || "");
  const direction = String(value.direction || "");
  const result = String(value.result || "");
  const summary = clean(value.summary, 1000);
  const reason = clean(value.reason, 500);
  const awaitingReply = value.awaitingReply;
  const createNextAction = value.createNextAction === true;
  const nextActionCode = createNextAction ? String(value.nextActionCode || "") : null;
  const nextActionDueDate = createNextAction ? clean(value.nextActionDueDate, 10) : null;
  const nextActionText = createNextAction ? clean(value.nextActionText, 1000) : null;
  const nextActionAssignedTo = createNextAction ? clean(value.nextActionAssignedTo, 120) : null;
  const nextActionAssignedEmployeeId = createNextAction ? clean(value.nextActionAssignedEmployeeId, 40) : null;
  const correctsCommunicationId = clean(value.correctsCommunicationId, 40);
  const correctionReason = clean(value.correctionReason, 500);
  if (!candidateId || !Number.isInteger(expectedCandidateVersion) || expectedCandidateVersion < 1
    || !communicationAt
    || !COMMUNICATION_METHODS.has(method) || !COMMUNICATION_DIRECTIONS.has(direction)
    || !COMMUNICATION_RESULTS.has(result) || !summary || !reason || typeof awaitingReply !== "boolean") return null;
  if (createNextAction && (!ACTION_CODES.has(nextActionCode || "")
    || !/^\d{4}-\d{2}-\d{2}$/u.test(nextActionDueDate || "") || !nextActionText || !UUID.test(nextActionAssignedEmployeeId || ""))) return null;
  if (Boolean(correctsCommunicationId) !== Boolean(correctionReason) || (correctsCommunicationId && !UUID.test(correctsCommunicationId))) return null;
  return Object.freeze({ candidateId, expectedCandidateVersion, communicationAt, method, direction, result,
    summary, reason, awaitingReply, createNextAction, nextActionCode, nextActionDueDate,
    nextActionText, nextActionAssignedTo, nextActionAssignedEmployeeId, correctsCommunicationId, correctionReason });
}

export function cleanNextActionCommand(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const operation = String(value.operation || "");
  const candidateId = clean(value.candidateId, 40);
  const nextActionId = clean(value.nextActionId, 40);
  const expectedVersion = value.expectedVersion == null ? null : Number(value.expectedVersion);
  const actionCode = clean(value.actionCode, 40);
  const dueDate = clean(value.dueDate, 10);
  const actionText = clean(value.actionText, 1000);
  const assignedTo = clean(value.assignedTo, 120);
  const assignedEmployeeId = clean(value.assignedEmployeeId, 40);
  const holdReason = clean(value.holdReason, 500);
  const reason = clean(value.reason, 500);
  if (!candidateId || !reason || !["CREATE","ASSIGN","COMPLETE","HOLD","REOPEN","CANCEL"].includes(operation)) return null;
  if (operation === "CREATE" && (!ACTION_CODES.has(actionCode || "") || !/^\d{4}-\d{2}-\d{2}$/u.test(dueDate || "") || !actionText || !UUID.test(assignedEmployeeId || ""))) return null;
  if (operation === "ASSIGN" && !UUID.test(assignedEmployeeId || "")) return null;
  if (operation !== "CREATE" && (!nextActionId || !Number.isInteger(expectedVersion) || Number(expectedVersion) < 1)) return null;
  if (operation === "HOLD" && !holdReason) return null;
  return Object.freeze({ operation, candidateId, nextActionId, expectedVersion, actionCode, dueDate,
    actionText, assignedTo, assignedEmployeeId, holdReason, reason });
}

export function cleanSourceFactLink(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const candidateId = clean(value.candidateId, 40);
  const sourceType = String(value.sourceType || "");
  const sourceRowNo = Number(value.sourceRowNo);
  const factCode = String(value.factCode || "");
  const expectedVersion = Number(value.expectedVersion);
  const expectedCandidateVersion = Number(value.expectedCandidateVersion);
  const reason = clean(value.reason, 500);
  const evidenceReference = clean(value.evidenceReference, 300);
  const canonicalReference = `SOURCE:${sourceType}:ROW:${sourceRowNo}:${factCode}`;
  if (!candidateId || !new Set(["ENTRIES_27", "OFFERS_27"]).has(sourceType)
    || !SELECTION_CODES.has(factCode) || !reason
    || !Number.isInteger(sourceRowNo) || sourceRowNo < 1
    || !Number.isInteger(expectedVersion) || expectedVersion < 1
    || !Number.isInteger(expectedCandidateVersion) || expectedCandidateVersion < 1
    || evidenceReference !== canonicalReference) return null;
  return Object.freeze({
    candidateId, sourceType, sourceRowNo, factCode, expectedVersion,
    expectedCandidateVersion, evidenceReference, reason
  });
}

export function cleanFairAttributionDecision(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const decision = String(value.decision || "");
  const expectedVersion = Number(value.expectedVersion);
  const reason = clean(value.reason, 500);
  const evidenceReference = clean(value.evidenceReference, 300);
  const reviewNote = clean(value.reviewNote, 1000);
  if (!["PENDING", "CONFIRMED", "REJECTED"].includes(decision)
    || !Number.isInteger(expectedVersion) || expectedVersion < 1 || !reason || !evidenceReference) return null;
  return Object.freeze({ decision, expectedVersion, reason, evidenceReference, reviewNote });
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
  if (FAIR_LEGACY_KPI_FIELDS.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return null;
  const numeric = cleanFairNullableIntegers(value, operation);
  if (!numeric) return null;
  return Object.freeze({ entityType, operation, entityId, expectedVersion, reason,
    payload: { fairName, eventDate, venue: clean(value.venue, 180), assignedTo: clean(value.assignedTo, 120), ...numeric } });
}

const FAIR_NULLABLE_INTEGER_FIELDS = Object.freeze([
  "participationFee", "participantCount", "contactCount", "lineRegistrationCount", "salonTourCount",
  "expectedContacts", "totalAttendance", "participatingSalons"
]);
const FAIR_LEGACY_KPI_FIELDS = Object.freeze(["interviewCount", "offerCount", "hireCount"]);

function cleanFairNullableIntegers(value: Record<string, unknown>, operation: string) {
  const payload: Record<string, number | null> = {};
  if (!["CREATE", "UPDATE"].includes(operation)) return payload;
  for (const key of FAIR_NULLABLE_INTEGER_FIELDS) {
    const present = Object.prototype.hasOwnProperty.call(value, key);
    if (!present) {
      // CREATE stores an explicit unknown. UPDATE must omit the key so the RPC's
      // `p_payload ? key` contract preserves the existing database value.
      if (operation === "CREATE") payload[key] = null;
      continue;
    }
    const raw = value[key];
    if (raw === null) {
      payload[key] = null;
      continue;
    }
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) return null;
    payload[key] = raw;
  }
  return payload;
}

function clean(value: unknown, max: number) {
  const result = String(value ?? "").normalize("NFKC").trim();
  return result ? result.slice(0, max) : null;
}
