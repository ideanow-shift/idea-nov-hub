import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const enabled=process.env.BDF_RUN_M015_DB_REHEARSAL==='1';
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
  '20260807225540_m015_bdf_journal_accounting_fact_allocation.sql'
];
const rollbacks=[
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
  if(!allow&&result.status!==0) throw new Error(`${exe} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result;
}

test('M001-M015 plus M061/M062 are deterministic',{
  skip:!enabled&&'set BDF_RUN_M015_DB_REHEARSAL=1',timeout:600000
},async()=>{
  assert.ok(pgBin);
  const dir=await mkdtemp(path.join(os.tmpdir(),'bdf-m015-pg17-'));
  const port=57900+(process.pid%300);
  const exe=name=>path.join(pgBin,`${name}.exe`);
  let started=false;
  const psql=sql=>cmd(exe('psql'),[
    '-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','bdf_m015'
  ],sql);
  const file=p=>readFile(path.join(root,p),'utf8');
  const apply=async()=>{for(const name of migrations) await psql(await file(`supabase/migrations/${name}`));};
  const catalog=()=>psql(`
    with objects as (
      select 'r|'||n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||
        c.relrowsecurity::text||'|'||c.relforcerowsecurity::text as x
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
      from information_schema.role_table_grants
      where table_schema in('core','governance','projection','accounting')
    ) select x from objects order by x;
  `).stdout;
  try{
    cmd(exe('initdb'),['-D',dir,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
    const server=spawn(exe('postgres'),['-D',dir,'-p',String(port),'-h','127.0.0.1'],{
      detached:true,env,stdio:'ignore',windowsHide:true
    });
    server.unref();
    for(let i=0;i<80;i++){
      if(cmd(exe('pg_isready'),['-h','127.0.0.1','-p',String(port),'-U','postgres'],undefined,true).status===0){started=true;break;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(started);
    cmd(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-T','template0','-E','UTF8','--locale=C','bdf_m015']);
    psql('create schema extensions;create role anon nologin;create role authenticated nologin;create role service_role nologin;');

    await apply();
    await psql(await file('supabase/validation/pr002/validate_m015.sql'));
    await psql(await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    assert.equal(psql(`select
      (select count(*) from accounting.journal_entries)+
      (select count(*) from accounting.journal_lines)+
      (select count(*) from accounting.accounting_facts)+
      (select count(*) from accounting.allocation_rule_versions)+
      (select count(*) from accounting.allocation_sets)+
      (select count(*) from accounting.accounting_allocations);`).stdout.trim(),'0');
    await psql(await file('supabase/validation/pr002/test_m013_account_mapping.sql'));
    await psql(await file('supabase/validation/pr002/test_m062_account_hierarchy_cycle.sql'));
    await psql(await file('supabase/validation/pr002/test_m014_accounting_version_lifecycle.sql'));
    const first=catalog();
    const hash=createHash('sha256').update(first).digest('hex');

    await psql(await file(rollbacks[0]));
    assert.equal(psql(`select count(*) from information_schema.tables where table_schema='accounting'
      and table_name in('journal_entries','journal_lines','accounting_facts','allocation_rule_versions','allocation_sets','accounting_allocations');`).stdout.trim(),'0');
    assert.equal(psql(`select count(*) from information_schema.tables where table_schema='accounting'
      and table_name in('scenario_contracts','measure_type_contracts','accounting_versions');`).stdout.trim(),'3');
    await psql(await file(`supabase/migrations/${migrations.at(-1)}`));
    assert.equal(createHash('sha256').update(catalog()).digest('hex'),hash);

    for(const rollback of rollbacks) await psql(await file(rollback));
    assert.equal(psql("select count(*) from pg_namespace where nspname in('core','governance','projection','accounting');").stdout.trim(),'0');

    await apply();
    await psql(await file('supabase/validation/pr002/validate_m015.sql'));
    await psql(await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    assert.equal(createHash('sha256').update(catalog()).digest('hex'),hash);
    process.stdout.write(`BDF_M015_REHEARSAL_PASS forward=17 rollback=17 reapply=17 catalog=${hash}\n`);
  }finally{
    if(started) cmd(exe('pg_ctl'),['-D',dir,'-m','immediate','-w','stop'],undefined,true);
    await rm(dir,{recursive:true,force:true});
  }
});
