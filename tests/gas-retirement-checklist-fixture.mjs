import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const checklist = fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-deployment-retirement-operator-checklist.md"), "utf8");

assert.match(checklist, /GAS_RETIREMENT_EVIDENCE_READY/u);
assert.match(checklist, /GAS_DEPLOYMENT_ARCHIVED_CLEAN/u);
assert.match(checklist, /gas-retirement-evidence-contract\.json/u);
assert.match(checklist, /gas-retirement-evidence-operator-handoff\.md/u);
assert.match(checklist, /gas-retirement-disable-archive-contract\.json/u);
assert.match(checklist, /gas-retirement-disable-archive-operator-handoff\.md/u);
assert.match(checklist, /These artifacts do not approve execution/u);
assert.match(checklist, /Separate explicit\s+operator approval|separate explicit\s+operator approval/u);
assert.match(checklist, /Script Properties/u);
assert.match(checklist, /No production DML/u);
assert.match(checklist, /destructive deletion is authorized/u);
assert.doesNotMatch(checklist, /clasp\s+deploy|clasp\s+push|script\.google\.com\/macros\/s\//iu);

console.log("gas-retirement-checklist-fixture: PASS");
