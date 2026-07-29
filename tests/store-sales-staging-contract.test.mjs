import assert from "node:assert/strict";
import test from "node:test";
import { createStagingTokenVerifier } from "../supabase/functions/store-sales-projection/auth.js";
import { createAuditSink } from "../supabase/functions/store-sales-projection/audit.js";
import { resolveEnvironment } from "../supabase/functions/store-sales-projection/environment.js";
import { PROJECTION_QUERY_PLAN } from "../supabase/functions/store-sales-projection/projection.js";
import { createStoreSalesStagingService } from "../supabase/functions/store-sales-projection/service.js";

const config = resolveEnvironment({
  APP_ENV: "staging", RUNTIME_MODE: "integration", PROJECTION_API_BASE_URL: "http://localhost:4175",
  SESSION_ISSUER: "idea-nov-staging", SESSION_AUDIENCE: "nov_hub_staging",
  CONTRACT_VERSION: "store-sales-projection-v1", AUDIT_ENABLED: "true",
  TELEMETRY_ENABLED: "true", PRODUCTION_BLOCKED: "true", SYNTHETIC_DATA_ENABLED: "true"
});
const token = (role, expiry = Date.now() + 60_000, signature = "synthetic-signature") => `Bearer stg-synthetic:${role}:${expiry}:${signature}`;
const make = (options = {}) => {
  const events = [];
  const tokenVerifier = createStagingTokenVerifier({ verifySignature: async ({ signature }) => signature === "synthetic-signature" });
  return { events, service: createStoreSalesStagingService({ config, tokenVerifier, audit: createAuditSink((event) => events.push(event)), ...options }) };
};
const call = (service, role, path = "/v1/store-sales/dashboard?period=2026-07", extras = {}) => service.handle({
  method: "GET", url: path, requestId: "00000000-0000-4000-8000-000000000001",
  headers: { authorization: token(role), "x-contract-version": "store-sales-projection-v1" }, ...extras
});

test("dashboard succeeds with synthetic contract", async () => {
  const result = await call(make().service, "representative_director");
  assert.equal(result.status, 200);
  assert.equal(result.body.meta.synthetic, true);
  assert.equal(result.body.stores.length, 19);
});
test("store detail succeeds", async () => {
  const result = await call(make().service, "representative_director", "/v1/store-sales/stores/synthetic-direct-01?period=2026-07");
  assert.equal(result.status, 200);
  assert.equal(result.body.selected_store.store_id, "synthetic-direct-01");
});
test("invalid period returns 422", async () => assert.equal((await call(make().service, "director", "/v1/store-sales/dashboard?period=2026-13")).status, 422));
test("invalid store ID returns 422", async () => assert.equal((await call(make().service, "director", "/v1/store-sales/stores/real-store?period=2026-07")).status, 422));
test("missing contract version returns contract mismatch", async () => {
  const service = make().service;
  const result = await service.handle({ method: "GET", url: "/v1/store-sales/dashboard?period=2026-07", headers: { authorization: token("director") } });
  assert.equal(result.body.error.code, "CONTRACT_MISMATCH");
});
test("request ID is returned in header and body provenance", async () => {
  const result = await call(make().service, "director");
  assert.equal(result.headers["x-request-id"], "00000000-0000-4000-8000-000000000001");
  assert.equal(result.body.meta.request_id, result.headers["x-request-id"]);
});
test("response is no-store", async () => assert.equal((await call(make().service, "director")).headers["cache-control"], "no-store"));
test("director sees all active stores", async () => assert.equal((await call(make().service, "director")).body.stores.length, 19));
test("executive officer sees all active stores", async () => assert.equal((await call(make().service, "executive_officer")).body.stores.length, 19));
test("department manager sees assigned department", async () => {
  const stores = (await call(make().service, "department_manager")).body.stores;
  assert.ok(stores.length > 1 && stores.every((store) => store.department_id === "synthetic-dept-sales"));
});
test("store manager sees own store", async () => {
  const stores = (await call(make().service, "store_manager")).body.stores;
  assert.deepEqual(stores.map((store) => store.store_id), ["synthetic-direct-01"]);
});
test("FC owner sees own FC company", async () => {
  const stores = (await call(make().service, "franchise_owner")).body.stores;
  assert.ok(stores.length && stores.every((store) => store.fc_company_id === "synthetic-fc-company-01"));
});
test("empty projection remains safe", async () => {
  const { service } = make({ stores: [] });
  const result = await call(service, "director");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.stores, []);
});
test("maintenance returns 503", async () => {
  const { service } = make({ maintenance: true });
  const result = await call(service, "director");
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "MAINTENANCE");
});
test("health endpoint has no dependency details", async () => {
  const result = await make().service.handle({ method: "GET", url: "/health", headers: {} });
  assert.deepEqual(Object.keys(result.body).sort(), ["contract_version", "environment", "production_blocked", "status", "synthetic"]);
});
test("N+1 query plan is prohibited", () => assert.deepEqual(PROJECTION_QUERY_PLAN, { directoryQueries: 1, accountingQueries: 1, kpiQueries: 1, perStoreQueries: 0, nPlusOne: false }));
test("audit emits request and success", async () => {
  const context = make();
  await call(context.service, "director");
  assert.deepEqual(context.events.map((event) => event.event), ["api_request", "api_success"]);
});
test("GET only", async () => {
  const result = await call(make().service, "director", undefined, { method: "POST" });
  assert.equal(result.status, 405);
});
