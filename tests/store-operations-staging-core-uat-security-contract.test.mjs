import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../docs/store_operations_management/production_release/staging_core_uat_security/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

test("sealed population artifact remains exact, deterministic, private, and reversible", () => {
  const doc = read("sealed-population-artifact-spec.md");
  for (const term of ["six corporations", "20 official stores", "three Owner-selected UAT employees", "HQ", "SHA-256", "dry-run", "rollback", "single transaction", "synthetic rows", "Production database copy"]) {
    assert.match(doc, new RegExp(term, "iu"));
  }
});

test("authentication contract is NOV HUB Session only and fails closed", () => {
  const doc = read("auth01-security-spec.md");
  for (const term of ["active NOV HUB session", "one-time", "single-use", "audience", "replay-denied", "fail-closed", "M019", "SCOPE_DENIED"]) {
    assert.match(doc, new RegExp(term, "iu"));
  }
  assert.match(doc, /DBF-specific/iu);
  assert.match(doc, /contract can authorize Store Operations/iu);
  assert.doesNotMatch(doc, /Security Review PASS for implementation/iu);
});

test("runbooks retire Magic Link and preserve zero-write gates", () => {
  const combined = ["supabase-auth-onboarding-runbook.md", "rollback-revoke-runbook.md", "test-matrix.md", "implementation-plan.md"].map(read).join("\n");
  for (const term of ["Magic Link", "prohibited", "browser service-role", "Business write 0", "DBF Canonical write 0", "Production change 0"]) {
    assert.match(combined, new RegExp(term, "iu"));
  }
  assert.match(combined, /DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN/u);
});
