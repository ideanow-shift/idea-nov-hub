import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdapterConfig } from "../portal/store-sales/adapters/config.js";
import { validateProjectionResponse, ProjectionContractError } from "../portal/store-sales/adapters/contract.js";
import { createMockAdapter } from "../portal/store-sales/adapters/mock.js";
import { createProjectionAdapter } from "../portal/store-sales/adapters/projection.js";
import { actorScopeFixtures, wireMetric, wireProjection, wireStore } from "./fixtures/store-sales-integration-projection.mjs";

const localLocation = { hostname: "127.0.0.1", search: "?fixture=executive" };
const integrationConfig = { mode: "integration", endpoint: "https://integration.invalid/v1/store-sales/dashboard", timeoutMs: 1000, cacheEnabled: false };

function response(status, payload, jsonError = false) {
  return { ok: status >= 200 && status < 300, status, json: async () => { if (jsonError) throw new Error("bad json"); return payload; } };
}

test("mock adapter returns synthetic executive fixture without fetch", async () => {
  const config = resolveAdapterConfig({ location: localLocation, runtimeConfig: { mode: "mock" } });
  const projection = await createMockAdapter(config).loadDashboard({ period: "2026-07" });
  assert.equal(projection.stores.length, 20);
});

test("integration adapter validates and normalizes a read-only response", async () => {
  const adapter = createProjectionAdapter(integrationConfig, {
    getSessionToken: () => "synthetic-session",
    fetchImpl: async () => response(200, wireProjection())
  });
  const projection = await adapter.loadDashboard({ period: "2026-07" });
  assert.equal(projection.stores[0].storeName, "所沢店");
  assert.equal(projection.meta.actorScope, "all_group");
});

test("adapter config supports mock and integration modes", () => {
  assert.equal(resolveAdapterConfig({ location: localLocation, runtimeConfig: { mode: "mock" } }).mode, "mock");
  assert.equal(resolveAdapterConfig({ location: localLocation, runtimeConfig: { mode: "integration", integrationEndpoint: integrationConfig.endpoint } }).mode, "integration");
});

test("production mode is blocked until approval", () => {
  assert.throws(() => resolveAdapterConfig({ location: { hostname: "example.com", search: "" }, runtimeConfig: { mode: "production" } }), /承認/);
});

test("non-local mock mode is rejected even with a fixture query", () => {
  assert.throws(() => resolveAdapterConfig({ location: { hostname: "example.com", search: "?fixture=executive" }, runtimeConfig: { mode: "mock" } }), /mock mode/);
});

for (const [status, code] of [[401, "UNAUTHORIZED"], [403, "FORBIDDEN"], [404, "NOT_FOUND"], [409, "VERSION_CONFLICT"], [422, "VALIDATION_ERROR"], [500, "SERVER_ERROR"]]) {
  test(`integration maps HTTP ${status} safely`, async () => {
    const adapter = createProjectionAdapter(integrationConfig, { getSessionToken: () => "session", fetchImpl: async () => response(status, {}) });
    await assert.rejects(() => adapter.loadDashboard({ period: "2026-07" }), (error) => error.code === code && !String(error.message).includes("SQL"));
  });
}

test("integration timeout is retryable", async () => {
  const adapter = createProjectionAdapter(integrationConfig, {
    getSessionToken: () => "session",
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))
  });
  await assert.rejects(() => adapter.loadDashboard({ period: "2026-07" }), (error) => error.code === "TIMEOUT" && error.retryable);
});

test("malformed JSON becomes validation error", async () => {
  const adapter = createProjectionAdapter(integrationConfig, { getSessionToken: () => "session", fetchImpl: async () => response(200, null, true) });
  await assert.rejects(() => adapter.loadDashboard({ period: "2026-07" }), (error) => error.code === "MALFORMED_JSON");
});

test("schema mismatch is rejected", () => {
  assert.throws(() => validateProjectionResponse({}), ProjectionContractError);
});

test("duplicate store IDs are rejected", () => {
  assert.throws(() => validateProjectionResponse(wireProjection({ stores: [wireStore(), wireStore()] })), /duplicate/i);
});

test("store manager response with multiple stores is rejected", () => {
  const payload = wireProjection({ stores: [wireStore(), wireStore({ store_id: "store-02", priority_rank: 2 })], meta: { actor_scope: "own_store" } });
  assert.throws(() => validateProjectionResponse(payload), /multiple stores/i);
});

test("empty stores are valid", () => {
  assert.equal(validateProjectionResponse(wireProjection({ stores: [] })).stores.length, 0);
});

test("partial KPI remains preparing and never becomes zero", () => {
  const payload = wireProjection({ stores: [wireStore({ productivity: wireMetric("Productivity") })] });
  const projection = validateProjectionResponse(payload);
  assert.equal(projection.stores[0].metrics.productivity.displayValue, null);
  assert.equal(projection.stores[0].metrics.productivity.dataState, "preparing");
});

test("pending period hides accounting values", () => {
  const collecting = wireMetric("営業利益", null, "collecting");
  const payload = wireProjection({ stores: [wireStore({ operating_profit: collecting })], meta: { confirmation_state: "collecting" } });
  const projection = validateProjectionResponse(payload);
  assert.equal(projection.stores[0].metrics.operatingProfit.displayValue, null);
});

test("validation_error hides values", () => {
  const invalid = wireMetric("営業利益率", null, "validation_error", "percent");
  const projection = validateProjectionResponse(wireProjection({ stores: [wireStore({ operating_profit_margin: invalid })] }));
  assert.equal(projection.stores[0].metrics.operatingProfitMargin.dataState, "validation_error");
});

test("actor scope denied response is rejected", () => {
  assert.throws(() => validateProjectionResponse(actorScopeFixtures.employeeDenied()), /denied/i);
});

test("department, store manager, and franchise fixtures remain server scoped", () => {
  assert.equal(validateProjectionResponse(actorScopeFixtures.departmentManager()).stores.length, 1);
  assert.equal(validateProjectionResponse(actorScopeFixtures.storeManager()).audience, "store_manager");
  assert.equal(validateProjectionResponse(actorScopeFixtures.franchiseOwner()).stores[0].ownership, "FC");
});

test("franchise response containing another franchise is rejected", () => {
  const payload = actorScopeFixtures.franchiseOwner();
  payload.stores.push(wireStore({ store_id: "store-02", ownership_type: "FC", scope_key: "franchise-02", priority_rank: 2 }));
  assert.throws(() => validateProjectionResponse(payload), /outside.*actor scope/i);
});

test("forbidden provenance fields are rejected", () => {
  assert.throws(() => validateProjectionResponse({ ...wireProjection(), raw_fact_id: "private" }), /consumer field/i);
});

test("integration sends no role scope store list or service role", async () => {
  let request;
  const adapter = createProjectionAdapter(integrationConfig, {
    getSessionToken: () => "synthetic-session",
    fetchImpl: async (url, options) => { request = { url: String(url), options }; return response(200, wireProjection()); }
  });
  await adapter.loadDashboard({ period: "2026-07", role: "executive", actorScope: "all_group", storeId: "store-other" });
  assert.equal(request.options.method, "GET");
  assert.deepEqual(Object.keys(request.options.headers).sort(), ["Accept", "Authorization"]);
  assert.doesNotMatch(request.url, /role|scope|store_id|service/i);
  assert.equal(request.options.body, undefined);
});

test("malformed reason remains inert text data", () => {
  const payload = wireProjection({ stores: [wireStore({ store_status_reason: "<img src=x onerror=alert(1)>" })] });
  assert.equal(validateProjectionResponse(payload).stores[0].statusReason, "<img src=x onerror=alert(1)>");
});

test("cache is disabled and clear retains no actor projection", () => {
  const config = resolveAdapterConfig({ location: localLocation, runtimeConfig: { mode: "mock" } });
  const adapter = createMockAdapter(config);
  assert.equal(config.cacheEnabled, false);
  assert.equal(adapter.clear(), undefined);
  assert.equal("projection" in adapter, false);
});

test("missing session is rejected before network access", async () => {
  let called = false;
  const adapter = createProjectionAdapter(integrationConfig, { getSessionToken: () => "", fetchImpl: async () => { called = true; } });
  await assert.rejects(() => adapter.loadDashboard({ period: "2026-07" }), (error) => error.code === "UNAUTHORIZED");
  assert.equal(called, false);
});

test("invalid period is rejected before network access", async () => {
  let called = false;
  const adapter = createProjectionAdapter(integrationConfig, { getSessionToken: () => "session", fetchImpl: async () => { called = true; } });
  await assert.rejects(() => adapter.loadDashboard({ period: "../private" }), (error) => error.code === "INVALID_PERIOD");
  assert.equal(called, false);
});
