import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const contract = JSON.parse(fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-retirement-disable-archive-contract.json"), "utf8"));

const cleanResult = Object.freeze({
  contractVersion: "gas-retirement-disable-archive-v1",
  category: "GAS_DEPLOYMENT_ARCHIVED_CLEAN",
  priorEvidenceReady: true,
  legacyWriteFreezeConfirmed: true,
  replacementRoutesStillReady: true,
  approvedActiveTriggerCount: 2,
  disabledTriggerCount: 2,
  remainingActiveTriggerCount: 0,
  deploymentArchiveAttempted: true,
  deploymentArchived: true,
  postArchiveObservationReady: true,
  mutationCount: 0,
  secretInspectionCount: 0,
  rawLogCaptured: false,
  rawPayloadCaptured: false,
  deletionPerformed: false
});

function validateArchiveResult(result) {
  const allowed = new Set(contract.sanitizedResultShape.requiredKeys);
  const categories = new Set(contract.terminalCategories);
  if (!result || typeof result !== "object" || Array.isArray(result)) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  if (!categories.has(result.category)) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  for (const key of allowed) {
    if (!(key in result)) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  }
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  }

  const countKeys = [
    "approvedActiveTriggerCount",
    "disabledTriggerCount",
    "remainingActiveTriggerCount",
    "mutationCount",
    "secretInspectionCount"
  ];
  for (const key of countKeys) {
    if (!Number.isInteger(result[key]) || result[key] < 0) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  }

  const boolKeys = [
    "priorEvidenceReady",
    "legacyWriteFreezeConfirmed",
    "replacementRoutesStillReady",
    "deploymentArchiveAttempted",
    "deploymentArchived",
    "postArchiveObservationReady",
    "rawLogCaptured",
    "rawPayloadCaptured",
    "deletionPerformed"
  ];
  for (const key of boolKeys) {
    if (typeof result[key] !== "boolean") return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  }

  if (result.contractVersion !== contract.contractVersion) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  if (!result.priorEvidenceReady || !result.legacyWriteFreezeConfirmed || !result.replacementRoutesStillReady) {
    return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  }
  if (result.mutationCount !== 0 || result.secretInspectionCount !== 0) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  if (result.rawLogCaptured || result.rawPayloadCaptured || result.deletionPerformed) return "RETIREMENT_ACTION_ABORTED_SAFE_STOP";
  if (result.disabledTriggerCount !== result.approvedActiveTriggerCount || result.remainingActiveTriggerCount !== 0) {
    return "TRIGGER_DISABLE_NOT_EXACT";
  }
  if (!result.deploymentArchiveAttempted || !result.deploymentArchived) return "DEPLOYMENT_ARCHIVE_NOT_EXACT";
  if (!result.postArchiveObservationReady) return "POST_ARCHIVE_OBSERVATION_NOT_EXACT";
  return "GAS_DEPLOYMENT_ARCHIVED_CLEAN";
}

test("disable/archive contract remains execution-ineligible and non-destructive", () => {
  assert.equal(contract.executionApproved, false);
  assert.equal(contract.requiresPriorEvidenceCategory, "GAS_RETIREMENT_EVIDENCE_READY");
  assert.equal(contract.boundaries.allowsDeletion, false);
  assert.equal(contract.boundaries.allowsSecretAccess, false);
  assert.equal(contract.boundaries.allowsProductionDml, false);
  assert.equal(contract.boundaries.allowsCredentialRotation, false);
});

test("clean archive requires prior evidence, exact trigger disablement, archive, and post observation", () => {
  assert.equal(validateArchiveResult(cleanResult), "GAS_DEPLOYMENT_ARCHIVED_CLEAN");
});

test("trigger, archive, and post-observation drift return fixed non-clean categories", () => {
  assert.equal(validateArchiveResult({ ...cleanResult, disabledTriggerCount: 1 }), "TRIGGER_DISABLE_NOT_EXACT");
  assert.equal(validateArchiveResult({ ...cleanResult, remainingActiveTriggerCount: 1 }), "TRIGGER_DISABLE_NOT_EXACT");
  assert.equal(validateArchiveResult({ ...cleanResult, deploymentArchived: false }), "DEPLOYMENT_ARCHIVE_NOT_EXACT");
  assert.equal(validateArchiveResult({ ...cleanResult, postArchiveObservationReady: false }), "POST_ARCHIVE_OBSERVATION_NOT_EXACT");
});

test("missing prior evidence, mutation, raw capture, deletion, and shape drift abort safely", () => {
  assert.equal(validateArchiveResult({ ...cleanResult, priorEvidenceReady: false }), "RETIREMENT_ACTION_ABORTED_SAFE_STOP");
  assert.equal(validateArchiveResult({ ...cleanResult, mutationCount: 1 }), "RETIREMENT_ACTION_ABORTED_SAFE_STOP");
  assert.equal(validateArchiveResult({ ...cleanResult, rawPayloadCaptured: true }), "RETIREMENT_ACTION_ABORTED_SAFE_STOP");
  assert.equal(validateArchiveResult({ ...cleanResult, deletionPerformed: true }), "RETIREMENT_ACTION_ABORTED_SAFE_STOP");
  assert.equal(validateArchiveResult({ ...cleanResult, deploymentArchiveAttempted: "true" }), "RETIREMENT_ACTION_ABORTED_SAFE_STOP");
  assert.equal(validateArchiveResult({ ...cleanResult, deploymentUrl: "https://example.invalid" }), "RETIREMENT_ACTION_ABORTED_SAFE_STOP");
});
