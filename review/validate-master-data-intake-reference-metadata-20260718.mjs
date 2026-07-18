import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const audit = JSON.parse(read("review/master-data-intake-reference-metadata-source-audit-20260718.json"));
const ledger = read("docs/core-employee-ledger-v1-review.md");
const jobTypes = read("supabase/job-types-stage1.sql");
const api = read("supabase/functions/nov-hub-api/index.ts");

const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
};

check("department candidate is source-backed", () => {
  assert.match(ledger, /department_code text not null unique/);
  assert.match(api, /department_no,department_code,department_name,is_active/);
});

check("position_code is not inferred", () => {
  assert.doesNotMatch(ledger, /position_code\s+text/);
  assert.equal(audit.references.position.candidateColumn, null);
  assert.equal(audit.references.position.existingIdentifierCandidate, "position_no");
});

check("position number is source-backed", () => {
  assert.match(ledger, /position_no text not null unique/);
  assert.match(api, /position_no,position_name,is_active/);
});

check("job type key uniqueness and nullability are represented", () => {
  assert.match(jobTypes, /job_type_key text unique/);
  assert.doesNotMatch(jobTypes, /job_type_key text not null unique/);
  assert.equal(audit.references.jobType.sourceProposesNotNull, false);
});

check("runtime consumes job type key", () => {
  assert.match(api, /job_type_key,job_type_name,sort_order,is_active/);
});

check("unsafe fallback remains disabled", () => {
  assert.equal(audit.sharedPolicyCandidate.displayNameFallback, false);
  assert.equal(audit.sharedPolicyCandidate.aliasFallback, false);
});

check("all runtime gates remain stopped", () => {
  assert.equal(audit.runtimeChangeAuthorized, false);
  assert.ok(audit.stops.includes("production_SELECT_DB"));
  assert.ok(audit.stops.includes("deploy_push_publish"));
});

console.log(JSON.stringify({
  result: "DATA_INTAKE_REFERENCE_METADATA_SOURCE_AUDIT_PASS",
  checkCount: checks.length,
  evidenceMode: audit.evidenceMode,
  runtimeChangeCount: 0,
  productionAccessCount: 0,
  mutationCount: 0
}));
