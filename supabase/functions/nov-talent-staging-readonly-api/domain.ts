const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const ALLOWED_ROLES = Object.freeze({
  full: new Set(["super_admin", "backoffice", "hr.admin"]),
  recruiter: new Set(["hr.staff"]),
  executive: new Set(["executive"]),
});

export type TalentAccessProfile = "full" | "recruiter" | "executive";

export type CandidateDatasetRow = {
  candidate_id: string;
  graduation_year: number;
  source_type: "CONTACTS_27" | "CONTACTS_28";
  source_row_no: number;
  student_name: string | null;
  student_name_kana: string | null;
  school_name: string | null;
  faculty_name: string | null;
  phone: string | null;
  email: string | null;
  line_identifier: string | null;
};

function text(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).normalize("NFKC").trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

export function resolveTalentAccessProfile(roleKeys: unknown): TalentAccessProfile | null {
  const roles = new Set((Array.isArray(roleKeys) ? roleKeys : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean));
  if ([...ALLOWED_ROLES.full].some((role) => roles.has(role))) return "full";
  if ([...ALLOWED_ROLES.recruiter].some((role) => roles.has(role))) return "recruiter";
  if ([...ALLOWED_ROLES.executive].some((role) => roles.has(role))) return "executive";
  return null;
}

export function validateCandidateDatasetRows(value: unknown): CandidateDatasetRow[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const rows: CandidateDatasetRow[] = [];
  for (const input of value) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const row = input as Record<string, unknown>;
    const candidateId = String(row.candidate_id || "");
    const graduationYear = Number(row.graduation_year);
    const sourceType = String(row.source_type || "");
    const sourceRowNo = Number(row.source_row_no);
    if (!UUID_PATTERN.test(candidateId)
      || ![2027, 2028].includes(graduationYear)
      || !["CONTACTS_27", "CONTACTS_28"].includes(sourceType)
      || !Number.isInteger(sourceRowNo)
      || sourceRowNo <= 0) return null;
    rows.push(Object.freeze({
      candidate_id: candidateId,
      graduation_year: graduationYear,
      source_type: sourceType as CandidateDatasetRow["source_type"],
      source_row_no: sourceRowNo,
      student_name: text(row.student_name, 120),
      student_name_kana: text(row.student_name_kana, 120),
      school_name: text(row.school_name, 180),
      faculty_name: text(row.faculty_name, 180),
      phone: text(row.phone, 40),
      email: text(row.email, 254),
      line_identifier: text(row.line_identifier, 160),
    }));
  }
  return rows;
}

export function buildCandidateSummary(rows: readonly CandidateDatasetRow[], fiscalYear = "current") {
  const selected = filterFiscalYear(rows, fiscalYear);
  return Object.freeze({
    contacts: selected.length,
    lineRegistrations: selected.filter((row) => Boolean(row.line_identifier)).length,
    salonTours: 0,
    interviews: 0,
    passed: 0,
    offers: 0,
    expectedJoiners: 0,
  });
}

export function buildCandidateWorkspace(
  rows: readonly CandidateDatasetRow[],
  accessProfile: TalentAccessProfile,
  fiscalYear = "current",
) {
  const selected = filterFiscalYear(rows, fiscalYear);
  const canViewContact = accessProfile !== "executive";
  const students = selected.map((row) => Object.freeze({
    applicationNo: `NT-${row.graduation_year}-${String(row.source_row_no).padStart(6, "0")}`,
    businessDate: null,
    classification: "IMPORTABLE",
    classificationLabel: "確認済み",
    displayName: row.student_name || "氏名未登録",
    email: canViewContact ? row.email : null,
    kana: row.student_name_kana,
    lineRegistrationDate: null,
    legacyNoPresent: true,
    mappingStatus: "OWNER_CONFIRMED",
    nextActionAt: null,
    offerDate: null,
    expectedJoinDate: null,
    plannedStore: null,
    phone: canViewContact ? row.phone : null,
    preferredStore: null,
    primaryEligible: true,
    profileVersion: 1,
    supplementVersion: null,
    reasonLabels: Object.freeze([]),
    recordId: row.candidate_id,
    school: row.school_name,
    sourceCode: row.source_type,
    sourceLabel: row.graduation_year === 2027 ? "27卒 接触学生" : "28卒 接触学生",
    sourceKeyStatus: "OWNER_CONFIRMED",
    status: "接触",
    statusCode: "CONTACT",
    suggestedTargetRecordId: null,
    suggestionCategory: "NONE",
  }));
  return Object.freeze({
    fiscalYear: fiscalYear === "current" ? "all" : fiscalYear,
    payloadMode: "workspace",
    overview: Object.freeze({
      contacts: students.length,
      entries: 0,
      exactLinkSuggestions: 0,
      mapped: students.length,
      manual: 0,
      offers: 0,
      ownerReview: 0,
      primaryCandidates: students.length,
      quarantined: 0,
      remainingManual: 0,
      total: students.length,
    }),
    students: Object.freeze(students),
  });
}

function filterFiscalYear(rows: readonly CandidateDatasetRow[], fiscalYear: string) {
  if (fiscalYear === "current") return [...rows];
  const year = Number(fiscalYear);
  return rows.filter((row) => row.graduation_year === year);
}
