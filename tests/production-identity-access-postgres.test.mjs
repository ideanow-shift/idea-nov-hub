import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';

// This harness cannot accept a database URL or remote host. Never run against Supabase.
const bin = process.env.BDF_PG_BIN || '';
const exe = (n) => bin ? join(bin, n + (process.platform === 'win32' ? '.exe' : '')) : n;
const local = Boolean(bin);
const port = local ? 59600 + process.pid % 200 : 5432;
const database = 'identity_access_disposable_test';
const env = { ...process.env, PGHOST:'127.0.0.1', PGPORT:String(port), PGUSER:'postgres',
 PGDATABASE:database, PGPASSWORD:local ? '' : 'postgres', LANG:'C', LC_ALL:'C', PGCLIENTENCODING:'UTF8' };
let directory, server; let passed=0;
function command(n,args,input,fail=false) {
 const r=spawnSync(exe(n),args,{env,input,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
 if(!fail && r.status!==0) throw new Error(`${n}: ${r.error||''}\n${r.stdout}\n${r.stderr}`);
 return r;
}
const args=['-X','-qAt','-v','ON_ERROR_STOP=1'];
const sql=(s,fail=false)=>command('psql',args,s,fail);
function check(name,fn){fn();passed++;process.stdout.write(`PASS ${name}\n`);}
const id=(n)=>`fixture_id(${n})`;
const digest=(n)=>`encode(sha256(convert_to(${id(n)}::text,'UTF8')),'hex')`;
const rpc=(n)=>`public.store_operations_production_access_v1(${digest(n)})`;
const authGrant=(n=101,key=1001,auth=201)=>`insert into identity_access.auth01_binding_decisions
 (decision_key,decision_sequence,decision,provider,issuer,audience,subject_digest,employee_id,auth_user_id,evidence_reference)
 values(${id(key)},1,'grant','nov_hub','nov_hub_production','nov_hub',${digest(n)},${id(n)},${id(auth)},'evidence:fixture');`;
const revoke=(table,key)=>`insert into identity_access.${table} select (jsonb_populate_record(null::identity_access.${table},
 to_jsonb(d)||jsonb_build_object('decision_id',gen_random_uuid(),'decision_sequence',2,'decision','revoke','evidence_reference','approval:fixture-revoke'))).*
 from identity_access.${table} d where decision_key=${id(key)} and decision_sequence=1;`;
const replaceGrant=(table,key,changes)=>revoke(table,key)+`insert into identity_access.${table}
 select (jsonb_populate_record(null::identity_access.${table},to_jsonb(d)||jsonb_build_object('decision_id',gen_random_uuid(),
 'decision_key',gen_random_uuid(),${changes}))).* from identity_access.${table} d where decision_key=${id(key)} and decision_sequence=1;`;
function denied(name,mutation,call=rpc(101),pattern=/DENIED|INACTIVE|MISMATCH|CONFLICT|INVALID|AMBIGUOUS|DISABLED/){
 check(name,()=>{const r=sql(`begin; ${mutation} set local role service_role; select ${call}; rollback;`,true);
 assert.notEqual(r.status,0);assert.match(r.stderr,pattern);});
}
try {
 if(local){
  directory=await mkdtemp(join(tmpdir(),'identity-access-pg17-'));
  command('initdb',['-D',directory,'-U','postgres','-A','trust','--encoding=UTF8','--locale=C']);
  server=spawn(exe('postgres'),['-D',directory,'-p',String(port),'-h','127.0.0.1'],{env,windowsHide:true,stdio:'ignore'});
  for(let n=0;n<100;n++){if(command('pg_isready',[],undefined,true).status===0)break;
   if(n===99)throw Error('POSTGRES_START_TIMEOUT');await new Promise(r=>setTimeout(r,100));}
 }
 command('createdb',[database]);
 check('PostgreSQL 17',()=>assert.equal(Math.trunc(Number(sql("select current_setting('server_version_num');").stdout.trim())/10000),17));
 sql(await readFile(new URL('./production-identity-access-fixture.sql',import.meta.url),'utf8'));
 const before=sql("select md5(string_agg(x::text,'' order by x::text)) from (select to_jsonb(e) x from public.employees e union all select to_jsonb(s) from public.stores s union all select to_jsonb(r) from public.employee_roles r) z;").stdout;
 sql(await readFile(new URL('../supabase/migrations/20260905020641_production_identity_access_auth01_m019_v1.sql',import.meta.url),'utf8'));
 check('apply leaves source business rows unchanged',()=>assert.equal(sql("select md5(string_agg(x::text,'' order by x::text)) from (select to_jsonb(e) x from public.employees e union all select to_jsonb(s) from public.stores s union all select to_jsonb(r) from public.employee_roles r) z;").stdout,before));
 check('RLS and FORCE RLS 4/4',()=>assert.equal(sql("select count(*) from pg_class where relnamespace='identity_access'::regnamespace and relkind='r' and relrowsecurity and relforcerowsecurity;").stdout.trim(),'4'));
 check('empty ledgers deny before authoring',()=>assert.notEqual(sql(`set role service_role; select ${rpc(101)};`,true).status,0));
 sql(`set role service_role; ${authGrant()} ${authGrant(102,1002,202)} ${authGrant(103,1003,203)}
 insert into identity_access.m019_scope_decisions(decision_key,decision_sequence,decision,employee_id,assignment_type,scope_type,scope_id,source_assignment_id,effective_from,evidence_reference)
 values(fixture_id(2001),1,'grant',fixture_id(101),'global','all',null,null,current_date,'approval:fixture'),
 (fixture_id(2002),1,'grant',fixture_id(102),'delegated','assigned',fixture_id(2),fixture_id(602),current_date,'approval:fixture'),
 (fixture_id(2003),1,'grant',fixture_id(103),'primary','own',fixture_id(3),null,current_date,'approval:fixture');
 insert into identity_access.consumer_access_decisions(decision_key,decision_sequence,decision,employee_id,consumer_key,effective_from,evidence_reference)
 select fixture_id(3000+n),1,'grant',fixture_id(100+n),'store_operations_v1',current_date,'approval:fixture' from generate_series(1,3) n;`);
 for(const [n,role,mode,count] of [[101,'executive','all',20],[102,'area_manager','assigned',1],[103,'store_manager','own',1]]){
  check(`${role} canonical resolution and exact scope`,()=>{const data=JSON.parse(sql(`set role service_role; select ${rpc(n)};`).stdout.trim());
   assert.equal(data.roleKeys[0],role);assert.equal(data.scope.mode,mode);assert.equal(data.scope.storeIds.length,count);
   if(count===1)assert.equal(data.scope.storeIds[0],`10000000-0000-4000-8000-${String(n-100).padStart(12,'0')}`);
   assert.equal(data.masters.stores.length,20);assert.equal(data.masters.stores.filter(s=>s.store_type==='DIRECT').length,13);
   assert.equal(data.masters.stores.filter(s=>s.store_type==='FC').length,7);assert.equal(new Set(data.masters.stores.map(s=>s.id)).size,20);
  });
 }
 check('resolver works in READ ONLY transaction',()=>assert.equal(sql(`begin read only; set local role service_role; select ${rpc(101)}; rollback;`).status,0));
 check('audit records are stamped with server database role',()=>assert.equal(sql("select count(*) from identity_access.auth01_binding_decisions where recorded_by='service_role';").stdout.trim(),'3'));
 check('fixed search_path and security invoker routines',()=>assert.equal(sql("select count(*) from pg_proc where (pronamespace='identity_access'::regnamespace or oid='public.store_operations_production_access_v1(text)'::regprocedure) and not prosecdef and proconfig @> array['search_path=\"\"'];").stdout.trim(),'2'));
 check('new lookup indexes present',()=>assert.equal(sql("select count(*) from pg_indexes where schemaname='identity_access' and indexname in ('auth01_subject_lookup','auth01_employee_lookup','auth01_auth_user_lookup','m019_employee_lookup','m019_source_assignment_lookup','m019_store_lookup','consumer_employee_lookup','store_alias_source_lookup','store_alias_canonical_lookup');").stdout.trim(),'9'));
 denied('unknown subject','',rpc(104));
 denied('inactive employee','update public.employees set is_active=false where id=fixture_id(101);');
 denied('retired employee','update public.employees set retired_on=current_date where id=fixture_id(101);');
 denied('deleted auth user','update auth.users set deleted_at=now() where id=fixture_id(201);');
 denied('banned auth user','update auth.users set banned_until=now()+interval \'1 day\' where id=fixture_id(201);');
 denied('missing role','delete from public.employee_roles where employee_id=fixture_id(101);');
 denied('inactive roles','update public.roles set is_active=false;');
 denied('conflicting roles',`insert into public.employee_roles values(fixture_id(410),fixture_id(101),fixture_id(302),'all',null,true);`);
 denied('locked credentials','update public.employee_login_credentials set locked_until=now()+interval \'1 day\' where employee_id=fixture_id(101);');
 denied('revoked AUTH01',revoke('auth01_binding_decisions',1001));
 denied('revoked assignment',revoke('m019_scope_decisions',2001));
 denied('revoked consumer access',revoke('consumer_access_decisions',3001));
 denied('expired AUTH01',replaceGrant('auth01_binding_decisions',1001,"'granted_at',now()-interval '2 days','expires_at',now()-interval '1 day'"));
 denied('expired M019 ledger',replaceGrant('m019_scope_decisions',2001,"'effective_from',current_date-10,'effective_to',current_date-1"));
 denied('future M019 ledger',replaceGrant('m019_scope_decisions',2001,"'effective_from',current_date+1"));
 denied('expired consumer grant',replaceGrant('consumer_access_decisions',3001,"'effective_from',current_date-10,'effective_to',current_date-1"));
 denied('expired source assignment',"update public.employee_store_assignments set effective_to=current_date-1;",rpc(102));
 denied('inactive source assignment','update public.employee_store_assignments set is_active=false;',rpc(102));
 denied('source role store scope mismatch',"update public.employee_roles set scope_type='store',scope_id=fixture_id(5) where employee_id=fixture_id(102);",rpc(102));
 denied('changed own store','update public.employees set store_id=fixture_id(5) where id=fixture_id(103);',rpc(103));
 denied('closed official store',"insert into public.store_business_profiles values(fixture_id(1),null,current_date,null);");
 denied('duplicate store code',"update public.stores set store_id='S1' where id=fixture_id(2);");
 check('duplicate active subject/employee denied',()=>assert.match(sql(`set role service_role; ${authGrant(101,1011,204)}`,true).stderr,/DUPLICATE/));
 check('duplicate auth anchor denied',()=>assert.match(sql(`set role service_role; ${authGrant(104,1014,201)}`,true).stderr,/DUPLICATE/));
 check('missing employee FK/active guard denied',()=>assert.match(sql(`set role service_role; ${authGrant(999,1014,204)}`,true).stderr,/INACTIVE|foreign key/));
 check('M019 scope overlap denied',()=>assert.match(sql(`begin; set role service_role;
 insert into identity_access.m019_scope_decisions select (jsonb_populate_record(null::identity_access.m019_scope_decisions,
 to_jsonb(m)||jsonb_build_object('decision_id',gen_random_uuid(),'decision_key',gen_random_uuid()))).* from identity_access.m019_scope_decisions m where decision_key=fixture_id(2001); rollback;`,true).stderr,/CONFLICTING/));
 check('immutable alias mapping, uniqueness and append-only revoke',()=>{
  sql(`begin; set role service_role; insert into identity_access.store_alias_decisions
  (decision_key,decision_sequence,decision,source_system,source_store_id,canonical_store_id,evidence_reference)
  values(fixture_id(4001),1,'grant','legacy_core',fixture_id(8001),fixture_id(1),'approval:fixture-mapping');
  ${revoke('store_alias_decisions',4001)} rollback;`);
  assert.match(sql(`begin; set role service_role; insert into identity_access.store_alias_decisions
  (decision_key,decision_sequence,decision,source_system,source_store_id,canonical_store_id,evidence_reference)
  values(fixture_id(4001),1,'grant','legacy_core',fixture_id(8001),fixture_id(1),'approval:fixture-mapping'),
  (fixture_id(4002),1,'grant','legacy_core',fixture_id(8001),fixture_id(2),'approval:fixture-mapping'); rollback;`,true).stderr,/AMBIGUOUS/);
 });
 check('source mapping view remains exactly 20 before optional alias configuration',()=>assert.equal(sql('set role service_role; select count(*) from identity_access.store_identity_mapping_v1;').stdout.trim(),'20'));
 check('subject employee mismatch denied',()=>assert.match(sql(`set role service_role; ${authGrant(104,1014,204).replace(digest(104),digest(101))}`,true).stderr,/MISMATCH/));
 for(const role of ['anon','authenticated'])for(const operation of ['select * from identity_access.auth01_binding_decisions',`select ${rpc(101)}`]){
  check(`${role} private access denied: ${operation.includes('from')?'table':'RPC'}`,()=>assert.match(sql(`set role ${role}; ${operation};`,true).stderr,/permission denied/));
 }
 for(const operation of ['update identity_access.auth01_binding_decisions set decision=\'revoke\'','delete from identity_access.m019_scope_decisions','truncate identity_access.consumer_access_decisions']){
  check('service append-only '+operation.split(' ')[0],()=>assert.match(sql(`set role service_role; ${operation};`,true).stderr,/permission denied/));
 }
 check('revocation after employee inactive remains possible',()=>assert.equal(sql(`begin; update public.employees set is_active=false where id=fixture_id(101); set local role service_role; ${revoke('auth01_binding_decisions',1001)} rollback;`).status,0));
 check('immutable revoke rejects reassignment',()=>assert.match(sql(`begin; set local role service_role; ${revoke('auth01_binding_decisions',1001).replace("'decision','revoke'","'decision','revoke','employee_id',fixture_id(104)")} rollback;`,true).stderr,/INVALID_REVOKE/));
 check('rollback isolation rejects stale authoring snapshots',()=>assert.match(sql(`begin isolation level repeatable read; set local role service_role; ${authGrant(104,1014,204)} rollback;`,true).stderr,/READ_COMMITTED/));
 // Real concurrent sessions: second insert must see the committed first grant after advisory lock.
 const asynchronous=(s)=>new Promise(resolve=>{const p=spawn(exe('psql'),args,{env,windowsHide:true});let out='';p.stderr.on('data',d=>out+=d);p.stdout.resume();p.on('close',code=>resolve({code,out}));p.stdin.end(s);});
 const first=asynchronous(`begin; set role service_role; ${authGrant(104,1014,204)} select pg_sleep(1); commit;`);
 await new Promise(r=>setTimeout(r,250));
 const second=asynchronous(`set role service_role; ${authGrant(104,1015,204)}`);
 const concurrent=await Promise.all([first,second]);
 check('concurrent unique active binding',()=>{assert.equal(concurrent.filter(x=>x.code===0).length,1);assert.match(concurrent.find(x=>x.code!==0).out,/DUPLICATE/);});
 sql(await readFile(new URL('../supabase/rollback/production_identity_access_auth01_m019_v1.rollback.sql',import.meta.url),'utf8'));
 check('containment rollback denies server resolver',()=>assert.match(sql(`set role service_role; select ${rpc(101)};`,true).stderr,/permission denied/));
 check('rollback preserves audit ledgers',()=>assert.equal(sql('select count(*) from identity_access.auth01_binding_decisions;').stdout.trim(),'4'));
 console.log(`RESULT ${passed} PASS / 0 FAIL`);
} finally {
 if(local && directory){command('pg_ctl',['-D',directory,'-m','immediate','-w','stop'],undefined,true);if(server?.exitCode===null)server.kill();
  const rel=relative(resolve(tmpdir()),resolve(directory));assert.ok(rel && !rel.startsWith('..') && !rel.includes(':'));
  await rm(directory,{recursive:true,force:true,maxRetries:5});}
}
