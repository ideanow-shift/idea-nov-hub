import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const enabled=process.env.BDF_RUN_M017_DB_REHEARSAL==='1';
const pgBin=process.env.BDF_PG_BIN;
const env={...process.env,LANG:'C',LC_ALL:'C',PGCLIENTENCODING:'UTF8',TZ:'UTC'};
const migrations=[
  '20260806090905_m001_bdf_schemas_default_deny.sql',
  '20260806090908_m002_bdf_source_identity_envelope.sql',
  '20260806090911_m003_bdf_corporations_stores.sql',
  '20260806090915_m004_bdf_departments_employees.sql',
  '20260806090918_m005_bdf_employee_store_assignments.sql',
  '20260806090921_m006_bdf_store_relationships_population.sql',
  '20260806090925_m007_bdf_master_versions_audit.sql',
  '20260806090928_m008_bdf_master_projections.sql',
  '20260806090931_m009_bdf_rls_grants.sql',
  '20260806090935_m010_bdf_verification_gate.sql',
  '20260806201417_m011_bdf_snapshot_metadata_foundation.sql',
  '20260807112029_m061_bdf_snapshot_contract_versions_nonblank.sql',
  '20260806223721_m012_bdf_accounting_import_boundary.sql',
  '20260807122604_m013_bdf_account_master_statement_mapping.sql',
  '20260807211422_m062_bdf_account_hierarchy_cycle_guard.sql',
  '20260807220334_m014_bdf_accounting_version_lifecycle.sql',
  '20260807225540_m015_bdf_journal_accounting_fact_allocation.sql',
  '20260808085452_m063_bdf_import_batch_local_concurrency.sql',
  '20260808101153_m016_bdf_accounting_validation_approval_audit.sql',
  '20260808111647_m017_bdf_accounting_publication.sql'
];
const rollbacks=[
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
  const result=spawnSync(exe,args,{cwd:root,encoding:'utf8',env,input,maxBuffer:64*1024*1024,windowsHide:true});
  if(!allow&&result.status!==0)throw new Error(`${exe} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('M001-M017 plus M061-M063 are deterministic with Publication regression',{
  skip:!enabled&&'set BDF_RUN_M017_DB_REHEARSAL=1',timeout:900000
},async()=>{
  assert.ok(pgBin);
  const dir=await mkdtemp(path.join(os.tmpdir(),'bdf-m017-pg17-'));
  const port=58900+(process.pid%300);
  const exe=name=>path.join(pgBin,`${name}.exe`);
  const db='bdf_m017';
  let started=false;
  const file=p=>readFile(path.join(root,p),'utf8');
  const psqlArgs=['-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',db];
  const psql=(sql,allow=false)=>cmd(exe('psql'),psqlArgs,sql,allow);
  const apply=async(start=0,end=migrations.length)=>{
    for(const name of migrations.slice(start,end))await psql(await file(`supabase/migrations/${name}`));
  };
  const catalog=()=>psql(`
    with objects as (
      select 'r|'||n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||c.relrowsecurity::text||'|'||c.relforcerowsecurity::text x
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('core','governance','projection','accounting')
      union all
      select 'c|'||n.nspname||'|'||c.relname||'|'||q.conname||'|'||pg_get_constraintdef(q.oid)
      from pg_constraint q join pg_class c on c.oid=q.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('core','governance','projection','accounting')
      union all
      select 'f|'||n.nspname||'|'||p.proname||'|'||pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('core','governance','projection','accounting')
      union all
      select 't|'||n.nspname||'|'||c.relname||'|'||t.tgname||'|'||pg_get_triggerdef(t.oid)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('core','governance','projection','accounting') and not t.tgisinternal
      union all
      select 'i|'||schemaname||'|'||tablename||'|'||indexname||'|'||indexdef
      from pg_indexes where schemaname in('core','governance','projection','accounting')
      union all
      select 'g|'||table_schema||'|'||table_name||'|'||grantee||'|'||privilege_type
      from information_schema.role_table_grants where table_schema in('core','governance','projection','accounting')
      union all
      select 'x|'||routine_schema||'|'||routine_name||'|'||grantee||'|'||privilege_type
      from information_schema.routine_privileges where routine_schema in('core','governance','projection','accounting')
    )select x from objects order by x;
  `).stdout;
  const validateM017=()=>file('supabase/validation/pr002/validate_m017.sql').then(sql=>psql(sql));
  const runM017=()=>file('supabase/validation/pr002/test_m017_accounting_publication.sql').then(sql=>psql(sql));
  const runPriorRegression=async()=>{
    await psql(await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    await psql(await file('supabase/validation/pr002/test_m063_import_batch_local_concurrency.sql'));
  };
  const runM016Baseline=async()=>{
    await psql(await file('supabase/validation/pr002/validate_m016.sql'));
    await psql(await file('supabase/validation/pr002/test_m016_accounting_validation_approval_audit.sql'));
  };
  const runM016Current=async()=>{
    const sql=(await file('supabase/validation/pr002/test_m016_accounting_validation_approval_audit.sql'))
      .replace('BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017','BDF_M017_PUBLICATION_EVIDENCE_REQUIRED');
    await psql(sql);
  };
  const session=(sql)=>{
    const child=spawn(exe('psql'),psqlArgs,{cwd:root,encoding:'utf8',env,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d);
    child.stderr.on('data',d=>stderr+=d);
    child.stdin.end(sql);
    const done=new Promise((resolve,reject)=>child.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error(stderr))));
    return {child,done,get stdout(){return stdout;}};
  };
  const waitFor=async(predicate)=>{
    for(let i=0;i<100;i++){if(predicate())return;await pause(25);}
    throw new Error('M017 concurrency marker timeout');
  };
  const concurrency=async()=>{
    const before=Number(psql(`select deadlocks from pg_stat_database where datname='${db}';`).stdout.trim());
    const a=session(`begin;select pg_advisory_xact_lock(hashtextextended('m017|same',0));select 'M017_LOCKED';select pg_sleep(1.2);rollback;`);
    await waitFor(()=>a.stdout.includes('M017_LOCKED'));
    const sameStart=Date.now();
    psql(`begin;select pg_advisory_xact_lock(hashtextextended('m017|same',0));rollback;`);
    const sameWait=Date.now()-sameStart;
    await a.done;
    assert.ok(sameWait>=800,`same stream did not serialize: ${sameWait}ms`);

    const c=session(`begin;select pg_advisory_xact_lock(hashtextextended('m017|A',0));select 'M017_LOCKED';select pg_sleep(1.2);rollback;`);
    await waitFor(()=>c.stdout.includes('M017_LOCKED'));
    const otherStart=Date.now();
    psql(`begin;select pg_advisory_xact_lock(hashtextextended('m017|B',0));rollback;`);
    const otherWait=Date.now()-otherStart;
    await c.done;
    assert.ok(otherWait<800,`different stream blocked: ${otherWait}ms`);
    const after=Number(psql(`select deadlocks from pg_stat_database where datname='${db}';`).stdout.trim());
    assert.equal(after-before,0);
    assert.equal(psql(`select count(*) from pg_locks where locktype='advisory' and database=(select oid from pg_database where datname='${db}');`).stdout.trim(),'0');
    return {sameWait,otherWait,deadlocks:after-before};
  };

  try{
    cmd(exe('initdb'),['-D',dir,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
    const server=spawn(exe('postgres'),['-D',dir,'-p',String(port),'-h','127.0.0.1'],{detached:true,env,stdio:'ignore',windowsHide:true});
    server.unref();
    for(let i=0;i<80;i++){
      if(cmd(exe('pg_isready'),['-h','127.0.0.1','-p',String(port),'-U','postgres'],undefined,true).status===0){started=true;break;}
      await pause(250);
    }
    assert.ok(started);
    cmd(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-T','template0','-E','UTF8','--locale=C',db]);
    psql('create schema extensions;create role anon nologin;create role authenticated nologin;create role service_role nologin;');

    await apply(0,migrations.length-1);
    await runM016Baseline();
    const m016Catalog=catalog();
    await apply(migrations.length-1);
    await validateM017();
    await runM016Current();
    await runM017();
    await runPriorRegression();
    const first=catalog();
    const hash=createHash('sha256').update(first).digest('hex');
    const locks=await concurrency();

    await psql(await file(rollbacks[0]));
    await runM016Baseline();
    assert.equal(catalog(),m016Catalog);
    assert.equal(psql("select count(*) from information_schema.tables where table_schema='accounting' and table_name in('publication_releases','publication_members','comparison_rules');").stdout.trim(),'0');
    assert.equal(psql("select count(*) from information_schema.tables where table_schema='accounting' and table_name in('validation_results','approvals','audit_events');").stdout.trim(),'3');
    await apply(migrations.length-1);
    await validateM017();
    assert.equal(createHash('sha256').update(catalog()).digest('hex'),hash);

    for(const rollback of rollbacks)await psql(await file(rollback));
    assert.equal(psql("select count(*) from pg_namespace where nspname in('core','governance','projection','accounting');").stdout.trim(),'0');

    await apply(0,migrations.length-1);
    await runM016Baseline();
    await apply(migrations.length-1);
    await validateM017();
    await runM016Current();
    await runM017();
    await runPriorRegression();
    assert.equal(createHash('sha256').update(catalog()).digest('hex'),hash);
    assert.equal(psql(`select
      (select count(*) from accounting.publication_releases)+
      (select count(*) from accounting.publication_members)+
      (select count(*) from accounting.comparison_rules)+
      (select count(*) from accounting.validation_results)+
      (select count(*) from accounting.approvals)+
      (select count(*) from accounting.audit_events)+
      (select count(*) from accounting.journal_entries)+
      (select count(*) from accounting.journal_lines)+
      (select count(*) from accounting.accounting_facts)+
      (select count(*) from accounting.allocation_rule_versions)+
      (select count(*) from accounting.allocation_sets)+
      (select count(*) from accounting.accounting_allocations);`).stdout.trim(),'0');
    process.stdout.write(`BDF_M017_REHEARSAL_PASS forward=20 rollback=20 reapply=20 m016_m015_m063_regression=PASS same_wait_ms=${locks.sameWait} other_wait_ms=${locks.otherWait} deadlocks=${locks.deadlocks} fixture=0 catalog=${hash}\n`);
  }finally{
    if(started)cmd(exe('pg_ctl'),['-D',dir,'-m','immediate','-w','stop'],undefined,true);
    await rm(dir,{recursive:true,force:true});
  }
});
