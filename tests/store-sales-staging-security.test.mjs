import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createStagingTokenVerifier } from "../supabase/functions/store-sales-projection/auth.js";
import { createAuditSink } from "../supabase/functions/store-sales-projection/audit.js";
import { resolveEnvironment } from "../supabase/functions/store-sales-projection/environment.js";
import { createStoreSalesStagingService } from "../supabase/functions/store-sales-projection/service.js";
import { SYNTHETIC_ACTOR_ROLES, SYNTHETIC_STORES } from "../supabase/functions/store-sales-projection/synthetic-data.js";

const config = resolveEnvironment({ APP_ENV: "staging", RUNTIME_MODE: "integration", PROJECTION_API_BASE_URL: "http://localhost:4175", SESSION_ISSUER: "idea-nov-staging", SESSION_AUDIENCE: "nov_hub_staging", CONTRACT_VERSION: "store-sales-projection-v1", PRODUCTION_BLOCKED: "true", SYNTHETIC_DATA_ENABLED: "true" });
const verifier = createStagingTokenVerifier({ verifySignature: async ({ signature }) => signature === "synthetic-signature" });
const service = createStoreSalesStagingService({ config, tokenVerifier: verifier, audit: createAuditSink() });
const request = (role, store = null, expiry = Date.now() + 60_000, signature = "synthetic-signature") => service.handle({
  method: "GET",
  url: store ? `/v1/store-sales/stores/${store}?period=2026-07` : "/v1/store-sales/dashboard?period=2026-07",
  headers: { authorization: `Bearer stg-synthetic:${role}:${expiry}:${signature}`, "x-contract-version": "store-sales-projection-v1" }
});

test("employee is denied", async () => assert.equal((await request("employee")).status, 403));
test("store manager cross-store is denied", async () => assert.equal((await request("store_manager", "synthetic-direct-02")).status, 403));
test("FC owner cross-entity is denied", async () => assert.equal((await request("franchise_owner", "synthetic-fc-04")).status, 403));
test("expired session is unauthorized", async () => assert.equal((await request("director", null, Date.now() - 1)).body.error.code, "SESSION_EXPIRED"));
test("invalid signature is unauthorized", async () => assert.equal((await request("director", null, Date.now() + 60_000, "bad")).body.error.code, "INVALID_SIGNATURE"));
test("invalid issuer marker is unauthorized", async () => {
  const result = await service.handle({ method: "GET", url: "/v1/store-sales/dashboard?period=2026-07", headers: { authorization: "Bearer production:director:9999999999999:synthetic-signature", "x-contract-version": "store-sales-projection-v1" } });
  assert.equal(result.body.error.code, "INVALID_ISSUER");
});
test("token is never included in audit fields", () => {
  const rows = [];
  const audit = createAuditSink((row) => rows.push(row));
  audit.emit("api_request", { request_id: "r", token: "secret", raw_response: "secret", service_role: "secret" });
  assert.deepEqual(rows[0], { event: "api_request", request_id: "r" });
});
test("synthetic actors cover required roles", () => assert.deepEqual(SYNTHETIC_ACTOR_ROLES, ["representative_director", "director", "executive_officer", "department_manager", "store_manager", "franchise_owner", "employee"]));
test("synthetic stores have marker and test IDs", () => assert.ok(SYNTHETIC_STORES.every((store) => store.synthetic && /^synthetic-/.test(store.store_id))));
test("synthetic stores contain no real names or emails", () => {
  const source = JSON.stringify(SYNTHETIC_STORES);
  assert.doesNotMatch(source, /BASSA|所沢|国分寺|@|株式会社/i);
});
test("synthetic states cover all required states", () => assert.deepEqual(new Set(SYNTHETIC_STORES.map((store) => store.data_state)), new Set(["available", "collecting", "preparing", "unavailable", "validation_error"])));
test("synthetic statuses cover all required statuses", () => assert.deepEqual(new Set(SYNTHETIC_STORES.map((store) => store.store_status)), new Set(["Good", "Stable", "Improving", "Needs Attention"])));
test("synthetic data includes direct, FC, closed and suspended stores", () => {
  assert.ok(SYNTHETIC_STORES.some((store) => store.ownership_type === "Direct"));
  assert.ok(SYNTHETIC_STORES.some((store) => store.ownership_type === "FC"));
  assert.ok(SYNTHETIC_STORES.some((store) => store.operational_state === "休業"));
  assert.ok(SYNTHETIC_STORES.some((store) => store.operational_state === "閉店"));
});
test("review SQL is default deny and rollback only", () => {
  const sql = readFileSync(new URL("../supabase/migrations/review_only/store_sales_staging_foundation.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all.*anon, authenticated/i);
  assert.match(sql, /ROLLBACK;/);
  assert.doesNotMatch(sql, /create policy/i);
});
test("frontend has no service role", () => {
  const source = readFileSync(new URL("../portal/store-sales/staging-config.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE/i);
});
test("production page does not load staging fixtures", () => {
  const source = readFileSync(new URL("../portal/store-sales/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(source, /staging-config|staging-session-bootstrap|synthetic-data/);
});
test("session token is not transported in URL", () => {
  const source = readFileSync(new URL("../portal/store-sales/adapters/projection.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /searchParams\.set\(["']token|token=.*url/i);
  assert.match(source, /Authorization/);
});
