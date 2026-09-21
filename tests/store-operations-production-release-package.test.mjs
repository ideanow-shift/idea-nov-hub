import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveAdapterConfig } from "../portal/store-sales/adapters/config.js";
import { createStoreSalesAdapter } from "../portal/store-sales/adapters/index.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const priorComparisonUiManifest = JSON.parse(read("docs/store_operations_management/production_integration/store-operations-comparison-ui-bundle-v1.json"));
const priorProfitStateUiManifest = JSON.parse(read("docs/store_operations_management/production_integration/store-operations-profit-state-staging-fix-ui-bundle-v1.json"));
const fcProfitSignalUiManifest = JSON.parse(read("docs/store_operations_management/production_integration/store-operations-fc-profit-signal-ui-bundle-v1.json"));
const salesUatCorrectionsUiManifest = JSON.parse(read("docs/store_operations_management/production_integration/store-operations-sales-uat-corrections-ui-bundle-v1.json"));
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

test("prior comparison UI bundle remains immutable", () => {
  assert.equal(priorComparisonUiManifest.bundle_content_sha256, "4c965387773288dd85fa7262568e64ac703ed7ff1cd2bcff1a539f1ee105d38e");
  assert.equal(priorComparisonUiManifest.deployment_status, "NOT_DEPLOYED");
});

test("prior profit-state UAT bundle remains immutable", () => {
  assert.equal(priorProfitStateUiManifest.bundle_content_sha256, "cf19a5f4b3497fbe8bc43cbd2c9e0fcf4902250a02dbd2c196927871d8d46d73");
  assert.equal(priorProfitStateUiManifest.deployment_status, "STAGING_UAT_PASSED_PRODUCTION_NOT_APPROVED");
});

test("prior FC profit signal candidate remains internally sealed and Production prohibited", () => {
  assert.equal(fcProfitSignalUiManifest.deployment_status, "NOT_DEPLOYED");
  assert.equal(fcProfitSignalUiManifest.production_release_status, "REQUIRES_SEPARATE_OWNER_APPROVAL");
  assert.equal(fcProfitSignalUiManifest.bundle_file_count, 1);
  assert.equal(fcProfitSignalUiManifest.bundle_content_sha256, "6eed773c5e1a78adb00f32556eb068188d09d73257d43ffeb92a8b6f567cfd40");
  assert.ok(Object.values(fcProfitSignalUiManifest.gates).every((gate) => gate === "PROHIBITED"));
  const sorted = [...fcProfitSignalUiManifest.files].sort((left, right) => left.path.localeCompare(right.path));
  const input = sorted.map((file) => file.path + "\t" + file.sha256 + "\t" + file.bytes).join("\n");
  assert.equal(createHash("sha256").update(input).digest("hex"), fcProfitSignalUiManifest.bundle_content_sha256);
});

test("sales UAT corrections candidate pins current changed assets and keeps Production prohibited", () => {
  assert.equal(salesUatCorrectionsUiManifest.deployment_status, "STAGING_DEPLOYED_AWAITING_OWNER_SALES_UAT");
  assert.equal(salesUatCorrectionsUiManifest.production_release_status, "REQUIRES_SEPARATE_OWNER_APPROVAL");
  assert.equal(salesUatCorrectionsUiManifest.bundle_file_count, 2);
  assert.ok(Object.values(salesUatCorrectionsUiManifest.gates).every((gate) => gate === "PROHIBITED"));
  const sorted = [...salesUatCorrectionsUiManifest.files].sort((left, right) => left.path.localeCompare(right.path));
  const input = sorted.map((file) => file.path + "\t" + file.sha256 + "\t" + file.bytes).join("\n");
  assert.equal(createHash("sha256").update(input).digest("hex"), salesUatCorrectionsUiManifest.bundle_content_sha256);
  for (const file of sorted) {
    const content = read(file.path);
    const approvedWindowsBytes = Buffer.from(
      content.replace(/\r?\n/gu, "\n").replace(/\n/gu, "\r\n"),
      "utf8",
    );
    assert.equal(approvedWindowsBytes.byteLength, file.bytes, file.path);
    assert.equal(createHash("sha256").update(approvedWindowsBytes).digest("hex"), file.sha256, file.path);
  }
});
