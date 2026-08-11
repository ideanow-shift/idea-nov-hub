import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const enabled = process.env.NOV_TALENT_RUN_RECRUITING_TARGET_DB_TEST === "1";
const pgBin = process.env.NOV_TALENT_PG_BIN;
const childEnv = { ...process.env, LANG: "C", LC_ALL: "C", PGCLIENTENCODING: "UTF8", TZ: "UTC" };

function command(executable, args, input, allowFailure = false) {
  const result = spawnSync(executable, args, {
    cwd: root, encoding: "utf8", env: childEnv, input,
    maxBuffer: 32 * 1024 * 1024, windowsHide: true
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

test("Recruiting Target migration enforces versioned approval and security on Fresh PostgreSQL 17", {
  skip: !enabled && "set NOV_TALENT_RUN_RECRUITING_TARGET_DB_TEST=1",
  timeout: 240_000
}, async () => {
  assert.ok(pgBin, "NOV_TALENT_PG_BIN is required");
  const migration = await readFile(path.join(root, "supabase/migrations/20260811050625_nov_talent_recruiting_target_foundation.sql"), "utf8");
  const rollback = await readFile(path.join(root, "supabase/migrations/review_only/20260811050625_nov_talent_recruiting_target_foundation.rollback.sql"), "utf8");
  const dir = await mkdtemp(path.join(os.tmpdir(), "nov-talent-target-pg17-"));
  const port = 59400 + (process.pid % 400);
  const exe = (name) => path.join(pgBin, `${name}.exe`);
  let started = false;
  const psql = (sql, allowFailure = false) => command(exe("psql"), [
    "-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", "127.0.0.1", "-p", String(port),
    "-U", "postgres", "-d", "nov_talent_target"
  ], sql, allowFailure);
  try {
    command(exe("initdb"), ["-D", dir, "-U", "postgres", "-A", "trust", "--encoding=SQL_ASCII", "--locale=C"]);
    const server = spawn(exe("postgres"), ["-D", dir, "-p", String(port), "-h", "127.0.0.1"], {
      detached: true, env: childEnv, stdio: "ignore", windowsHide: true
    });
    server.unref();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (command(exe("pg_isready"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres"], undefined, true).status === 0) {
        started = true; break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(started, "Fresh PostgreSQL did not become ready");
    command(exe("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-T", "template0", "-E", "UTF8", "--locale=C", "nov_talent_target"]);
    psql("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
    psql(migration);

    assert.equal(psql(`
      select relrowsecurity::text||'|'||relforcerowsecurity::text from pg_class where oid='public.nov_talent_recruiting_targets_v1'::regclass;
      select has_table_privilege('service_role','public.nov_talent_recruiting_targets_v1','select')::text||'|'||has_table_privilege('service_role','public.nov_talent_recruiting_targets_v1','insert')::text;
      select has_function_privilege('authenticated','public.nov_talent_approve_recruiting_target_v1(uuid,text,uuid,integer)','execute')::text||'|'||has_function_privilege('service_role','public.nov_talent_approve_recruiting_target_v1(uuid,text,uuid,integer)','execute')::text;
    `).stdout.trim().replaceAll("\r", ""), "true|true\ntrue|false\nfalse|true");

    const actor = "00000000-0000-4000-8000-000000000009";
    const behavior = psql(`
      do $test$
      declare v1 uuid; v2 uuid; v_overlap uuid;
      begin
        select target_id into v1 from public.nov_talent_create_recruiting_target_draft_v1(
          '${actor}','hr.admin',2028,'OFFERED','FY2028','2028-04-01','2029-03-31','COMPANY',0,'2028-04-01','2029-03-31','Initial approved zero');
        perform * from public.nov_talent_approve_recruiting_target_v1('${actor}','hr.admin',v1,1);
        if (select target_count from public.nov_talent_recruiting_targets_v1 where target_id=v1) <> 0 then raise exception 'formal_zero_lost'; end if;

        select target_id into v2 from public.nov_talent_create_recruiting_target_draft_v1(
          '${actor}','hr.admin',2028,'OFFERED','FY2028','2028-04-01','2029-03-31','COMPANY',12,'2028-04-01','2029-03-31','Owner approved revision');
        begin
          perform * from public.nov_talent_approve_recruiting_target_v1('${actor}','hr.admin',v2,99);
          raise exception 'stale_version_accepted';
        exception when sqlstate '40001' then null; end;
        perform * from public.nov_talent_approve_recruiting_target_v1('${actor}','hr.admin',v2,1);
        if (select record_state from public.nov_talent_recruiting_targets_v1 where target_id=v1) <> 'SUPERSEDED'
          or (select record_state from public.nov_talent_recruiting_targets_v1 where target_id=v2) <> 'APPROVED'
          or (select count(*) from public.nov_talent_recruiting_targets_v1 where graduation_year=2028 and target_type='OFFERED' and record_state='APPROVED') <> 1
          or (select count(*) from public.nov_talent_recruiting_target_audit_v1) <> 5
        then raise exception 'atomic_version_approval_failed'; end if;

        select target_id into v_overlap from public.nov_talent_create_recruiting_target_draft_v1(
          '${actor}','hr.admin',2028,'OFFERED','CAL2029','2029-01-01','2029-12-31','COMPANY',15,'2029-01-01','2029-12-31','Overlapping period');
        begin
          perform * from public.nov_talent_approve_recruiting_target_v1('${actor}','hr.admin',v_overlap,1);
          raise exception 'overlap_accepted';
        exception when sqlstate '23P01' then null; end;
        begin
          perform * from public.nov_talent_create_recruiting_target_draft_v1('${actor}','hr.admin',2028,'EXPECTED_JOIN','FY2028','2028-04-01','2029-03-31','COMPANY',1,'2028-04-01','2029-03-31','Forbidden phase');
          raise exception 'phase1_type_accepted';
        exception when sqlstate '22023' then null; end;
        begin
          perform * from public.nov_talent_create_recruiting_target_draft_v1('${actor}','hr.admin',2028,'OFFERED','FY2028','2028-04-01','2029-03-31','STORE',1,'2028-04-01','2029-03-31','Forbidden scope');
          raise exception 'phase1_scope_accepted';
        exception when sqlstate '22023' then null; end;
        begin
          update public.nov_talent_recruiting_targets_v1 set target_count=99 where target_id=v2;
          raise exception 'approved_update_accepted';
        exception when sqlstate '55000' then null; end;
        begin
          delete from public.nov_talent_recruiting_targets_v1 where target_id=v2;
          raise exception 'target_delete_accepted';
        exception when sqlstate '55000' then null; end;
        begin
          update public.nov_talent_recruiting_target_audit_v1 set actor_role='backoffice';
          raise exception 'audit_update_accepted';
        exception when sqlstate '55000' then null; end;
      end $test$;

      set role service_role;
      do $service$
      begin
        begin
          insert into public.nov_talent_recruiting_targets_v1(graduation_year,target_type,target_period_code,target_period_start,target_period_end,scope_type,target_count,version,record_state,effective_from,effective_to,reason,created_by)
          values(2029,'OFFERED','FY2029','2029-04-01','2030-03-31','COMPANY',1,1,'DRAFT','2029-04-01','2030-03-31','Direct forbidden','${actor}');
          raise exception 'service_role_insert_accepted';
        exception when sqlstate '42501' then null; end;
      end $service$;
      reset role;
      select count(*)||'|'||count(*) filter(where record_state='APPROVED')||'|'||(select count(*) from public.nov_talent_recruiting_target_audit_v1) from public.nov_talent_recruiting_targets_v1;
    `).stdout.trim();
    assert.equal(behavior.replaceAll("\r", "").split("\n").at(-1), "3|1|6");

    const guarded = psql(rollback, true);
    assert.notEqual(guarded.status, 0, "rollback must refuse when business rows exist");
    assert.match(`${guarded.stdout}\n${guarded.stderr}`, /RECRUITING_TARGET_ROLLBACK_REQUIRES_EMPTY_TABLES/);
  } finally {
    if (started) command(exe("pg_ctl"), ["-D", dir, "stop", "-m", "immediate"], undefined, true);
    await rm(dir, { recursive: true, force: true });
  }
});
