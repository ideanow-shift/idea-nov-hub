const OUTER_KEYS = new Set(['auditPackId', 'runnerIntegrity', 'projectIdentity', 'readOnlySession', 'queryCount', 'queryResults', 'runStatus', 'failureCategory', 'mutationExecuted', 'secretExposureDetected']);
const FAILURE_CATEGORIES = new Set(['AUDIT_REQUEST_INVALID', 'PROJECT_IDENTITY_MISMATCH', 'AUDIT_ROLE_UNAVAILABLE', 'READ_ONLY_SESSION_UNVERIFIED', 'QUERY_POLICY_REJECTED', 'SANITIZATION_REJECTED', 'AUDIT_QUERY_FAILED', 'ROLLBACK_GUARD_FAILED', 'CONNECTION_CLEANUP_FAILED']);

export function validateAuditResult(result) {
  if (!result || typeof result !== 'object') return false;
  if (Object.keys(result).some((key) => !OUTER_KEYS.has(key))) return false;
  if (!['complete', 'safe_stop'].includes(result.runStatus)) return false;
  if (!Number.isSafeInteger(result.queryCount) || result.queryCount < 0 || result.queryCount > 10) return false;
  if (result.mutationExecuted !== false || result.secretExposureDetected !== false) return false;
  if (result.failureCategory !== null && !FAILURE_CATEGORIES.has(result.failureCategory)) return false;
  if (!Array.isArray(result.queryResults) || result.queryResults.length !== result.queryCount) return false;
  return result.queryResults.every((entry) => entry && typeof entry.queryId === 'string'
    && ['pass', 'fail', 'skipped'].includes(entry.status)
    && ['aggregate_only', 'metadata_shape_only', 'safe_stop'].includes(entry.resultCategory)
    && entry.sanitizedMetrics && typeof entry.sanitizedMetrics === 'object');
}
