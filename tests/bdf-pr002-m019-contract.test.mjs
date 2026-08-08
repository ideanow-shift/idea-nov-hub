import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/20260808211137_m019_bdf_accounting_consumer_release_security.sql');
const rollback=read('supabase/rollback/pr002/m019_bdf_accounting_consumer_release_security.rollback.sql');
const validation=read('supabase/validation/pr002/validate_m019.sql');
const fixture=read('supabase/validation/pr002/test_m019_accounting_consumer_release_security.sql');
const design=read('docs/architecture/42_pr002_m019_accounting_consumer_release_security_design_package.md');
const gate=read('docs/architecture/43_pr002_m019_accounting_consumer_release_security_release_gate.md');

test('M019 owns one append-only Consumer access table and no Accounting logic',()=>{
  assert.equal((migration.match(/create table /gi)||[]).length,1);
  assert.match(migration,/create table accounting\.consumer_access_contracts/i);
  assert.doesNotMatch(migration,/create (?:materialized )?view|create index[^;]*(?:facts|journal|publication)/i);
});
test('Canonical identity, assignment and organization scope are pinned without role names',()=>{
  for(const x of ['employee_identities','employee_store_assignments','corporation_store_relationships','departments'])assert.match(migration,new RegExp(x));
  assert.doesNotMatch(migration,/store_manager|representative|finance_manager|employee UUID/i);
});
test('Access decisions are append-only and grant/revoke chains fail closed',()=>{
  for(const x of ['ACCESS_CONTRACT_APPEND_ONLY','ACCESS_CHAIN_MUST_START_GRANT','ACCESS_CHAIN_INVALID','AUTH_SUBJECT_IDENTITY_CONFLICT'])assert.match(migration,new RegExp(x));
});
test('The only Consumer port reads M018 projections with fixed inputs and no dynamic SQL',()=>{
  assert.match(migration,/read_accounting_consumer_v1\(\s*p_projection text,p_corporation_id uuid,p_accounting_period date,p_scenario_type text/i);
  for(const x of ['accounting_publication_status_v1','accounting_corporation_pl_v1','accounting_corporation_bs_v1','accounting_store_profit_v1','accounting_corporation_comparison_v1','accounting_cash_flow_v1'])assert.match(migration,new RegExp(x));
  assert.doesNotMatch(migration,/\bexecute\s+(?:format|p_)|format\s*\(/i);
});
test('SECURITY DEFINER is limited to the authenticated read port',()=>{
  assert.equal((migration.match(/security definer/gi)||[]).length,1);
  assert.match(migration,/language plpgsql stable security definer set search_path=''/i);
  assert.match(migration,/request\.jwt\.claim/);
});
test('Least privilege leaves raw Accounting and M018 Views ungranted',()=>{
  assert.match(migration,/revoke all on accounting\.consumer_access_contracts from public,anon,authenticated,service_role/i);
  assert.match(migration,/grant execute on function projection\.read_accounting_consumer_v1[^;]*to authenticated/i);
  assert.doesNotMatch(migration,/grant (?:select|insert|update|delete|truncate)[^;]*(?:accounting\.|accounting_.*_v1)/i);
});
test('Scenario and publication boundaries remain M017/M018-owned',()=>{
  for(const x of ["'actual','budget','forecast'",'current_consumer_access_contracts','accounting_cash_flow_v1'])assert.match(migration,new RegExp(x));
  assert.doesNotMatch(migration,/previous_year[^\n]*scenario|release_status\s*=|status\s*=\s*'published'/i);
});
test('Validation freezes grants, view protection, PII and privilege escalation',()=>{
  for(const x of ['M018_VIEW_PROTECTION_DRIFT','RAW_ACCOUNTING_GRANT','SECURITY_DEFINER_INVENTORY_DRIFT','PII_OR_PRODUCTION_COLUMN'])assert.match(validation,new RegExp(x));
});
test('Negative suite covers the authorized denial matrix',()=>{
  for(const x of ['ANON_DENIED','UNAUTHORIZED_CONSUMER','UNAUTHORIZED_ROLE','STORE_SCOPE_DENIED','DEPARTMENT_SCOPE_DENIED','RAW_TABLE_SELECT','PROJECTION_DML','PUBLICATION_WRITE','WRONG_SCENARIO','DIRECT_HELPER_ABUSE','INACTIVE_EMPLOYEE','INVALID_ASSIGNMENT'])assert.match(fixture,new RegExp(x));
  assert.match(fixture,/rollback;\s*$/i);
});
test('Rollback is exact, non-CASCADE and restores the M018 boundary',()=>{
  assert.doesNotMatch(rollback,/cascade/i);
  for(const x of ['read_accounting_consumer_v1','current_consumer_access_contracts','guard_consumer_access_contract','consumer_access_contracts'])assert.match(rollback,new RegExp(x));
  assert.doesNotMatch(rollback,/drop (?:table|view)[^;]*(?:publication|accounting_corporation)/i);
});
test('Design and Release Gate keep UI, API business logic and Production out of scope',()=>{
  assert.match(design,/M018[^\n]*single Consumer projection source|M018 Projection/i);
  assert.match(gate,/Production接続0|Production dependency 0/i);
  for(const x of ['Store Operations UI','Finance UI','Consumer-specific KPI'])assert.match(design,new RegExp(x,'i'));
});
test('M019 creates no writer or lock path',()=>{
  assert.doesNotMatch(migration,/pg_advisory|for update|lock table/i);
  assert.match(gate,/additional Concurrency Gate is不要/i);
});
