import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20260825012056_store_operations_single_licensed_owner_technical_uat_v1.sql","utf8");
const bridge=readFileSync("supabase/functions/nov-hub-api/firebase_auth01_external_bridge.mjs","utf8");
const runtime=readFileSync("supabase/functions/nov-hub-api/index.ts","utf8");

test("independent Google-account runtime is disabled and Wakita is the sole browser principal",()=>{
  assert.match(bridge,/"m\.wakita@idea-nov\.com"/);
  assert.doesNotMatch(bridge,/"uat-area-manager@idea-nov\.com"\s*:/);
  assert.doesNotMatch(bridge,/"uat-store-manager@idea-nov\.com"\s*:/);
  assert.match(migration,/revoke all on function public\.store_operations_external_enrollment_issue_v2[\s\S]*service_role/);
  assert.match(migration,/revoke all on function public\.store_operations_external_enrollment_consume_v2[\s\S]*service_role/);
});

test("technical challenge fixes scenario server-side and rejects browser target authority",()=>{
  assert.match(migration,/scenario in \('area_manager','store_manager'\)/);
  assert.match(migration,/identity_key in \('uat-area-manager','uat-store-manager'\)/);
  for(const forbidden of ["identityKey","targetPrincipal","targetScenario"]){
    assert.doesNotMatch(bridge,new RegExp(`acceptedBrowserKeys[^\\n]+${forbidden}`));
  }
  assert.match(runtime,/store_operations_technical_assumption_consume_v1/);
  assert.doesNotMatch(runtime,/p_expected_identity_key/);
});

test("assumption decisions are append-only, short-lived and non-overlapping",()=>{
  assert.match(migration,/before update or delete on store_operations_uat_private\.technical_assumption_decisions/);
  assert.match(migration,/STORE_OPERATIONS_TECHNICAL_ASSUMPTION_OVERLAP/);
  assert.match(migration,/interval '15 minutes'/);
  assert.match(migration,/decision in \('grant','revoke'\)/);
  assert.match(migration,/store_operations_technical_assumption_revoke_v1/);
  assert.match(migration,/store_operations_technical_assumption_validate_v1/);
});

test("browser roles cannot execute private assumption RPCs",()=>{
  for(const fn of ["issue","consume","validate","revoke"]){
    assert.match(migration,new RegExp(`revoke all on function public\\.store_operations_technical_assumption_${fn}_v1[\\s\\S]*from public,anon,authenticated`));
  }
  assert.match(migration,/grant execute on function public\.store_operations_technical_assumption_consume_v1[\s\S]*to service_role/);
  assert.doesNotMatch(migration,/idea-nov-dbf-prod|nkmxevmioczcmnldreyo|production endpoint/i);
});

test("technical sessions are auditable without real employee names or raw identity",()=>{
  assert.match(bridge,/uat_actor: "owner_controlled_technical_principal"/);
  assert.match(bridge,/uat_scenario: technicalScenario/);
  assert.match(runtime,/Technical UAT assumption is no longer active/);
  assert.doesNotMatch(bridge,/Toda|Masumoto|\u6238\u7530|\u685d\u672c/);
  assert.doesNotMatch(bridge,/firebase_token|service_role/);
});
