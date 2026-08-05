import { resolveAdapterConfig } from "./config.js";
import { createMockAdapter } from "./mock.js";
import { createStoreSalesApiAdapter } from "./store-sales-api.js";

export function createStoreSalesAdapter(options) {
  const config = resolveAdapterConfig(options);
  if (config.mode === "mock") return { config, adapter: createMockAdapter(config, options.dependencies) };
  if (["integration", "staging", "production"].includes(config.mode)) return {
    config,
    adapter: createStoreSalesApiAdapter(config, options.dependencies)
  };
  throw new Error("Unsupported Store Sales adapter mode.");
}
