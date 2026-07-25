import type { TalentWriteCapability, WriteAuthorizer } from "./auth.ts";
import {
  parseHistoricalReview,
  parseInvalidation,
  parseStagingSupplement,
  parseStudentProfile,
  parseWorkforceProcedureCase,
  parseWrite,
  sanitizeCreateResult,
  sanitizeHistoricalReviewResult,
  sanitizeStagingSupplementResult,
  sanitizeStudentProfileResult,
  sanitizeWorkforceProcedureCaseList,
  sanitizeWorkforceProcedureCaseResult,
} from "./domain.ts";
const ORIGIN='https://ideanow-shift.github.io',NAME_BASE='/nov-talent-write-api',BASE='/functions/v1/nov-talent-write-api',EVENT='/api/talent/v1/events';
const HISTORICAL_REVIEW='/api/talent/v1/historical/review';
const STUDENT_PROFILE='/api/talent/v1/students/profile';
const STAGING_SUPPLEMENT='/api/talent/v1/staging/supplement';
const WORKFORCE_PROCEDURE_CASES='/api/talent/v1/workforce/procedure-cases';
export interface Deps{authorizer:WriteAuthorizer;rpc:(cap:TalentWriteCapability,name:string,args:Record<string,unknown>)=>Promise<unknown>}
const headers=(origin:string)=>{const h=new Headers({'cache-control':'no-store','content-type':'application/json; charset=utf-8','vary':'Origin'});
 if(origin===ORIGIN){h.set('access-control-allow-origin',ORIGIN);h.set('access-control-allow-headers','authorization, content-type');h.set('access-control-allow-methods','GET, POST, OPTIONS');}return h;};
const out=(status:number,body:unknown,origin:string)=>new Response(JSON.stringify(body),{status,headers:headers(origin)});
const fail=(status:number,code:string,origin:string)=>out(status,{ok:false,error:{code}},origin);
export async function handleTalentWrite(req:Request,deps:Deps){const origin=req.headers.get('origin')||'';
 if(origin!==ORIGIN)return fail(403,'origin_not_allowed',origin);const pathname=new URL(req.url).pathname;
 const path=pathname.startsWith(`${BASE}/`)?pathname.slice(BASE.length):pathname.startsWith(`${NAME_BASE}/`)?pathname.slice(NAME_BASE.length):pathname;
 if(path!==EVENT&&path!==`${EVENT}/invalidate`&&path!==HISTORICAL_REVIEW&&path!==STUDENT_PROFILE&&path!==STAGING_SUPPLEMENT&&path!==WORKFORCE_PROCEDURE_CASES)return fail(404,'not_found',origin);
 if(req.method==='OPTIONS'){const h=headers(origin);h.delete('content-type');return new Response(null,{status:204,headers:h});}
 if(req.method!=='POST'&&!(req.method==='GET'&&path===WORKFORCE_PROCEDURE_CASES))return fail(405,'method_not_allowed',origin);
 const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(req.headers.get('authorization')||'');
 if(!match)return fail(401,'auth_required',origin);const cap=await deps.authorizer.authorize(match[1]);if(!cap)return fail(403,'write_forbidden',origin);
 if(path===WORKFORCE_PROCEDURE_CASES&&req.method==='GET'){
  try{const result=sanitizeWorkforceProcedureCaseList(await deps.rpc(cap,'get_nov_talent_workforce_procedure_cases_v1',{
   p_employee_id:cap.actorEmployeeId,p_limit:200
  }));return result?out(200,{ok:true,data:result},origin):fail(503,'not_ready',origin);}catch{return fail(503,'not_ready',origin);}
 }
 let raw:unknown;try{raw=await req.json();}catch{return fail(400,'invalid_request',origin);}
 if(path===HISTORICAL_REVIEW){const v=parseHistoricalReview(raw);if(!v)return fail(400,'invalid_request',origin);
  try{const result=sanitizeHistoricalReviewResult(await deps.rpc(cap,'apply_nov_talent_historical_review_v1',{
   p_primary_record_ids:v.primaryRecordIds,p_link_pairs:v.linkPairs,p_reviewer_employee_id:cap.actorEmployeeId
  }));return result?out(200,{ok:true,data:result},origin):fail(503,'not_ready',origin);}catch{return fail(503,'not_ready',origin);}}
 if(path===STUDENT_PROFILE){const v=parseStudentProfile(raw);if(!v)return fail(400,'invalid_request',origin);
 try{const result=sanitizeStudentProfileResult(await deps.rpc(cap,'save_nov_talent_student_profile_v2',{
   p_actor_employee_id:cap.actorEmployeeId,p_application_no:v.applicationNo,p_expected_version:v.expectedVersion,
   p_display_name:v.displayName,p_kana:v.kana,p_school:v.school,p_phone:v.phone,p_email:v.email,
   p_preferred_store:v.preferredStore,p_current_status:v.currentStatus,p_next_action_at:v.nextActionAt,
   p_offer_date:v.offerDate,p_expected_join_date:v.expectedJoinDate,p_planned_store:v.plannedStore
  }));return result?out(200,{ok:true,data:result},origin):fail(503,'not_ready',origin);}catch{return fail(503,'not_ready',origin);}}
 if(path===STAGING_SUPPLEMENT){const v=parseStagingSupplement(raw);if(!v)return fail(400,'invalid_request',origin);
  try{const result=sanitizeStagingSupplementResult(await deps.rpc(cap,'save_nov_talent_staging_supplement_v1',{
   p_actor_employee_id:cap.actorEmployeeId,p_staging_record_id:v.stagingRecordId,p_expected_version:v.expectedVersion,
   p_display_name:v.displayName,p_kana:v.kana,p_school:v.school,p_phone:v.phone,p_email:v.email,
   p_preferred_store:v.preferredStore,p_current_status:v.currentStatus,p_next_action_at:v.nextActionAt,
  p_offer_date:v.offerDate,p_expected_join_date:v.expectedJoinDate,p_planned_store:v.plannedStore
  }));return result?out(200,{ok:true,data:result},origin):fail(503,'not_ready',origin);}catch{return fail(503,'not_ready',origin);}}
 if(path===WORKFORCE_PROCEDURE_CASES){const v=parseWorkforceProcedureCase(raw);if(!v)return fail(400,'invalid_request',origin);
  try{const result=sanitizeWorkforceProcedureCaseResult(await deps.rpc(cap,'save_nov_talent_workforce_procedure_case_v1',{
   p_actor_employee_id:cap.actorEmployeeId,p_case_id:v.caseId,p_expected_version:v.expectedVersion,
   p_procedure_type:v.procedureType,p_case_status:v.caseStatus,p_subject_label:v.subjectLabel,
   p_effective_date:v.effectiveDate,p_detail:v.detail
  }));return result?out(200,{ok:true,data:result},origin):fail(503,'not_ready',origin);}catch{return fail(503,'not_ready',origin);}}
 if(path===EVENT){const v=parseWrite(raw);if(!v)return fail(400,'invalid_request',origin);
  try{if(v.mode==='create'){const r=sanitizeCreateResult(await deps.rpc(cap,'create_nov_talent_application_with_event_audited_v2',{p_actor_employee_id:cap.actorEmployeeId,p_metric_key:v.metricKey,p_event_code:v.eventCode,p_event_at:v.eventAt}));
    return r?out(200,{ok:true,data:r},origin):fail(503,'not_ready',origin);}
   await deps.rpc(cap,'record_nov_talent_funnel_event_audited_v2',{p_actor_employee_id:cap.actorEmployeeId,p_application_no:v.applicationNo,p_metric_key:v.metricKey,p_event_code:v.eventCode,p_event_at:v.eventAt});
   return out(200,{ok:true,data:{accepted:true}},origin);}catch{return fail(503,'not_ready',origin);}}
 const v=parseInvalidation(raw);if(!v)return fail(400,'invalid_request',origin);
 try{await deps.rpc(cap,'invalidate_nov_talent_funnel_event_audited_v2',{p_actor_employee_id:cap.actorEmployeeId,p_application_no:v.applicationNo,p_metric_key:v.metricKey,p_fiscal_year:v.fiscalYear,p_invalidated_code:v.code});
  return out(200,{ok:true,data:{invalidated:true}},origin);}catch{return fail(503,'not_ready',origin);}}
