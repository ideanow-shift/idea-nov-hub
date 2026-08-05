import { AUDIT_PACK_ID, getFixedQuery, QUERY_IDS } from './query-registry.mjs';
import { verifyIdentity } from './identity-verifier.mjs';
import { sanitizeRows } from './result-sanitizer.mjs';
import { validateFixedSql } from './sql-validator.mjs';
import { validateAuditResult } from './schema-validator.mjs';

const safeStop = (category) => ({
  auditPackId: AUDIT_PACK_ID,
  runnerIntegrity: 'pass',
  projectIdentity: 'fail',
  readOnlySession: 'not_started',
  queryCount: 0,
  queryResults: [],
  runStatus: 'safe_stop',
  failureCategory: category,
  mutationExecuted: false,
  secretExposureDetected: false,
});

export async function runSealedAudit({ request, profile, identityObservation, connection }) {
  if (!request || request.auditPackId !== AUDIT_PACK_ID || request.environment !== 'production'
    || !Array.isArray(request.queryIds) || request.queryIds.length === 0 || request.queryIds.length > 12
    || new Set(request.queryIds).size !== request.queryIds.length || !request.queryIds.every((id) => QUERY_IDS.includes(id))) {
    return safeStop('AUDIT_REQUEST_INVALID');
  }
  if (!verifyIdentity(profile, identityObservation)) return safeStop('PROJECT_IDENTITY_MISMATCH');
  if (!connection || connection.roleClass !== 'dedicated_production_audit_login' || connection.serviceRole === true || connection.canWrite === true) {
    return safeStop('AUDIT_ROLE_UNAVAILABLE');
  }

  let opened = false;
  const result = {
    auditPackId: AUDIT_PACK_ID,
    runnerIntegrity: 'pass',
    projectIdentity: 'pass',
    readOnlySession: 'fail',
    queryCount: 0,
    queryResults: [],
    runStatus: 'safe_stop',
    failureCategory: null,
    mutationExecuted: false,
    secretExposureDetected: false,
  };
  try {
    await connection.open(); opened = true;
    await connection.beginReadOnly({ statementTimeoutMs: 5000, lockTimeoutMs: 1000, idleTimeoutMs: 10000 });
    if (await connection.verifyReadOnly() !== true) {
      result.failureCategory = 'READ_ONLY_SESSION_UNVERIFIED';
      return result;
    }
    result.readOnlySession = 'pass';
    for (const queryId of request.queryIds) {
      const query = getFixedQuery(queryId);
      if (!query || !validateFixedSql(query.sql)) {
        result.failureCategory = 'QUERY_POLICY_REJECTED';
        return result;
      }
      const rows = await connection.executeFixed(query);
      const sanitizedMetrics = sanitizeRows(rows, query.expectedColumns);
      result.queryResults.push({ queryId, status: 'pass', resultCategory: 'metadata_shape_only', sanitizedMetrics });
      result.queryCount += 1;
    }
    result.runStatus = 'complete';
    return result;
  } catch (error) {
    result.failureCategory = error?.message === 'SANITIZATION_FIELD_REJECTED' ? 'SANITIZATION_REJECTED' : 'AUDIT_QUERY_FAILED';
    return result;
  } finally {
    if (opened) {
      try { await connection.rollback(); } catch { result.failureCategory ??= 'ROLLBACK_GUARD_FAILED'; result.runStatus = 'safe_stop'; }
      try { await connection.close(); } catch { result.failureCategory ??= 'CONNECTION_CLEANUP_FAILED'; result.runStatus = 'safe_stop'; }
    }
    if (!validateAuditResult(result)) throw new Error('RESULT_SCHEMA_INVALID');
  }
}
