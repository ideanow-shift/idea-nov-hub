import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clearNovHubSession } from "../portal/js/nov-hub-session-candidate.js";
import { mapRuntimeError } from "../portal/store-sales/runtime/error-mapping.js";
import { resolveStoreSalesFeatureFlag, STORE_SALES_FEATURE_FLAGS, toAdapterRuntimeConfig } from "../portal/store-sales/runtime/feature-flags.js";
import { createStoreSalesRuntime, STORE_SALES_RUNTIME_STATES } from "../portal/store-sales/runtime/store-sales-runtime.js";

const appSource = readFileSync(new URL("../portal/store-sales/app.js", import.meta.url), "utf8");
const projection = (stores = [{ storeKey: "synthetic-01" }]) => ({ stores, accounting: {}, executiveSummary: { metrics: [] }, priorityActions: [], businessDrivers: {} });
const location = { hostname: "127.0.0.1", search: "" };

function runtimeWithAdapter(adapter, runtimeConfig = {}) {
  return createStoreSalesRuntime({
    location,
    runtimeConfig: { featureFlag: "mock", mode: "mock", preview: false, requireHubSession: false, ...runtimeConfig },
    dependencies: {
      isOnline: () => true,
      createAdapter: () => ({ config: { mode: "mock" }, adapter })
    }
  });
}

test("Runtime exposes the CTO state registry", () => {
  assert.deepEqual(STORE_SALES_RUNTIME_STATES, ["initializing", "loading", "ready", "empty", "unauthorized", "forbidden", "validation_error", "maintenance", "timeout", "offline"]);
});

test("Runtime exposes all feature flags", () => {
  assert.deepEqual(STORE_SALES_FEATURE_FLAGS, ["mock", "preview", "integration", "staging", "production"]);
});

test("UI imports only the Store Sales Runtime entry", () => {
  assert.match(appSource, /from "\.\/runtime\/index\.js"/);
  assert.doesNotMatch(appSource, /from "\.\/adapters|callApiAction|fetch\s*\(|accounting.*api|projection\.js/i);
});

test("initializing transitions through loading to ready", async () => {
  const states = [];
  const runtime = runtimeWithAdapter({ loadDashboard: async () => projection(), clear() {} });
  runtime.subscribe((state) => states.push(state.status));
  const result = await runtime.initialize({ period: "2026-07" });
  assert.equal(result.status, "ready");
  assert.deepEqual(states, ["initializing", "initializing", "loading", "ready"]);
});

test("zero stores transitions to empty", async () => {
  const runtime = runtimeWithAdapter({ loadDashboard: async () => projection([]), clear() {} });
  assert.equal((await runtime.initialize({ period: "2026-07" })).status, "empty");
});

test("timeout exposes retry and retry reaches ready", async () => {
  let attempt = 0;
  const runtime = runtimeWithAdapter({
    async loadDashboard() {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error("timeout"), { code: "TIMEOUT", status: 408 });
      return projection();
    },
    clear() {}
  });
  const failed = await runtime.initialize({ period: "2026-07" });
  assert.equal(failed.status, "timeout");
  assert.equal(failed.canRetry, true);
  const ready = await runtime.retry();
  assert.equal(ready.status, "ready");
  assert.equal(ready.retryCount, 1);
});

test("network and server failures map to offline", () => {
  assert.equal(mapRuntimeError({ code: "NETWORK_ERROR", status: 503 }, { online: true }).status, "offline");
  assert.equal(mapRuntimeError({ code: "SERVER_ERROR", status: 500 }, { online: true }).status, "offline");
});

test("maintenance is a distinct retryable Runtime state", async () => {
  const runtime = runtimeWithAdapter({
    async loadDashboard() {
      throw Object.assign(new Error("maintenance"), { code: "MAINTENANCE", status: 503 });
    },
    clear() {}
  });
  const state = await runtime.initialize({ period: "2026-07" });
  assert.equal(state.status, "maintenance");
  assert.equal(state.errorCode, "MAINTENANCE");
  assert.equal(state.canRetry, true);
  assert.equal(state.presentation.title, "メンテナンス中です");
});

test("401 maps to unauthorized and 403 maps to forbidden", () => {
  assert.equal(mapRuntimeError({ code: "UNAUTHORIZED", status: 401 }).status, "unauthorized");
  assert.equal(mapRuntimeError({ code: "FORBIDDEN", status: 403 }).status, "forbidden");
});

test("schema and validation errors map to validation_error", () => {
  assert.equal(mapRuntimeError({ code: "SCHEMA_MISMATCH", status: 422 }).status, "validation_error");
  assert.equal(mapRuntimeError({ code: "VALIDATION_ERROR", status: 422 }).status, "validation_error");
});

test("404 maps to empty", () => {
  assert.equal(mapRuntimeError({ code: "NOT_FOUND", status: 404 }).status, "empty");
});

test("staging selects the integration adapter boundary", () => {
  assert.equal(resolveStoreSalesFeatureFlag({ featureFlag: "staging" }), "staging");
  assert.deepEqual(toAdapterRuntimeConfig("staging", { stagingEndpoint: "https://staging.invalid/projection" }), {
    stagingEndpoint: "https://staging.invalid/projection",
    mode: "integration",
    integrationEndpoint: "https://staging.invalid/projection"
  });
});

test("preview selects the localhost-only mock adapter boundary", () => {
  assert.equal(resolveStoreSalesFeatureFlag({ featureFlag: "preview" }), "preview");
  assert.deepEqual(toAdapterRuntimeConfig("preview", { preview: false }), {
    preview: true,
    mode: "mock"
  });
});

test("production remains blocked by the adapter policy", async () => {
  clearNovHubSession();
  const runtime = createStoreSalesRuntime({
    location,
    runtimeConfig: { featureFlag: "production", mode: "production", requireHubSession: false }
  });
  const state = await runtime.initialize({ period: "2026-07" });
  assert.equal(state.status, "validation_error");
  assert.equal(state.errorCode, "PRODUCTION_NOT_APPROVED");
});

test("projection switching rebuilds the adapter without UI involvement", async () => {
  const modes = [];
  const runtime = createStoreSalesRuntime({
    location,
    runtimeConfig: { featureFlag: "mock", mode: "mock", requireHubSession: false },
    dependencies: {
      isOnline: () => true,
      createAdapter: ({ runtimeConfig }) => {
        modes.push(runtimeConfig.mode);
        return { config: runtimeConfig, adapter: { loadDashboard: async () => projection(), clear() {} } };
      }
    }
  });
  await runtime.initialize({ period: "2026-07" });
  await runtime.switchProjection("staging", { stagingEndpoint: "https://staging.invalid/projection" });
  assert.deepEqual(modes, ["mock", "integration"]);
});

test("session refresh is attempted once before unauthorized", async () => {
  clearNovHubSession();
  let refreshes = 0;
  const runtime = createStoreSalesRuntime({
    location,
    runtimeConfig: { featureFlag: "integration", mode: "integration", requireHubSession: true, integrationEndpoint: "https://integration.invalid/projection" },
    dependencies: {
      refreshSession: async () => { refreshes += 1; return null; },
      isOnline: () => true
    }
  });
  const state = await runtime.initialize({ period: "2026-07" });
  assert.equal(refreshes, 1);
  assert.equal(state.status, "unauthorized");
});
