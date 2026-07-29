import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("store history migration is additive and keeps UUIDs immutable", async () => {
  const sql = await read("../migration/V001__store_history.sql");
  assert.match(sql, /create table if not exists public\.store_operation_history/i);
  assert.match(sql, /references public\.stores\(id\) on delete restrict/i);
  assert.match(sql, /exclude using gist/i);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /update public\.stores/i);
  assert.doesNotMatch(sql, /delete from public\.stores/i);
});

test("RLS candidate has explicit scoped policies and no delete policy", async () => {
  const sql = await read("../migration/V002__rls_policy.sql");
  assert.match(sql, /store_operation_history_select_scoped/i);
  assert.match(sql, /store_operation_history_insert_representative_executive/i);
  assert.match(sql, /store_operation_history_update_representative_executive/i);
  assert.match(sql, /role_key = 'store_manager'/i);
  assert.match(sql, /role_key = 'fc_owner'/i);
  assert.match(sql, /Department managers receive no policy/i);
  assert.doesNotMatch(sql, /for delete/i);
});

test("runbook keeps deployment and UUID remediation gated", async () => {
  const [runbook, uuid] = await Promise.all([
    read("../docs/core_db_remediation/06-migration-runbook.md"),
    read("../docs/core_db_remediation/02-uuid-remediation.md")
  ]);
  assert.match(runbook, /not authorization to execute/i);
  assert.match(uuid, /not\s+possible\s+to\s+prove/i);
  assert.match(uuid, /crosswalk/i);
});
