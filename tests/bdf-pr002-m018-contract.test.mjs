import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const migrationPath='supabase/migrations/20260808131114_m018_bdf_accounting_consumer_projection.sql';
const rollbackPath='supabase/rollback/pr002/m018_bdf_accounting_consumer_projection.rollback.sql';

test('M018 creates exactly the frozen six-view inventory',async()=>{
  const sql=await read(migrationPath);
  const views=[...sql.matchAll(/create view projection\.([a-z0-9_]+)/gi)].map(x=>x[1]);
  assert.deepEqual(views,[
    'accounting_publication_status_v1','accounting_corporation_pl_v1',
    'accounting_corporation_bs_v1','accounting_store_profit_v1',
    'accounting_corporation_comparison_v1','accounting_cash_flow_v1'
  ]);
  assert.doesNotMatch(sql,/create table/i);
});

test('M018 projects only current published Publication members',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/r\.release_status='published' and v\.status='published'/i);
  assert.match(sql,/v\.content_hash=m\.version_content_hash/i);
  assert.doesNotMatch(sql,/status in \([^)]*approved/i);
  assert.doesNotMatch(sql,/status in \([^)]*superseded/i);
});

test('M018 preserves P-L and B-S measure contracts from M013',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/statement_type='pl' and measure_type='period_flow'/i);
  assert.match(sql,/statement_type='bs' and measure_type='ending_balance'/i);
  assert.match(sql,/account_statement_mappings/i);
  assert.match(sql,/sm\.contribution_sign/i);
});

test('M018 replaces balanced allocated sources without double counting',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/not exists[\s\S]*allocation_sets[\s\S]*status='balanced'/i);
  assert.match(sql,/accounting_allocations/i);
  assert.match(sql,/target_scope_type/i);
  assert.match(sql,/attribution_status/i);
});

test('M018 preserves NULL and formal zero',async()=>{
  const sql=await read(migrationPath);
  assert.doesNotMatch(sql,/coalesce\s*\(/i);
  assert.match(sql,/p\.amount\s*\*\s*sm\.contribution_sign/i);
  assert.match(sql,/value_status='not_applicable'/i);
});

test('M018 has a fail-closed disabled Cash Flow contract',async()=>{
  const sql=await read(migrationPath);
  const cf=sql.slice(sql.indexOf('create view projection.accounting_cash_flow_v1'));
  assert.match(cf,/where false/i);
  assert.match(cf,/cash_flow_gate_disabled/i);
  assert.doesNotMatch(sql,/create table accounting\.cash_flow/i);
});

test('M018 is security-invoker and default deny',async()=>{
  const sql=await read(migrationPath);
  assert.equal((sql.match(/security_invoker=true/gi)||[]).length,6);
  assert.equal((sql.match(/security_barrier=true/gi)||[]).length,6);
  assert.match(sql,/security invoker set search_path=''/i);
  assert.equal((sql.match(/revoke all on projection\.accounting_/gi)||[]).length,6);
  assert.doesNotMatch(sql,/security definer/i);
  assert.doesNotMatch(sql,/\bproduction\./i);
});

test('M018 exposes no raw lineage, PII, write, API, or M019 scope',async()=>{
  const sql=await read(migrationPath);
  assert.doesNotMatch(sql,/create (?:policy|trigger|table)/i);
  assert.doesNotMatch(sql,/grant (?:insert|update|delete)/i);
  assert.doesNotMatch(sql,/\b(?:email|phone|address|raw_payload|source_record_key)\b/i);
  assert.doesNotMatch(sql,/store_operations|finance_api|dashboard|executive_summary/i);
});

test('M018 rollback is exact, non-CASCADE, and leaves M017',async()=>{
  const sql=await read(rollbackPath);
  assert.equal((sql.match(/drop view projection\./gi)||[]).length,6);
  assert.match(sql,/drop function projection\.m018_current_published_lines/i);
  assert.doesNotMatch(sql,/cascade/i);
  assert.doesNotMatch(sql,/drop (?:table|function) accounting\./i);
});

test('M018 validation and DB fixture cover release gates',async()=>{
  const validation=await read('supabase/validation/pr002/validate_m018.sql');
  const fixture=await read('supabase/validation/pr002/test_m018_accounting_consumer_projection.sql');
  for(const marker of ['BDF_M018_VIEW_COUNT','BDF_M018_SECURITY_INVOKER_COUNT',
    'BDF_M018_CURRENT_PUBLICATION_FUNCTION_CONTRACT','BDF_M018_FORBIDDEN_VIEW_GRANT',
    'BDF_M018_RAW_ACCOUNTING_GRANT','BDF_M018_CASH_FLOW_MUST_BE_DISABLED'])
    assert.match(validation,new RegExp(marker));
  for(const label of ['SUPERSEDED_EXCLUDED','APPROVED_NOT_PUBLISHED_EXCLUDED',
    'NULL_NOT_ZERO','FORMAL_ZERO_PRESERVED','RAW_FACT_ACCESS','CONSUMER_VIEW_DML',
    'UNAUTHORIZED_CONSUMER','NO_PUBLICATION_NO_PROJECTION'])
    assert.match(fixture,new RegExp(label));
});
