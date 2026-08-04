import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260804231827_nov_talent_fair_master_schema_completion.sql', import.meta.url);
const contractPath = new URL('../docs/nov_talent/fair_master_schema_completion/fair-master-schema-contract.json', import.meta.url);
const sql = readFileSync(migrationPath, 'utf8');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

test('Fair Master raw measures distinguish NULL from confirmed zero', () => {
  const existingRawMeasures = [
    'participation_fee',
    'participant_count',
    'contact_count',
    'line_registration_count',
    'salon_tour_count',
    'interview_count',
    'offer_count',
    'hire_count'
  ];
  for (const column of existingRawMeasures) {
    assert.match(sql, new RegExp(`alter column ${column} drop default`));
    assert.match(sql, new RegExp(`alter column ${column} drop not null`));
  }
  assert.doesNotMatch(sql, /coalesce\s*\(\s*\(p_payload->>'(?:participationFee|participantCount|contactCount|lineRegistrationCount|salonTourCount|interviewCount|offerCount|hireCount)'\)::integer\s*,\s*0\s*\)/i);
  assert.match(sql, /nullif\(btrim\(p_payload->>'participationFee'\),' '\)::integer|nullif\(btrim\(p_payload->>'participationFee'\),''\)::integer/);
});

test('Fair Master stores every approved source field without persisting derived rates', () => {
  for (const column of contract.addedFields) {
    assert.match(sql, new RegExp(`add column ${column}`));
  }
  for (const derived of contract.derivedOnly) {
    assert.doesNotMatch(sql, new RegExp(`add column ${derived}`));
  }
});

test('migration never rewrites or deletes existing Fair rows', () => {
  const schemaSection = sql.split('create or replace function')[0];
  assert.doesNotMatch(schemaSection, /update\s+public\.nov_talent_fair_masters_v1/i);
  assert.doesNotMatch(schemaSection, /delete\s+from\s+public\.nov_talent_fair_masters_v1/i);
  assert.equal(contract.existingRemoteBaseline.existingRowsRewritten, 0);
});

test('write RPC preserves RLS boundary, role checks, audit, and omitted fields', () => {
  assert.match(sql, /security definer set search_path = public, pg_temp/);
  assert.match(sql, /'super_admin','backoffice','hr.admin','hr.staff'/);
  assert.match(sql, /insert into public\.nov_talent_recruitment_master_audit_v1/);
  assert.match(sql, /p_payload \? 'participationFee'/);
  assert.match(sql, /revoke all on function public\.nov_talent_mutate_recruitment_master_v1[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.nov_talent_mutate_recruitment_master_v1[\s\S]*to service_role/);
});

test('contract is staging-only and waits for explicit deployment approval', () => {
  assert.equal(contract.environment, 'idea-nov-staging');
  assert.equal(contract.productionApplicationAllowed, false);
  assert.equal(contract.deployment.stagingApplied, false);
  assert.equal(contract.deployment.status, 'AWAITING_EXPLICIT_APPROVAL');
  assert.equal(contract.deployment.sourceBackfillExecuted, false);
});
