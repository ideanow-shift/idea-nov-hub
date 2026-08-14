import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "../tmp/dbf-pglite-fixture/node_modules/@electric-sql/pglite/dist/index.js";

const migrationUrls = [
  new URL("../supabase/migrations/20260814140109_dbf_business_data_phase1_foundation.sql", import.meta.url),
  new URL("../supabase/migrations/20260814204346_dbf_business_data_phase1_service_role_acl_corrective.sql", import.meta.url),
  new URL("../supabase/migrations/20260814213224_dbf_business_data_phase_c_runtime.sql", import.meta.url),
];
const migrations = await Promise.all(migrationUrls.map((url) => fs.readFile(url, "utf8")));
for (const migration of migrations) {
  assert.match(migration, /\bbegin;[\s\S]*commit;\s*$/iu);
  assert.doesNotMatch(migration, /rollback;/iu);
}

const db = new PGlite();
try {
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  for (const migration of migrations) await db.exec(migration);

  const shape = (await db.query(`
    select
      (select count(*) from dbf_ingest.metric_definitions where definition_version = 'v1') as metric_count,
      (select count(*) from pg_proc where pronamespace='public'::regnamespace
        and proname like 'dbf_import_%_v1' and prosecdef) as security_definer_count,
      has_function_privilege('anon','public.dbf_import_history_v1(date,text,integer)','EXECUTE') as anon_history,
      has_function_privilege('authenticated','public.dbf_import_history_v1(date,text,integer)','EXECUTE') as authenticated_history,
      has_function_privilege('service_role','public.dbf_import_history_v1(date,text,integer)','EXECUTE') as service_history,
      (select count(*) from public.dbf_pl_detail_facts)
        + (select count(*) from public.dbf_pl_aggregate_facts)
        + (select count(*) from public.dbf_bs_facts)
        + (select count(*) from public.dbf_store_monthly_metric_facts)
        + (select count(*) from public.dbf_budget_facts) as fact_rows
  `)).rows[0];
  assert.equal(Number(shape.metric_count), 19);
  assert.equal(Number(shape.security_definer_count), 9);
  assert.equal(shape.anon_history, false);
  assert.equal(shape.authenticated_history, false);
  assert.equal(shape.service_history, true);
  assert.equal(Number(shape.fact_rows), 0);

  await db.exec("begin");
  await db.query(`select public.dbf_import_start_v1(
    $1::uuid,
    jsonb_build_object('sha256',$2::text,'byteSize',64,'originalFileName','pilot.csv','mediaType','text/csv'),
    'pl', date '2026-07-01', 'normalized_csv', 'pilot-csv-v1',
    jsonb_build_array(jsonb_build_object(
      'sourceRowNumber',1,
      'payload',jsonb_build_object('company','IDEA NOV','accountCode','4000','amount',1000),
      'payloadSha256',$3::text
    )), null, null
  )`, [
    "11111111-1111-4111-8111-111111111111",
    "a".repeat(64),
    "b".repeat(64),
  ]);
  assert.equal(Number((await db.query("select count(*) as count from dbf_ingest.import_batches")).rows[0].count), 1);
  await db.exec("rollback");
  assert.equal(Number((await db.query("select count(*) as count from dbf_ingest.import_batches")).rows[0].count), 0);
  assert.equal(Number((await db.query("select count(*) as count from public.dbf_pl_detail_facts")).rows[0].count), 0);
  console.log("dbf business data Phase C fresh postgres-compatible runtime: PASS");
} finally {
  await db.close();
}
