import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('supabase/functions/nov-hub-api/index.ts', 'utf8');
const management = readFileSync('supabase/functions/nov-hub-api/management_readonly_candidate.ts', 'utf8');
const foundation = readFileSync('supabase/migrations/20260820215852_store_operations_staging_uat_security_runtime.sql', 'utf8');
const binding = readFileSync('supabase/migrations/20260820223000_store_operations_uat_auth_delivery_binding.sql', 'utf8');
const businessDate = readFileSync('supabase/migrations/20260820225000_store_operations_uat_business_date_wrappers.sql', 'utf8');
const serverRoleCorrective = readFileSync('supabase/migrations/20260822084829_store_operations_uat_server_role_corrective.sql', 'utf8');
const generator = readFileSync('scripts/store-operations-staging-uat-artifact.mjs', 'utf8');

test('management runtime accepts only the formal HUB session path', () => {
  assert.match(index, /authType: requestedAuthType/);
  assert.match(index, /String\(authUser\.authType \|\| ""\) !== requestedAuthType/);
  assert.doesNotMatch(index, /\/auth\/v1\/(user|otp|admin\/users)/);
  assert.doesNotMatch(index, /STORE_OPERATIONS_UAT_ONBOARDING_SECRET|verifyNativeStagingAuthSubject/);
  assert.doesNotMatch(index, /password\s*:/i);
  assert.match(management, /resolveCanonicalAccess/);
  assert.match(management, /SCOPE_DENIED/);
});

test('Hosted Store Operations request headers pass the Edge CORS preflight', () => {
  assert.match(index, /Access-Control-Allow-Headers[^\n]*x-contract-version[^\n]*x-request-id/i);
  assert.match(index, /request\.headers\.get\(["']authorization["']\)[\s\S]*\^Bearer\\s\+/i);
  assert.match(index, /token:\s*bearerToken\s*\|\|\s*String\(data\.token/);
});

test('private tables and AUTH-01 RPCs deny browser roles', () => {
  assert.match(foundation, /force row level security/gi);
  assert.match(foundation, /revoke all on all tables in schema store_operations_uat_private from public,anon,authenticated,service_role/);
  for (const source of [foundation, binding, businessDate]) {
    assert.match(source, /revoke all on function[\s\S]*from public,anon,authenticated/);
  }
  assert.match(binding, /delivery_digest=p_delivery_digest/);
  assert.match(binding, /STORE_OPERATIONS_UAT_BINDING_ALREADY_EXISTS/);
});

test('server-only RPCs use the active PostgREST role and retain browser denial', () => {
  assert.doesNotMatch(serverRoleCorrective, /request\.jwt\.claim\.role/);
  assert.match(serverRoleCorrective, /current_setting\('role',true\)[\s\S]*<>\s*'service_role'/);
  assert.equal((serverRoleCorrective.match(/STORE_OPERATIONS_UAT_SERVER_ONLY/g) || []).length, 2);
  assert.match(serverRoleCorrective, /revoke all on function public\.store_operations_uat_resolve_access_v1\(uuid,date\)[\s\S]*from public,anon,authenticated/);
  assert.match(serverRoleCorrective, /revoke all on function public\.store_operations_uat_resolve_access_v2\(uuid\)[\s\S]*from public,anon,authenticated/);
  assert.match(serverRoleCorrective, /revoke all on function public\.store_operations_uat_master_read_v1\(\)[\s\S]*from public,anon,authenticated/);
  assert.match(serverRoleCorrective, /grant execute on function public\.store_operations_uat_resolve_access_v1\(uuid,date\) to service_role/);
  assert.match(serverRoleCorrective, /grant execute on function public\.store_operations_uat_master_read_v1\(\) to service_role/);
  assert.doesNotMatch(serverRoleCorrective, /idea-nov-dbf-prod|production/i);
});

test('sealed runner fixes exact UAT counts and remains dry-run first', () => {
  assert.match(generator, /CORPORATION_COUNT_MISMATCH/);
  assert.match(generator, /STORE_COUNT_MISMATCH/);
  assert.match(generator, /UAT_EMPLOYEE_COUNT_MISMATCH/);
  assert.match(generator, /DIRECT_COUNT_MISMATCH/);
  assert.match(generator, /FC_COUNT_MISMATCH/);
  assert.match(generator, /mode: 'dry-run'/);
  assert.match(generator, /syntheticCount: 0, duplicateCount: 0, writes: 0/);
});

test('scope comes from canonical assignments and preserves no-write projection', () => {
  assert.match(foundation, /role_key_value='executive'[\s\S]*cardinality\(store_ids\)<>20/);
  assert.match(foundation, /role_key_value='area_manager'[\s\S]*core\.employee_store_assignments/);
  assert.match(foundation, /role_key_value='store_manager'[\s\S]*cardinality\(store_ids\)<>1/);
  assert.doesNotMatch(index, /insert into|update\s+dbf|delete from/i);
});
