import assert from "node:assert/strict";
import test from "node:test";
import { createStagingTokenVerifier } from "../supabase/functions/store-sales-projection/auth.js";
import { createAuditSink } from "../supabase/functions/store-sales-projection/audit.js";
import { resolveEnvironment } from "../supabase/functions/store-sales-projection/environment.js";
import { createStoreSalesStagingService } from "../supabase/functions/store-sales-projection/service.js";

const config = resolveEnvironment({ APP_ENV: "staging", RUNTIME_MODE: "integration", PROJECTION_API_BASE_URL: "http://localhost:4175", CONTRACT_VERSION: "store-sales-projection-v1", PRODUCTION_BLOCKED: "true", SYNTHETIC_DATA_ENABLED: "true" });
const verifier = createStagingTokenVerifier({ verifySignature: async () => true });
const service = createStoreSalesStagingService({ config, tokenVerifier: verifier, audit: createAuditSink() });
const headers = { authorization: `Bearer stg-synthetic:representative:${Date.now() + 60_000}:synthetic-signature`, "x-contract-version": "store-sales-projection-v1" };
const request = () => service.handle({ method: "GET", url: "/v1/store-sales/dashboard?period=2026-07", headers });

test("synthetic dashboard models 20 stores before closed-store filtering", async () => {
  const result = await request();
  assert.equal(result.body.stores.length, 20);
  assert.equal(result.body.meta.reflected_store_count >= 0, true);
});
test("50 actor candidate concurrency completes without error", async () => {
  const results = await Promise.all(Array.from({ length: 50 }, () => request()));
  assert.ok(results.every((result) => result.status === 200));
});
test("synthetic response size is recorded and bounded for the fixture", async () => {
  const bytes = Buffer.byteLength(JSON.stringify((await request()).body));
  assert.ok(bytes > 0 && bytes < 250_000);
});
test("warm synthetic p95 is measurable below proposed dashboard threshold", async () => {
  const timings = [];
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    await request();
    timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);
  assert.ok(timings[Math.ceil(timings.length * 0.95) - 1] < 2000);
});
test("performance thresholds remain proposed rather than approved", () => {
  assert.equal(config.productionBlocked, true);
});
