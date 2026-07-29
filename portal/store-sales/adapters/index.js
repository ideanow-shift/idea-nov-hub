import { resolveAdapterConfig } from "./config.js";
import { createMockAdapter } from "./mock.js";
import { createProjectionAdapter } from "./projection.js";

export function createStoreSalesAdapter(options) {
  const config = resolveAdapterConfig(options);
  if (config.mode === "mock") return { config, adapter: createMockAdapter(config, options.dependencies) };
  if (config.mode === "integration") return {
    config,
    adapter: createProjectionAdapter(config, options.dependencies)
  };
  throw new Error("Production adapter is blocked.");
}
