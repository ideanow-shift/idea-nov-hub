const MODES = new Set(["mock", "integration", "staging", "production"]);

export class AdapterConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AdapterConfigurationError";
    this.code = code;
    this.status = 503;
  }
}

export function resolveAdapterConfig({ location, runtimeConfig = {} }) {
  const hostname = String(location?.hostname || "");
  const local = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "";
  const requestedMode = String(runtimeConfig.mode || (local ? "mock" : "production"));
  if (!MODES.has(requestedMode)) throw new AdapterConfigurationError("INVALID_ADAPTER_MODE", "Store Sales adapter mode is invalid.");
  if (requestedMode === "mock" && !local) {
    throw new AdapterConfigurationError("MOCK_NOT_ALLOWED", "この環境ではmock modeを使用できません。");
  }
  const query = new URLSearchParams(String(location?.search || ""));
  const fixture = requestedMode === "mock" && local ? query.get("fixture") || "executive" : null;
  const endpoint = requestedMode === "mock" ? "" : String(
    runtimeConfig.apiEndpoint ||
    (requestedMode === "integration" ? runtimeConfig.integrationEndpoint : "") ||
    (requestedMode === "staging" ? runtimeConfig.stagingEndpoint : "") ||
    (requestedMode === "production" ? runtimeConfig.productionEndpoint : "")
  ).trim();
  if (requestedMode === "integration" && (!endpoint || !/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\//.test(endpoint))) {
    throw new AdapterConfigurationError("INTEGRATION_ENDPOINT_REQUIRED", "隔離されたintegration endpointが必要です。");
  }
  if (requestedMode === "staging" && !/^https:\/\//.test(endpoint)) {
    throw new AdapterConfigurationError("STAGING_ENDPOINT_REQUIRED", "承認済みHTTPS staging endpointが必要です。");
  }
  if (requestedMode === "production") {
    if (runtimeConfig.productionReadOnlyEnabled !== true) {
      throw new AdapterConfigurationError("PRODUCTION_NOT_APPROVED", "本番read-only接続はまだ承認されていません。");
    }
    if (!/^https:\/\//.test(endpoint)) {
      throw new AdapterConfigurationError("PRODUCTION_ENDPOINT_REQUIRED", "承認済みHTTPS production endpointが必要です。");
    }
    if (runtimeConfig.syntheticData !== false) {
      throw new AdapterConfigurationError("PRODUCTION_FIXTURE_FORBIDDEN", "ProductionではSynthetic Dataを使用できません。");
    }
  }
  return Object.freeze({
    mode: requestedMode,
    fixture,
    endpoint,
    environment: requestedMode,
    readOnly: requestedMode !== "mock",
    contractVersion: String(runtimeConfig.contractVersion || "store-sales-projection-v1"),
    timeoutMs: Math.max(1000, Math.min(Number(runtimeConfig.timeoutMs || 8000), 20000)),
    cacheEnabled: false
  });
}

export const STORE_SALES_ADAPTER_MODES = Object.freeze([...MODES]);
