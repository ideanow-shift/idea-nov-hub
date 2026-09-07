import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAdapterConfig } from "../portal/store-sales/adapters/config.js";
import { createStoreSalesAdapter } from "../portal/store-sales/adapters/index.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const productionConfig = {
  mode: "production", featureFlag: "production", preview: false, productionApproved: true,
  expectedProjectRef: "nkmxevmioczcmnldreyo",
  productionEndpoint: "https://nkmxevmioczcmnldreyo.supabase.co/functions/v1/nov-hub-api",
  contractVersion: "STORE_MONTHLY_ACTUAL_V1"
};

test("production adapter is exact-target, canonical-read and cacheless", () => {
  const config = resolveAdapterConfig({ location: { hostname: "ideanow-shift.github.io", search: "" }, runtimeConfig: productionConfig });
  const created = createStoreSalesAdapter({ location: { hostname: "ideanow-shift.github.io", search: "" }, runtimeConfig: productionConfig, dependencies: {} });
  assert.equal(config.endpoint, productionConfig.productionEndpoint);
  assert.equal(config.cacheEnabled, false);
  assert.equal(created.adapter.mode, "production");
});

test("production remains fail closed without every explicit gate", () => {
  for (const override of [{ productionApproved: false }, { preview: true }, { featureFlag: "preview" }, { expectedProjectRef: "wrong" }]) {
    assert.throws(() => resolveAdapterConfig({ location: { hostname: "ideanow-shift.github.io", search: "" }, runtimeConfig: { ...productionConfig, ...override } }));
  }
});

test("release package freezes no-write, no-copy and approval boundaries", () => {
  const manifest = read("docs/store_operations_management/production_release/release-manifest.md");
  const workflow = read(".github/workflows/deploy-pages.yml");
  assert.match(manifest, /Business Data write \| 0/u);
  assert.match(manifest, /Data copy \| 0/u);
  assert.match(workflow, /store_operations_release_approved/u);
  assert.match(workflow, /store_operations_main_sha/u);
  assert.match(workflow, /runtime-config\.production\.js/u);
});

test("limited pilot Auth anchors are internal AUTH-01 records, never user login authority", () => {
  const contract = read("docs/store_operations_management/production_release/limited-real-user-pilot-v1.md");
  assert.match(contract, /server-managed internal Supabase Auth anchor/u);
  assert.match(contract, /existing signed NOV HUB session and canonical employee identity/u);
  assert.match(contract, /email must not be used as proof of identity/u);
  assert.match(contract, /send no email or invitation/u);
  assert.match(contract, /configure no user password/u);
  assert.match(contract, /require no Supabase login/u);
});

test("release production config contains no mock, synthetic or secret material", () => {
  const source = read("portal/store-sales/runtime-config.production.js");
  assert.doesNotMatch(source, /mock|synthetic|sb_secret_|service_role|eyJ[A-Za-z0-9_-]{20,}\./iu);
});
