import { hashCanonical, hashRecordSet } from './canonicalization.mjs';

const FORBIDDEN_FIELD = /(^|_)(employee_name|full_name|email|phone|address|birth|salary|password|secret|token|credential|connection|dsn|certificate|raw_sql|raw_error)(_|$)/i;
const HASH = /^[a-f0-9]{64}$/;

function assertSafeScalar(value) {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'string' && value.length <= 256 && !value.startsWith('\uFEFF')) return;
  throw new Error('PRIVATE_OUTPUT_VALUE_REJECTED');
}

function typeOfScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number' && Number.isSafeInteger(value)) return 'integer';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  return 'invalid';
}

function assertExpectedType(query, column, value) {
  const expectedTypes = query.expectedTypes?.[column];
  if (!Array.isArray(expectedTypes) || !expectedTypes.includes(typeOfScalar(value))) {
    throw new Error('PRIVATE_OUTPUT_TYPE_REJECTED');
  }
}

export function assertPrivateRows(query, rows) {
  if (!query || !Array.isArray(rows) || rows.length > query.maximumRows) {
    throw new Error('PRIVATE_OUTPUT_SHAPE_REJECTED');
  }
  const expected = new Set(query.expectedColumns);
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('PRIVATE_OUTPUT_SHAPE_REJECTED');
    const keys = Object.keys(row);
    if (keys.length !== expected.size || keys.some((key) => !expected.has(key) || (FORBIDDEN_FIELD.test(key) && !key.endsWith('_count')))) {
      throw new Error('PRIVATE_OUTPUT_FIELD_REJECTED');
    }
    for (const column of query.expectedColumns) {
      if (!Object.hasOwn(row, column)) throw new Error('PRIVATE_OUTPUT_FIELD_REJECTED');
      assertSafeScalar(row[column]);
      assertExpectedType(query, column, row[column]);
    }
  }
  return rows;
}

export function sanitizeQueryEvidence(query, rows) {
  assertPrivateRows(query, rows);
  const evidence = {
    query_id: query.queryId,
    result_category: 'sanitized-count-and-digest-only',
    row_count: rows.length,
    entity_digest: hashRecordSet(rows, query.canonicalKeyFields),
    output_schema_digest: hashCanonical(query.expectedColumns),
    status: 'pass',
  };
  assertSanitizedEvidence([evidence]);
  return evidence;
}

export function assertSanitizedEvidence(evidenceRows) {
  if (!Array.isArray(evidenceRows)) throw new Error('SANITIZED_EVIDENCE_REJECTED');
  for (const evidence of evidenceRows) {
    const allowed = new Set(['query_id', 'result_category', 'row_count', 'entity_digest', 'output_schema_digest', 'status']);
    if (!evidence || typeof evidence !== 'object' || Object.keys(evidence).some((key) => !allowed.has(key))) {
      throw new Error('SANITIZED_EVIDENCE_REJECTED');
    }
    if (typeof evidence.query_id !== 'string' || typeof evidence.result_category !== 'string'
      || !Number.isSafeInteger(evidence.row_count) || evidence.row_count < 0
      || !HASH.test(evidence.entity_digest) || !HASH.test(evidence.output_schema_digest)
      || evidence.status !== 'pass') {
      throw new Error('SANITIZED_EVIDENCE_REJECTED');
    }
  }
  return true;
}

export function safeFailureCode(error) {
  const known = new Set([
    'REQUEST_REJECTED',
    'PROFILE_REJECTED',
    'POSTGRES_VERSION_REJECTED',
    'EXECUTION_AUTHORIZATION_REJECTED',
    'RUN_ID_REJECTED',
    'PRIVATE_QUERY_PACK_REJECTED',
    'READ_ONLY_ROLE_REJECTED',
    'FIXED_QUERY_OUTPUT_SCHEMA_INVALID',
    'SCHEMA_CONTRACT_MISMATCH',
    'DOMAIN_VALIDATION_REJECTED',
    'TARGET_PRESTATE_REJECTED',
    'SEALED_ARTIFACT_REJECTED',
    'RUNNER_CLEANUP_FAILED',
  ]);
  return known.has(error?.code) ? error.code : 'SEALED_RUNNER_FAILED';
}
