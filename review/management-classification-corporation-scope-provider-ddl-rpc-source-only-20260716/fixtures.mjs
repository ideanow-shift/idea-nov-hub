import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CURRENT_READINESS, inspectCorporationScopeSubstrate, validateSanitizedStatus } from "./validator.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const sources = { substrate: read("substrate-up.sql"), cutover: read("cutover-authoritative-resolver.sql"), down: read("down.sql"), catalog: read("catalog-inventory.sql") };

test("content manifest fixes every reviewed dependency", () => {
  const manifest = JSON.parse(read("content-manifest.json"));
  assert.equal(manifest.currentReady, false);
  assert.equal(manifest.runtimeApprovedDigest, null);
  for (const [name, identity] of Object.entries(manifest.files)) {
    const bytes = fs.readFileSync(path.join(root, name));
    assert.equal(bytes.length, identity.bytes);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), identity.sha256);
  }
});

test("substrate is non-disruptive and not ready", () => {
  const result = inspectCorporationScopeSubstrate(sources);
  assert.equal(result.nonDisruptive, true);
  assert.equal(result.businessSchemaChanges, 0);
  assert.equal(result.currentReady, false);
  assert.equal(result.triggerCount, 0);
  assert.equal(result.directRuntimeExecuteGrants, 0);
  assert.equal(result.browserAssertionsAccepted, false);
  assert.equal(result.catalogSelectOnly, true);
});

test("current runtime identity remains null", () => {
  assert.equal(CURRENT_READINESS.runtimeApprovedDigest, null);
  assert.equal(CURRENT_READINESS.currentReady, false);
});

test("status result is exact and fail closed", () => {
  assert.equal(validateSanitizedStatus({ category: "CORPORATION_SCOPE_PROVIDER_NOT_READY", providerReady: false, actorResolverInstalled: false, targetResolverInstalled: false, runtimeWired: false }), true);
  assert.equal(validateSanitizedStatus({ category: "SCOPE_MATCH", providerReady: true, actorResolverInstalled: true, targetResolverInstalled: true, runtimeWired: true }), false);
});

test("unknown status fields are rejected", () => {
  assert.equal(validateSanitizedStatus({ category: "CORPORATION_SCOPE_PROVIDER_NOT_READY", providerReady: false, actorResolverInstalled: false, targetResolverInstalled: false, runtimeWired: false, corporationKey: "hidden" }), false);
});

for (const [name, mutate] of [
  ["trigger", (s) => { s.substrate += "\ncreate trigger unsafe;"; }],
  ["grant", (s) => { s.substrate += "\ngrant execute on function x() to authenticated;"; }],
  ["ready category", (s) => { s.substrate = s.substrate.replaceAll("CORPORATION_SCOPE_PROVIDER_NOT_READY", "SCOPE_MATCH"); }],
  ["browser assertion", (s) => { s.substrate = s.substrate.replace("p_rule_id uuid", "p_rule_id uuid, p_actor_resolved boolean"); }],
  ["cutover hold", (s) => { s.cutover = s.cutover.replace("CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY", "READY"); }],
  ["down boundary", (s) => { s.down = s.down.replace("RUNTIME-DISCONNECTED BOUNDARY", ""); }],
  ["catalog mutation", (s) => { s.catalog += "\nupdate public.x set y = 1;"; }],
]) {
  test(`rejects ${name} drift`, () => {
    const changed = structuredClone(sources);
    mutate(changed);
    assert.equal(inspectCorporationScopeSubstrate(changed), null);
  });
}
