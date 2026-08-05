const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|MERGE|COPY|CALL|DO|EXECUTE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|VACUUM|ANALYZE|SET\s+ROLE|SELECT\s+INTO|EXPLAIN|LOCK)\b|\bpg_advisory\w*/i;

export function validateFixedSql(sql) {
  if (typeof sql !== 'string' || sql.length === 0 || sql.length > 12000) return false;
  if (sql.includes(';') || FORBIDDEN.test(sql)) return false;
  if (!/^\s*(SELECT|WITH)\b/i.test(sql) || /\bSELECT\s+\*/i.test(sql)) return false;
  return true;
}
