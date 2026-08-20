const MODES = new Set(["mock", "integration", "production"]);

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
  if (requestedMode === "production") {
    if (runtimeConfig.productionApproved !== true || runtimeConfig.preview !== false || runtimeConfig.featureFlag !== "production") {
      throw new AdapterConfigurationError("PRODUCTION_NOT_APPROVED", "本番接続はまだ承認されていません。");
    }
  }
  if (requestedMode === "mock" && !local) {
    throw new AdapterConfigurationError("MOCK_NOT_ALLOWED", "この環境ではmock modeを使用できません。");
  }
  const query = new URLSearchParams(String(location?.search || ""));
  const fixture = requestedMode === "mock" && local ? query.get("fixture") || "executive" : null;
  const endpoint = requestedMode === "integration"
    ? String(runtimeConfig.integrationEndpoint || "")
    : requestedMode === "production" ? String(runtimeConfig.productionEndpoint || "") : "";
  if (requestedMode === "integration" && (!endpoint || !/^https:\/\/|^http:\/\/(127\.0\.0\.1|localhost)/.test(endpoint))) {
    throw new AdapterConfigurationError("INTEGRATION_ENDPOINT_REQUIRED", "隔離されたintegration endpointが必要です。");
  }
  if (requestedMode === "production") {
    const expectedProjectRef = String(runtimeConfig.expectedProjectRef || "");
    const expectedEndpoint = `https://${expectedProjectRef}.supabase.co/functions/v1/nov-hub-api`;
    if (!/^[a-z0-9]{20}$/u.test(expectedProjectRef) || endpoint !== expectedEndpoint) {
      throw new AdapterConfigurationError("PRODUCTION_TARGET_MISMATCH", "本番接続先を確認できません。");
    }
  }
  return Object.freeze({
    mode: requestedMode,
    fixture,
    endpoint,
    contractVersion: String(runtimeConfig.contractVersion || "store-sales-projection-v1.1"),
    timeoutMs: Math.max(1000, Math.min(Number(runtimeConfig.timeoutMs || 8000), 20000)),
    cacheEnabled: false
  });
}

export const STORE_SALES_ADAPTER_MODES = Object.freeze([...MODES]);
