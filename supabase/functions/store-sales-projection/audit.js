const ALLOWED_EVENTS = new Set([
  "api_request", "api_success", "api_failure", "access_denied", "session_invalid",
  "contract_mismatch", "timeout", "projection_empty", "missing_store", "stale_data",
  "validation_error", "maintenance", "runtime_error"
]);
const ALLOWED_FIELDS = new Set([
  "request_id", "actor_id", "role", "scope_key", "period", "store_id",
  "contract_version", "status", "duration_ms", "environment", "synthetic"
]);

/** @param {(event: Record<string, unknown>) => void} [writer] */
export function createAuditSink(writer = (_event) => {}) {
  return Object.freeze({
    emit(event, fields = {}) {
      if (!ALLOWED_EVENTS.has(event)) throw new Error("AUDIT_EVENT_INVALID");
      const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => ALLOWED_FIELDS.has(key)));
      writer(Object.freeze({ event, ...safe }));
    }
  });
}

export const STAGING_AUDIT_EVENTS = Object.freeze([...ALLOWED_EVENTS]);
