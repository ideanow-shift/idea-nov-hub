export const stagingHealth = (config) => Object.freeze({
  status: "ok",
  environment: config.appEnv,
  contract_version: config.contractVersion,
  synthetic: config.syntheticDataEnabled,
  production_blocked: config.productionBlocked
});
