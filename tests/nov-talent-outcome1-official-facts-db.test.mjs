import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const enabled = process.env.NOV_TALENT_RUN_OUTCOME1_DB_TEST === "1";
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

const baseline = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema nov_talent_internal;
create table public.nov_talent_candidates_v1(
  candidate_id uuid primary key default gen_random_uuid(), graduation_year smallint not null,
  student_name text not null, student_name_kana text, school_name text, faculty_name text,
  phone text, email text, line_identifier text, current_status_code text,
  acquisition_source text, assigned_to text, notes text, source_type text, source_row_no integer,
  version integer not null default 1, is_active boolean not null default true,
  invalidated_reason text, invalidated_by_employee_id uuid, invalidated_at timestamptz,
  created_by_employee_id uuid not null, updated_by_employee_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nov_talent_candidate_audit_log_v1(
  audit_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1,
  action text not null, changed_fields text[] not null, before_values jsonb not null default '{}',
  after_values jsonb not null default '{}', actor_employee_id uuid not null,
  actor_role text not null, reason text not null, candidate_version integer not null,
  occurred_at timestamptz not null default now()
);
create table public.nov_talent_recruitment_events_v1(
  event_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1,
  event_code text not null constraint nov_talent_recruitment_events_v1_event_code_check
    check(event_code in('CONTACT_RECORDED','LINE_REGISTERED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED','INTERVIEW_PLANNED','INTERVIEW_COMPLETED')),
  event_date date not null, event_name text, event_state text not null default 'COMPLETED',
  contact_content text, assigned_to text, notes text, source_type text not null,
  source_row_no integer, source_field_code text not null, source_fingerprint text,
  version integer not null default 1, is_active boolean not null default true,
  invalidated_reason text, invalidated_by_employee_id uuid, invalidated_at timestamptz,
  created_by_employee_id uuid, updated_by_employee_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nov_talent_selection_history_v1(
  selection_history_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1,
  selection_code text not null constraint nov_talent_selection_history_v1_selection_code_check check(selection_code in(
    'APPLICATION_RECEIVED','SALON_TOUR_PLANNED','SALON_TOUR_COMPLETED','INTERVIEW_PLANNED',
    'INTERVIEW_COMPLETED','UNDER_REVIEW','OFFERED','OFFER_ACCEPTED','OFFERED_ELSEWHERE','WITHDRAWN','REJECTED')),
  effective_date date not null, assigned_to text, notes text, source_type text not null,
  source_row_no integer, source_field_code text not null, source_fingerprint text,
  version integer not null default 1, is_active boolean not null default true,
  invalidated_reason text, invalidated_by_employee_id uuid, invalidated_at timestamptz,
  created_by_employee_id uuid, updated_by_employee_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.nov_talent_recruitment_source_facts_v1(
  source_type text not null, source_row_no integer not null, fact_code text not null,
  fact_date date not null, source_fingerprint text not null, candidate_id uuid references public.nov_talent_candidates_v1,
  linked_at timestamptz, linked_by_employee_id uuid, link_reason text,
  version integer not null default 1, primary key(source_type,source_row_no,fact_code)
);
create table public.nov_talent_recruitment_activity_audit_v1(
  audit_id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.nov_talent_candidates_v1,
  entity_type text not null, entity_id text not null, action text not null,
  changed_fields text[] not null, before_values jsonb not null default '{}',
  after_values jsonb not null default '{}', actor_employee_id uuid not null,
  actor_role text not null, reason text not null, entity_version integer not null,
  occurred_at timestamptz not null default now()
);
alter table public.nov_talent_candidates_v1 enable row level security;
alter table public.nov_talent_recruitment_events_v1 enable row level security;
alter table public.nov_talent_selection_history_v1 enable row level security;
alter table public.nov_talent_recruitment_source_facts_v1 enable row level security;
alter table public.nov_talent_recruitment_activity_audit_v1 enable row level security;
create function public.nov_talent_link_source_fact_v1(uuid,text,text,text,integer,text,uuid,integer)
returns table(source_row_no integer,source_version integer) language sql as 'select 1,1';
grant execute on function public.nov_talent_link_source_fact_v1(uuid,text,text,text,integer,text,uuid,integer) to service_role;
grant select,insert,update on public.nov_talent_candidates_v1 to service_role;
grant select,insert,update on public.nov_talent_recruitment_events_v1 to service_role;
grant select,insert,update on public.nov_talent_selection_history_v1 to service_role;
grant select,insert,update,delete on public.nov_talent_recruitment_source_facts_v1 to service_role;
grant select,insert on public.nov_talent_recruitment_activity_audit_v1 to service_role;
`;

test("Outcome 1 migration compiles, enforces contracts, rolls back, and reapplies on Fresh PostgreSQL 17", {
  skip: !enabled && "set NOV_TALENT_RUN_OUTCOME1_DB_TEST=1",
  timeout: 240_000
}, async () => {
  assert.ok(pgBin, "NOV_TALENT_PG_BIN is required");
  const migration = await readFile(path.join(root, "supabase/migrations/20260808083752_nov_talent_official_recruiting_facts.sql"), "utf8");
  const rollback = await readFile(path.join(root, "supabase/rollback/20260808083752_nov_talent_official_recruiting_facts.rollback.sql"), "utf8");
  const dir = await mkdtemp(path.join(os.tmpdir(), "nov-talent-outcome1-pg17-"));
  const port = 58900 + (process.pid % 500);
  const exe = (name) => path.join(pgBin, `${name}.exe`);
  let started = false;
  const psql = (sql, allowFailure = false) => command(exe("psql"), [
    "-X", "-v", "ON_ERROR_STOP=1", "-At", "-h", "127.0.0.1", "-p", String(port),
    "-U", "postgres", "-d", "nov_talent_outcome1"
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
    assert.ok(started);
    command(exe("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-T", "template0", "-E", "UTF8", "--locale=C", "nov_talent_outcome1"]);
    psql(baseline);
    psql(migration);

    const catalog = () => psql(`
      select md5(string_agg(item,E'\\n' order by item)) from (
        select 'column|'||table_name||'|'||column_name||'|'||data_type item
        from information_schema.columns
        where table_schema='public' and table_name in (
          'nov_talent_candidates_v1','nov_talent_recruitment_source_facts_v1')
        union all
        select 'function|'||p.proname||'|'||pg_get_function_identity_arguments(p.oid)||'|'||p.prosecdef::text
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','nov_talent_internal')
          and (p.proname like 'nov_talent_%selection%' or p.proname like '%source_fact_evidence_v2')
        union all
        select 'trigger|'||event_object_table||'|'||trigger_name
        from information_schema.triggers where trigger_schema='public'
      ) q;
    `).stdout.trim();
    const firstCatalog = catalog();
    assert.equal(psql(`
      select (relforcerowsecurity::text) from pg_class
      where oid='public.nov_talent_selection_history_v1'::regclass;
      select has_table_privilege('service_role','public.nov_talent_selection_history_v1','insert');
      select has_table_privilege('service_role','public.nov_talent_recruitment_source_facts_v1','update');
    `).stdout.trim().replaceAll("\r", ""), "true\nf\nf");

    const actor = "00000000-0000-4000-8000-000000000009";
    const candidate = "00000000-0000-4000-8000-000000000001";
    const behavior = psql(`begin;
      insert into public.nov_talent_candidates_v1(
        candidate_id,graduation_year,student_name,current_status_code,source_type,
        created_by_employee_id,updated_by_employee_id
      ) values('${candidate}',2027,'fixture',null,'NOV_TALENT_UI','${actor}','${actor}');
      do $test$
      declare
        v_code text;
        v_version integer := 1;
        v_projection uuid;
      begin
        foreach v_code in array array[
          'OFFERED','APPLICATION_RECEIVED','REJECTED','INTERVIEW_PLANNED',
          'OFFER_ACCEPTED','INTERVIEW_COMPLETED','WITHDRAWN'
        ] loop
          perform * from public.nov_talent_append_selection_transition_v1(
            '${actor}','hr.admin','fixture','${candidate}',v_version,v_code,'2026-08-08',null,null);
          v_version := v_version + 1;
        end loop;
        perform * from public.nov_talent_append_selection_transition_v1(
          '${actor}','hr.admin','fixture','${candidate}',v_version,
          'APPLICATION_RECEIVED','2026-01-01',null,null);

        select selection_history_id into v_projection
        from public.nov_talent_selection_history_v1
        where candidate_id='${candidate}'
        order by effective_date desc,created_at desc,selection_history_id desc limit 1;
        if (select count(*) from public.nov_talent_selection_history_v1 where candidate_id='${candidate}') <> 8
          or (select count(*) from public.nov_talent_recruitment_activity_audit_v1
              where candidate_id='${candidate}' and entity_type='SELECTION') <> 8
          or (select count(*) from public.nov_talent_candidate_audit_log_v1 where candidate_id='${candidate}') <> 8
          or (select version from public.nov_talent_candidates_v1 where candidate_id='${candidate}') <> 9
          or (select current_status_selection_history_id from public.nov_talent_candidates_v1
              where candidate_id='${candidate}') is distinct from v_projection
        then raise exception 'selection_atomic_projection_contract_failed'; end if;

        begin
          perform * from public.nov_talent_append_selection_transition_v1(
            '${actor}','hr.admin','fixture','${candidate}',9,'UNKNOWN','2026-08-09',null,null);
          raise exception 'invalid_selection_code_was_accepted';
        exception when sqlstate '22023' then null; end;
        begin
          perform * from public.nov_talent_append_selection_transition_v1(
            '${actor}','hr.admin','fixture','${candidate}',1,'OFFERED','2026-08-09',null,null);
          raise exception 'stale_candidate_version_was_accepted';
        exception when sqlstate '40001' then null; end;
        begin
          update public.nov_talent_selection_history_v1 set notes='forbidden'
          where selection_history_id=v_projection;
          raise exception 'selection_update_was_accepted';
        exception when sqlstate '55000' then null; end;
        begin
          delete from public.nov_talent_selection_history_v1 where selection_history_id=v_projection;
          raise exception 'selection_delete_was_accepted';
        exception when sqlstate '55000' then null; end;
        begin
          update public.nov_talent_recruitment_activity_audit_v1 set reason='forbidden'
          where candidate_id='${candidate}';
          raise exception 'activity_audit_update_was_accepted';
        exception when sqlstate '55000' then null; end;
        begin
          delete from public.nov_talent_recruitment_activity_audit_v1 where candidate_id='${candidate}';
          raise exception 'activity_audit_delete_was_accepted';
        exception when sqlstate '55000' then null; end;
      end
      $test$;

      insert into public.nov_talent_recruitment_source_facts_v1(
        source_type,source_row_no,fact_code,fact_date,source_fingerprint
      ) values
        ('ENTRIES_27',42,'INTERVIEW_COMPLETED','2026-08-01',repeat('a',64)),
        ('ENTRIES_27',43,'OFFERED','2026-08-02',repeat('b',64));
      select * from public.nov_talent_link_source_fact_v2(
        '${actor}','hr.admin','fixture','ENTRIES_27',42,'INTERVIEW_COMPLETED',
        '${candidate}',9,1,'SOURCE:ENTRIES_27:ROW:42:INTERVIEW_COMPLETED','HUMAN_CONFIRMED');
      do $source_test$
      begin
        if (select count(*) from public.nov_talent_selection_history_v1 where candidate_id='${candidate}') <> 8
          or (select candidate_id from public.nov_talent_recruitment_source_facts_v1
              where source_type='ENTRIES_27' and source_row_no=42 and fact_code='INTERVIEW_COMPLETED')
             is distinct from '${candidate}'::uuid
          or (select evidence_hash from public.nov_talent_recruitment_source_facts_v1
              where source_type='ENTRIES_27' and source_row_no=42 and fact_code='INTERVIEW_COMPLETED')
             <> repeat('a',64)
        then raise exception 'source_link_contract_failed'; end if;
        begin
          perform * from public.nov_talent_link_source_fact_v2(
            '${actor}','hr.admin','fixture','ENTRIES_27',43,'OFFERED','${candidate}',9,1,
            'student@example.com','HUMAN_CONFIRMED');
          raise exception 'pii_evidence_was_accepted';
        exception when sqlstate '22023' then null; end;
        begin
          perform * from public.nov_talent_link_source_fact_v2(
            '${actor}','hr.admin','fixture','ENTRIES_27',43,'OFFERED','${candidate}',9,99,
            'SOURCE:ENTRIES_27:ROW:43:OFFERED','HUMAN_CONFIRMED');
          raise exception 'stale_source_version_was_accepted';
        exception when sqlstate '40001' then null; end;
        begin
          perform * from public.nov_talent_link_source_fact_v2(
            '${actor}','hr.admin','fixture','ENTRIES_27',42,'INTERVIEW_COMPLETED','${candidate}',9,2,
            'SOURCE:ENTRIES_27:ROW:42:INTERVIEW_COMPLETED','HUMAN_CONFIRMED');
          raise exception 'duplicate_source_link_was_accepted';
        exception when sqlstate '40001' then null; end;
        begin
          update public.nov_talent_recruitment_source_facts_v1 set link_reason='forbidden'
          where source_type='ENTRIES_27' and source_row_no=42 and fact_code='INTERVIEW_COMPLETED';
          raise exception 'source_fact_mutation_was_accepted';
        exception when sqlstate '42501' or sqlstate '55000' then null; end;
      end
      $source_test$;

      insert into public.nov_talent_recruitment_events_v1(
        candidate_id,event_code,event_date,event_state,source_type,source_field_code,
        created_by_employee_id,updated_by_employee_id
      ) values('${candidate}','COMMUNICATION_RECORDED','2026-08-08','COMPLETED',
        'NOV_TALENT_UI','COMMUNICATION_RECORDED','${actor}','${actor}');
      do $event_test$
      begin
        if (select count(*) from public.nov_talent_recruitment_events_v1
            where candidate_id='${candidate}' and event_code='COMMUNICATION_RECORDED') <> 1
        then raise exception 'communication_event_contract_failed'; end if;
        begin
          insert into public.nov_talent_recruitment_events_v1(
            candidate_id,event_code,event_date,event_state,source_type,source_field_code,
            created_by_employee_id,updated_by_employee_id
          ) values('${candidate}','INTERVIEW_COMPLETED','2026-08-08','COMPLETED',
            'NOV_TALENT_UI','INTERVIEW_COMPLETED','${actor}','${actor}');
          raise exception 'selection_code_was_accepted_as_event';
        exception when sqlstate '23514' then null; end;
      end
      $event_test$;
      select 'outcome1_behavior_pass';
      rollback;`);
    assert.match(behavior.stdout, /outcome1_behavior_pass/u);

    const forbidden = psql(`set role service_role;
      insert into public.nov_talent_selection_history_v1(
        candidate_id,selection_code,effective_date,source_type,source_field_code
      ) values('${candidate}','OFFERED','2026-08-08','NOV_TALENT_UI','OFFERED');`, true);
    assert.notEqual(forbidden.status, 0);

    const guarded = psql(`begin;
      insert into public.nov_talent_candidates_v1(
        candidate_id,graduation_year,student_name,current_status_code,source_type,
        created_by_employee_id,updated_by_employee_id
      ) values('${candidate}',2027,'fixture',null,'NOV_TALENT_UI','${actor}','${actor}');
      select set_config('nov_talent.selection_append_v1','allowed',true);
      insert into public.nov_talent_selection_history_v1(
        candidate_id,selection_code,effective_date,source_type,source_field_code,
        created_by_employee_id,updated_by_employee_id
      ) values('${candidate}','OFFERED','2026-08-08','NOV_TALENT_UI','OFFERED','${actor}','${actor}');
      ${rollback}`, true);
    assert.notEqual(guarded.status, 0);
    assert.match(guarded.stderr, /outcome1_rollback_business_facts_present/);

    psql(rollback);
    assert.equal(psql(`
      select (to_regprocedure('public.nov_talent_append_selection_transition_v1(uuid,text,text,uuid,integer,text,date,text,text)') is null)::text||'|'||
             (select count(*) from information_schema.columns where table_schema='public'
              and table_name='nov_talent_candidates_v1' and column_name='current_status_projection_source')::text;
    `).stdout.trim(), "true|0");
    psql(migration);
    assert.equal(catalog(), firstCatalog);
    assert.equal(psql("select current_setting('server_version_num')::integer >= 170000;").stdout.trim(), "t");
  } finally {
    if (started) command(exe("pg_ctl"), ["-D", dir, "-m", "immediate", "-w", "stop"], undefined, true);
    await rm(dir, { recursive: true, force: true });
  }
});
