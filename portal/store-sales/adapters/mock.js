import { getReviewFixture } from "../review-fixtures.js";

export function createMockAdapter(config) {
  if (config.mode !== "mock") throw new Error("Mock adapter requires mock mode.");
  return Object.freeze({
    mode: "mock",
    async loadDashboard() {
      if (config.fixture === "timeout") {
        const error = new Error("Mock timeout.");
        error.code = "TIMEOUT";
        error.status = 408;
        error.retryable = true;
        throw error;
      }
      return getReviewFixture(config.fixture);
    },
    clear() {}
  });
}

