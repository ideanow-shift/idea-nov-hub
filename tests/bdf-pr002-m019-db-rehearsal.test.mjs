import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const enabled=process.env.BDF_RUN_M019_DB_REHEARSAL==='1';
const pgBin=process.env.BDF_PG_BIN;
const env={...process.env,LANG:'C',LC_ALL:'C',PGCLIENTENCODING:'UTF8',TZ:'UTC'};
const migrations=[
  '20260806090905_m001_bdf_schemas_default_deny.sql','20260806090908_m002_bdf_source_identity_envelope.sql',
  '20260806090911_m003_bdf_corporations_stores.sql','20260806090915_m004_bdf_departments_employees.sql',
  '20260806090918_m005_bdf_employee_store_assignments.sql','20260806090921_m006_bdf_store_relationships_population.sql',
  '20260806090925_m007_bdf_master_versions_audit.sql','20260806090928_m008_bdf_master_projections.sql',
  '20260806090931_m009_bdf_rls_grants.sql','20260806090935_m010_bdf_verification_gate.sql',
  '20260806201417_m011_bdf_snapshot_metadata_foundation.sql','20260807112029_m061_bdf_snapshot_contract_versions_nonblank.sql',
  '20260806223721_m012_bdf_accounting_import_boundary.sql','20260807122604_m013_bdf_account_master_statement_mapping.sql',
  '20260807211422_m062_bdf_account_hierarchy_cycle_guard.sql','20260807220334_m014_bdf_accounting_version_lifecycle.sql',
  '20260807225540_m015_bdf_journal_accounting_fact_allocation.sql','20260808085452_m063_bdf_import_batch_local_concurrency.sql',
  '20260808101153_m016_bdf_accounting_validation_approval_audit.sql','20260808111647_m017_bdf_accounting_publication.sql',
  '20260808131114_m018_bdf_accounting_consumer_projection.sql',
  '20260808211137_m019_bdf_accounting_consumer_release_security.sql'
];
const rollbacks=[
  'supabase/rollback/pr002/m019_bdf_accounting_consumer_release_security.rollback.sql',
  'supabase/rollback/pr002/m018_bdf_accounting_consumer_projection.rollback.sql',
  'supabase/rollback/pr002/m017_bdf_accounting_publication.rollback.sql',
  'supabase/rollback/pr002/m016_bdf_accounting_validation_approval_audit.rollback.sql',
  'supabase/rollback/pr002/m063_bdf_import_batch_local_concurrency.rollback.sql',
  'supabase/rollback/pr002/m015_bdf_journal_accounting_fact_allocation.rollback.sql',
  'supabase/rollback/pr002/m014_bdf_accounting_version_lifecycle.rollback.sql',
  'supabase/rollback/pr002/m062_bdf_account_hierarchy_cycle_guard.rollback.sql',
  'supabase/rollback/pr002/m013_bdf_account_master_statement_mapping.rollback.sql',
  'supabase/rollback/pr002/m012_bdf_accounting_import_boundary.rollback.sql',
  'supabase/rollback/pr001b1/m061_bdf_snapshot_contract_versions_nonblank.rollback.sql',
  'supabase/rollback/pr001b1/m011_bdf_snapshot_metadata_foundation.rollback.sql',
  'supabase/rollback/pr001a/m010_bdf_verification_gate.rollback.sql',
  'supabase/rollback/pr001a/m009_bdf_rls_grants.rollback.sql',
  'supabase/rollback/pr001a/m008_bdf_master_projections.rollback.sql',
  'supabase/rollback/pr001a/m007_bdf_master_versions_audit.rollback.sql',
  'supabase/rollback/pr001a/m006_bdf_store_relationships_population.rollback.sql',
  'supabase/rollback/pr001a/m005_bdf_employee_store_assignments.rollback.sql',
  'supabase/rollback/pr001a/m004_bdf_departments_employees.rollback.sql',
  'supabase/rollback/pr001a/m003_bdf_corporations_stores.rollback.sql',
  'supabase/rollback/pr001a/m002_bdf_source_identity_envelope.rollback.sql',
  'supabase/rollback/pr001a/m001_bdf_schemas_default_deny.rollback.sql'
];

function cmd(exe,args,input,allow=false){
  const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',env,input,maxBuffer:96*1024*1024,windowsHide:true});
  if(!allow&&r.status!==0)throw new Error(`${exe} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('M001-M019 plus M061-M063 are deterministic with Consumer release/security regression',{
  skip:!enabled&&'set BDF_RUN_M019_DB_REHEARSAL=1',timeout:900000
},async()=>{
  assert.ok(pgBin);
  const dir=await mkdtemp(path.join(os.tmpdir(),'bdf-m019-pg17-'));
  const port=59200+(process.pid%300);
  const exe=name=>path.join(pgBin,`${name}.exe`);
  const db='bdf_m019';
  const concurrencyDb='bdf_m019_concurrency';
  let started=false;
  let concurrencyCreated=false;
  const file=p=>readFile(path.join(root,p),'utf8');
  const psqlArgs=database=>['-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',database];
  const psqlDb=(database,sql,allow=false)=>cmd(exe('psql'),psqlArgs(database),sql,allow);
  const psql=(sql,allow=false)=>psqlDb(db,sql,allow);
  const apply=async(start=0,end=migrations.length)=>{
    for(const name of migrations.slice(start,end))await psql(await file(`supabase/migrations/${name}`));
  };
  const catalog=()=>psql(`with o as (
    select 'r|'||n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||coalesce(array_to_string(c.reloptions,','),'') x
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('core','governance','projection','accounting')
    union all select 'v|'||schemaname||'|'||viewname||'|'||definition from pg_views where schemaname in('core','governance','projection','accounting')
    union all select 'c|'||n.nspname||'|'||t.relname||'|'||q.conname||'|'||pg_get_constraintdef(q.oid)
      from pg_constraint q join pg_class t on t.oid=q.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname in('core','governance','projection','accounting')
    union all select 'f|'||n.nspname||'|'||p.proname||'|'||pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('core','governance','projection','accounting')
    union all select 't|'||n.nspname||'|'||t.relname||'|'||g.tgname||'|'||pg_get_triggerdef(g.oid)
      from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname in('core','governance','projection','accounting') and not g.tgisinternal
    union all select 'i|'||schemaname||'|'||tablename||'|'||indexname||'|'||indexdef from pg_indexes where schemaname in('core','governance','projection','accounting')
    union all select 'g|'||table_schema||'|'||table_name||'|'||grantee||'|'||privilege_type from information_schema.role_table_grants where table_schema in('core','governance','projection','accounting')
  )select x from o order by x;`).stdout;
  const session=(sql,database=concurrencyDb)=>{
    const child=spawn(exe('psql'),psqlArgs(database),{cwd:root,encoding:'utf8',env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d);
    child.stderr.on('data',d=>stderr+=d);
    child.stdin.end(sql);
    const done=new Promise((resolve,reject)=>child.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error(`${stdout}\n${stderr}`))));
    return {done,get stdout(){return stdout;}};
  };
  const waitFor=async(predicate)=>{
    for(let i=0;i<160;i++){if(predicate())return;await pause(25);}
    throw new Error('M019 concurrency marker timeout');
  };
  const grant=({key,subject,employee='19000000-0000-4000-8000-000000000130',assignment='19000000-0000-4000-8000-000000000240',scope='corporation'})=>`
    insert into accounting.consumer_access_contracts(
      access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,
      scope_type,corporation_id,store_id,scenario_type,decision,effective_at,evidence_reference,contract_version
    ) values (
      '${key}',1,'${subject}','${employee}','${assignment}',
      '${scope}','19000000-0000-4000-8000-000000000100',${scope==='store'?"'19000000-0000-4000-8000-000000000110'":'null'},
      'budget','grant','2026-05-01','approval:m019-concurrency','consumer-v1'
    );`;
  const concurrency=async()=>{
    cmd(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-T',db,concurrencyDb]);
    concurrencyCreated=true;
    const fixture=await file('supabase/validation/pr002/test_m019_accounting_consumer_release_security.sql');
    const accessAt=fixture.indexOf('\ninsert into accounting.consumer_access_contracts(');
    assert.ok(accessAt>0,'M019 fixture seed boundary missing');
    psqlDb(concurrencyDb,`${fixture.slice(0,accessAt)}\ncommit;`);
    psqlDb(concurrencyDb,`
      insert into governance.canonical_entity_registry(canonical_entity_id,entity_type) values
        ('19000000-0000-4000-8000-000000000160','employee'),
        ('19000000-0000-4000-8000-000000000170','assignment');
      insert into core.employee_identities(employee_id) values ('19000000-0000-4000-8000-000000000160');
      insert into core.assignment_identities(assignment_id) values ('19000000-0000-4000-8000-000000000170');
      insert into governance.canonical_version_registry(entity_version_id,canonical_entity_id,entity_type,source_snapshot_id) values
        ('19000000-0000-4000-8000-000000000260','19000000-0000-4000-8000-000000000160','employee','19000000-0000-4000-8000-000000000001'),
        ('19000000-0000-4000-8000-000000000270','19000000-0000-4000-8000-000000000170','assignment','19000000-0000-4000-8000-000000000001');
      insert into core.employees(employee_version_id,employee_id,display_alias,status,primary_department_id,effective_from,effective_to,source_snapshot_id,source_record_digest)
      values ('19000000-0000-4000-8000-000000000260','19000000-0000-4000-8000-000000000160','consumer-two','active','19000000-0000-4000-8000-000000000120','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('c',64));
      insert into core.employee_store_assignments(assignment_version_id,assignment_id,employee_id,store_id,assignment_role_code,assignment_kind,effective_from,effective_to,status,source_snapshot_id,source_record_digest)
      values ('19000000-0000-4000-8000-000000000270','19000000-0000-4000-8000-000000000170','19000000-0000-4000-8000-000000000160','19000000-0000-4000-8000-000000000110','canonical.finance','primary','2026-01-01','2027-01-01','active','19000000-0000-4000-8000-000000000001',repeat('d',64));
    `);
    const before=Number(psqlDb(concurrencyDb,"select deadlocks from pg_stat_database where datname=current_database();").stdout.trim());

    // Same subject / different Employee: one commits; the post-lock recheck rejects the other.
    const differentEmployeeA=session(`set application_name='bdf-m019-subject-different-a';begin;
      ${grant({key:'19000000-0000-4000-8000-000000000310',subject:'19000000-0000-4000-8000-000000000910'})}
      select 'M019_DIFFERENT_EMPLOYEE_A_LOCKED';select pg_sleep(1.2);commit;`);
    await waitFor(()=>differentEmployeeA.stdout.includes('M019_DIFFERENT_EMPLOYEE_A_LOCKED'));
    const conflictStart=Date.now();
    const conflict=psqlDb(concurrencyDb,`set application_name='bdf-m019-subject-different-b';begin;
      ${grant({key:'19000000-0000-4000-8000-000000000311',subject:'19000000-0000-4000-8000-000000000910',employee:'19000000-0000-4000-8000-000000000160',assignment:'19000000-0000-4000-8000-000000000270'})}
      commit;`,true);
    const conflictWait=Date.now()-conflictStart;
    await differentEmployeeA.done;
    assert.notEqual(conflict.status,0,'different Employee binding unexpectedly committed');
    assert.match(`${conflict.stdout}\n${conflict.stderr}`,/BDF_M019_AUTH_SUBJECT_IDENTITY_CONFLICT/);
    assert.ok(conflictWait>=800,`different Employee binding did not serialize: ${conflictWait}ms`);
    assert.equal(psqlDb(concurrencyDb,"select count(*)||'|'||count(distinct employee_id) from accounting.consumer_access_contracts where auth_subject_id='19000000-0000-4000-8000-000000000910';").stdout.trim(),'1|1');
    assert.equal(psqlDb(concurrencyDb,"select count(*) from accounting.consumer_access_contracts where access_key='19000000-0000-4000-8000-000000000311';").stdout.trim(),'0');

    // Same subject / same Employee: valid independent scopes serialize and both commit.
    const sameEmployeeA=session(`set application_name='bdf-m019-subject-same-a';begin;
      ${grant({key:'19000000-0000-4000-8000-000000000320',subject:'19000000-0000-4000-8000-000000000920'})}
      select 'M019_SAME_EMPLOYEE_A_LOCKED';select pg_sleep(1.2);commit;`);
    await waitFor(()=>sameEmployeeA.stdout.includes('M019_SAME_EMPLOYEE_A_LOCKED'));
    const sameStart=Date.now();
    psqlDb(concurrencyDb,`set application_name='bdf-m019-subject-same-b';begin;
      ${grant({key:'19000000-0000-4000-8000-000000000321',subject:'19000000-0000-4000-8000-000000000920',scope:'store'})}
      commit;`);
    const sameWait=Date.now()-sameStart;
    await sameEmployeeA.done;
    assert.ok(sameWait>=800,`same subject did not serialize: ${sameWait}ms`);
    assert.equal(psqlDb(concurrencyDb,"select count(*)||'|'||count(distinct employee_id) from accounting.consumer_access_contracts where auth_subject_id='19000000-0000-4000-8000-000000000920';").stdout.trim(),'2|1');

    // Different subjects use different lock keys and progress concurrently.
    const differentSubjectA=session(`set application_name='bdf-m019-different-subject-a';begin;
      ${grant({key:'19000000-0000-4000-8000-000000000330',subject:'19000000-0000-4000-8000-000000000930'})}
      select 'M019_DIFFERENT_SUBJECT_A_LOCKED';select pg_sleep(1.2);rollback;`);
    await waitFor(()=>differentSubjectA.stdout.includes('M019_DIFFERENT_SUBJECT_A_LOCKED'));
    const otherStart=Date.now();
    psqlDb(concurrencyDb,`set application_name='bdf-m019-different-subject-b';begin;
      ${grant({key:'19000000-0000-4000-8000-000000000331',subject:'19000000-0000-4000-8000-000000000931',scope:'store'})}
      commit;`);
    const otherWait=Date.now()-otherStart;
    await differentSubjectA.done;
    assert.ok(otherWait<800,`different subjects blocked unnecessarily: ${otherWait}ms`);
    assert.equal(psqlDb(concurrencyDb,"select count(*) from accounting.consumer_access_contracts where auth_subject_id='19000000-0000-4000-8000-000000000930';").stdout.trim(),'0');
    assert.equal(psqlDb(concurrencyDb,"select count(*) from accounting.consumer_access_contracts where auth_subject_id='19000000-0000-4000-8000-000000000931';").stdout.trim(),'1');

    const after=Number(psqlDb(concurrencyDb,"select deadlocks from pg_stat_database where datname=current_database();").stdout.trim());
    assert.equal(after-before,0,'M019 concurrency introduced a deadlock');
    assert.equal(psqlDb(concurrencyDb,"select count(*) from pg_locks where locktype='advisory' and database=(select oid from pg_database where datname=current_database());").stdout.trim(),'0');
    cmd(exe('dropdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres',concurrencyDb]);
    concurrencyCreated=false;
    return {conflictWait,sameWait,otherWait,deadlocks:after-before};
  };
  try{
    cmd(exe('initdb'),['-D',dir,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C']);
    const server=spawn(exe('postgres'),['-D',dir,'-p',String(port),'-h','127.0.0.1'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    started=true;
    for(let i=0;i<100;i++){
      const ready=cmd(exe('pg_isready'),['-h','127.0.0.1','-p',String(port)],undefined,true);
      if(ready.status===0)break;
      await new Promise(r=>setTimeout(r,50));
    }
    cmd(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-T','template0','-E','UTF8','--locale=C',db]);
    psql(`create schema extensions;create role anon nologin;create role authenticated nologin;create role service_role nologin;`);
    await apply();
    await psql(await file('supabase/validation/pr002/validate_m019.sql'));
    await psql(await file('supabase/validation/pr002/test_m019_accounting_consumer_release_security.sql'));
    await psql(await file('supabase/validation/pr002/test_m018_accounting_consumer_projection.sql'));
    await psql(await file('supabase/validation/pr002/test_m017_accounting_publication.sql'));
    await psql(await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    await psql(await file('supabase/validation/pr002/test_m063_import_batch_local_concurrency.sql'));
    const m016=(await file('supabase/validation/pr002/test_m016_accounting_validation_approval_audit.sql'))
      .replace('BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017','BDF_M017_PUBLICATION_EVIDENCE_REQUIRED');
    await psql(m016);
    const concurrencyEvidence=await concurrency();
    const first=catalog();

    await psql(await file(rollbacks[0]));
    assert.equal(psql("select count(*) from information_schema.tables where table_schema='accounting' and table_name='consumer_access_contracts';").stdout.trim(),'0');
    assert.equal(psql("select count(*) from pg_views where schemaname='projection' and viewname like 'accounting_%_v1';").stdout.trim(),'6');
    await psql(await file(`supabase/migrations/${migrations.at(-1)}`));
    await psql(await file('supabase/validation/pr002/validate_m019.sql'));

    for(const rb of rollbacks)await psql(await file(rb));
    assert.equal(psql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('core','governance','projection','accounting') and c.relkind in('r','p','v','m','S');").stdout.trim(),'0');

    await apply();
    await psql(await file('supabase/validation/pr002/validate_m019.sql'));
    assert.equal(catalog(),first,'first and reapplied catalogs differ');
    assert.deepEqual(psql("select count(*) from accounting.consumer_access_contracts;select count(*) from accounting.publication_releases;select count(*) from accounting.accounting_facts;select count(*) from accounting.audit_events;").stdout.trim().split(/\r?\n/),['0','0','0','0']);
    assert.equal(psql(`select count(*) from pg_database where datname='${concurrencyDb}';`).stdout.trim(),'0');
    process.stdout.write(`BDF_M019_REHEARSAL_PASS forward=22 rollback=22 reapply=22 concurrency=3 conflict_wait_ms=${concurrencyEvidence.conflictWait} same_employee_wait_ms=${concurrencyEvidence.sameWait} different_subject_wait_ms=${concurrencyEvidence.otherWait} deadlocks=${concurrencyEvidence.deadlocks} retained_advisory_lock=0 fixture=0\n`);
    server.kill();
  }finally{
    if(concurrencyCreated)cmd(exe('dropdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','--if-exists',concurrencyDb],undefined,true);
    if(started)cmd(exe('pg_ctl'),['-D',dir,'stop','-m','immediate'],undefined,true);
    await rm(dir,{recursive:true,force:true});
  }
});
