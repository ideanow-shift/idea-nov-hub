import { getReviewFixture } from "../review-fixtures.js";

export function createMockAdapter(config, dependencies = {}) {
  if (config.mode !== "mock") throw new Error("Mock adapter requires mock mode.");
  return Object.freeze({
    mode: "mock",
    async loadDashboard(request = {}) {
      const fixture = String(dependencies.getPreviewFixtureName?.() || config.fixture || "executive");
      if (fixture === "employee-denied") {
        const error = new Error("Preview actor is not allowed.");
        error.code = "ACTOR_SCOPE_DENIED";
        error.status = 403;
        throw error;
      }
      if (fixture === "timeout") {
        const error = new Error("Mock timeout.");
        error.code = "TIMEOUT";
        error.status = 408;
        error.retryable = true;
        throw error;
      }
      const runtimeState = dependencies.getDevelopmentState?.()?.runtimeState;
      if (["unauthorized", "forbidden", "validation_error", "timeout", "offline", "maintenance"].includes(runtimeState)) {
        const codes = { unauthorized: ["UNAUTHORIZED", 401], forbidden: ["FORBIDDEN", 403], validation_error: ["VALIDATION_ERROR", 422], timeout: ["TIMEOUT", 408], offline: ["NETWORK_ERROR", 503], maintenance: ["MAINTENANCE", 503] };
        const [code, status] = codes[runtimeState];
        throw Object.assign(new Error(`Mock ${runtimeState}`), { code, status, retryable: ["timeout", "offline", "maintenance"].includes(runtimeState) });
      }
      const development = dependencies.getDevelopmentState?.() || {};
      const selectedFixture = runtimeState === "empty" ? "empty" : development.role || fixture;
      const projection = getReviewFixture(selectedFixture, {
        period: request.period,
        profitMode: development.profitMode,
        missingData: development.missingData
      });
      const storeOptions = projection.stores.map(({ storeKey, storeName }) => ({ storeKey, storeName }));
      if (!request.storeKey) return { ...projection, storeOptions, selectedStoreKey: null };
      const selectedStore = projection.stores.find((store) => store.storeKey === request.storeKey);
      if (!selectedStore) throw Object.assign(new Error("Mock store is outside resolved scope."), { code: "FORBIDDEN", status: 403 });
      return { ...projection, storeOptions, selectedStoreKey: request.storeKey, stores: [selectedStore] };
    },
    clear() {}
  });
}
