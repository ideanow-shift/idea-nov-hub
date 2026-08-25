import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync("supabase/migrations/20260825083612_production_core_access_containment_v1.sql", "utf8");
const rollback = fs.readFileSync("supabase/rollback/production_core_access_containment_v1.rollback.sql", "utf8");
const tables = ["account_titles","corporations","departments","employee_roles","employees","positions","roles","stores","vendors"];

test("all nine Core tables receive RLS and FORCE RLS", () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table core\\.${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`alter table core\\.${table} force row level security`, "i"));
  }
});

test("browser table privileges are revoked and service read is explicit", () => {
  assert.match(migration, /from public,anon,authenticated/i);
  assert.match(migration, /to service_role/i);
});

test("critical write-capable definer functions are service-only", () => {
  for (const signature of ["dev_seed_employee\\(text,text,text,text\\)", "link_employee_to_auth_user\\(text\\)"]) {
    assert.match(migration, new RegExp(`revoke execute on function core\\.${signature} from public,anon,authenticated`, "i"));
    assert.match(migration, new RegExp(`grant execute on function core\\.${signature} to service_role`, "i"));
  }
});

test("authorization helpers have fixed search paths", () => {
  for (const name of ["current_employee_id","current_employee_has_any_role","current_employee_profile","employee_admin_options","permission_admin_options","has_role","has_global_role","has_scoped_role","can_manage_permissions"]) {
    assert.match(migration, new RegExp(`alter function core\\.${name}\\([^;]*set search_path=pg_catalog`, "is"));
  }
});

test("migration is metadata-only and rollback is explicit", () => {
  assert.doesNotMatch(migration, /\b(insert|update|delete|truncate)\s+(into|core\.)/i);
  assert.match(rollback, /disable row level security/i);
  assert.match(rollback, /grant select on table/i);
});
