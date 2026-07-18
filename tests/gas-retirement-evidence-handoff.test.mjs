import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const handoff = fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-retirement-evidence-operator-handoff.md"), "utf8");
const contract = JSON.parse(fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-retirement-evidence-contract.json"), "utf8"));

test("handoff is source-only and does not approve production actions", () => {
  assert.match(handoff, /source-only/u);
  assert.match(handoff, /does not approve or perform production SQL/u);
  assert.match(handoff, /Secret inspection/u);
  assert.match(handoff, /deletion/u);
  assert.doesNotMatch(handoff, /clasp\s+(deploy|push|run)/iu);
});

test("handoff lists every contract terminal category and required key", () => {
  for (const category of contract.terminalCategories) {
    assert.match(handoff, new RegExp(category, "u"));
  }
  for (const key of contract.sanitizedResultShape.requiredKeys) {
    assert.match(handoff, new RegExp(`"${key}"|\\b${key}\\b`, "u"));
  }
});

test("handoff keeps non-ready categories fail-closed before disable/archive", () => {
  assert.match(handoff, /Any non-READY category stops the retirement\s+lane without disabling anything/u);
  assert.match(handoff, /If and only if the return category is `GAS_RETIREMENT_EVIDENCE_READY`/u);
  assert.match(handoff, /separate explicit disable\/archive approval/u);
});

test("handoff prohibits raw private evidence", () => {
  for (const phrase of [
    "request or response bodies",
    "Script Properties",
    "raw logs",
    "credentials, tokens, keys",
    "user names, employee IDs",
    "project IDs"
  ]) {
    assert.match(handoff, new RegExp(phrase, "u"));
  }
});
