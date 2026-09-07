// Staging deployment entrypoint. Ports are intentionally supplied only by server configuration.
// This source package is not deployed by this sprint.
import { createStoreSalesStagingHandler } from "./handler.ts";
import type { StoreSalesDependencies } from "./contract.ts";

export function createStagingEndpoint(dependencies: StoreSalesDependencies) {
  return createStoreSalesStagingHandler(dependencies);
}
