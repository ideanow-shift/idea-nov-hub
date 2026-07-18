import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const handoff = fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-retirement-disable-archive-operator-handoff.md"), "utf8");
const contract = JSON.parse(fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-retirement-disable-archive-contract.json"), "utf8"));

test("disable/archive handoff is source-only and requires prior READY evidence", () => {
  assert.match(handoff, /source-only/u);
  assert.match(handoff, /not permission to disable triggers/u);
  assert.match(handoff, /GAS_RETIREMENT_EVIDENCE_READY/u);
  assert.match(handoff, /RETIREMENT_ACTION_ABORTED_SAFE_STOP/u);
});

test("disable/archive handoff lists every terminal category and required key", () => {
  for (const category of contract.terminalCategories) {
    assert.match(handoff, new RegExp(category, "u"));
  }
  for (const key of contract.sanitizedResultShape.requiredKeys) {
    assert.match(handoff, new RegExp(`"${key}"|\\b${key}\\b`, "u"));
  }
});

test("disable/archive handoff prevents clean category from authorizing deletion or credentials work", () => {
  assert.match(handoff, /does not authorize deletion/u);
  assert.match(handoff, /credential rotation/u);
  assert.match(handoff, /database mutation/u);
  assert.match(handoff, /notification send/u);
});

test("disable/archive handoff prohibits raw private output", () => {
  for (const phrase of [
    "deployment ID",
    "script ID",
    "trigger ID",
    "Script Properties",
    "Secret value",
    "raw logs",
    "request bodies",
    "credentials, tokens, keys",
    "employee IDs"
  ]) {
    assert.match(handoff, new RegExp(phrase, "u"));
  }
  assert.doesNotMatch(handoff, /clasp\s+(deploy|push|run)/iu);
});
