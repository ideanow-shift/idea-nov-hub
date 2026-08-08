import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const migrationPath='supabase/migrations/20260808111647_m017_bdf_accounting_publication.sql';
const rollbackPath='supabase/rollback/pr002/m017_bdf_accounting_publication.rollback.sql';

test('M017 scope is Publication release member comparison only',async()=>{
  const sql=await read(migrationPath);
  const tables=[...sql.matchAll(/create table accounting\.([a-z_]+)/gi)].map(x=>x[1]);
  assert.deepEqual(tables,['publication_releases','publication_members','comparison_rules']);
  assert.doesNotMatch(sql,/create (?:table|view) (?:accounting|projection)\.(?:consumer|cash_flow|dashboard)/i);
});

test('M017 pins immutable Publication identity and one member',async()=>{
  const sql=await read(migrationPath);
  for(const token of ['request_key','release_sequence','publication_approval_id','prior_publication_id',
    'accounting_version_id','version_content_hash','validation_cycle_id','supersedes_member_id'])
    assert.match(sql,new RegExp(token));
  assert.match(sql,/publication_id uuid not null unique/i);
  assert.match(sql,/accounting_version_id uuid not null unique/i);
});

test('M017 publication command is fail closed',async()=>{
  const sql=await read(migrationPath);
  for(const code of ['BDF_M017_APPROVED_VERSION_REQUIRED','BDF_M017_STALE_VERSION',
    'BDF_M017_VALIDATION_INCOMPLETE','BDF_M017_APPROVAL_INCOMPLETE',
    'BDF_M017_PRIOR_PUBLICATION_MISMATCH','BDF_M017_IDEMPOTENCY_KEY_REUSE_MISMATCH'])
    assert.match(sql,new RegExp(code));
  assert.match(sql,/m016_required_validation_codes/i);
  assert.match(sql,/actual_value=x\.expected_value/i);
});

test('M017 idempotency is post-lock and binds the complete semantic request',async()=>{
  const sql=await read(migrationPath);
  const publishStart=sql.indexOf('create function accounting.publish_accounting_version');
  const fingerprintStart=sql.indexOf('create function accounting.m017_request_fingerprint');
  const publish=sql.slice(publishStart);
  const fingerprint=sql.slice(fingerprintStart,publishStart);
  const streamLock=publish.indexOf("v.corporation_id::text||'|'||v.period_start::text||'|'||v.scenario_type");
  const requestLock=publish.indexOf("'m017-request|'||p_request_key");
  const requestRecheck=publish.indexOf('where r.request_key=p_request_key');
  const versionRowLock=publish.indexOf('for update');
  assert.ok(streamLock>=0&&streamLock<requestLock&&requestLock<requestRecheck&&requestRecheck<versionRowLock);
  for(const token of ['p_accounting_version_id','p_expected_content_hash','p_actor','p_actor_role',
    'p_reason_code','p_evidence_reference','p_correlation_id','p_expected_prior_publication_id',
    'p_corporation_id','p_accounting_period','p_scenario_type'])
    assert.match(fingerprint,new RegExp(token));
  assert.match(sql,/request_fingerprint text not null/i);
  assert.match(sql,/sha256/i);
  assert.match(publish,/request_fingerprint=computed_fingerprint/i);
});

test('M017 approval matrix reuses M016 evidence',async()=>{
  const sql=await read(migrationPath);
  for(const approval of ['accounting_confirmed','publication_approved','import_validated',
    'operations_confirmed','adjustment_approved','reversal_approved'])
    assert.match(sql,new RegExp(`'${approval}'`));
  assert.doesNotMatch(sql,/create table accounting\.(?:roles|publication_approvals)/i);
});

test('M017 supersede is append only and current is unique at commit',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/pg_advisory_xact_lock/i);
  assert.match(sql,/old\.status='published' and new\.status='superseded'/i);
  assert.match(sql,/BDF_M017_CURRENT_PUBLICATION_COUNT/);
  assert.match(sql,/deferrable initially deferred/gi);
  assert.equal((sql.match(/before update or delete on accounting\.(?:publication_releases|publication_members|comparison_rules)/gi)||[]).length,3);
});

test('M017 audit extends M016 without copying Approval',async()=>{
  const sql=await read(migrationPath);
  for(const action of ['publication_recorded','version_published','version_superseded'])
    assert.match(sql,new RegExp(`'${action}'`));
  assert.match(sql,/publication_approval_id uuid not null[\s\S]*references accounting\.approvals/i);
  assert.doesNotMatch(sql,/update accounting\.approvals/i);
});

test('M017 Previous Year is a rule not a Scenario or Fact',async()=>{
  const sql=await read(migrationPath);
  assert.match(sql,/comparison_scenario='actual'/i);
  assert.match(sql,/period_shift_months between -120 and -1/i);
  assert.doesNotMatch(sql,/previous_year/i);
  assert.doesNotMatch(sql,/create table accounting\.comparison_facts/i);
});

test('M017 security is default deny',async()=>{
  const sql=await read(migrationPath);
  assert.equal((sql.match(/enable row level security/gi)||[]).length,3);
  assert.equal((sql.match(/force row level security/gi)||[]).length,3);
  assert.equal((sql.match(/revoke all on accounting\.(?:publication_releases|publication_members|comparison_rules)/gi)||[]).length,3);
  assert.doesNotMatch(sql,/security definer/i);
  assert.doesNotMatch(sql,/\bproduction\./i);
  assert.doesNotMatch(sql,/create view/i);
});

test('M017 rollback is exact non-CASCADE and restores M016',async()=>{
  const sql=await read(rollbackPath);
  assert.doesNotMatch(sql,/cascade/i);
  assert.match(sql,/drop table accounting\.publication_members/);
  assert.match(sql,/drop table accounting\.publication_releases/);
  assert.match(sql,/drop table accounting\.comparison_rules/);
  assert.match(sql,/BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017/);
  assert.doesNotMatch(sql,/drop table accounting\.(?:validation_results|approvals|audit_events|accounting_versions)/i);
});

test('M017 validation and DB fixture cover release gates',async()=>{
  const validation=await read('supabase/validation/pr002/validate_m017.sql');
  const fixture=await read('supabase/validation/pr002/test_m017_accounting_publication.sql');
  for(const marker of ['BDF_M017_TABLE_COUNT','BDF_M017_FUNCTION_SECURITY_COUNT',
    'BDF_M017_TRIGGER_BINDING_COUNT','BDF_M017_FORBIDDEN_TABLE_GRANT','BDF_M017_CONSUMER_VIEW_COUNT'])
    assert.match(validation,new RegExp(marker));
  for(const label of ['DRAFT_PUBLISH','VALIDATED_UNAPPROVED_PUBLISH','REJECTED_PUBLISH',
    'PENDING_VALIDATION_PUBLISH','STALE_HASH','DUPLICATE_VERSION_PUBLISH',
    'UNAUTHORIZED_PUBLISHER','PUBLICATION_UPDATE','PUBLICATION_DELETE',
    'INVALID_SUPERSEDE','PREVIOUS_YEAR_SCENARIO','IDEMPOTENCY_VERSION_MISMATCH',
    'IDEMPOTENCY_CONTENT_MISMATCH','IDEMPOTENCY_ACTOR_MISMATCH',
    'IDEMPOTENCY_ROLE_MISMATCH','IDEMPOTENCY_REASON_MISMATCH',
    'IDEMPOTENCY_EVIDENCE_MISMATCH','IDEMPOTENCY_CORRELATION_MISMATCH',
    'IDEMPOTENCY_PRIOR_MISMATCH'])
    assert.match(fixture,new RegExp(`'${label}'`));
  assert.match(fixture,/M017_SEQUENTIAL_RETRY_ID_MISMATCH/);
  assert.match(fixture,/M017_PRIOR_VERSION_NOT_SUPERSEDED/);
});
