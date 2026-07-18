import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const contractPath = path.join(root, "review/gas-exit-20260717/gas-retirement-evidence-contract.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

const readyResult = Object.freeze({
  contractVersion: "gas-retirement-evidence-v1",
  category: "GAS_RETIREMENT_EVIDENCE_READY",
  replacementRouteCount: 2,
  recentExecutionCount: 0,
  requiredTriggerCount: 0,
  unresolvedDependencyCount: 0,
  mutationCount: 0,
  secretInspectionCount: 0,
  replacementRoutesReady: true,
  recentExecutionPresence: false,
  activeTriggerRequired: false,
  knownDependencyUnresolved: false,
  secretOrPropertyInspection: false,
  rawLogCaptured: false,
  rawPayloadCaptured: false
});

function validateEvidenceResult(result) {
  const allowed = new Set(contract.sanitizedResultShape.requiredKeys);
  const categories = new Set(contract.terminalCategories);

  if (!result || typeof result !== "object" || Array.isArray(result)) return "EVIDENCE_CONTRACT_FAILED";
  if (!categories.has(result.category)) return "EVIDENCE_CONTRACT_FAILED";
  for (const key of allowed) {
    if (!(key in result)) return "EVIDENCE_CONTRACT_FAILED";
  }
  for (const key of Object.keys(result)) {
    if (!allowed.has(key)) return "EVIDENCE_CONTRACT_FAILED";
  }

  const countKeys = [
    "replacementRouteCount",
    "recentExecutionCount",
    "requiredTriggerCount",
    "unresolvedDependencyCount",
    "mutationCount",
    "secretInspectionCount"
  ];
  for (const key of countKeys) {
    if (!Number.isInteger(result[key]) || result[key] < 0) return "EVIDENCE_CONTRACT_FAILED";
  }

  const boolKeys = [
    "replacementRoutesReady",
    "recentExecutionPresence",
    "activeTriggerRequired",
    "knownDependencyUnresolved",
    "secretOrPropertyInspection",
    "rawLogCaptured",
    "rawPayloadCaptured"
  ];
  for (const key of boolKeys) {
    if (typeof result[key] !== "boolean") return "EVIDENCE_CONTRACT_FAILED";
  }

  if (result.contractVersion !== contract.contractVersion) return "EVIDENCE_CONTRACT_FAILED";
  if (result.mutationCount !== 0 || result.secretInspectionCount !== 0) return "EVIDENCE_CONTRACT_FAILED";
  if (result.secretOrPropertyInspection || result.rawLogCaptured || result.rawPayloadCaptured) return "EVIDENCE_CONTRACT_FAILED";
  if (!result.replacementRoutesReady || result.replacementRouteCount < 1) return "REPLACEMENT_ROUTE_NOT_READY";
  if (result.recentExecutionPresence || result.recentExecutionCount > 0) return "GAS_TRAFFIC_STILL_PRESENT";
  if (result.activeTriggerRequired || result.requiredTriggerCount > 0) return "GAS_TRIGGER_STILL_REQUIRED";
  if (result.knownDependencyUnresolved || result.unresolvedDependencyCount > 0) return "DEPENDENCY_OWNER_NOT_READY";
  return "GAS_RETIREMENT_EVIDENCE_READY";
}

test("contract remains source-only and action-disabled", () => {
  assert.equal(contract.executionApproved, false);
  assert.equal(contract.productionActionApproved, false);
  assert.equal(contract.boundaries.allowsAppsScriptDisable, false);
  assert.equal(contract.boundaries.allowsTriggerMutation, false);
  assert.equal(contract.boundaries.allowsSecretAccess, false);
  assert.equal(contract.boundaries.allowsDeletion, false);
});

test("ready result requires zero traffic, zero required triggers, and no unresolved dependencies", () => {
  assert.equal(validateEvidenceResult(readyResult), "GAS_RETIREMENT_EVIDENCE_READY");
});

test("traffic, trigger, route, and owner blockers fail closed to fixed categories", () => {
  assert.equal(validateEvidenceResult({ ...readyResult, recentExecutionCount: 1 }), "GAS_TRAFFIC_STILL_PRESENT");
  assert.equal(validateEvidenceResult({ ...readyResult, activeTriggerRequired: true }), "GAS_TRIGGER_STILL_REQUIRED");
  assert.equal(validateEvidenceResult({ ...readyResult, replacementRoutesReady: false }), "REPLACEMENT_ROUTE_NOT_READY");
  assert.equal(validateEvidenceResult({ ...readyResult, unresolvedDependencyCount: 1 }), "DEPENDENCY_OWNER_NOT_READY");
});

test("raw/private evidence, mutations, unknown categories, and type drift are rejected", () => {
  assert.equal(validateEvidenceResult({ ...readyResult, deploymentUrl: "https://example.invalid" }), "EVIDENCE_CONTRACT_FAILED");
  assert.equal(validateEvidenceResult({ ...readyResult, mutationCount: 1 }), "EVIDENCE_CONTRACT_FAILED");
  assert.equal(validateEvidenceResult({ ...readyResult, category: "READY" }), "EVIDENCE_CONTRACT_FAILED");
  assert.equal(validateEvidenceResult({ ...readyResult, recentExecutionCount: "0" }), "EVIDENCE_CONTRACT_FAILED");
  assert.equal(validateEvidenceResult({ ...readyResult, rawLogCaptured: true }), "EVIDENCE_CONTRACT_FAILED");
});
