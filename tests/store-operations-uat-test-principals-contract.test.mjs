import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20260824232711_store_operations_uat_test_principals_v1.sql","utf8");
const rollback=readFileSync("supabase/rollback/20260824232711_store_operations_uat_test_principals_v1.rollback.sql","utf8");
const bridge=readFileSync("supabase/functions/nov-hub-api/firebase_auth01_external_bridge.mjs","utf8");
const runtime=readFileSync("supabase/functions/nov-hub-api/index.ts","utf8");
const original=readFileSync("supabase/migrations/20260823223102_store_operations_external_subject_binding.sql","utf8");

test("principal allowlist is exact and cannot derive authorization from browser claims",()=>{
  for(const value of ["m.wakita@idea-nov.com","uat-area-manager@idea-nov.com","uat-store-manager@idea-nov.com",
    "uat-executive","uat-area-manager","uat-store-manager","executive","area_manager","store_manager","all","assigned","own"]){
    assert.match(bridge,new RegExp(value.replaceAll(".","\\.")));
  }
  assert.match(bridge,/Object\.hasOwn\(FIREBASE_AUTH01_BRIDGE\.principals, email\)/);
  assert.match(bridge,/expectedIdentityKey: verified\.identityKey/);
  assert.doesNotMatch(bridge,/employeeId:\s*principal\./);
  assert.match(runtime,/store_operations_external_enrollment_consume_v2/);
  assert.match(runtime,/p_expected_identity_key: expectedIdentityKey/);
});

test("corrective migration uses read-back constraint names and only three identity keys",()=>{
  assert.match(migration,/drop constraint external_subject_enrollment_challenges_identity_key_check/);
  assert.match(migration,/drop constraint external_subject_enrollment_challenges_approval_reference_check/);
  assert.match(migration,/drop constraint external_subject_binding_decisions_evidence_reference_check/);
  assert.match(migration,/identity_key in \('uat-executive','uat-area-manager','uat-store-manager'\)/);
  assert.match(migration,/approval:OWNER-STORE-OPS-UAT-TEST-PRINCIPALS-2026-08-25-V1/g);
  assert.doesNotMatch(migration,/idea-nov-dbf-prod|production/i);
  assert.match(original,/identity_key='uat-executive'/);
});

test("v2 issue and atomic consume validate principal role scope and expected store",()=>{
  for(const value of ["store_operations_external_enrollment_issue_v2","store_operations_external_enrollment_consume_v2",
    "STORE_OPERATIONS_EXTERNAL_CHALLENGE_DENIED","STORE_OPERATIONS_UAT_SCOPE_DENIED","approved.expected_store_id",
    "jsonb_array_length(access#>'{scope,storeIds}')<>expected_count"]){assert.match(migration,new RegExp(value.replaceAll("(","\\(" ).replaceAll(")","\\)")));}
  assert.match(migration,/where challenge_hash=p_challenge_hash and identity_key=p_expected_identity_key and consumed_at is null/);
  assert.match(migration,/p_effective_to>consumed_at_value\+interval '14 days'/);
  assert.match(migration,/revoke all on function public\.store_operations_external_enrollment_issue_v1[\s\S]*service_role/);
  assert.match(migration,/grant execute on function public\.store_operations_external_enrollment_consume_v2[\s\S]*to service_role/);
});

test("rollback removes v2, preserves append-only audit compatibility and restores V1 service grants",()=>{
  assert.match(rollback,/drop function public\.store_operations_external_enrollment_consume_v2/);
  assert.match(rollback,/drop function public\.store_operations_external_enrollment_issue_v2/);
  assert.doesNotMatch(rollback,/delete from|update\s+store_operations_uat_private/i);
  assert.match(rollback,/append-only UAT audit rows stay valid/);
  assert.match(rollback,/grant execute on function public\.store_operations_external_enrollment_consume_v1[\s\S]*to service_role/);
});
