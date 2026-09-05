import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductionReadPayload, resolveProductionCanonicalAccess } from '../supabase/functions/nov-hub-api/store_operations_production_access.mjs';
export const fixtureId = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function fixtureResult(role='executive') {
 const stores=Array.from({length:20},(_,i)=>({id:fixtureId(i+1),store_id:`s-${i+1}`,store_no:String(i+1),
  store_name:`Fixture ${i+1}`,corporation_id:fixtureId(501),store_type:i<13?'DIRECT':'FC',is_active:true}));
 return {contract:'production_identity_access_v1',employeeId:fixtureId(101),roleKeys:[role],
  scope:{mode:({executive:'all',area_manager:'assigned',store_manager:'own'})[role],storeIds:role==='executive'?stores.map(s=>s.id):[stores[0].id]},
  masters:{stores,corporations:[{id:fixtureId(501),corporation_name:'Fixture',is_active:true}],corporation_business_profiles:[{corporation_id:fixtureId(501),fiscal_year_end_month:8}]}};
}
export function fixtureInput(overrides={}) {
 return {session:{authType:'hub_session',employeeId:fixtureId(101),sessionId:fixtureId(901),audience:'nov_hub',expiresAt:'2099-01-01T00:00:00Z'},
  projectRef:'nkmxevmioczcmnldreyo',rolloutState:'OWNER_PILOT',ownerEmployeeId:fixtureId(101),rpc:async()=>fixtureResult(),...overrides};
}
for(const role of ['executive','area_manager','store_manager'])test(`server resolves ${role}`,async()=>{
 const result=await resolveProductionCanonicalAccess(fixtureInput({rpc:async()=>fixtureResult(role)}));
 assert.equal(result.roleKeys[0],role);assert.equal(result.scope.storeIds.length,role==='executive'?20:1);
});
test('RPC receives verified subject digest only; token, email and subject never forwarded',async()=>{
 let seen;await resolveProductionCanonicalAccess(fixtureInput({rpc:async(name,args)=>{seen={name,args};return fixtureResult();}}));
 assert.equal(seen.name,'store_operations_production_access_v1');assert.deepEqual(Object.keys(seen.args),['p_subject_digest']);
 assert.match(seen.args.p_subject_digest,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(seen).includes(fixtureId(101)));
});
for(const key of ['employeeId','role','scope','storeId','email','subject','identity_key','targetPrincipal','storeUUID','ownerEmployeeId']){
 test(`browser ${key} assertion denied`,()=>assert.throws(()=>assertProductionReadPayload({[key]:'injected'}),/DENIED/));
}
test('ordinary projection options accepted (scope ceiling enforced downstream)',()=>assert.doesNotThrow(()=>assertProductionReadPayload({authType:'hub_session',selectedMonth:'2026-06',scopeMode:'own'})));
for(const key of ['uat_actor','uat_scenario','uat_assumption_key','uatActor','uatScenario','uatAssumptionKey','technicalAssumption']){
 test(`signed ${key} denied before RPC`,async()=>{
  const input=fixtureInput();input.session[key]='not-allowed';input.rpc=()=>assert.fail('must not call RPC');
  await assert.rejects(()=>resolveProductionCanonicalAccess(input),/DENIED/);
 });
}
for(const key of ['employeeId','sessionId','audience','expiresAt','authType'])test(`invalid verified ${key} fails closed`,async()=>{
 const input=fixtureInput();input.session[key]='invalid';await assert.rejects(()=>resolveProductionCanonicalAccess(input),/DENIED/);
});
test('expired signed session denied',async()=>{const input=fixtureInput();input.session.expiresAt='2000-01-01T00:00:00Z';await assert.rejects(()=>resolveProductionCanonicalAccess(input),/DENIED/);});
test('database errors never disclose raw credentials',async()=>{
 await assert.rejects(()=>resolveProductionCanonicalAccess(fixtureInput({rpc:async()=>{throw Error('secret-token subject-uuid');}})),e=>e.message==='PRODUCTION_CANONICAL_ACCESS_DENIED');
});
for(const mutate of [r=>r.employeeId=fixtureId(102),r=>r.scope.storeIds.push(fixtureId(800)),r=>r.roleKeys.push('area_manager'),r=>r.scope.mode='own',r=>r.masters.stores.pop(),r=>r.masters.stores[0].store_id=r.masters.stores[0].id]){
 test('malformed/ambiguous canonical response denied',async()=>{const result=fixtureResult();mutate(result);await assert.rejects(()=>resolveProductionCanonicalAccess(fixtureInput({rpc:async()=>result})),/DENIED/);});
}
for(const overrides of [{rolloutState:'DISABLED'},{ownerEmployeeId:fixtureId(999)},{projectRef:'wrong-project'}])test('rollout remains fail-closed',async()=>{
 await assert.rejects(()=>resolveProductionCanonicalAccess(fixtureInput(overrides)),/DENIED/);
});
