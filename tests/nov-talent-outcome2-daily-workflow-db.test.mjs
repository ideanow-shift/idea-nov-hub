import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const enabled = process.env.NOV_TALENT_RUN_OUTCOME2_DB_TEST === "1";
const pgBin = process.env.NOV_TALENT_PG_BIN;
const childEnv = { ...process.env, LANG: "C", LC_ALL: "C", PGCLIENTENCODING: "UTF8", TZ: "UTC" };
function command(executable, args, input, allowFailure = false) {
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8", env: childEnv, input, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  if (!allowFailure && result.status !== 0) throw new Error(`${executable} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

const baseline = String.raw`
create extension if not exists pgcrypto;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema nov_talent_internal;
create table public.nov_talent_candidates_v1(
  candidate_id uuid primary key default gen_random_uuid(), graduation_year smallint not null, student_name text not null,
  version integer not null default 1, is_active boolean not null default true
);
create table public.nov_talent_recruitment_events_v1(
  event_id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.nov_talent_candidates_v1,
  event_code text not null, event_date date not null, event_name text, event_state text not null default 'COMPLETED',
  contact_content text, assigned_to text, notes text, source_type text not null, source_row_no integer,
  source_field_code text not null, source_fingerprint text, version integer not null default 1, is_active boolean not null default true,
  created_by_employee_id uuid, updated_by_employee_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  invalidated_reason text, invalidated_by_employee_id uuid, invalidated_at timestamptz,
  unique(candidate_id,event_code,event_date,source_field_code)
);
create table public.nov_talent_next_actions_v1(
  next_action_id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.nov_talent_candidates_v1,
  action_code text not null check(action_code in('FOLLOW_UP','SALON_TOUR_FOLLOW_UP','INTERVIEW_FOLLOW_UP','OFFER_FOLLOW_UP')),
  due_date date, state text not null default 'OPEN' constraint nov_talent_next_actions_v1_state_check check(state in('OPEN','COMPLETED','CANCELLED')),
  source_type text not null, source_row_no integer, source_field_code text not null, source_fingerprint text,
  action_text text, assigned_to text, notes text, completed_at timestamptz, version integer not null default 1,
  is_active boolean not null default true, created_by_employee_id uuid, updated_by_employee_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  invalidated_reason text, invalidated_by_employee_id uuid, invalidated_at timestamptz,
  unique(candidate_id,action_code,due_date,source_field_code)
);
create table public.nov_talent_recruitment_activity_audit_v1(
  audit_id uuid primary key default gen_random_uuid(), candidate_id uuid not null references public.nov_talent_candidates_v1,
  entity_type text not null constraint nov_talent_recruitment_activity_audit_v1_entity_type_check check(entity_type in('EVENT','SELECTION','NEXT_ACTION','SOURCE_FACT_LINK')),
  entity_id text not null, action text not null constraint nov_talent_recruitment_activity_audit_v1_action_check check(action in('CREATE','UPDATE','COMPLETE','DEACTIVATE','RESTORE','LINK')),
  changed_fields text[] not null, before_values jsonb not null default '{}', after_values jsonb not null default '{}',
  actor_employee_id uuid not null, actor_role text not null, reason text not null, entity_version integer not null,
  occurred_at timestamptz not null default now()
);
create function nov_talent_internal.block_recruitment_activity_audit_mutation_v1() returns trigger language plpgsql as $$begin raise exception using errcode='55000',message='recruitment_activity_audit_append_only'; end$$;
create trigger block_recruitment_activity_audit_mutation_v1 before update or delete on public.nov_talent_recruitment_activity_audit_v1 for each row execute function nov_talent_internal.block_recruitment_activity_audit_mutation_v1();
create function nov_talent_internal.guard_official_recruitment_event_v1() returns trigger language plpgsql as $$begin if tg_op='DELETE' then raise exception using errcode='55000',message='recruitment_event_physical_delete_forbidden'; end if; return new; end$$;
create trigger guard_official_recruitment_event_v1 before insert or update or delete on public.nov_talent_recruitment_events_v1 for each row execute function nov_talent_internal.guard_official_recruitment_event_v1();
alter table public.nov_talent_recruitment_events_v1 enable row level security;
alter table public.nov_talent_next_actions_v1 enable row level security;
alter table public.nov_talent_recruitment_activity_audit_v1 enable row level security;
grant select,insert,update on public.nov_talent_recruitment_events_v1 to service_role;
grant select,insert,update on public.nov_talent_next_actions_v1 to service_role;
grant select,insert on public.nov_talent_recruitment_activity_audit_v1 to service_role;
`;

test("Outcome 2 migration applies, enforces atomic commands, rolls back, and reapplies on Fresh PostgreSQL 17", {
  skip: !enabled && "set NOV_TALENT_RUN_OUTCOME2_DB_TEST=1", timeout: 240_000
}, async () => {
  assert.ok(pgBin, "NOV_TALENT_PG_BIN is required");
  const migration = await readFile(path.join(root, "supabase/migrations/20260809102904_nov_talent_outcome2_daily_workflow.sql"), "utf8");
  const rollback = await readFile(path.join(root, "supabase/rollback/20260809102904_nov_talent_outcome2_daily_workflow.rollback.sql"), "utf8");
  const dir = await mkdtemp(path.join(os.tmpdir(), "nov-talent-outcome2-pg17-"));
  const port = 59400 + (process.pid % 400); const exe = (name) => path.join(pgBin, `${name}.exe`); let started = false;
  const psql = (sql, allowFailure = false) => command(exe("psql"), ["-X","-v","ON_ERROR_STOP=1","-At","-h","127.0.0.1","-p",String(port),"-U","postgres","-d","nov_talent_outcome2"], sql, allowFailure);
  try {
    command(exe("initdb"), ["-D",dir,"-U","postgres","-A","trust","--encoding=SQL_ASCII","--locale=C"]);
    const server = spawn(exe("postgres"), ["-D",dir,"-p",String(port),"-h","127.0.0.1"], { detached:true, env:childEnv, stdio:"ignore", windowsHide:true }); server.unref();
    for (let attempt=0; attempt<80; attempt+=1) { if (command(exe("pg_isready"), ["-h","127.0.0.1","-p",String(port),"-U","postgres"], undefined, true).status===0) { started=true; break; } await new Promise((resolve)=>setTimeout(resolve,250)); }
    assert.ok(started); command(exe("createdb"), ["-h","127.0.0.1","-p",String(port),"-U","postgres","-T","template0","-E","UTF8","--locale=C","nov_talent_outcome2"]);
    psql(baseline); psql(migration);
    const catalog = () => psql(`select md5(string_agg(item,E'\n' order by item)) from (
      select 'column|'||table_name||'|'||column_name item from information_schema.columns where table_schema='public' and table_name in('nov_talent_recruitment_events_v1','nov_talent_next_actions_v1')
      union all select 'function|'||p.proname||'|'||pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','nov_talent_internal') and p.proname like '%outcome2%' or p.proname in('nov_talent_record_communication_v1','nov_talent_mutate_next_action_v2','guard_next_action_command_v2')
    )q;`).stdout.trim();
    const firstCatalog = catalog();
    const actor="00000000-0000-4000-8000-000000000009", assignee="00000000-0000-4000-8000-000000000008", candidate="00000000-0000-4000-8000-000000000001";
    const behavior = psql(`begin;
      insert into public.nov_talent_candidates_v1(candidate_id,graduation_year,student_name) values('${candidate}',2027,'fixture');
      select set_config('nov_talent.outcome2_next_action_write','allowed',true);
      insert into public.nov_talent_next_actions_v1(candidate_id,action_code,due_date,state,source_type,source_field_code,action_text,assigned_to)
        values('${candidate}','FOLLOW_UP','2026-08-11','OPEN','LEGACY','LEGACY:1','legacy action','legacy owner');
      do $$begin if not exists(select 1 from public.nov_talent_next_actions_v1 where source_type='LEGACY' and assigned_employee_id is null and workflow_contract_version is null) then raise exception 'legacy_assignee_was_guessed'; end if; end$$;
      select * from public.nov_talent_record_communication_v1('${actor}','hr.admin','fixture','${candidate}',1,'2026-08-09T10:00:00+09:00','LINE','OUTBOUND','REACHED','summary',true,true,'FOLLOW_UP','2026-08-10','reply check','owner','${assignee}',null,null);
      do $$declare a uuid; original_event uuid; correction_event uuid; begin
        if (select count(*) from public.nov_talent_recruitment_events_v1 where event_code='COMMUNICATION_RECORDED')<>1
          or (select count(*) from public.nov_talent_next_actions_v1)<>2 or (select count(*) from public.nov_talent_recruitment_activity_audit_v1)<>2 then raise exception 'atomic_create_failed'; end if;
        if (select communication_at at time zone 'UTC' from public.nov_talent_recruitment_events_v1 where event_code='COMMUNICATION_RECORDED')
          <> timestamp '2026-08-09 01:00:00' then raise exception 'communication_timezone_drift'; end if;
        begin update public.nov_talent_recruitment_events_v1 set contact_content='changed' where event_code='COMMUNICATION_RECORDED'; raise exception 'communication_update_accepted'; exception when sqlstate '55000' then null; end;
        select next_action_id into a from public.nov_talent_next_actions_v1 where workflow_contract_version='1.1.0';
        perform * from public.nov_talent_mutate_next_action_v2('${actor}','hr.admin','assign','ASSIGN','${candidate}',a,1,null,null,null,'new owner','${actor}',null);
        if (select assigned_employee_id from public.nov_talent_next_actions_v1 where next_action_id=a)<>'${actor}' then raise exception 'assign_failed'; end if;
        if not exists(select 1 from public.nov_talent_recruitment_activity_audit_v1 where entity_id=a::text and action='ASSIGN'
          and before_values->>'assignedEmployeeId'='${assignee}' and after_values->>'assignedEmployeeId'='${actor}') then raise exception 'assign_audit_missing'; end if;
        perform * from public.nov_talent_mutate_next_action_v2('${actor}','hr.admin','hold','HOLD','${candidate}',a,2,null,null,null,null,null,'waiting');
        begin perform * from public.nov_talent_mutate_next_action_v2('${actor}','hr.admin','bad','COMPLETE','${candidate}',a,2,null,null,null,null,null,null); raise exception 'stale_accepted'; exception when sqlstate '40001' then null; end;
        perform * from public.nov_talent_mutate_next_action_v2('${actor}','hr.admin','resume','REOPEN','${candidate}',a,3,null,null,null,null,null,null);
        perform * from public.nov_talent_mutate_next_action_v2('${actor}','hr.admin','done','COMPLETE','${candidate}',a,4,null,null,null,null,null,null);
        begin perform * from public.nov_talent_mutate_next_action_v2('${actor}','hr.admin','bad','REOPEN','${candidate}',a,5,null,null,null,null,null,null); raise exception 'invalid_transition_accepted'; exception when sqlstate '22023' then null; end;
        select event_id into original_event from public.nov_talent_recruitment_events_v1 where event_code='COMMUNICATION_RECORDED';
        select event_id into correction_event from public.nov_talent_record_communication_v1('${actor}','hr.admin','correct','${candidate}',1,'2026-08-09T10:05:00+09:00','LINE','OUTBOUND','REPLY_RECEIVED','corrected',false,false,null,null,null,null,null,original_event,'wrong result');
        begin perform * from public.nov_talent_record_communication_v1('${actor}','hr.admin','double','${candidate}',1,'2026-08-09T10:06:00+09:00','LINE','OUTBOUND','REACHED','again',false,false,null,null,null,null,null,original_event,'again'); raise exception 'double_correction_accepted'; exception when unique_violation then null; end;
        perform * from public.nov_talent_record_communication_v1('${actor}','hr.admin','chain','${candidate}',1,'2026-08-09T10:07:00+09:00','LINE','OUTBOUND','REACHED','final',false,false,null,null,null,null,null,correction_event,'final correction');
      end$$;
      do $$begin
        begin perform * from public.nov_talent_record_communication_v1('${actor}','hr.admin','fixture','${candidate}',1,'2026-08-09T11:00:00','LINE','OUTBOUND','REACHED','summary',false,false,null,null,null,null,null,null,null); raise exception 'timezone_less_accepted'; exception when sqlstate '22023' then null; end;
        begin perform * from public.nov_talent_record_communication_v1('${actor}','hr.admin','fixture','${candidate}',1,'2026-02-30T11:00:00+09:00','LINE','OUTBOUND','REACHED','summary',false,false,null,null,null,null,null,null,null); raise exception 'invalid_date_accepted'; exception when sqlstate '22023' then null; end;
        begin perform * from public.nov_talent_record_communication_v1('${actor}','hr.admin','fixture','${candidate}',1,'2026-08-09T11:00:00+09:00','LINE','OUTBOUND','REACHED','summary',false,true,'FOLLOW_UP',null,'missing date','owner','${assignee}',null,null); raise exception 'partial_payload_accepted'; exception when sqlstate '22023' then null; end;
        if (select count(*) from public.nov_talent_recruitment_events_v1)<>3 then raise exception 'partial_write'; end if;
        begin update public.nov_talent_recruitment_activity_audit_v1 set reason='changed'; raise exception 'audit_update_accepted'; exception when sqlstate '55000' then null; end;
      end$$;
      select 'outcome2_behavior_pass'; rollback;`);
    assert.match(behavior.stdout,/outcome2_behavior_pass/u);
    const direct = psql(`set role service_role; insert into public.nov_talent_next_actions_v1(candidate_id,action_code,due_date,state,source_type,source_field_code) values('${candidate}','FOLLOW_UP','2026-08-10','OPEN','NOV_TALENT_UI','x');`, true);
    assert.notEqual(direct.status,0);
    psql(rollback);
    assert.equal(psql("select to_regprocedure('public.nov_talent_record_communication_v1(uuid,text,text,uuid,integer,text,text,text,text,text,boolean,boolean,text,date,text,text,uuid,uuid,text)') is null;").stdout.trim(),"t");
    psql(migration); assert.equal(catalog(),firstCatalog); assert.equal(psql("select current_setting('server_version_num')::integer>=170000;").stdout.trim(),"t");
  } finally { if(started) command(exe("pg_ctl"),["-D",dir,"-m","immediate","-w","stop"],undefined,true); await rm(dir,{recursive:true,force:true}); }
});
