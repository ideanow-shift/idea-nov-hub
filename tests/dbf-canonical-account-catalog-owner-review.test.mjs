import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260815090000_dbf_canonical_account_catalog_owner_review.sql", import.meta.url), "utf8");
const domain = fs.readFileSync(new URL("../supabase/functions/dbf-business-data-api/domain.ts", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../supabase/functions/dbf-business-data-api/index.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../portal/management-app/dbf-account-mapping-review.js", import.meta.url), "utf8");

test("migration is additive, transactional and has no rollback", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /\b(drop|truncate)\b\s+(table|schema)/i);
  assert.doesNotMatch(migration, /\brollback\b/i);
});
test("review tables are private, forced RLS and browser roles have no grants", () => {
  for (const table of ["account_mapping_review_candidates", "account_mapping_review_audit"]) {
    assert.match(migration, new RegExp(`alter table dbf_ingest\\.${table} force row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on dbf_ingest\\.${table} from public,anon,authenticated,service_role`, "i"));
  }
  assert.doesNotMatch(migration, /grant\s+(delete|truncate)/i);
});
test("corporate scope is exactly 71 PL plus 67 BS and store detail is only a future count", () => {
  assert.match(migration, /source_row_category='aggregate'/);
  assert.match(migration, /source_row_category='detail'/);
  assert.match(migration, /v_count <> 138/);
  assert.match(ui, /店舗別P\/Lは対象外/);
  assert.match(ui, /営業店舗20（DIRECT 13・FC 7）/);
});
test("owner decisions, semantics and audit are explicit and promotion remains disabled", () => {
  for (const value of ["APPROVE", "EDIT_AND_APPROVE", "EXCLUDE", "NEEDS_REVIEW", "POSTABLE_DETAIL", "DERIVED_SUBTOTAL", "CONTROL_TOTAL", "DISPLAY_ONLY"]) {
    assert.ok(migration.includes(value)); assert.ok(ui.includes(value));
  }
  assert.match(migration, /DBF_ACCOUNT_REVIEW_AUDIT_APPEND_ONLY/);
  assert.match(ui, /Promotion disabled/);
  assert.doesNotMatch(ui, /\.promote\s*\(/);
});
test("backend resolves actor and rejects arbitrary company scope", () => {
  assert.match(domain, /COMPANY_SCOPE_REJECTED/);
  assert.match(api, /p_actor_employee_id: actorEmployeeId/);
  assert.doesNotMatch(domain, /actorEmployeeId/);
});
test("no production project or production Supabase reference is introduced", () => {
  const joined=[migration,domain,api,ui].join("\n");
  assert.doesNotMatch(joined,/nkmxevmioczcmnldreyo|idea-nov-core/);
  assert.doesNotMatch(joined,/service_role[^\n]*(browser|localStorage|sessionStorage)/i);
});
