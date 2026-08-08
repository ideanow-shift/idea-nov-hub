import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const enabled=process.env.BDF_RUN_M063_DB_REHEARSAL==='1';
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
  '20260808085452_m063_bdf_import_batch_local_concurrency.sql'
];
const rollbacks=[
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
  const r=spawnSync(exe,args,{cwd:root,encoding:'utf8',env,input,maxBuffer:64*1024*1024,windowsHide:true});
  if(!allow&&r.status!==0) throw new Error(`${exe} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r;
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('M001-M015 plus M061-M063 are deterministic and batch-local concurrent',{
  skip:!enabled&&'set BDF_RUN_M063_DB_REHEARSAL=1',timeout:900000
},async()=>{
  assert.ok(pgBin);
  const dir=await mkdtemp(path.join(os.tmpdir(),'bdf-m063-pg17-'));
  const port=58200+(process.pid%300);
  const exe=name=>path.join(pgBin,`${name}.exe`);
  const mainDb='bdf_m063';
  const concurrencyDb='bdf_m063_concurrency';
  let started=false;
  let concurrencyCreated=false;
  const file=p=>readFile(path.join(root,p),'utf8');
  const psql=(db,sql,allow=false)=>cmd(exe('psql'),[
    '-X','-v','ON_ERROR_STOP=1','-At','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',db
  ],sql,allow);
  const apply=async(db,end=migrations.length)=>{
    for(const name of migrations.slice(0,end)) await psql(db,await file(`supabase/migrations/${name}`));
  };
  const catalog=db=>psql(db,`
    with objects as (
      select 'r|'||n.nspname||'|'||c.relname||'|'||c.relkind::text||'|'||
        c.relrowsecurity::text||'|'||c.relforcerowsecurity::text x
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
      union all
      select 'x|'||routine_schema||'|'||routine_name||'|'||grantee||'|'||privilege_type
      from information_schema.routine_privileges
      where routine_schema in('core','governance','projection','accounting')
    ) select x from objects order by x;
  `).stdout;

  class Session{
    constructor(db,name){
      this.name=name;this.output='';
      this.child=spawn(exe('psql'),['-X','-q','-v','ON_ERROR_STOP=0','-At','-h','127.0.0.1',
        '-p',String(port),'-U','postgres','-d',db],{cwd:root,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      this.child.stdout.on('data',d=>{this.output+=d.toString();});
      this.child.stderr.on('data',d=>{this.output+=d.toString();});
    }
    send(sql){this.child.stdin.write(`${sql}\n`);}
    async waitFor(marker,timeout=6000){
      const until=Date.now()+timeout;
      while(Date.now()<until){if(this.output.includes(marker))return;await pause(25);}
      throw new Error(`${this.name} missing ${marker}\n${this.output}`);
    }
    async close(){
      if(this.child.exitCode===null){this.send('\\q');await Promise.race([
        new Promise(resolve=>this.child.once('exit',resolve)),pause(3000)
      ]);}
      if(this.child.exitCode===null)this.child.kill();
    }
  }

  const batchIds={
    diffA:'63000000-0000-4000-8000-000000000101',
    diffB:'63000000-0000-4000-8000-000000000102',
    same:'63000000-0000-4000-8000-000000000103',
    file:'63000000-0000-4000-8000-000000000104',
    line:'63000000-0000-4000-8000-000000000105',
    timeout:'63000000-0000-4000-8000-000000000106'
  };
  const suffix=id=>id.slice(-3);
  const fileId=id=>`63000000-0000-4000-8100-000000000${suffix(id)}`;
  const lineId=id=>`63000000-0000-4000-8200-000000000${suffix(id)}`;
  const seedBatch=(id,label)=>`
    insert into accounting.import_batches(import_batch_id,source_system,source_version,source_file,
      source_period,source_hash,schema_version,mapping_contract_version,tax_normalization_contract_version,created_by)
    values('${id}','m063-${label}','batch-v1','${label}.csv',daterange('2026-04-01','2026-05-01','[)'),
      repeat('1',64),'schema-v1','mapping-v1','tax-v1','audit:m063');
    insert into accounting.import_files(import_file_id,import_batch_id,file_name,file_type,file_hash,row_count)
    values('${fileId(id)}','${id}','${label}.csv','text_csv',repeat('2',64),1);
    insert into accounting.import_staging_lines(staging_line_id,import_batch_id,import_file_id,
      source_record_key_digest,source_line_no,row_digest,accounting_period,corporation_source_key_digest,
      account_source_key_digest,scenario_type,measure_type,source_amount,source_tax_basis,source_tax_category,
      source_tax_rate,tax_rate_source_version,rounding_mode,rounding_scope,rounding_unit,
      rounding_difference_amount,normalized_amount,tax_basis,value_status)
    values('${lineId(id)}','${id}','${fileId(id)}',repeat('a',64),1,repeat('b',64),'2026-04-01',
      repeat('c',64),repeat('d',64),'actual','period_flow',110,'inclusive','standard',0.1,'rate-v1',
      'half_up','line',1,0,null,null,'pending');
    update accounting.import_files set validation_status='validating' where import_file_id='${fileId(id)}';
    update accounting.import_files set validation_status='validated' where import_file_id='${fileId(id)}';
    update accounting.import_staging_lines set normalized_amount=100,tax_basis='exclusive',value_status='observed',
      normalization_status='passed',mapping_status='passed',validation_status='valid'
      where staging_line_id='${lineId(id)}';
    update accounting.import_batches set status='validating' where import_batch_id='${id}';
  `;
  const blocked=async(appName)=>{
    for(let i=0;i<100;i++){
      const value=Number(psql(concurrencyDb,`select coalesce(array_length(pg_blocking_pids(pid),1),0)
        from pg_stat_activity where application_name='${appName}';`).stdout.trim()||0);
      if(value>0)return value;
      await pause(25);
    }
    throw new Error(`no lock wait observed for ${appName}`);
  };
  const session=(name)=>new Session(concurrencyDb,name);
  let waits=0;
  let allSessionOutput='';

  try{
    cmd(exe('initdb'),['-D',dir,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
    const server=spawn(exe('postgres'),['-D',dir,'-p',String(port),'-h','127.0.0.1'],{
      detached:true,env,stdio:'ignore',windowsHide:true
    });
    server.unref();
    for(let i=0;i<80;i++){
      if(cmd(exe('pg_isready'),['-h','127.0.0.1','-p',String(port),'-U','postgres'],undefined,true).status===0){started=true;break;}
      await pause(250);
    }
    assert.ok(started);
    cmd(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-T','template0','-E','UTF8','--locale=C',mainDb]);
    psql(mainDb,'create schema extensions;create role anon nologin;create role authenticated nologin;create role service_role nologin;');

    await apply(mainDb,migrations.length-1);
    await psql(mainDb,await file('supabase/validation/pr002/validate_m015.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    const m015Catalog=catalog(mainDb);

    await psql(mainDb,await file(`supabase/migrations/${migrations.at(-1)}`));
    await psql(mainDb,await file('supabase/validation/pr002/validate_m063.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m063_import_batch_local_concurrency.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m013_account_mapping.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m062_account_hierarchy_cycle.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m014_accounting_version_lifecycle.sql'));
    const first=catalog(mainDb);
    const hash=createHash('sha256').update(first).digest('hex');

    cmd(exe('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','-T',mainDb,concurrencyDb]);
    concurrencyCreated=true;
    for(const [label,id] of Object.entries(batchIds))psql(concurrencyDb,seedBatch(id,label.toLowerCase()));
    const deadlocksBefore=Number(psql(concurrencyDb,`select deadlocks from pg_stat_database where datname=current_database();`).stdout.trim());

    // 1. Different batches: both updates complete while both transactions remain open.
    {
      const a=session('different-a'),b=session('different-b');
      a.send(`begin;set application_name='bdf-m063-different-a';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.diffA}';select 'DIFF_A_READY';`);
      b.send(`begin;set application_name='bdf-m063-different-b';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.diffB}';select 'DIFF_B_READY';`);
      await Promise.all([a.waitFor('DIFF_A_READY'),b.waitFor('DIFF_B_READY')]);
      assert.equal(psql(concurrencyDb,`select count(*) from pg_stat_activity a where a.application_name like 'bdf-m063-different-%' and cardinality(pg_blocking_pids(a.pid))>0;`).stdout.trim(),'0');
      a.send(`rollback;select 'DIFF_A_DONE';`);b.send(`rollback;select 'DIFF_B_DONE';`);
      await Promise.all([a.waitFor('DIFF_A_DONE'),b.waitFor('DIFF_B_DONE')]);
      allSessionOutput+=a.output+b.output;await a.close();await b.close();
    }

    // 2 and 5. Same batch: B waits, A rollback releases, B completes without deadlock.
    {
      const a=session('same-a'),b=session('same-b');
      a.send(`begin;set application_name='bdf-m063-same-a';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.same}';select 'SAME_A_LOCKED';`);
      await a.waitFor('SAME_A_LOCKED');
      b.send(`begin;set application_name='bdf-m063-same-b';select 'SAME_B_PID';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.same}';select 'SAME_B_SERIALIZED';`);
      await b.waitFor('SAME_B_PID');waits+=await blocked('bdf-m063-same-b');
      a.send(`rollback;select 'SAME_A_ROLLED_BACK';`);await a.waitFor('SAME_A_ROLLED_BACK');
      await b.waitFor('SAME_B_SERIALIZED');b.send(`rollback;select 'SAME_B_DONE';`);await b.waitFor('SAME_B_DONE');
      allSessionOutput+=a.output+b.output;await a.close();await b.close();
    }

    // 3. File writer waits for finalization, then fails closed after terminal commit.
    {
      const a=session('file-a'),b=session('file-b');
      a.send(`begin;set application_name='bdf-m063-file-a';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.file}';select 'FILE_A_LOCKED';`);
      await a.waitFor('FILE_A_LOCKED');
      b.send(`begin;set application_name='bdf-m063-file-b';select 'FILE_B_PID';insert into accounting.import_files(import_file_id,import_batch_id,file_name,file_type,file_hash,row_count) values('63000000-0000-4000-8300-000000000104','${batchIds.file}','late.csv','text_csv',repeat('e',64),0);`);
      await b.waitFor('FILE_B_PID');waits+=await blocked('bdf-m063-file-b');
      a.send(`commit;select 'FILE_A_COMMITTED';`);await a.waitFor('FILE_A_COMMITTED');
      await b.waitFor('BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');
      b.send(`rollback;select 'FILE_B_ROLLED_BACK';`);await b.waitFor('FILE_B_ROLLED_BACK');
      allSessionOutput+=a.output+b.output;await a.close();await b.close();
      assert.equal(psql(concurrencyDb,"select count(*) from accounting.import_files where import_file_id='63000000-0000-4000-8300-000000000104';").stdout.trim(),'0');
    }

    // 4. Staging writer waits for finalization and then fails closed.
    {
      const a=session('line-a'),b=session('line-b');
      a.send(`begin;set application_name='bdf-m063-line-a';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.line}';select 'LINE_A_LOCKED';`);
      await a.waitFor('LINE_A_LOCKED');
      b.send(`begin;set application_name='bdf-m063-line-b';select 'LINE_B_PID';insert into accounting.import_staging_lines(staging_line_id,import_batch_id,import_file_id,source_record_key_digest,source_line_no,row_digest,accounting_period,corporation_source_key_digest,account_source_key_digest,scenario_type,measure_type,source_amount,source_tax_basis,source_tax_category,source_tax_rate,tax_rate_source_version,rounding_mode,rounding_scope,rounding_unit,rounding_difference_amount,normalized_amount,tax_basis,value_status) values('63000000-0000-4000-8400-000000000105','${batchIds.line}','${fileId(batchIds.line)}',repeat('e',64),2,repeat('f',64),'2026-04-01',repeat('a',64),repeat('b',64),'actual','period_flow',110,'inclusive','standard',0.1,'rate-v1','half_up','line',1,0,null,null,'pending');`);
      await b.waitFor('LINE_B_PID');waits+=await blocked('bdf-m063-line-b');
      a.send(`commit;select 'LINE_A_COMMITTED';`);await a.waitFor('LINE_A_COMMITTED');
      await b.waitFor('BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED');
      b.send(`rollback;select 'LINE_B_ROLLED_BACK';`);await b.waitFor('LINE_B_ROLLED_BACK');
      allSessionOutput+=a.output+b.output;await a.close();await b.close();
      assert.equal(psql(concurrencyDb,"select count(*) from accounting.import_staging_lines where staging_line_id='63000000-0000-4000-8400-000000000105';").stdout.trim(),'0');
    }

    // 6. A bounded waiter aborts, rolls back, and leaves no partial row.
    {
      const a=session('timeout-a'),b=session('timeout-b');
      a.send(`begin;set application_name='bdf-m063-timeout-a';update accounting.import_batches set status='validated' where import_batch_id='${batchIds.timeout}';select 'TIMEOUT_A_LOCKED';`);
      await a.waitFor('TIMEOUT_A_LOCKED');
      b.send(`begin;set application_name='bdf-m063-timeout-b';set local lock_timeout='1500ms';select 'TIMEOUT_B_PID';insert into accounting.import_files(import_file_id,import_batch_id,file_name,file_type,file_hash,row_count) values('63000000-0000-4000-8500-000000000106','${batchIds.timeout}','timeout.csv','text_csv',repeat('f',64),0);`);
      await b.waitFor('TIMEOUT_B_PID');waits+=await blocked('bdf-m063-timeout-b');
      await b.waitFor('canceling statement due to lock timeout',5000);
      b.send(`rollback;select 'TIMEOUT_B_ROLLED_BACK';`);await b.waitFor('TIMEOUT_B_ROLLED_BACK');
      a.send(`rollback;select 'TIMEOUT_A_ROLLED_BACK';`);await a.waitFor('TIMEOUT_A_ROLLED_BACK');
      allSessionOutput+=a.output+b.output;await a.close();await b.close();
      assert.equal(psql(concurrencyDb,"select count(*) from accounting.import_files where import_file_id='63000000-0000-4000-8500-000000000106';").stdout.trim(),'0');
    }

    assert.doesNotMatch(allSessionOutput,/deadlock detected/i);
    const deadlocksAfter=Number(psql(concurrencyDb,`select deadlocks from pg_stat_database where datname=current_database();`).stdout.trim());
    assert.equal(deadlocksAfter-deadlocksBefore,0);
    assert.ok(waits>=4);
    assert.equal(psql(concurrencyDb,`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name like 'bdf-m063-%';`).stdout.trim(),'0');
    assert.equal(psql(concurrencyDb,`select count(*) from accounting.import_files where import_file_id in('63000000-0000-4000-8300-000000000104','63000000-0000-4000-8500-000000000106');`).stdout.trim(),'0');
    cmd(exe('dropdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres',concurrencyDb]);
    concurrencyCreated=false;

    await psql(mainDb,await file(rollbacks[0]));
    await psql(mainDb,await file('supabase/validation/pr002/validate_m015.sql'));
    assert.equal(catalog(mainDb),m015Catalog);
    await psql(mainDb,await file(`supabase/migrations/${migrations.at(-1)}`));
    assert.equal(createHash('sha256').update(catalog(mainDb)).digest('hex'),hash);

    for(const rollback of rollbacks)await psql(mainDb,await file(rollback));
    assert.equal(psql(mainDb,"select count(*) from pg_namespace where nspname in('core','governance','projection','accounting');").stdout.trim(),'0');

    await apply(mainDb);
    await psql(mainDb,await file('supabase/validation/pr002/validate_m063.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m063_import_batch_local_concurrency.sql'));
    await psql(mainDb,await file('supabase/validation/pr002/test_m015_journal_accounting_fact_allocation.sql'));
    assert.equal(createHash('sha256').update(catalog(mainDb)).digest('hex'),hash);
    assert.equal(psql(mainDb,`select
      (select count(*) from accounting.import_batches)+
      (select count(*) from accounting.import_files)+
      (select count(*) from accounting.import_staging_lines)+
      (select count(*) from accounting.journal_entries)+
      (select count(*) from accounting.journal_lines)+
      (select count(*) from accounting.accounting_facts)+
      (select count(*) from accounting.allocation_rule_versions)+
      (select count(*) from accounting.allocation_sets)+
      (select count(*) from accounting.accounting_allocations);`).stdout.trim(),'0');
    process.stdout.write(`BDF_M063_REHEARSAL_PASS forward=18 rollback=18 reapply=18 concurrency=6 deadlocks=0 waits=${waits} retained_locks=0 catalog=${hash}\n`);
  }finally{
    if(concurrencyCreated)cmd(exe('dropdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','--if-exists',concurrencyDb],undefined,true);
    if(started)cmd(exe('pg_ctl'),['-D',dir,'-m','immediate','-w','stop'],undefined,true);
    await rm(dir,{recursive:true,force:true});
  }
});
