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

test("HMAC fingerprint is deterministic and never equals the raw Firebase subject",async()=>{
  const first=await subjectFingerprint({subject},"s".repeat(32));
  assert.match(first,/^[0-9a-f]{64}$/u); assert.notEqual(first,subject);
  assert.equal(first,await subjectFingerprint({subject},"s".repeat(32)));
});

test("bridge ignores browser identity claims, converges AUTH-01 and caps session at Firebase expiry",async()=>{
  const signed=[]; const consumed=[];
  const result=await bridgeFirebaseAuth01({token:token(),payload:{enrollmentChallenge:"A".repeat(43),employeeId:"spoof",role:"executive"}},
    {...deps(),fingerprintSecret:"s".repeat(32),randomUuid:()=>"50000000-0000-4000-8000-000000000001",
      consumeEnrollment:async(value)=>{consumed.push(value);return {employeeId:"10000000-0000-4000-8000-000000000001",access:{employeeId:"10000000-0000-4000-8000-000000000001",roleKeys:["executive"],scope:{mode:"all",storeIds:Array(20).fill("store")}}};},
      resolveBinding:async()=>assert.fail("existing binding must not be used during enrollment"),
      signSession:async(value)=>{signed.push(value);return "signed-session";}});
  assert.equal(result.hubSession.sessionToken,"signed-session"); assert.equal(consumed.length,1);
  assert.equal(signed[0].auth_source,"firebase_auth01_external_binding_v1");
  assert.equal(signed[0].bridge_contract,FIREBASE_AUTH01_BRIDGE.contract);
  assert.ok(signed[0].exp-signed[0].iat<=900);
  for(const forbidden of ["email","uid","firebase_uid","auth_subject","role","scope"]) assert.equal(forbidden in signed[0],false);
});

test("bridge ignores client-declared identity fields and rejects failed AUTH-01 convergence",async()=>{
  await assert.rejects(()=>bridgeFirebaseAuth01({token:token(),payload:{}},{...deps(),fingerprintSecret:"s".repeat(32),randomUuid:()=>crypto.randomUUID(),
    resolveBinding:async()=>({employeeId:"one",access:{employeeId:"two"}}),consumeEnrollment:async()=>null,signSession:async()=>"never"}),
    (error)=>error.status===403);
});
