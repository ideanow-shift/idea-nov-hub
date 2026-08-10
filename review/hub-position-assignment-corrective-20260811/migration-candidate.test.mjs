import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("./public-position-assignment-additive-migration-candidate.sql", import.meta.url),
  "utf8",
);

assert.match(sql, /^begin;$/m);
assert.match(sql, /^rollback;$/m);
assert.doesNotMatch(sql, /^\s*(insert|update|delete|merge|grant|call)\b/im);
assert.doesNotMatch(sql, /create\s+extension/i);
assert.match(sql, /alter table public\.positions[\s\S]*add column position_class text/);
assert.match(sql, /create table public\.organization_assignment_types/);
assert.match(sql, /create table public\.employee_organization_assignments/);
assert.match(sql, /target_type in \('corporation', 'business_unit', 'department', 'store'\)/);
assert.match(sql, /num_nonnulls\(corporation_id, business_unit_id, department_id, store_id\) = 1/);
assert.match(sql, /employee_organization_assignments_semantic_period_excl/);
assert.match(sql, /assignment_type_id with =,[\s\S]*target_type with =,[\s\S]*coalesce\(corporation_id, business_unit_id, department_id, store_id\)/);
assert.match(sql, /employee_organization_assignments_primary_period_excl/);
assert.match(sql, /where \(is_active and is_primary\)/);
assert.match(sql, /public\.employee_store_assignments/);
assert.doesNotMatch(sql, /assignment_order\s+(smallint|integer)/i);
assert.doesNotMatch(sql, /assignment_type\s+text\s+not null default 'primary'/i);
assert.match(sql, /enable row level security/g);
assert.match(sql, /revoke all on public\.organization_assignment_types from public, anon, authenticated/);
assert.match(sql, /revoke all on public\.employee_organization_assignments from public, anon, authenticated/);

console.log("position-assignment migration candidate fixtures: pass");
