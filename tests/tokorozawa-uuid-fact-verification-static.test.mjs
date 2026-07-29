import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const reportPath = path.join(root, "docs", "core_db_remediation", "production_readiness", "tokorozawa-uuid-fact-verification.md");
const evidencePath = path.join(root, "docs", "core_db_remediation", "production_readiness", "tokorozawa-uuid-evidence.csv");
const report = fs.readFileSync(reportPath, "utf8");
const evidence = fs.readFileSync(evidencePath, "utf8");

test("records unresolved rather than inventing a canonical UUID", () => {
  assert.match(report, /Decision: `unresolved`/);
  assert.match(report, /Strong evidence: observed count 0/);
  assert.match(report, /No canonical Tokorozawa UUID is recommended/);
});

test("keeps the required audit evidence structure", () => {
  assert.match(report, /Required human confirmation/);
  assert.match(evidence, /^evidence_no,evidence_type,evidence_level,schema_name,object_name,referenced_uuid_side,reference_kind,evidence_summary,source_path,supports_canonical,blocking_flag/m);
  assert.match(evidence, /U01,missing_strong_evidence,Strong/);
});

test("does not disclose a full UUID", () => {
  const fullUuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  assert.equal(fullUuid.test(report), false);
  assert.equal(fullUuid.test(evidence), false);
});
