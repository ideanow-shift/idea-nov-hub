import test from "node:test";
import assert from "node:assert/strict";
import {verifyGoogleCloudRunIdentity} from "../supabase/functions/nov-hub-api/google_oidc_service_identity.mjs";

const now=Date.parse("2026-08-23T02:00:00Z");
const audience="https://zgkoofphhivesclehrom.supabase.co/functions/v1/nov-hub-api";
const email="runtime@staging.example.iam.gserviceaccount.com";
const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const publicJwk={...(await crypto.subtle.exportKey("jwk",pair.publicKey)),kid:"test-key",alg:"RS256",use:"sig"};
const enc=(value)=>Buffer.from(typeof value==="string"?value:JSON.stringify(value)).toString("base64url");
async function token(overrides={},key=pair.privateKey){const header=enc({alg:"RS256",kid:"test-key",typ:"JWT"});const claims=enc({iss:"https://accounts.google.com",sub:"service-subject",audience,email,email_verified:true,iat:Math.floor(now/1000)-10,exp:Math.floor(now/1000)+300,...overrides,aud:overrides.aud??audience});const signing=`${header}.${claims}`;return `${signing}.${Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(signing))).toString("base64url")}`;}
const options=(overrides={})=>({audience,authorizedServiceAccount:email,authorizedSubject:"service-subject",now:()=>now,fetchJwks:async()=>Response.json({keys:[publicJwk]}),...overrides});

test("valid Google-signed Cloud Run OIDC identity passes exact checks",async()=>{const result=await verifyGoogleCloudRunIdentity(await token(),options());assert.equal(result.email,email);assert.equal(result.subject,"service-subject");});
test("missing and invalid signature return 401",async()=>{await assert.rejects(()=>verifyGoogleCloudRunIdentity("",options()),error=>error.status===401);const other=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);const invalid=await token({},other.privateKey);await assert.rejects(()=>verifyGoogleCloudRunIdentity(invalid,options()),error=>error.status===401);});
test("wrong audience and expired token return 401",async()=>{const wrongAudience=await token({aud:"https://wrong.invalid"});const expired=await token({exp:Math.floor(now/1000)-1});await assert.rejects(()=>verifyGoogleCloudRunIdentity(wrongAudience,options()),error=>error.status===401);await assert.rejects(()=>verifyGoogleCloudRunIdentity(expired,options()),error=>error.status===401);});
test("unauthorized service account or subject returns 403",async()=>{const valid=await token();await assert.rejects(()=>verifyGoogleCloudRunIdentity(valid,options({authorizedServiceAccount:"other@staging.example.iam.gserviceaccount.com"})),error=>error.status===403);await assert.rejects(()=>verifyGoogleCloudRunIdentity(valid,options({authorizedSubject:"other-subject"})),error=>error.status===403);});
