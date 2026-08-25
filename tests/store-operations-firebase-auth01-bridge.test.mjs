import test from "node:test";
import assert from "node:assert/strict";
import { bridgeFirebaseAuth01, FIREBASE_AUTH01_BRIDGE, subjectFingerprint, verifyFirebaseBridgeToken } from "../supabase/functions/nov-hub-api/firebase_auth01_external_bridge.mjs";

const now=1787500000000;
const subject="firebase-subject-never-stored";
const encode=(value)=>Buffer.from(JSON.stringify(value)).toString("base64url");
const claims=(extra={})=>({iss:FIREBASE_AUTH01_BRIDGE.issuer,aud:FIREBASE_AUTH01_BRIDGE.projectId,sub:subject,user_id:subject,
  exp:Math.floor(now/1000)+1200,iat:Math.floor(now/1000)-10,auth_time:Math.floor(now/1000)-20,
  firebase:{sign_in_provider:"google.com"},email_verified:true,email:"m.wakita@idea-nov.com",...extra});
const token=(extra={})=>`${encode({alg:"RS256",kid:"formal-google-key"})}.${encode(claims(extra))}.signature`;
const deps=()=>({now:()=>now,lookup:async()=>({localId:subject,email:"m.wakita@idea-nov.com",emailVerified:true,disabled:false})});
const principalToken=(email,subjectValue)=>`${encode({alg:"RS256",kid:"formal-google-key"})}.${encode(claims({sub:subjectValue,user_id:subjectValue,email}))}.signature`;
const principalDeps=(email,subjectValue)=>({now:()=>now,lookup:async()=>({localId:subjectValue,email,emailVerified:true,disabled:false})});

test("strict Firebase verifier accepts only the approved Google token",async()=>{
  assert.equal((await verifyFirebaseBridgeToken(token(),deps())).subject,subject);
  for(const [value,status] of [["",401],[token({iss:"https://evil.invalid"}),401],[token({aud:"other"}),401],
    [token({exp:1}),401],[token({sub:"",user_id:""}),401],[token({firebase:{sign_in_provider:"password"}}),403],
    [token({email_verified:false}),403],[token({email:"other@idea-nov.com"}),403]]){
    await assert.rejects(()=>verifyFirebaseBridgeToken(value,deps()),(error)=>error.status===status);
  }
  await assert.rejects(()=>verifyFirebaseBridgeToken(token(),{...deps(),lookup:async()=>{const error=new Error("invalid signature");error.status=401;throw error;}}),
    (error)=>error.status===401);
});

test("only the licensed Wakita Google principal is accepted",async()=>{
  const verified=await verifyFirebaseBridgeToken(principalToken("m.wakita@idea-nov.com","subject-executive"),principalDeps("m.wakita@idea-nov.com","subject-executive"));
  assert.deepEqual([verified.identityKey,verified.expectedRole,verified.expectedScopeMode,verified.expectedStoreCount],
    ["uat-executive","executive","all",20]);
  for(const email of ["uat-area-manager@idea-nov.com","uat-store-manager@idea-nov.com"]){
    await assert.rejects(()=>verifyFirebaseBridgeToken(principalToken(email,`old-${email}`),principalDeps(email,`old-${email}`)),
      (error)=>error.code==="FIREBASE_ACCOUNT_DENIED");
  }
});

test("HMAC fingerprint is deterministic and never equals the raw Firebase subject",async()=>{
  const first=await subjectFingerprint({subject},"s".repeat(32));
  assert.match(first,/^[0-9a-f]{64}$/u); assert.notEqual(first,subject);
  assert.equal(first,await subjectFingerprint({subject},"s".repeat(32)));
});

test("bridge converges technical AUTH-01 and caps session at Firebase expiry",async()=>{
  const signed=[]; const consumed=[];
  const result=await bridgeFirebaseAuth01({token:token(),payload:{enrollmentChallenge:"A".repeat(43)}},
    {...deps(),fingerprintSecret:"s".repeat(32),randomUuid:()=>"50000000-0000-4000-8000-000000000001",
      consumeTechnicalAssumption:async(value)=>{consumed.push(value);return {assumptionKey:"50000000-0000-4000-8000-000000000002",uatScenario:"area_manager",employeeId:"10000000-0000-4000-8000-000000000001",access:{employeeId:"10000000-0000-4000-8000-000000000001",roleKeys:["area_manager"],scope:{mode:"assigned",storeIds:["store"]}}};},
      resolveBinding:async()=>assert.fail("existing binding must not be used during enrollment"),
      signSession:async(value)=>{signed.push(value);return "signed-session";}});
  assert.equal(result.hubSession.sessionToken,"signed-session"); assert.equal(consumed.length,1);
  assert.equal(signed[0].auth_source,"owner_controlled_technical_assumption");
  assert.equal(signed[0].bridge_contract,FIREBASE_AUTH01_BRIDGE.contract);
  assert.equal(signed[0].uat_actor,"owner_controlled_technical_principal");
  assert.equal(signed[0].uat_scenario,"area_manager");
  assert.ok(signed[0].exp-signed[0].iat<=900);
  for(const forbidden of ["email","uid","firebase_uid","auth_subject","role","scope"]) assert.equal(forbidden in signed[0],false);
});

test("bridge rejects client-declared authority and failed AUTH-01 convergence",async()=>{
  for(const key of ["employeeId","role","scope","storeId","identityKey","targetPrincipal"]){
    await assert.rejects(()=>bridgeFirebaseAuth01({token:token(),payload:{[key]:"spoof"}},deps()),
      (error)=>error.code==="INVALID_REQUEST");
  }
  await assert.rejects(()=>bridgeFirebaseAuth01({token:token(),payload:{}},{...deps(),fingerprintSecret:"s".repeat(32),randomUuid:()=>crypto.randomUUID(),
    resolveBinding:async()=>({employeeId:"one",access:{employeeId:"two"}}),consumeTechnicalAssumption:async()=>null,signSession:async()=>"never"}),
    (error)=>error.status===403);
});

test("failed technical assumption consume never signs a session",async()=>{
  let signed=false;
  await assert.rejects(()=>bridgeFirebaseAuth01({token:token(),payload:{enrollmentChallenge:"A".repeat(43)}},
    {...deps(),fingerprintSecret:"s".repeat(32),randomUuid:()=>crypto.randomUUID(),
      consumeTechnicalAssumption:async()=>{const error=new Error("mismatch");error.status=403;throw error;},
      resolveBinding:async()=>null,signSession:async()=>{signed=true;return "never";}}),(error)=>error.status===403);
  assert.equal(signed,false);
});

test("Wakita technical assumptions accept only canonical Area and Store role/scope",async()=>{
  const cases=[
    ["area_manager","assigned"],
    ["store_manager","own"],
  ];
  for(const [roleKey,scopeMode] of cases){
    const base={...deps(),fingerprintSecret:"s".repeat(32),randomUuid:()=>crypto.randomUUID(),
      resolveBinding:async()=>assert.fail("enrollment required"),signSession:async()=>"signed"};
    const good=()=>({assumptionKey:"50000000-0000-4000-8000-000000000002",uatScenario:roleKey,employeeId:`employee-${roleKey}`,access:{employeeId:`employee-${roleKey}`,
      roleKeys:[roleKey],scope:{mode:scopeMode,storeIds:["canonical-store"]}}});
    const result=await bridgeFirebaseAuth01({token:token(),payload:{enrollmentChallenge:"A".repeat(43)}},
      {...base,consumeTechnicalAssumption:async()=>good()});
    assert.equal(result.hubSession.sessionToken,"signed");
    for(const badAccess of [
      {...good(),access:{...good().access,roleKeys:["executive"]}},
      {...good(),access:{...good().access,scope:{mode:"all",storeIds:["canonical-store"]}}},
      {...good(),access:{...good().access,scope:{mode:scopeMode,storeIds:["one","two"]}}},
    ]) await assert.rejects(()=>bridgeFirebaseAuth01({token:token(),payload:{enrollmentChallenge:"A".repeat(43)}},
      {...base,consumeTechnicalAssumption:async()=>badAccess}),(error)=>error.code==="AUTH01_CONVERGENCE_DENIED");
  }
});

test("disabled Firebase user and lookup email mismatch fail closed",async()=>{
  await assert.rejects(()=>verifyFirebaseBridgeToken(token(),{...deps(),lookup:async()=>({localId:subject,email:"m.wakita@idea-nov.com",emailVerified:true,disabled:true})}),
    (error)=>error.status===401);
  await assert.rejects(()=>verifyFirebaseBridgeToken(token(),{...deps(),lookup:async()=>({localId:subject,email:"uat-area-manager@idea-nov.com",emailVerified:true,disabled:false})}),
    (error)=>error.status===401);
});
