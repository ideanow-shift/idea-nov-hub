import assert from "node:assert/strict";
import test from "node:test";
import { createHandler } from "../supabase/functions/nov-talent-staging-api/index.ts";
import { CONTACT_2027_BACKFILL } from "../supabase/functions/nov-talent-staging-api/contact-2027-backfill.ts";

const ORIGIN = "https://ideanow-shift.github.io";
const ACTOR = "00000000-0000-4000-8000-000000000009";
const PATH = "/api/talent/v1/recruiting-actual-facts/backfills/contact-2027";

function runtime({ role="hr.admin", enabled=false, host="zgkoofphhivesclehrom.supabase.co", state="PASS", rpcStatus=200 }={}) {
  const calls=[];
  return { calls, value:{ hubApiUrl:"https://hub.test/auth", supabaseUrl:`https://${host}`, serviceRoleKey:"server-only", recruitingActualContactBackfillEnabled:enabled,
    fetchImpl:async(url,init={})=>{
      calls.push({ url:String(url), init });
      if(String(url)==="https://hub.test/auth")return Response.json({ok:true,employee:{id:ACTOR,roleKeys:[role]}});
      if(String(url).includes("nov_talent_preflight_contact_2027_backfill_v1"))return Response.json([{state,exact_preflight_passed:state==="PASS",
        review_package_sha256:CONTACT_2027_BACKFILL.reviewPackageSha256,canonical_source_sha256:CONTACT_2027_BACKFILL.canonicalSourceSha256,
        source_event_count:11,unique_candidate_count:10,existing_fact_count:state==="COMPLETED"?11:0,original_actor_status:"UNAVAILABLE"}]);
      if(String(url).includes("nov_talent_execute_contact_2027_backfill_v1"))return new Response(JSON.stringify(rpcStatus===200?[{backfill_receipt_id:"00000000-0000-4000-8000-000000000001",fact_count:11,unique_candidate_count:10}]:{code:"40001"}),{status:rpcStatus});
      return Response.json({code:"PGRST202"},{status:404});
    }
  }};
}
function request(method="GET",{auth=true,body}={}){return new Request(`https://edge.test${PATH}${method==="GET"?"/preflight":""}`,{method,headers:{origin:ORIGIN,...(auth?{authorization:"Bearer existing.hub.session"}:{}),"content-type":"application/json"},body});}

test("Hosted preflight is staging-only, authenticated and management-role gated",async()=>{
  const fixture=runtime();const response=await createHandler(fixture.value)(request());
  assert.equal(response.status,200);const envelope=await response.json();assert.equal(envelope.data.state,"PASS");assert.equal(envelope.data.canExecute,false);
  assert.equal((await createHandler(runtime().value)(request("GET",{auth:false}))).status,401);
  assert.equal((await createHandler(runtime({role:"hr.staff"}).value)(request())).status,403);
  assert.equal((await createHandler(runtime({host:"not-the-staging-project.supabase.co"}).value)(request())).status,404);
});

test("flag OFF rejects POST without executing the business RPC",async()=>{
  const fixture=runtime({enabled:false});const response=await createHandler(fixture.value)(request("POST",{body:"{}"}));
  assert.equal(response.status,503);assert.equal(fixture.calls.filter(call=>call.url.includes("nov_talent_execute_contact_2027_backfill_v1")).length,0);
});

test("flag ON reruns exact preflight, accepts only empty command and resolves Actor server-side",async()=>{
  const fixture=runtime({enabled:true});const response=await createHandler(fixture.value)(request("POST",{body:"{}"}));
  assert.equal(response.status,201);const execute=fixture.calls.find(call=>call.url.includes("nov_talent_execute_contact_2027_backfill_v1"));assert.ok(execute);
  const body=JSON.parse(execute.init.body);assert.equal(body.p_actor_employee_id,ACTOR);assert.equal(body.p_actor_role,"hr.admin");assert.equal(body.p_review_package_sha256,CONTACT_2027_BACKFILL.reviewPackageSha256);
  assert.equal((await createHandler(runtime({enabled:true}).value)(request("POST",{body:JSON.stringify({actorId:ACTOR})}))).status,400);
  assert.equal((await createHandler(runtime({enabled:true,state:"BLOCKED"}).value)(request("POST",{body:"{}"}))).status,409);
});

test("execution conflict is returned once without automatic retry",async()=>{
  const fixture=runtime({enabled:true,rpcStatus:409});const response=await createHandler(fixture.value)(request("POST",{body:"{}"}));
  assert.equal(response.status,409);assert.equal(fixture.calls.filter(call=>call.url.includes("nov_talent_execute_contact_2027_backfill_v1")).length,1);
});
