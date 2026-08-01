import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectionResponse } from "../portal/store-sales/adapters/contract.js";
import { createStagingTokenVerifier } from "../supabase/functions/store-sales-projection/auth.js";
import { resolveEnvironment } from "../supabase/functions/store-sales-projection/environment.js";
import { createStoreSalesStagingService } from "../supabase/functions/store-sales-projection/service.js";
import { OFFICIAL_STORE_NAMES, SYNTHETIC_STORES } from "../supabase/functions/store-sales-projection/synthetic-data.js";

const config = resolveEnvironment({
  APP_ENV: "staging", RUNTIME_MODE: "integration", PROJECTION_API_BASE_URL: "http://localhost:4175",
  SESSION_ISSUER: "idea-nov-staging", SESSION_AUDIENCE: "nov_hub_staging",
  CONTRACT_VERSION: "store-sales-projection-v1", PRODUCTION_BLOCKED: "true", SYNTHETIC_DATA_ENABLED: "true"
});
const verifier = createStagingTokenVerifier({ verifySignature: async ({ signature }) => signature === "synthetic-signature" });
const service = createStoreSalesStagingService({ config, tokenVerifier: verifier });
const request = (role, path = "/v1/store-sales/dashboard?period=2026-07") => service.handle({
  method: "GET", url: path,
  headers: {
    authorization: `Bearer stg-synthetic:${role}:${Date.now() + 60_000}:synthetic-signature`,
    "x-contract-version": "store-sales-projection-v1"
  }
});

test("integration fixture contains exactly the approved 20 active stores", () => {
  assert.equal(SYNTHETIC_STORES.length, 20);
  assert.deepEqual(SYNTHETIC_STORES.map((store) => store.store_name), OFFICIAL_STORE_NAMES);
  assert.equal(SYNTHETIC_STORES.filter((store) => store.ownership_type === "Direct").length, 13);
  assert.equal(SYNTHETIC_STORES.filter((store) => store.ownership_type === "FC").length, 7);
  assert.ok(SYNTHETIC_STORES.every((store) => store.operational_state === "営業中"));
  assert.equal(new Set(SYNTHETIC_STORES.map((store) => store.store_name)).size, 20);
});

test("server-resolved role scope is default deny and role bounded", async () => {
  assert.equal((await request("representative")).body.stores.length, 20);
  assert.equal((await request("sales_manager")).body.stores.length, 13);
  assert.equal((await request("area_manager")).body.stores.length, 5);
  assert.equal((await request("store_manager")).body.stores.length, 1);
  assert.equal((await request("unknown_role")).status, 403);
  assert.equal((await request("sales_manager", "/v1/store-sales/stores/synthetic-fc-01?period=2026-07")).status, 403);
});

test("forbidden and empty remain distinct API outcomes", async () => {
  const emptyService = createStoreSalesStagingService({ config, tokenVerifier: verifier, stores: [] });
  const empty = await emptyService.handle({
    method: "GET", url: "/v1/store-sales/dashboard?period=2026-07",
    headers: { authorization: `Bearer stg-synthetic:representative:${Date.now() + 60_000}:synthetic-signature`, "x-contract-version": "store-sales-projection-v1" }
  });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.stores, []);
  assert.equal((await request("employee")).status, 403);
});

test("profit values are hidden for every non-available state", async () => {
  const projection = (await request("representative")).body;
  for (const store of projection.stores) {
    if (store.operating_profit.data_state !== "available") {
      assert.equal(store.operating_profit.value, null);
      assert.equal(store.operating_profit.display_value, null);
    }
  }
  assert.deepEqual(new Set(projection.stores.map((store) => store.data_state)), new Set(["available", "collecting", "preparing", "unavailable", "validation_error"]));
});

test("projection contract retains version, required fields and safe unknown handling", async () => {
  const source = (await request("representative")).body;
  const wire = { ...source, meta: { ...source.meta }, future_optional_field: "ignored-by-v1-consumer" };
  const normalized = validateProjectionResponse(wire);
  assert.equal(normalized.meta.projectionVersion, "store-sales-projection-v1");
  assert.equal(normalized.role, "representative");
  assert.equal(normalized.stores.length, 20);
  assert.equal(Object.hasOwn(normalized, "future_optional_field"), false);
  delete wire.meta.accounting_confirmed_through_period;
  assert.throws(() => validateProjectionResponse(wire), /required|YYYY-MM/i);
});
