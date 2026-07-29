import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveEnvironment } from "../supabase/functions/store-sales-projection/environment.js";

const staging = {
  APP_ENV: "staging", RUNTIME_MODE: "integration",
  PROJECTION_API_BASE_URL: "https://store-sales.staging.invalid",
  SUPABASE_URL: "https://staging.invalid",
  SESSION_ISSUER: "idea-nov-staging", SESSION_AUDIENCE: "nov_hub_staging",
  CONTRACT_VERSION: "store-sales-projection-v1", AUDIT_ENABLED: "true",
  TELEMETRY_ENABLED: "true", PRODUCTION_BLOCKED: "true", SYNTHETIC_DATA_ENABLED: "true"
};

test("staging config resolves as isolated synthetic environment", () => {
  const result = resolveEnvironment(staging);
  assert.equal(result.appEnv, "staging");
  assert.equal(result.syntheticDataEnabled, true);
  assert.equal(result.productionBlocked, true);
});
test("production config remains blocked", () => assert.throws(() => resolveEnvironment({ ...staging, APP_ENV: "production", RUNTIME_MODE: "production", SYNTHETIC_DATA_ENABLED: "false" }), /Production is blocked/));
test("staging rejects production URL", () => assert.throws(() => resolveEnvironment({ ...staging, PROJECTION_API_BASE_URL: "https://api.production.invalid" }), /production endpoint/));
test("staging rejects production Supabase URL", () => assert.throws(() => resolveEnvironment({ ...staging, SUPABASE_URL: "https://production-db.invalid" }), /production endpoint/));
test("production rejects staging URL when explicitly unblocked", () => assert.throws(() => resolveEnvironment({ ...staging, APP_ENV: "production", RUNTIME_MODE: "production", PRODUCTION_BLOCKED: "false", SYNTHETIC_DATA_ENABLED: "false" }), /Staging cannot|Production cannot/));
test("production rejects synthetic fixture", () => assert.throws(() => resolveEnvironment({ ...staging, APP_ENV: "production", RUNTIME_MODE: "production", PRODUCTION_BLOCKED: "false" }), /Synthetic data/));
test("environment mismatch refuses startup", () => assert.throws(() => resolveEnvironment({ ...staging, APP_ENV: "preview" }), /do not match/));
test("query parameter cannot change environment", () => {
  assert.equal(resolveEnvironment({ ...staging, QUERY_MODE: "production" }).appEnv, "staging");
});
test("localStorage cannot change environment", () => {
  assert.equal(resolveEnvironment({ ...staging, LOCAL_STORAGE_MODE: "production" }).appEnv, "staging");
});
test("staging config has no production URL or secret value", () => {
  const source = readFileSync(new URL("../portal/store-sales/staging-config.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /production\.(com|jp)|sb_secret_|service_role/i);
});
test("environment template contains key names and empty secret values", () => {
  const source = readFileSync(new URL("../supabase/functions/store-sales-projection/.env.staging.example", import.meta.url), "utf8");
  assert.match(source, /SUPABASE_ANON_KEY=\s*$/m);
  assert.doesNotMatch(source, /sb_(secret|publishable)_/i);
});
