import{createWriteAuthorizer}from'../supabase/functions/nov-talent-write-api/auth.ts';
import{INVALIDATION_ALLOWLIST,parseHistoricalReview,parseInvalidation,parseStudentProfile,parseWrite,sanitizeCreateResult,sanitizeHistoricalReviewResult,sanitizeStudentProfileResult}from'../supabase/functions/nov-talent-write-api/domain.ts';
import{handleTalentWrite}from'../supabase/functions/nov-talent-write-api/http.ts';
import{createWriteRuntime,WRITE_RUNTIME_CONTRACT}from'../supabase/functions/nov-talent-write-api/runtime-adapter.ts';
import{TALENT_ADMIN_GOVERNANCE,validateTalentAdminGovernance}from'../supabase/functions/nov-talent-write-api/governance.ts';
import{AUDIT_CONTRACT,validatePrivateAuditRecord,validateSafeAuditEntry}from'../supabase/functions/nov-talent-write-api/audit-contract.ts';
const check=(v:unknown,m='assertion_failed')=>{if(!v)throw new Error(m)};
const b64=(v:unknown)=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function token(secret:string){const now=Math.floor(Date.now()/1000),h=b64({alg:'HS256',typ:'NOV-HUB-APP-SESSION',v:1});
 const p=b64({v:1,sid:'00000000-0000-4000-8000-000000000001',sub:'00000000-0000-4000-8000-000000000002',aud:'nov_hub',auth_source:'hub_pin',iat:now,exp:now+60,role_version_checked_at:now});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${h}.${p}`)));
 const s=btoa(String.fromCharCode(...sig)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');return`${h}.${p}.${s}`;}

Deno.test('module-private capability requires exact server role',async()=>{const secret='x'.repeat(32),jwt=await token(secret);
 const governance={role:'talent_admin',active:true,assignmentApproved:true,assignedAt:new Date(Date.now()-86400000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),reviewedAt:new Date(Date.now()-60000).toISOString(),revoked:false};
 check(await createWriteAuthorizer({signingSecret:secret,resolveServerGovernance:async()=>governance}).authorize(jwt));
 check(await createWriteAuthorizer({signingSecret:secret,resolveServerGovernance:async()=>({...governance,role:'browser_talent_admin'})}).authorize(jwt)===null);
});
Deno.test('write and invalidation reject extra keys and withdrawn scope',()=>{
 check(parseWrite({metricKey:'contacts',eventCode:'CONTACT_RECORDED',eventAt:new Date().toISOString()}));
 check(parseWrite({metricKey:'contacts',eventCode:'CONTACT_RECORDED',eventAt:new Date().toISOString(),extra:true})===null);
 check(parseInvalidation({applicationNo:'NT-2026-000001',metricKey:'offers',fiscalYear:2026,code:'WITHDRAWN'})===null);
 check(parseInvalidation({applicationNo:'NT-2026-000001',metricKey:'expectedJoiners',fiscalYear:2026,code:'WITHDRAWN'}));
});
Deno.test('historical review accepts bounded exact proposals and fixed safe results',()=>{
 const primaryRecordIds=['00000000-0000-4000-8000-000000000001'];
 const linkPairs=[{sourceRecordId:'00000000-0000-4000-8000-000000000002',targetRecordId:primaryRecordIds[0]}];
 check(parseHistoricalReview({primaryRecordIds,linkPairs}));
 check(parseHistoricalReview({primaryRecordIds:[...primaryRecordIds,...primaryRecordIds],linkPairs})===null);
 check(parseHistoricalReview({primaryRecordIds,linkPairs:[{...linkPairs[0],extra:true}]})===null);
 const safe=[{requestedPrimary:1,createdPrimary:1,requestedLinks:1,confirmedLinks:1,remainingUnmapped:3,canonicalEventCreated:false,rawValuesIncluded:false}];
 check(sanitizeHistoricalReviewResult(safe)?.remainingUnmapped===3);
 check(sanitizeHistoricalReviewResult([{...safe[0],canonicalEventCreated:true}])===null);
});
Deno.test('student profile accepts exact bounded fields and safe version result',()=>{
 const payload={applicationNo:null,expectedVersion:0,displayName:'表示 氏名',kana:'ヒョウジ シメイ',school:'表示学校',phone:null,email:'owner@example.test',preferredStore:null,currentStatus:'CONTACT',nextActionAt:'2026-08-01',offerDate:null,expectedJoinDate:null,plannedStore:null};
 check(parseStudentProfile(payload));check(parseStudentProfile({...payload,extra:true})===null);
 check(parseStudentProfile({...payload,email:'invalid'})===null);
 const result=sanitizeStudentProfileResult([{application_no:'NT-2027-000001',profile_version:1,operation:'CREATE'}]);
 check(result?.applicationNo==='NT-2027-000001'&&result.profileVersion===1);
});
Deno.test('owner-attested invalidation matrix accepts exact pairs and rejects every unsupported pair',()=>{
 const metrics=Object.keys(INVALIDATION_ALLOWLIST),codes=['CANCELLED','NO_SHOW','DELETED','WITHDRAWN'];
 for(const metricKey of metrics)for(const code of codes){const value={applicationNo:'NT-2026-000001',metricKey,fiscalYear:2026,code};
  const expected=INVALIDATION_ALLOWLIST[metricKey as keyof typeof INVALIDATION_ALLOWLIST].includes(code as never);
  check(Boolean(parseInvalidation(value))===expected,`${metricKey}:${code}`);
 }
});
Deno.test('talent_admin governance enforces approval, 90-day expiry, 30-day review, active exact role, and revocation',()=>{
 const now=Date.parse('2026-07-20T00:00:00Z');const valid={role:'talent_admin',active:true,assignmentApproved:true,assignedAt:'2026-06-01T00:00:00Z',expiresAt:'2026-08-30T00:00:00Z',reviewedAt:'2026-07-01T00:00:00Z',revoked:false};
 check(validateTalentAdminGovernance(valid,now));
 for(const invalid of [{...valid,role:'browser_talent_admin'},{...valid,assignmentApproved:false},{...valid,active:false},{...valid,revoked:true},{...valid,expiresAt:'2026-07-20T00:00:00Z'},{...valid,expiresAt:'2026-09-01T00:00:01Z'},{...valid,reviewedAt:'2026-06-19T23:59:59Z'},{...valid,extra:true}])check(validateTalentAdminGovernance(invalid,now)===null);
 check(TALENT_ADMIN_GOVERNANCE.assignmentTimeLimitDays===90&&TALENT_ADMIN_GOVERNANCE.reviewIntervalDays===30&&TALENT_ADMIN_GOVERNANCE.browserAuthority===false);
});
Deno.test('non-sensitive append-only audit accepts fixed fields only and rejects identifiers or free text',()=>{
 const valid={event:'WRITE_DENIED',reasonCode:'REVIEW_OVERDUE',outcome:'DENY',occurredAt:'2026-07-20T00:00:00Z'};check(validateSafeAuditEntry(valid));
 for(const extra of ['token','claims','personalValues','rawError','freeText','applicationNo','applicationUUID'])check(validateSafeAuditEntry({...valid,[extra]:'forbidden'})===null);
 const privateRecord={...valid,actor_employee_id:'00000000-0000-4000-8000-000000000001',application_id:'00000000-0000-4000-8000-000000000002',funnel_event_id:'00000000-0000-4000-8000-000000000003'};
 check(validatePrivateAuditRecord(privateRecord));check(validatePrivateAuditRecord({...privateRecord,token:'forbidden'})===null);
 check(AUDIT_CONTRACT.appendOnly===true&&AUDIT_CONTRACT.serverTimestampRequired===true&&AUDIT_CONTRACT.backendPrivateFieldsOutputAllowed===false&&AUDIT_CONTRACT.transactionBoundary==='MUTATION_AND_AUDIT_SAME_RPC_TRANSACTION');
});
Deno.test('OPTIONS has CORS and request0',async()=>{let auth=0,rpc=0;const res=await handleTalentWrite(new Request('https://local/functions/v1/nov-talent-write-api/api/talent/v1/events',{method:'OPTIONS',headers:{origin:'https://ideanow-shift.github.io'}}),
 {authorizer:{authorize:async()=>{auth++;return null}},rpc:async()=>{rpc++;return null}});
 check(res.status===204);check(res.headers.get('access-control-allow-origin')==='https://ideanow-shift.github.io');check(auth===0&&rpc===0);
});
Deno.test('historical review route invokes only the sealed atomic RPC and returns safe counts',async()=>{
 let rpcName='',rpcArgs:Record<string,unknown>|null=null;
 const response=await handleTalentWrite(new Request('https://local/functions/v1/nov-talent-write-api/api/talent/v1/historical/review',{
  method:'POST',headers:{origin:'https://ideanow-shift.github.io',authorization:'Bearer a.a.a','content-type':'application/json'},
  body:JSON.stringify({primaryRecordIds:['00000000-0000-4000-8000-000000000001'],linkPairs:[]})
 }),{authorizer:{authorize:async()=>({actorEmployeeId:'00000000-0000-4000-8000-000000000009'} as never)},rpc:async(_cap,name,args)=>{
  rpcName=name;rpcArgs=args;return[{requestedPrimary:1,createdPrimary:1,requestedLinks:0,confirmedLinks:0,remainingUnmapped:2,canonicalEventCreated:false,rawValuesIncluded:false}];
 }});
 check(response.status===200);check(rpcName==='apply_nov_talent_historical_review_v1');
 check((rpcArgs as unknown as Record<string,unknown>).p_reviewer_employee_id==='00000000-0000-4000-8000-000000000009');
 const body=await response.json();check(body.ok===true&&body.data.createdPrimary===1&&body.data.canonicalEventCreated===false);
});
Deno.test('write accepts only exact runtime prefix variants',async()=>{const deps={authorizer:{authorize:async()=>null},rpc:async()=>null};for(const path of ['/api/talent/v1/events','/nov-talent-write-api/api/talent/v1/events','/functions/v1/nov-talent-write-api/api/talent/v1/events']){const response=await handleTalentWrite(new Request(`https://local${path}?ignored=1#ignored`,{method:'OPTIONS',headers:{origin:'https://ideanow-shift.github.io'}}),deps);check(response.status===204);}for(const path of ['/unknown','/nov-talent-write-api/unknown','/functions/v1/nov-talent-write-api/unknown']){const response=await handleTalentWrite(new Request(`https://local${path}`,{method:'OPTIONS',headers:{origin:'https://ideanow-shift.github.io'}}),deps);check(response.status===404);}});
Deno.test('missing and malformed bearer are fixed 401 with request0',async()=>{let auth=0,rpc=0;for(const authorization of [undefined,'Basic fixture','Bearer malformed value']){
 const headers:Record<string,string>={origin:'https://ideanow-shift.github.io'};if(authorization)headers.authorization=authorization;
 const res=await handleTalentWrite(new Request('https://local/functions/v1/nov-talent-write-api/api/talent/v1/events',{method:'POST',headers}),{authorizer:{authorize:async()=>{auth++;return null}},rpc:async()=>{rpc++;return null}});
 check(res.status===401);check((await res.json()).error.code==='auth_required');check(res.headers.get('access-control-allow-origin')==='https://ideanow-shift.github.io');
 }check(auth===0&&rpc===0);
});
Deno.test('valid local auth fails with fixed not_ready before activation',async()=>{const secret='x'.repeat(32),jwt=await token(secret),now=Date.now();
 const governance={role:'talent_admin',active:true,assignmentApproved:true,assignedAt:new Date(now-86400000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),reviewedAt:new Date(now-60000).toISOString(),revoked:false};
 const authorizer=createWriteAuthorizer({signingSecret:secret,resolveServerGovernance:async()=>governance});let rpc=0;
 const res=await handleTalentWrite(new Request('https://local/functions/v1/nov-talent-write-api/api/talent/v1/events',{method:'POST',headers:{origin:'https://ideanow-shift.github.io',authorization:`Bearer ${jwt}`,'content-type':'application/json'},body:JSON.stringify({metricKey:'contacts',eventCode:'CONTACT_RECORDED',eventAt:new Date().toISOString()})}),
 {authorizer,rpc:async()=>{rpc++;throw new Error('local-not-activated');}});
 check(res.status===503);check((await res.json()).error.code==='not_ready');check(rpc===1);
});
Deno.test('application_no create and continuation shapes expose no UUID',()=>{
 const r=sanitizeCreateResult([{application_no:'NT-2026-000001',accepted:true}]);check(r?.applicationNo==='NT-2026-000001');
 check(sanitizeCreateResult([{application_no:'NT-2026-000001',accepted:true,application_id:'forbidden'}])===null);
 check(parseWrite({applicationNo:'NT-2026-000001',metricKey:'interviews',eventCode:'INTERVIEW_COMPLETED',eventAt:new Date().toISOString()}));
});
Deno.test('runtime binds canonical env names and exact RPC allowlist only',async()=>{
 const values=new Map([['HUB_APP_SESSION_SIGNING_SECRET','x'.repeat(32)],['SUPABASE_URL','https://local.invalid'],['SUPABASE_SERVICE_ROLE_KEY','local-only']]);
 let calls=0;const runtime=createWriteRuntime({get:name=>values.get(name)},async(input,init)=>{calls++;
  check(init.method==='POST');check(input.endsWith('/rest/v1/rpc/record_nov_talent_funnel_event_audited_v2'));return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
 });
 await runtime.rpc({} as never,'record_nov_talent_funnel_event_audited_v2',{});check(calls===1);
 let rejected=false;try{await runtime.rpc({} as never,'activate_nov_talent_prospective_v1',{});}catch{rejected=true;}check(rejected&&calls===1);
 check(WRITE_RUNTIME_CONTRACT.secretName==='HUB_APP_SESSION_SIGNING_SECRET');check(WRITE_RUNTIME_CONTRACT.role==='talent_admin');check(WRITE_RUNTIME_CONTRACT.retry===0);
 check(WRITE_RUNTIME_CONTRACT.rpcAllowlist.includes('apply_nov_talent_historical_review_v1'));
 check(WRITE_RUNTIME_CONTRACT.rpcAllowlist.includes('save_nov_talent_student_profile_v2'));
});
Deno.test('student profile route invokes only the canonical profile RPC',async()=>{
 let rpcName='',rpcArgs:Record<string,unknown>|null=null;
 const response=await handleTalentWrite(new Request('https://local/functions/v1/nov-talent-write-api/api/talent/v1/students/profile',{
  method:'POST',headers:{origin:'https://ideanow-shift.github.io',authorization:'Bearer a.a.a','content-type':'application/json'},
  body:JSON.stringify({applicationNo:null,expectedVersion:0,displayName:'表示氏名',kana:null,school:null,phone:null,email:null,preferredStore:null,currentStatus:'CONTACT',nextActionAt:null,offerDate:null,expectedJoinDate:null,plannedStore:null})
 }),{authorizer:{authorize:async()=>({actorEmployeeId:'00000000-0000-4000-8000-000000000009'} as never)},rpc:async(_cap,name,args)=>{
  rpcName=name;rpcArgs=args;return[{application_no:'NT-2027-000001',profile_version:1,operation:'CREATE'}];
 }});
 check(response.status===200);check(rpcName==='save_nov_talent_student_profile_v2');
 check((rpcArgs as unknown as Record<string,unknown>).p_actor_employee_id==='00000000-0000-4000-8000-000000000009');
 const body=await response.json();check(body.data.profileVersion===1&&body.data.operation==='CREATE');
});
Deno.test('runtime resolves exact server role and fails closed on ambiguous rows',async()=>{
 const secret='x'.repeat(32),jwt=await token(secret),values=new Map([['HUB_APP_SESSION_SIGNING_SECRET',secret],['SUPABASE_URL','https://local.invalid'],['SUPABASE_SERVICE_ROLE_KEY','local-only']]);
 const now=Date.now(),row={role:'talent_admin',active:true,assignmentApproved:true,assignedAt:new Date(now-86400000).toISOString(),expiresAt:new Date(now+86400000).toISOString(),reviewedAt:new Date(now-60000).toISOString(),revoked:false};
 let calls=0;const runtime=createWriteRuntime({get:name=>values.get(name)},async(input,init)=>{calls++;check(init.method==='POST');check(input.endsWith('/rest/v1/rpc/resolve_nov_talent_admin_governance_v1'));
  return new Response(JSON.stringify([row]),{status:200,headers:{'content-type':'application/json'}});
 });
 check(await runtime.authorizer.authorize(jwt));check(calls===1);
 const ambiguous=createWriteRuntime({get:name=>values.get(name)},async()=>new Response(JSON.stringify([{},{}]),{status:200,headers:{'content-type':'application/json'}}));
 check(await ambiguous.authorizer.authorize(jwt)===null);
 const wrong=createWriteRuntime({get:name=>values.get(name)},async()=>new Response(JSON.stringify([{...row,role:'browser_talent_admin'}]),{status:200,headers:{'content-type':'application/json'}}));
 check(await wrong.authorizer.authorize(jwt)===null);
});
Deno.test('all fixed failures retain exact-origin CORS without raw detail',async()=>{
 const base='https://local/functions/v1/nov-talent-write-api';const deps={authorizer:{authorize:async()=>null},rpc:async()=>null};
 for(const [path,method,status] of [['/api/talent/v1/events','GET',405],['/unknown','POST',404],['/api/talent/v1/events','POST',401]] as const){
  const response=await handleTalentWrite(new Request(`${base}${path}`,{method,headers:{origin:'https://ideanow-shift.github.io'}}),deps);
  check(response.status===status);check(response.headers.get('access-control-allow-origin')==='https://ideanow-shift.github.io');
  const body=await response.json();check(Object.keys(body).length===2&&Object.keys(body.error).length===1);
 }
});
