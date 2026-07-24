const SOURCE_LABELS = Object.freeze({
  CONTACTS_27: "接触",
  ENTRIES_27: "エントリー",
  OFFERS_27: "内定",
});

const CLASSIFICATION_LABELS = Object.freeze({
  IMPORTABLE: "確認済み",
  OWNER_REVIEW: "要確認",
  QUARANTINE: "隔離",
  NOT_APPLICABLE: "対象外",
});

const FIELD_ALIASES = Object.freeze({
  name: Object.freeze(["氏名", "学生氏名", "名前", "お名前", "姓名"]),
  kana: Object.freeze(["フリガナ", "ふりがな", "カナ", "氏名カナ"]),
  school: Object.freeze(["学校名", "学校", "在籍校", "専門学校", "大学名"]),
  phone: Object.freeze(["電話番号", "携帯番号", "携帯", "TEL"]),
  email: Object.freeze(["メールアドレス", "メール", "E-MAIL", "MAIL"]),
  preferredStore: Object.freeze(["希望店舗", "店舗希望", "希望サロン", "配属希望"]),
  status: Object.freeze(["選考状況", "進捗", "ステータス", "現在状況"]),
});

const SAFE_REASON_LABELS = Object.freeze({
  SOURCE_KEY_UNPROVEN: "識別情報の確認が必要",
  CROSS_SHEET_LINK_UNPROVEN: "シート間の対応確認が必要",
  BUSINESS_DATE_MISSING: "日付の確認が必要",
  STATUS_MAPPING_UNPROVEN: "進捗の確認が必要",
  DUPLICATE_CANDIDATE: "重複候補",
  EXPECTED_JOINER_DATA_INSUFFICIENT: "入社予定情報の確認が必要",
  PLANNING_OR_SUMMARY_CONTENT: "集計・計画行",
  OWNER_REVIEW_REQUIRED: "担当者確認が必要",
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_ROWS = 1000;
const MAX_TEXT = 180;

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replaceAll("\u3000", " ")
    .replace(/[\s/／・:：()（）[\]【】._-]+/gu, "")
    .toUpperCase();
}

function boundedText(value: unknown, maximum = MAX_TEXT): string {
  if (!["string", "number", "boolean"].includes(typeof value)) return "";
  return String(value).normalize("NFKC").trim().slice(0, maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function payloadColumns(value: unknown): Array<{ header: string; value: string }> {
  if (!isRecord(value)) return [];
  const columns: Array<{ header: string; value: string }> = [];
  for (const [key, candidate] of Object.entries(value)) {
    if (!/^column_[0-9]{3}$/u.test(key) || !isRecord(candidate)) continue;
    const header = boundedText(candidate.header);
    const cellValue = boundedText(candidate.value, 500);
    if (header || cellValue) columns.push({ header, value: cellValue });
  }
  return columns.slice(0, 120);
}

function findField(
  columns: Array<{ header: string; value: string }>,
  aliases: readonly string[],
): string | null {
  const normalizedAliases = aliases.map(normalizeToken);
  for (const column of columns) {
    const header = normalizeToken(column.header);
    if (!header || !column.value) continue;
    if (normalizedAliases.some((alias) => header === alias || header.endsWith(alias))) {
      return column.value;
    }
  }
  return null;
}

function mappingStatus(value: unknown): string {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) return "UNMAPPED";
  return ["UNMAPPED", "OWNER_CONFIRMED", "REJECTED"].includes(String(row.mapping_status))
    ? String(row.mapping_status)
    : "UNMAPPED";
}

function safeReasonLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  for (const reason of value) {
    const label = SAFE_REASON_LABELS[String(reason) as keyof typeof SAFE_REASON_LABELS];
    if (label) labels.push(label);
  }
  return labels.slice(0, 6);
}

function sanitizeRow(value: unknown, ordinal: number) {
  if (!isRecord(value)) return null;
  const recordId = boundedText(value.staging_record_id, 40);
  const sourceCode = boundedText(value.source_sheet_code, 24);
  const classification = boundedText(value.classification, 24);
  if (!UUID_PATTERN.test(recordId)
    || !Object.hasOwn(SOURCE_LABELS, sourceCode)
    || !Object.hasOwn(CLASSIFICATION_LABELS, classification)) {
    return null;
  }

  const sourcePayload = isRecord(value.source_payload) ? value.source_payload : null;
  const columns = payloadColumns(sourcePayload?.payload);
  const name = findField(columns, FIELD_ALIASES.name);
  const school = findField(columns, FIELD_ALIASES.school);
  const status = findField(columns, FIELD_ALIASES.status);
  const businessDate = /^\d{4}-\d{2}-\d{2}$/u.test(String(value.business_date ?? ""))
    ? String(value.business_date)
    : null;

  return Object.freeze({
    recordId,
    displayName: name || `${SOURCE_LABELS[sourceCode as keyof typeof SOURCE_LABELS]}データ ${ordinal}`,
    kana: findField(columns, FIELD_ALIASES.kana),
    school,
    phone: findField(columns, FIELD_ALIASES.phone),
    email: findField(columns, FIELD_ALIASES.email),
    preferredStore: findField(columns, FIELD_ALIASES.preferredStore),
    sourceCode,
    sourceLabel: SOURCE_LABELS[sourceCode as keyof typeof SOURCE_LABELS],
    classification,
    classificationLabel:
      CLASSIFICATION_LABELS[classification as keyof typeof CLASSIFICATION_LABELS],
    mappingStatus: mappingStatus(value.mapping),
    status: status || CLASSIFICATION_LABELS[classification as keyof typeof CLASSIFICATION_LABELS],
    businessDate,
    lineRegistrationDate: /^\d{4}-\d{2}-\d{2}$/u.test(
      String(sourcePayload?.lineRegistrationDate ?? ""),
    )
      ? String(sourcePayload?.lineRegistrationDate)
      : null,
    reasonLabels: Object.freeze(safeReasonLabels(value.reason_codes)),
  });
}

function countBy<T>(rows: readonly T[], predicate: (row: T) => boolean): number {
  return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0);
}

export function buildTalentWorkspaceData(input: unknown, fiscalYear: string) {
  if (!isRecord(input) || !Array.isArray(input.rows) || input.rows.length > MAX_ROWS) return null;
  const rows = input.rows
    .map((row, index) => sanitizeRow(row, index + 1))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (rows.length !== input.rows.length) return null;

  const overview = Object.freeze({
    total: rows.length,
    contacts: countBy(rows, (row) => row.sourceCode === "CONTACTS_27"),
    entries: countBy(rows, (row) => row.sourceCode === "ENTRIES_27"),
    offers: countBy(rows, (row) => row.sourceCode === "OFFERS_27"),
    ownerReview: countBy(rows, (row) => row.classification === "OWNER_REVIEW"),
    quarantined: countBy(rows, (row) => row.classification === "QUARANTINE"),
    mapped: countBy(rows, (row) => row.mappingStatus === "OWNER_CONFIRMED"),
  });

  return Object.freeze({
    fiscalYear,
    payloadMode: "workspace",
    overview,
    students: Object.freeze(rows),
  });
}

export const TALENT_WORKSPACE_DOMAIN_CONTRACT = Object.freeze({
  maximumRows: MAX_ROWS,
  sourceCodes: Object.freeze(Object.keys(SOURCE_LABELS)),
  exposesRawPayload: false,
  requiresAccountableOwner: true,
});
