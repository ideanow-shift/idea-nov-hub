import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "review/management-financial-staged-import-contract.json"), "utf8"));

test("financial staged import contract is source-only and fail-closed", () => {
  assert.equal(contract.schemaVersion, "management-financial-staged-import-contract-v1");
  assert.equal(contract.status, "SOURCE_STATIC_CANDIDATE_ONLY");
  assert.equal(contract.runtimeEnabled, false);
  assert.equal(contract.productionMutationEnabled, false);
  assert.deepEqual(contract.supportedStatements, ["PL", "BS"]);
});

test("staging contract requires immutable source identity without raw file storage", () => {
  assert.equal(contract.sourceIdentity.fileSha256, "required");
  assert.equal(contract.sourceIdentity.fileBytes, "required");
  assert.equal(contract.sourceIdentity.rawFileStorage, "prohibited");
  assert.equal(contract.sourceIdentity.adapterReceiptSchema, "management-financial-data-intake-local-v1");
});

test("actor, idempotency, rollback, and sanitized result boundaries are fixed", () => {
  assert.equal(contract.actorAndAudit.actorSource, "backend_resolved_hub_session_employee");
  assert.equal(contract.actorAndAudit.browserActorOverride, "rejected");
  assert.equal(contract.actorAndAudit.auditRecord, "exactly_one_per_import_command");
  assert.deepEqual(contract.idempotency.keyFields, ["statement", "period", "scopeKind", "sourceSystem", "fileSha256"]);
  assert.equal(contract.idempotency.duplicatePolicy, "fail_close_same_key_existing");
  assert.equal(contract.rollback.scope, "single_import_command");
  assert.equal(contract.sanitizedResult.rawRows, "prohibited");
  assert.equal(contract.sanitizedResult.digests, "prohibited_in_browser");
});

test("P/L and B/S gates retain known accounting blockers", () => {
  assert.deepEqual(contract.validationGates.pl.supplementalRequired, ["salesSubaccount", "utilitySubaccount", "couponAmountSource"]);
  assert.ok(contract.validationGates.pl.required.includes("aggregateSheetPolicyClosed"));
  assert.ok(contract.validationGates.bs.required.includes("assetsEqualLiabilitiesPlusEquity"));
  assert.ok(contract.terminalCategories.includes("SUPPLEMENTAL_SOURCE_REQUIRED"));
  assert.ok(contract.terminalCategories.includes("BS_IMBALANCED"));
});
