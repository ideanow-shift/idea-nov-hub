import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../docs/store_operations_management/production_integration/store-corporation-effective-operator-rpc-v1.review-only.sql",
  import.meta.url,
), "utf8");
const candidate = readFileSync(new URL(
  "../supabase/functions/nov-hub-api/management_readonly_candidate.ts",
  import.meta.url,
), "utf8");

test("effective operator RPC resolves by fiscal month and canonical valid period", () => {
  assert.match(migration, /identity_access\.store_corporation_history_v1/u);
  assert.match(migration, /history\.valid_period\s+@>\s+month_scope\.fiscal_month/u);
  assert.match(migration, /history\.store_id\s+=\s+any \(p_store_ids\)/u);
  assert.doesNotMatch(migration, /public\.stores/u);
  assert.doesNotMatch(migration, /insert\s+into|update\s+|delete\s+from|truncate\s+/iu);
});

test("public RPC is invoker-only and privileged resolver stays in private schema", () => {
  assert.match(migration, /create or replace function identity_access\.store_corporation_effective_operator_range_read_internal_v1[\s\S]*security definer/u);
  assert.match(migration, /create or replace function public\.store_corporation_effective_operator_range_read_v1[\s\S]*security invoker/u);
  assert.match(migration, /set search_path = ''/u);
  assert.equal((migration.match(/owner to postgres/gu) || []).length, 2);
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated/u);
  assert.match(migration, /grant execute on function[\s\S]*to service_role/u);
  assert.match(migration, /grant usage on schema identity_access to service_role/u);
  assert.doesNotMatch(migration, /grant select on .*identity_access/iu);
});

test("RPC rejects invalid ranges, duplicate stores, zero UUID and oversized scope", () => {
  assert.match(migration, /23 months/u);
  assert.match(migration, /cardinality\(p_store_ids\) > 21/u);
  assert.match(migration, /count\(distinct scoped\.store_id\)/u);
  assert.match(migration, /00000000-0000-0000-0000-000000000000/u);
});

test("HUB candidate consumes effective operator mapping before accepting DBF rows", () => {
  assert.match(candidate, /store_corporation_effective_operator_range_read_v1/u);
  assert.match(candidate, /effectiveOperatorByStoreMonth/u);
  assert.match(candidate, /ownershipMismatchExcludedCount/u);
  assert.match(candidate, /history-unresolved-not-backcast/u);
});
