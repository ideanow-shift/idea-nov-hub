import { getReviewFixture } from "../review-fixtures.js";

export function createMockAdapter(config, dependencies = {}) {
  if (config.mode !== "mock") throw new Error("Mock adapter requires mock mode.");
  return Object.freeze({
    mode: "mock",
    async loadDashboard() {
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
      return getReviewFixture(fixture);
    },
    clear() {}
  });
}
