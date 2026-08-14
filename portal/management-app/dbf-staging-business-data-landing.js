const DBF_STAGING_PROJECT_REF = "zgkoofphhivesclehrom";
const DBF_STAGING_PROJECT_FINGERPRINT = "fea6c6315484f1f8fd993c68bcdb12c00ea8b6b79b970b3ea363a531133d24ce";

export function resolveDbfStagingBusinessDataLanding(runtime, session) {
  if (runtime?.environment !== "staging") return null;
  const authorized = runtime.projectRef === DBF_STAGING_PROJECT_REF
    && runtime.projectFingerprint === DBF_STAGING_PROJECT_FINGERPRINT
    && runtime.runtimeImport === "DISABLED"
    && runtime.productionWrite === "DISABLED"
    && session?.audience === "dbf_staging_session_v1"
    && session?.capability?.businessDataAdmin === true
    && session?.runtimeImport === "DISABLED"
    && session?.productionWrite === "DISABLED";
  return Object.freeze({
    authorized,
    initialView: authorized ? "businessdata" : "auth_required",
    sourceStatus: authorized ? "READY_EMPTY" : "FORBIDDEN",
    capabilitySource: "backend_session",
    requiresManagementApi: false,
  });
}
