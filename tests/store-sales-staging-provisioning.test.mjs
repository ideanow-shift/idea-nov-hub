import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../docs/store_sales_staging_provisioning");
const inventory = await readFile(resolve(root, "staging-environment-inventory.md"), "utf8");
const project = await readFile(resolve(root, "staging-project-decision.md"), "utf8");
const comparison = await readFile(resolve(root, "staging-project-options-comparison.md"), "utf8");
const secrets = await readFile(resolve(root, "secret-inventory.md"), "utf8");
const board = await readFile(resolve(root, "human-action-board.md"), "utf8");
const summary = await readFile(resolve(root, "final-summary.md"), "utf8");

assert.match(inventory, /not selectable by inference/);
assert.match(project, /Decision pending options comparison/);
assert.match(comparison, /A\. New Staging project/);
assert.match(comparison, /B1\. Existing ACTIVE Core project/);
assert.match(comparison, /B2\. Existing INACTIVE sandbox project/);
assert.match(comparison, /Decision pending human evidence/);
assert.match(secrets, /Sensitive secrets: 3/);
assert.match(secrets, /Protected configuration and approval entries: 4/);
assert.match(board, /\| 7\. Approve and execute one deploy\/E2E window/);
assert.match(summary, /CONDITIONAL PASS/);
assert.doesNotMatch(`${inventory}\n${project}\n${comparison}\n${secrets}\n${board}\n${summary}`, /postgres(?:ql)?:\/\/[^\s]+|sb_secret_[^\s]+/i);
process.stdout.write("RESULT staging provisioning package compares existing and new project options without selection PASS\n");
