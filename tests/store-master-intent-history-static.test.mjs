import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const productionReadiness = path.join(root, "docs", "core_db_remediation", "production_readiness");
const audit = fs.readFileSync(path.join(productionReadiness, "store-master-intent-history-audit.md"), "utf8");
const evidence = fs.readFileSync(path.join(productionReadiness, "store-master-intent-evidence.csv"), "utf8");
const options = fs.readFileSync(path.join(productionReadiness, "store-master-decision-options.md"), "utf8");

test("does not convert source history absence into a core-store decision", () => {
  assert.match(audit, /Decision: `unresolved`/);
  assert.match(audit, /does not prove that a `core\.stores` object does not exist/);
  assert.match(audit, /core-future is unproven/);
});

test("contains all requested decision options and an evidence header", () => {
  ["Option A", "Option B", "Option C", "Option D"].forEach((name) => assert.match(options, new RegExp(name)));
  assert.match(evidence, /^evidence_no,evidence_level,evidence_type,date_or_commit,branch,file_path,evidence_summary,supports_public_current,supports_core_future,supports_public_canonical,supports_core_canonical,supports_abandon_core,supports_dual_master,contradiction_flag,notes/m);
  const columns = evidence.trim().split(/\r?\n/).map((line) => line.split(",").length);
  assert.ok(columns.every((count) => count === 15));
});

test("does not disclose UUIDs secrets or Windows absolute paths", () => {
  const fullUuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  const windowsPath = /[A-Z]:\\/i;
  [audit, evidence, options].forEach((content) => {
    assert.equal(fullUuid.test(content), false);
    assert.equal(windowsPath.test(content), false);
  });
});
