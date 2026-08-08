import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const enabled = process.env.NOV_TALENT_RUN_POPULATION_EXECUTOR_DB_TEST === "1";
const pgBin = process.env.NOV_TALENT_PG_BIN;
const privateManifestPath = process.env.NOV_TALENT_PRIVATE_MANIFEST_PATH;
const childEnv = { ...process.env, LANG: "C", LC_ALL: "C", PGCLIENTENCODING: "UTF8", TZ: "UTC" };

function command(executable, args, input, allowFailure = false) {
  const result = spawnSync(executable, args, {
    cwd: root, encoding: "utf8", env: childEnv, input, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
  });
  if (!allowFailure && result.status !== 0) throw new Error(`${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function quoteManifest(value) {
  const delimiter = "$manifest_v2_private$";
  assert.equal(value.includes(delimiter), false);
  return `${delimiter}${value}${delimiter}::jsonb`;
}

const baseline = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema nov_talent_internal;
revoke all on schema nov_talent_internal from public, anon, authenticated;
grant usage on schema nov_talent_internal to service_role;
create table public.nov_talent_candidate_datasets_v1(dataset_id uuid primary key, state text not null);
create table public.nov_talent_candidate_dataset_records_v1(
  dataset_id uuid not null references public.nov_talent_candidate_datasets_v1(dataset_id),
  candidate_id uuid not null, graduation_year integer not null, source_row_no integer not null,
  source_reference_hash text not null, source_type text not null,
  primary key(dataset_id,candidate_id)
);
create table public.nov_talent_candidates_v1(
  candidate_id uuid primary key, graduation_year integer not null, student_name text not null,
  school_name text, current_status_code text, acquisition_source text,
  version integer not null default 1, is_active boolean not null default true
);
create table public.nov_talent_fair_masters_v1(
  fair_id uuid primary key, fair_name text not null, event_date date,
  version integer not null default 1, is_active boolean not null default true
);
`;

test("population executor migration compiles and its negative guards execute on Fresh PostgreSQL 17", {
  skip: !enabled && "set NOV_TALENT_RUN_POPULATION_EXECUTOR_DB_TEST=1",
  timeout: 240_000,
}, async () => {
  assert.ok(pgBin, "NOV_TALENT_PG_BIN is required");
  assert.ok(privateManifestPath, "NOV_TALENT_PRIVATE_MANIFEST_PATH is required");
  const manifestText = await readFile(privateManifestPath, "utf8");
  const manifest = JSON.parse(manifestText);
  const manifestSql = quoteManifest(manifestText);
  const dir = await mkdtemp(path.join(os.tmpdir(), "nov-talent-population-v2-pg17-"));
  const port = 58400 + (process.pid % 500);
  const exe = (name) => path.join(pgBin, `${name}.exe`);
  let started = false;
  const psql = (sql, allowFailure = false) => command(exe("psql"), [
    "-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", "127.0.0.1", "-p", String(port),
    "-U", "postgres", "-d", "nov_talent_population_v2",
  ], sql, allowFailure);
  try {
    command(exe("initdb"), ["-D", dir, "-U", "postgres", "-A", "trust", "--encoding=SQL_ASCII", "--locale=C"]);
    const server = spawn(exe("postgres"), ["-D", dir, "-p", String(port), "-h", "127.0.0.1"], {
      detached: true, env: childEnv, stdio: "ignore", windowsHide: true,
    });
    server.unref();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (command(exe("pg_isready"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres"], undefined, true).status === 0) {
        started = true; break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(started, "Fresh PostgreSQL did not start");
    command(exe("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-T", "template0", "-E", "UTF8", "--locale=C", "nov_talent_population_v2"]);
    psql(baseline);
    psql(await readFile(path.join(root, "supabase/migrations/20260807210000_nov_talent_fair_attribution_review_workflow.sql"), "utf8"));
    const executorMigration = await readFile(path.join(root, "supabase/migrations/20260808083816_nov_talent_fair_attribution_population_executor_v2.sql"), "utf8");
    const executorRollback = await readFile(path.join(root, "review/nov-talent-fair-attribution-population-v2/rollback-population-executor-v2.sql"), "utf8");
    psql(executorMigration);

    const executorCatalog = () => psql(`
      select pg_get_function_identity_arguments(p.oid)||'|'||p.prosecdef::text||'|'||
             coalesce(array_to_string(p.proconfig,','),'')||'|'||coalesce(p.proacl::text,'')
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='nov_talent_population_fair_attribution_queue_v2';
    `).stdout.trim();
    const initialCatalog = executorCatalog();

    psql(executorRollback);
    assert.equal(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='nov_talent_population_fair_attribution_queue_v2';`).stdout.trim(), "0");
    assert.equal(psql(`select (to_regclass('public.nov_talent_candidate_fair_attributions_v1') is not null)::text||'|'||(to_regclass('public.nov_talent_candidate_fair_attribution_audit_v1') is not null)::text;`).stdout.trim(), "true|true");
    assert.equal(psql(`select (to_regclass('public.nov_talent_candidates_v1') is not null)::text||'|'||(to_regclass('public.nov_talent_fair_masters_v1') is not null)::text;`).stdout.trim(), "true|true");

    psql(executorMigration);
    assert.equal(executorCatalog(), initialCatalog);

    assert.equal(psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='nov_talent_population_fair_attribution_queue_v2';`).stdout.trim(), "1");
    assert.equal(psql(`select has_function_privilege('service_role','public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb)','execute');`).stdout.trim(), "t");
    assert.equal(psql(`select has_function_privilege('anon','public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb)','execute');`).stdout.trim(), "f");
    assert.equal(psql(`select has_function_privilege('authenticated','public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb)','execute');`).stdout.trim(), "f");
    assert.match(psql(`select array_to_string(proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='nov_talent_population_fair_attribution_queue_v2';`).stdout.trim(), /search_path=/);

    const wrongHost = psql(`
      select set_config('request.headers','{"host":"nkmxevmioczcmnldreyo.supabase.co"}',false);
      select set_config('request.jwt.claims','{"role":"service_role"}',false);
      select * from public.nov_talent_population_fair_attribution_queue_v2(
        '00000000-0000-4000-8000-000000000009','hr.admin','idea-nov-staging',
        'ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b','{}'::jsonb);
    `, true);
    assert.notEqual(wrongHost.status, 0);
    assert.match(wrongHost.stderr, /population_v2_staging_host_required/);

    const wrongRole = psql(`
      select set_config('request.headers','{"host":"zgkoofphhivesclehrom.supabase.co"}',false);
      select set_config('request.jwt.claims','{"role":"authenticated"}',false);
      select * from public.nov_talent_population_fair_attribution_queue_v2(
        '00000000-0000-4000-8000-000000000009','hr.admin','idea-nov-staging',
        'ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b','{}'::jsonb);
    `, true);
    assert.notEqual(wrongRole.status, 0);
    assert.match(wrongRole.stderr, /population_v2_service_role_required/);

    const missingSnapshot = psql(`
      select set_config('request.headers','{"host":"zgkoofphhivesclehrom.supabase.co"}',false);
      select set_config('request.jwt.claims','{"role":"service_role"}',false);
      select * from public.nov_talent_population_fair_attribution_queue_v2(
        '00000000-0000-4000-8000-000000000009','hr.admin','idea-nov-staging',
        'ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b',${manifestSql});
    `, true);
    assert.notEqual(missingSnapshot.status, 0);
    assert.match(missingSnapshot.stderr, /population_v2_candidate_snapshot_count_mismatch/);

    const tampered = structuredClone(manifest);
    tampered.cases[0].source_rows[0] += 1;
    const tamperedPair = psql(`
      select set_config('request.headers','{"host":"zgkoofphhivesclehrom.supabase.co"}',false);
      select set_config('request.jwt.claims','{"role":"service_role"}',false);
      select * from public.nov_talent_population_fair_attribution_queue_v2(
        '00000000-0000-4000-8000-000000000009','hr.admin','idea-nov-staging',
        'ecbadebb2a4b6bb6e0d4484193bd4088bc9f36ebf9fdbe8b56f8634be604d34b',${quoteManifest(JSON.stringify(tampered))});
    `, true);
    assert.notEqual(tamperedPair.status, 0);
    assert.match(tamperedPair.stderr, /population_v2_pair_payload_hash_mismatch/);

    assert.equal(psql(`select (select count(*) from public.nov_talent_candidate_fair_attributions_v1)::text||'|'||(select count(*) from public.nov_talent_candidate_fair_attribution_audit_v1)::text;`).stdout.trim(), "0|0");
    assert.equal(psql(`select current_setting('server_version_num')::integer >= 170000;`).stdout.trim(), "t");
  } finally {
    if (started) command(exe("pg_ctl"), ["-D", dir, "-m", "immediate", "-w", "stop"], undefined, true);
    await rm(dir, { recursive: true, force: true });
  }
});
