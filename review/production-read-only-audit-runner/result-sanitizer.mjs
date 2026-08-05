const SAFE_KEY = /^(schema_name|relation_name|relation_kind|table_name|column_name|data_type|is_nullable|row_count|rls_enabled|policy_count|constraint_kind|key_column_count|index_count|unique_index_count|privilege_type|grant_count|view_dependency_count|function_dependency_count|transaction_read_only)$/;
const MAX_INT = 1_000_000;

export function maskUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? `${value.slice(0, 8)}…` : null;
}

export function sanitizeRows(rows, expectedColumns) {
  if (!Array.isArray(rows) || rows.length > 1000) throw new Error('SANITIZATION_INPUT_INVALID');
  const expected = new Set(expectedColumns);
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('SANITIZATION_INPUT_INVALID');
    const safe = {};
    for (const [key, value] of Object.entries(row)) {
      if (!expected.has(key) || !SAFE_KEY.test(key)) throw new Error('SANITIZATION_FIELD_REJECTED');
      if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value < 0 || value > MAX_INT) throw new Error('SANITIZATION_VALUE_REJECTED');
        safe[key] = value;
      } else if (typeof value === 'boolean') {
        safe[key] = value;
      } else if (typeof value === 'string' && value.length <= 128 && !/[\r\n]/.test(value)) {
        safe[key] = value;
      } else {
        throw new Error('SANITIZATION_VALUE_REJECTED');
      }
    }
    return safe;
  });
}
