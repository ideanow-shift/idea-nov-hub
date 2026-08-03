export const STATUS_LABELS: Record<string, string> = Object.freeze({
  LINE_REGISTERED: "LINE登録", SALON_TOUR_PLANNED: "サロン見学［予定］",
  SALON_TOUR_COMPLETED: "サロン見学［済］", AWAITING_INTERVIEW: "面接待ち",
  OFFERED: "内定", OFFERED_ELSEWHERE: "他社内定", DROPPED: "離脱",
  UNDER_REVIEW: "合否検討中", REJECTED: "不採用"
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

function clean(value: unknown, max: number) {
  const result = String(value ?? "").normalize("NFKC").trim();
  return result ? result.slice(0, max) : null;
}
