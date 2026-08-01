import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdapterConfig } from "../portal/store-sales/adapters/config.js";
import { validateProjectionResponse } from "../portal/store-sales/adapters/contract.js";
import { createStoreSalesApiAdapter } from "../portal/store-sales/adapters/store-sales-api.js";
import { toAdapterRuntimeConfig } from "../portal/store-sales/runtime/feature-flags.js";
import { wireMetric, wireProjection, wireStore } from "./fixtures/store-sales-integration-projection.mjs";

const remote = { hostname: "hub.example.invalid", search: "" };
const response = (payload) => ({ ok: true, status: 200, json: async () => payload });

test("each environment changes only the data-source adapter boundary", () => {
  assert.equal(toAdapterRuntimeConfig("preview", {}).mode, "mock");
  assert.equal(toAdapterRuntimeConfig("integration", { integrationEndpoint: "http://127.0.0.1:4175/v1/store-sales/dashboard" }).mode, "integration");
  assert.equal(toAdapterRuntimeConfig("staging", { stagingEndpoint: "https://staging.example.invalid/v1/store-sales/dashboard" }).mode, "staging");
  assert.equal(toAdapterRuntimeConfig("production", { productionEndpoint: "https://api.example.invalid/v1/store-sales/dashboard" }).mode, "production");
});

test("production remains fail closed until the final read-only switch", () => {
  assert.throws(() => resolveAdapterConfig({
    location: remote,
    runtimeConfig: { mode: "production", apiEndpoint: "https://api.example.invalid/v1/store-sales/dashboard", syntheticData: false }
  }), (error) => error.code === "PRODUCTION_NOT_APPROVED");
});

test("production switch requires HTTPS and rejects Synthetic Data", () => {
  assert.throws(() => resolveAdapterConfig({
    location: remote,
    runtimeConfig: { mode: "production", productionReadOnlyEnabled: true, apiEndpoint: "http://api.invalid/v1/store-sales/dashboard", syntheticData: false }
  }), (error) => error.code === "PRODUCTION_ENDPOINT_REQUIRED");
  assert.throws(() => resolveAdapterConfig({
    location: remote,
    runtimeConfig: { mode: "production", productionReadOnlyEnabled: true, apiEndpoint: "https://api.example.invalid/v1/store-sales/dashboard", syntheticData: true }
  }), (error) => error.code === "PRODUCTION_FIXTURE_FORBIDDEN");
});

test("approved production configuration is read-only and cache-free", () => {
  const config = resolveAdapterConfig({
    location: remote,
    runtimeConfig: {
      mode: "production",
      productionReadOnlyEnabled: true,
      apiEndpoint: "https://api.example.invalid/v1/store-sales/dashboard",
      syntheticData: false
    }
  });
  assert.equal(config.mode, "production");
  assert.equal(config.readOnly, true);
  assert.equal(config.cacheEnabled, false);
});

test("Store Sales API adapter sends HUB bearer session without role or scope claims", async () => {
  let request;
  const adapter = createStoreSalesApiAdapter({
    mode: "staging",
    endpoint: "https://staging.example.invalid/v1/store-sales/dashboard",
    contractVersion: "store-sales-projection-v1",
    timeoutMs: 8000
  }, {
    getSessionToken: () => "hub-session",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return response(wireProjection());
    }
  });
  await adapter.loadDashboard({ period: "2026-07", role: "sales_manager", scope: "all_group" });
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.body, undefined);
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.credentials, "omit");
  assert.doesNotMatch(request.url, /role|scope|employee|service_role/i);
});

test("store detail uses the formal read-only store endpoint", async () => {
  let requestUrl;
  const adapter = createStoreSalesApiAdapter({
    mode: "integration",
    endpoint: "http://127.0.0.1:4175/v1/store-sales/dashboard",
    contractVersion: "store-sales-projection-v1",
    timeoutMs: 8000
  }, {
    getSessionToken: () => "hub-session",
    fetchImpl: async (url) => {
      requestUrl = String(url);
      return response(wireProjection());
    }
  });
  await adapter.loadStore({ period: "2026-07", storeId: "store-01" });
  assert.match(requestUrl, /\/v1\/store-sales\/stores\/store-01\?period=2026-07$/);
});

test("unconfirmed profit must remain null and cannot be displayed as zero", () => {
  const hidden = wireMetric("営業利益", null, "collecting");
  const payload = wireProjection({
    meta: { profit_state: "collecting", confirmed_through_period: "2026-06" },
    stores: [wireStore({
      operating_profit: hidden,
      operating_profit_margin: wireMetric("営業利益率", null, "collecting", "percent"),
      detail_metrics: { ordinaryProfit: wireMetric("経常利益", null, "collecting") }
    })]
  });
  payload.executive_summary.metrics.operatingProfit = hidden;
  payload.executive_summary.metrics.operatingProfitMargin = wireMetric("営業利益率", null, "collecting", "percent");
  payload.executive_summary.metrics.ordinaryProfit = wireMetric("経常利益", null, "collecting");
  assert.equal(validateProjectionResponse(payload).meta.profitState, "collecting");

  payload.executive_summary.metrics.operatingProfit = wireMetric("営業利益", "0円", "available");
  assert.throws(() => validateProjectionResponse(payload), /must be null/i);
});

test("sales manager projection cannot contain FC stores", () => {
  const payload = wireProjection({
    meta: { actor_scope: "department", actor_scope_key: "direct-sales", actor_role: "sales_manager" },
    stores: [wireStore({ ownership_type: "FC", scope_key: "direct-sales" })]
  });
  assert.throws(() => validateProjectionResponse(payload), /direct stores only/i);
});
