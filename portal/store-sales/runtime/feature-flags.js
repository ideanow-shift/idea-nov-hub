export const STORE_SALES_FEATURE_FLAGS = Object.freeze([
  "mock",
  "preview",
  "integration",
  "staging",
  "production"
]);

const FLAG_SET = new Set(STORE_SALES_FEATURE_FLAGS);

export function resolveStoreSalesFeatureFlag(runtimeConfig = {}) {
  const flag = String(runtimeConfig.featureFlag || runtimeConfig.mode || "production").trim().toLowerCase();
  if (!FLAG_SET.has(flag)) {
    const error = new Error("Store Sales feature flag is invalid.");
    error.code = "INVALID_FEATURE_FLAG";
    error.status = 503;
    throw error;
  }
  return flag;
}

export function toAdapterRuntimeConfig(featureFlag, runtimeConfig = {}) {
  if (featureFlag === "preview") {
    return { ...runtimeConfig, mode: "mock", preview: true };
  }
  if (featureFlag === "staging") {
    return {
      ...runtimeConfig,
      mode: "integration",
      integrationEndpoint: runtimeConfig.stagingEndpoint || runtimeConfig.integrationEndpoint || ""
    };
  }
  return { ...runtimeConfig, mode: featureFlag };
}
