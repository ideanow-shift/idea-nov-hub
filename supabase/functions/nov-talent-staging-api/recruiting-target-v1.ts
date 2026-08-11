export const RECRUITING_TARGET_CONTRACT_VERSION = "1.0.0";
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const PERIOD = /^[A-Z0-9][A-Z0-9_-]{0,31}$/u;
const TARGET_TYPES = new Set(["OFFERED", "OFFER_ACCEPTED"]);

export function cleanRecruitingTargetDraft(value: unknown) {
  if (!exactObject(value, ["graduationYear", "targetType", "targetPeriodCode", "targetPeriodStart", "targetPeriodEnd", "scopeType", "targetCount", "effectiveFrom", "effectiveTo", "reason"])) return null;
  const input = value as Record<string, unknown>;
  const graduationYear = input.graduationYear;
  const targetCount = input.targetCount;
  const reason = String(input.reason || "").trim();
  if (typeof graduationYear !== "number" || !Number.isInteger(graduationYear) || graduationYear < 2020 || graduationYear > 2100
    || !TARGET_TYPES.has(String(input.targetType)) || input.scopeType !== "COMPANY"
    || !PERIOD.test(String(input.targetPeriodCode)) || !DATE.test(String(input.targetPeriodStart))
    || !DATE.test(String(input.targetPeriodEnd)) || String(input.targetPeriodStart) > String(input.targetPeriodEnd)
    || typeof targetCount !== "number" || !Number.isInteger(targetCount) || targetCount < 0 || !DATE.test(String(input.effectiveFrom))
    || !DATE.test(String(input.effectiveTo)) || String(input.effectiveFrom) > String(input.effectiveTo)
    || reason.length < 1 || reason.length > 500) return null;
  return Object.freeze({ graduationYear, targetType: String(input.targetType), targetPeriodCode: String(input.targetPeriodCode),
    targetPeriodStart: String(input.targetPeriodStart), targetPeriodEnd: String(input.targetPeriodEnd), scopeType: "COMPANY",
    targetCount, effectiveFrom: String(input.effectiveFrom), effectiveTo: String(input.effectiveTo), reason });
}

export function cleanRecruitingTargetStateCommand(value: unknown) {
  if (!exactObject(value, ["expectedRowVersion"])) return null;
  const expectedRowVersion = (value as Record<string, unknown>).expectedRowVersion;
  return typeof expectedRowVersion === "number" && Number.isInteger(expectedRowVersion) && expectedRowVersion >= 1
    ? Object.freeze({ expectedRowVersion }) : null;
}

export function recruitingTargetEnvelope(rows: unknown[], kind: "CURRENT" | "DRAFTS" | "HISTORY") {
  if (!Array.isArray(rows)) return null;
  const targets = rows.map(targetView);
  if (targets.some((row) => !row)) return null;
  return Object.freeze({ ok: true as const, data: Object.freeze({ recruiting_target_contract_version: RECRUITING_TARGET_CONTRACT_VERSION,
    kind, targets: Object.freeze(targets), sourceAvailability: true }) });
}

function targetView(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const state = String(row.record_state || "");
  const graduationYear = Number(row.graduation_year);
  const targetCount = Number(row.target_count);
  const version = Number(row.version);
  const rowVersion = Number(row.row_version);
  if (!/^[0-9a-f-]{36}$/iu.test(String(row.target_id || "")) || !TARGET_TYPES.has(String(row.target_type))
    || !["DRAFT", "APPROVED", "SUPERSEDED"].includes(state) || row.scope_type !== "COMPANY" || row.scope_id !== null
    || !Number.isInteger(graduationYear) || graduationYear < 2020 || graduationYear > 2100
    || !Number.isInteger(targetCount) || targetCount < 0 || !Number.isInteger(version) || version < 1
    || !Number.isInteger(rowVersion) || rowVersion < 1 || !PERIOD.test(String(row.target_period_code))
    || !DATE.test(String(row.target_period_start)) || !DATE.test(String(row.target_period_end))
    || !DATE.test(String(row.effective_from)) || !DATE.test(String(row.effective_to))) return null;
  return Object.freeze({ targetId: String(row.target_id), graduationYear, targetType: String(row.target_type),
    targetPeriod: Object.freeze({ code: String(row.target_period_code), start: String(row.target_period_start), end: String(row.target_period_end) }),
    scope: Object.freeze({ type: "COMPANY", id: null }), targetCount,
    version, rowVersion, state, effectivePeriod: Object.freeze({ from: String(row.effective_from), to: String(row.effective_to) }),
    reason: String(row.reason), approvedBy: row.approved_by ?? null, approvedAt: row.approved_at ?? null,
    supersededByTargetId: row.superseded_by_target_id ?? null, supersededAt: row.superseded_at ?? null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at) });
}

function exactObject(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value as Record<string, unknown>).sort();
  return actual.length === keys.length && keys.slice().sort().every((key, index) => actual[index] === key);
}
