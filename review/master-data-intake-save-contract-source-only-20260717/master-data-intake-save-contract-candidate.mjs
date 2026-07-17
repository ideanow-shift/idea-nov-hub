const TARGETS = Object.freeze({
  employees: Object.freeze({
    keyField: "社員番号",
    requiredFields: Object.freeze(["社員番号", "氏名"]),
    optionalFields: Object.freeze(["メールアドレス", "所属", "雇用形態", "就労ステータス", "休職種別"])
  }),
  stores: Object.freeze({
    keyField: "店舗ID",
    requiredFields: Object.freeze(["店舗ID", "店舗名"]),
    optionalFields: Object.freeze(["店舗No", "法人", "エリア", "状態"])
  }),
  corporations: Object.freeze({
    keyField: "法人No",
    requiredFields: Object.freeze(["法人No", "法人名"]),
    optionalFields: Object.freeze(["正式名", "決算月", "状況", "有効"])
  })
});

const FORBIDDEN_FIELD_PATTERNS = Object.freeze([
  /pin/i,
  /password/i,
  /credential/i,
  /firebase/i,
  /line.?works/i,
  /notification/i,
  /profile.?image/i,
  /storage.?path/i,
  /my.?number/i,
  /salary/i,
  /bank/i,
  /actor/i,
  /role.?key/i,
  /permission/i
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const ALLOWED_ACTIONS = new Set(["create", "update"]);
const MAX_ROWS = 1000;
const MAX_FIELD_LENGTH = 2000;

function fail(code, detail = {}) {
  return { ok: false, code, ...detail };
}

function normalizeValue(value) {
  return String(value ?? "").trim();
}

function hasForbiddenField(values) {
  return Object.keys(values).some((field) => FORBIDDEN_FIELD_PATTERNS.some((pattern) => pattern.test(field)));
}

function validateCounts(expected, rows) {
  const creates = rows.filter((row) => row.action === "create").length;
  const updates = rows.filter((row) => row.action === "update").length;
  const unchanged = Number(expected?.unchanged);
  const errors = Number(expected?.errors);
  const total = Number(expected?.total);
  if (![creates, updates, unchanged, errors, total].every(Number.isSafeInteger)) return fail("INVALID_EXPECTED_COUNTS");
  if (unchanged < 0 || errors < 0 || total < 0) return fail("INVALID_EXPECTED_COUNTS");
  if (errors !== 0) return fail("PREVIEW_HAS_ERRORS");
  if (Number(expected.creates) !== creates || Number(expected.updates) !== updates) return fail("COUNT_MISMATCH");
  if (creates + updates + unchanged !== total) return fail("COUNT_MISMATCH");
  return { ok: true, creates, updates, unchanged, errors, total };
}

export function validateDataIntakeCommit(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fail("INVALID_PAYLOAD");
  const targetConfig = TARGETS[payload.target];
  if (!targetConfig) return fail("UNSUPPORTED_TARGET");
  if (!UUID_PATTERN.test(normalizeValue(payload.clientRequestId))) return fail("INVALID_CLIENT_REQUEST_ID");
  if (!SHA256_HEX_PATTERN.test(normalizeValue(payload.fileDigest))) return fail("INVALID_FILE_DIGEST");
  if (!SHA256_HEX_PATTERN.test(normalizeValue(payload.previewDigest))) return fail("INVALID_PREVIEW_DIGEST");
  if (!Array.isArray(payload.rows) || payload.rows.length > MAX_ROWS) return fail("INVALID_ROW_COUNT");

  const allowedFields = new Set([...targetConfig.requiredFields, ...targetConfig.optionalFields]);
  const seenKeys = new Set();
  const canonicalRows = [];

  for (const row of payload.rows) {
    if (!row || typeof row !== "object" || !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 2) {
      return fail("INVALID_ROW_IDENTITY");
    }
    if (!ALLOWED_ACTIONS.has(row.action)) return fail("INVALID_ROW_ACTION", { rowNumber: row.rowNumber });
    if (!row.values || typeof row.values !== "object" || Array.isArray(row.values)) {
      return fail("INVALID_ROW_VALUES", { rowNumber: row.rowNumber });
    }
    if (hasForbiddenField(row.values)) return fail("FORBIDDEN_FIELD", { rowNumber: row.rowNumber });
    const fields = Object.keys(row.values);
    if (fields.some((field) => !allowedFields.has(field))) return fail("UNKNOWN_FIELD", { rowNumber: row.rowNumber });
    if (targetConfig.requiredFields.some((field) => !normalizeValue(row.values[field]))) {
      return fail("MISSING_REQUIRED_VALUE", { rowNumber: row.rowNumber });
    }
    if (fields.some((field) => normalizeValue(row.values[field]).length > MAX_FIELD_LENGTH)) {
      return fail("FIELD_TOO_LONG", { rowNumber: row.rowNumber });
    }
    const key = normalizeValue(row.values[targetConfig.keyField]);
    if (seenKeys.has(key)) return fail("DUPLICATE_KEY", { rowNumber: row.rowNumber });
    seenKeys.add(key);
    canonicalRows.push({
      rowNumber: row.rowNumber,
      action: row.action,
      values: Object.fromEntries([...allowedFields].filter((field) => field in row.values).map((field) => [field, normalizeValue(row.values[field])]))
    });
  }

  const countResult = validateCounts(payload.expected, canonicalRows);
  if (!countResult.ok) return countResult;

  return {
    ok: true,
    code: canonicalRows.length ? "READY_FOR_ATOMIC_COMMIT" : "NO_CHANGES",
    target: payload.target,
    clientRequestId: normalizeValue(payload.clientRequestId).toLowerCase(),
    fileDigest: normalizeValue(payload.fileDigest),
    previewDigest: normalizeValue(payload.previewDigest),
    rows: canonicalRows,
    expected: countResult,
    requiresBackendAuthorization: true,
    requiresTransactionalRpc: canonicalRows.length > 0
  };
}

export function classifyIdempotentAttempt(previous, next) {
  if (!previous) return "FIRST_ATTEMPT";
  if (previous.clientRequestId === next.clientRequestId && previous.fileDigest === next.fileDigest && previous.previewDigest === next.previewDigest) {
    return "SAFE_REPLAY_SAME_RESULT";
  }
  if (previous.clientRequestId === next.clientRequestId) return "REJECT_REQUEST_ID_REUSE";
  if (previous.target === next.target && previous.fileDigest === next.fileDigest) return "REJECT_DUPLICATE_FILE";
  return "FIRST_ATTEMPT";
}

export const DATA_INTAKE_SAVE_CONTRACT = Object.freeze({
  action: "masterCommitDataIntake",
  targets: Object.keys(TARGETS),
  maxRows: MAX_ROWS,
  atomic: true,
  partialSave: false,
  browserDirectDatabaseWrite: false,
  blankOptionalValueSemantics: "NO_CHANGE",
  productionEnabled: false
});
