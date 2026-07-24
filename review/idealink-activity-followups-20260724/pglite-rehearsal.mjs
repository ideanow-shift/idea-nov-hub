import { readFile } from "node:fs/promises";
import { PGlite } from "../../../nov-talent-controlled-recovery-fc51aa2-20260719/review/nov-talent-prospective-canonical-operation-20260719/pglite-fixture/node_modules/@electric-sql/pglite/dist/index.js";

const migration = await readFile(new URL("../../supabase/idea-link-activity-followups-20260724.sql", import.meta.url), "utf8");
const db = new PGlite();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create table public.employees (id uuid primary key);
    create table public.stores (id uuid primary key);
  `);
  await db.exec(migration);
  const shape = await db.query(`
    select
      (select count(*) from information_schema.columns where table_schema='public' and table_name='idea_link_activity_followups') as column_count,
      (select relrowsecurity from pg_class where oid='public.idea_link_activity_followups'::regclass) as rls,
      has_table_privilege('service_role','public.idea_link_activity_followups','SELECT') as service_select,
      has_table_privilege('authenticated','public.idea_link_activity_followups','SELECT') as browser_select
  `);
  const row = shape.rows[0];
  if (Number(row.column_count) !== 11 || row.rls !== true || row.service_select !== true || row.browser_select !== false) {
    throw new Error("PGLITE_POSTCHECK_FAILED");
  }
  let incompatibleRejected = false;
  const incompatible = new PGlite();
  try {
    await incompatible.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create table public.employees (id uuid primary key);
      create table public.stores (id uuid primary key);
      create table public.idea_link_activity_followups (id uuid primary key);
    `);
    await incompatible.exec(migration);
  } catch {
    incompatibleRejected = true;
  } finally {
    await incompatible.close();
  }
  if (!incompatibleRejected) throw new Error("INCOMPATIBLE_OBJECT_ACCEPTED");
  console.log(JSON.stringify({
    migrationExecutionCount: 1,
    cleanMigrationPassed: true,
    incompatibleObjectRejected: true,
    persistence: false,
    PostgreSQL17EquivalenceProven: false,
    rawValuesIncluded: false,
  }));
} finally {
  await db.close();
}
