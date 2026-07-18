import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const status = fs.readFileSync(path.join(root, "review/gas-exit-20260717/gas-final-removal-status-20260718.md"), "utf8");

test("final status says source and public GAS are removed", () => {
  assert.match(status, /SOURCE_PUBLIC_GAS_REMOVED/u);
  assert.match(status, /tracked `.clasp\.json`: 0/u);
  assert.match(status, /tracked `appsscript\.json`: 0/u);
  assert.match(status, /tracked `\.gs`: 0/u);
  assert.match(status, /tracked `gas-backend`: absent/u);
  assert.match(status, /strict zero-GAS source check: PASS/u);
});

test("final status keeps production deployment retirement blocked on identity evidence", () => {
  assert.match(status, /PRODUCTION_DEPLOYMENT_IDENTITY_NOT_AVAILABLE/u);
  assert.match(status, /no reviewed Apps Script project identity is\s+available locally/u);
  assert.match(status, /missing production Apps Script\s+identity\/evidence/u);
});

test("final status does not approve unsafe production actions", () => {
  assert.match(status, /risk touching the wrong production\s+asset/u);
  assert.match(status, /Do not delete/u);
  assert.match(status, /Secrets\/Script Properties/u);
  assert.match(status, /raw logs/u);
  assert.doesNotMatch(status, /clasp\s+(deploy|push|run)/iu);
});
