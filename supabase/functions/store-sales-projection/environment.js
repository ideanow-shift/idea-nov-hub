export const APP_ENVS = Object.freeze(["local", "preview", "integration", "staging", "production"]);

export class EnvironmentBoundaryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = 503;
  }
}

export function resolveEnvironment(source = {}) {
  const env = String(source.APP_ENV || "").toLowerCase();
  const mode = String(source.RUNTIME_MODE || "").toLowerCase();
  if (!APP_ENVS.includes(env) || !APP_ENVS.includes(mode)) {
    throw new EnvironmentBoundaryError("INVALID_ENVIRONMENT", "APP_ENV and RUNTIME_MODE are required.");
  }
  if (env !== mode && !(env === "staging" && mode === "integration")) {
    throw new EnvironmentBoundaryError("ENVIRONMENT_MISMATCH", "Environment and runtime mode do not match.");
  }
  const productionBlocked = String(source.PRODUCTION_BLOCKED || "true") === "true";
  const synthetic = String(source.SYNTHETIC_DATA_ENABLED || "false") === "true";
  if (env === "production" && productionBlocked) throw new EnvironmentBoundaryError("PRODUCTION_NOT_APPROVED", "Production is blocked.");
  if (env === "production" && synthetic) throw new EnvironmentBoundaryError("PRODUCTION_FIXTURE_FORBIDDEN", "Synthetic data is forbidden in production.");
  if (env === "staging" && !synthetic) throw new EnvironmentBoundaryError("STAGING_SYNTHETIC_REQUIRED", "Phase 5-5B staging requires synthetic data.");
  const api = String(source.PROJECTION_API_BASE_URL || "");
  const supabase = String(source.SUPABASE_URL || "");
  if (env === "staging" && (/prod(uction)?/i.test(api) || /prod(uction)?/i.test(supabase))) {
    throw new EnvironmentBoundaryError("CROSS_ENVIRONMENT_ENDPOINT", "Staging cannot use a production endpoint.");
  }
  if (env === "production" && /stag(e|ing)/i.test(`${api} ${supabase}`)) {
    throw new EnvironmentBoundaryError("CROSS_ENVIRONMENT_ENDPOINT", "Production cannot use a staging endpoint.");
  }
  return Object.freeze({
    appEnv: env,
    runtimeMode: mode,
    projectionApiBaseUrl: api,
    sessionIssuer: String(source.SESSION_ISSUER || ""),
    sessionAudience: String(source.SESSION_AUDIENCE || ""),
    contractVersion: String(source.CONTRACT_VERSION || ""),
    auditEnabled: String(source.AUDIT_ENABLED || "false") === "true",
    telemetryEnabled: String(source.TELEMETRY_ENABLED || "false") === "true",
    productionBlocked,
    syntheticDataEnabled: synthetic
  });
}
