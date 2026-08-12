import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "../tmp/dbf-pglite-fixture/node_modules/@electric-sql/pglite/dist/index.js";

const migrationPath = new URL("../supabase/migrations/20260812105304_dbf_secure_session_handoff_store.sql", import.meta.url);
const migration = await fs.readFile(migrationPath, "utf8");
assert.match(migration, /^begin;[\s\S]*commit;\s*$/u);
assert.doesNotMatch(migration, /rollback;/u);
assert.doesNotMatch(migration, /\b(drop|truncate)\b/u);

const db = new PGlite();
try {
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  await db.exec(migration);
  const shape = (await db.query(`
    select
      (select count(*) from information_schema.tables where table_schema='dbf_handoff') as table_count,
      (select count(*) from pg_class where relnamespace='dbf_handoff'::regnamespace and relrowsecurity) as rls_count,
      (select count(*) from pg_class where relnamespace='dbf_handoff'::regnamespace and relforcerowsecurity) as force_rls_count,
      (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'dbf_staging_handoff_%_v1' and prosecdef) as security_definer_count,
      has_schema_privilege('anon','dbf_handoff','USAGE') as anon_schema,
      has_schema_privilege('authenticated','dbf_handoff','USAGE') as authenticated_schema,
      has_function_privilege('anon','public.dbf_staging_handoff_consume_v1(text,text,text,text,text,text,timestamptz,uuid)','EXECUTE') as anon_consume,
      has_function_privilege('authenticated','public.dbf_staging_handoff_consume_v1(text,text,text,text,text,text,timestamptz,uuid)','EXECUTE') as authenticated_consume,
      has_function_privilege('service_role','public.dbf_staging_handoff_consume_v1(text,text,text,text,text,text,timestamptz,uuid)','EXECUTE') as service_consume
  `)).rows[0];
  assert.equal(Number(shape.table_count), 2);
  assert.equal(Number(shape.rls_count), 2);
  assert.equal(Number(shape.force_rls_count), 2);
  assert.equal(Number(shape.security_definer_count), 0);
  assert.equal(shape.anon_schema, false);
  assert.equal(shape.authenticated_schema, false);
  assert.equal(shape.anon_consume, false);
  assert.equal(shape.authenticated_consume, false);
  assert.equal(shape.service_consume, true);

  const issuedAt = "2026-08-12T04:00:00Z";
  await db.query(`select * from public.dbf_staging_handoff_issue_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [
    "a".repeat(43), "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002",
    "2026-08-12T05:00:00Z", "hub_session", "DBF_STAGING", "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app",
    "dbf_staging_handoff_exchange_v1", "b".repeat(43), "c".repeat(43), "00000000-0000-4000-8000-000000000003",
    issuedAt, "2026-08-12T04:01:00Z"
  ]);
  const first = await db.query(`select * from public.dbf_staging_handoff_consume_v1($1,$2,$3,$4,$5,$6,$7,$8)`, [
    "a".repeat(43), "b".repeat(43), "c".repeat(43), "DBF_STAGING",
    "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app", "dbf_staging_handoff_exchange_v1",
    "2026-08-12T04:00:30Z", "00000000-0000-4000-8000-000000000004"
  ]);
  assert.equal(first.rows.length, 1);
  const replay = await db.query(`select * from public.dbf_staging_handoff_consume_v1($1,$2,$3,$4,$5,$6,$7,$8)`, [
    "a".repeat(43), "b".repeat(43), "c".repeat(43), "DBF_STAGING",
    "https://idea-nov-dbf-staging-ui-om6tepo36q-an.a.run.app", "dbf_staging_handoff_exchange_v1",
    "2026-08-12T04:00:31Z", "00000000-0000-4000-8000-000000000005"
  ]);
  assert.equal(replay.rows.length, 0);
  const audit = await db.query("select event_type from dbf_handoff.audit_events order by occurred_at");
  assert.deepEqual(audit.rows.map((row) => row.event_type), ["ISSUED", "CONSUMED"]);
  console.log("dbf secure session handoff fresh postgres: PASS");
} finally {
  await db.close();
}
