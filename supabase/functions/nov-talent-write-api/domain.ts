export const METRIC_EVENT=Object.freeze({contacts:'CONTACT_RECORDED',lineRegistrations:'LINE_REGISTERED',
 salonTours:'SALON_TOUR_COMPLETED',interviews:'INTERVIEW_COMPLETED',passed:'SELECTION_PASSED',offers:'OFFER_ISSUED',expectedJoiners:'EXPECTED_JOIN_CONFIRMED'});
const no=/^NT-[0-9]{4}-[0-9]{6}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const profileStatuses=Object.freeze(['CONTACT','LINE_REGISTERED','SALON_TOUR','INTERVIEW','PASSED','OFFER','EXPECTED_JOIN','WITHDRAWN']);
export const INVALIDATION_ALLOWLIST=Object.freeze({
 contacts:Object.freeze(['DELETED']),
 lineRegistrations:Object.freeze(['DELETED']),
 salonTours:Object.freeze(['CANCELLED','NO_SHOW','DELETED']),
 interviews:Object.freeze(['CANCELLED','NO_SHOW','DELETED']),
 passed:Object.freeze(['DELETED']),
 offers:Object.freeze(['DELETED']),
 expectedJoiners:Object.freeze(['CANCELLED','NO_SHOW','DELETED','WITHDRAWN'])
});
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const base=(v:Record<string,unknown>)=>Object.hasOwn(METRIC_EVENT,String(v.metricKey))
 &&v.eventCode===METRIC_EVENT[v.metricKey as keyof typeof METRIC_EVENT]
 &&typeof v.eventAt==='string'&&!Number.isNaN(Date.parse(v.eventAt));
export function parseWrite(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(exact(v,['metricKey','eventCode','eventAt'])&&base(v))return {mode:'create',metricKey:v.metricKey,eventCode:v.eventCode,eventAt:v.eventAt};
 if(exact(v,['applicationNo','metricKey','eventCode','eventAt'])&&no.test(String(v.applicationNo))&&base(v))
  return {mode:'existing',applicationNo:v.applicationNo,metricKey:v.metricKey,eventCode:v.eventCode,eventAt:v.eventAt};
 return null;}
export function parseInvalidation(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(!exact(v,['applicationNo','metricKey','fiscalYear','code'])||!no.test(String(v.applicationNo))
  ||!Object.hasOwn(METRIC_EVENT,String(v.metricKey))||!Number.isInteger(v.fiscalYear))return null;
 const allowed=INVALIDATION_ALLOWLIST[v.metricKey as keyof typeof INVALIDATION_ALLOWLIST];
 if(!allowed.includes(String(v.code)))return null;return v;}
export function sanitizeCreateResult(value:unknown){const row=Array.isArray(value)&&value.length===1?value[0]:null;
 if(!row||typeof row!=='object'||Array.isArray(row)||!exact(row as Record<string,unknown>,['application_no','accepted'])
  ||!no.test(String((row as Record<string,unknown>).application_no))||(row as Record<string,unknown>).accepted!==true)return null;
 return Object.freeze({applicationNo:(row as Record<string,unknown>).application_no,accepted:true});}

export function parseHistoricalReview(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(!exact(v,['primaryRecordIds','linkPairs'])||!Array.isArray(v.primaryRecordIds)||!Array.isArray(v.linkPairs)
  ||v.primaryRecordIds.length>600||v.linkPairs.length>200||v.primaryRecordIds.length+v.linkPairs.length===0)return null;
 const primaryRecordIds=v.primaryRecordIds.map(String);
 if(primaryRecordIds.some(id=>!uuid.test(id))||new Set(primaryRecordIds).size!==primaryRecordIds.length)return null;
 const linkPairs=[] as Array<{sourceRecordId:string;targetRecordId:string}>;
 for(const candidate of v.linkPairs){
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)
   ||!exact(candidate as Record<string,unknown>,['sourceRecordId','targetRecordId']))return null;
  const sourceRecordId=String((candidate as Record<string,unknown>).sourceRecordId);
  const targetRecordId=String((candidate as Record<string,unknown>).targetRecordId);
  if(!uuid.test(sourceRecordId)||!uuid.test(targetRecordId)||sourceRecordId===targetRecordId)return null;
  linkPairs.push({sourceRecordId,targetRecordId});
 }
 if(new Set(linkPairs.map(pair=>pair.sourceRecordId)).size!==linkPairs.length)return null;
 return Object.freeze({
  primaryRecordIds:Object.freeze(primaryRecordIds),
  linkPairs:Object.freeze(linkPairs.map(pair=>Object.freeze(pair)))
 });
}

export function sanitizeHistoricalReviewResult(value:unknown){
 const row=Array.isArray(value)&&value.length===1?value[0]:null;
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 const record=row as Record<string,unknown>;
 const keys=['requestedPrimary','createdPrimary','requestedLinks','confirmedLinks','remainingUnmapped','canonicalEventCreated','rawValuesIncluded'];
 if(!exact(record,keys)||record.canonicalEventCreated!==false||record.rawValuesIncluded!==false)return null;
 for(const key of keys.slice(0,5))if(!Number.isInteger(record[key])||Number(record[key])<0)return null;
 if(record.requestedPrimary!==record.createdPrimary||record.requestedLinks!==record.confirmedLinks)return null;
 return Object.freeze({
  createdPrimary:Number(record.createdPrimary),
  confirmedLinks:Number(record.confirmedLinks),
  remainingUnmapped:Number(record.remainingUnmapped),
  canonicalEventCreated:false,
  rawValuesIncluded:false
 });
}

const profileKeys=['applicationNo','expectedVersion','displayName','kana','school','phone','email','preferredStore','currentStatus','nextActionAt','offerDate','expectedJoinDate','plannedStore'];
const nullableText=(value:unknown,maximum:number)=>{
 if(value===null||value==='')return null;
 if(typeof value!=='string')return undefined;
 const normalized=value.normalize('NFKC').trim();
 return normalized.length<=maximum?normalized:undefined;
};
export function parseStudentProfile(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(!exact(v,profileKeys)||!(v.applicationNo===null||no.test(String(v.applicationNo)))
  ||!Number.isInteger(v.expectedVersion)||Number(v.expectedVersion)<0
  ||(v.applicationNo===null&&v.expectedVersion!==0)
  ||typeof v.displayName!=='string')return null;
 const displayName=v.displayName.normalize('NFKC').trim();
 const kana=nullableText(v.kana,120),school=nullableText(v.school,180),phone=nullableText(v.phone,40);
 const email=nullableText(v.email,254),preferredStore=nullableText(v.preferredStore,120);
 const nextActionAt=nullableText(v.nextActionAt,10),offerDate=nullableText(v.offerDate,10),expectedJoinDate=nullableText(v.expectedJoinDate,10),plannedStore=nullableText(v.plannedStore,120);
 if(!displayName||displayName.length>120||[kana,school,phone,email,preferredStore,nextActionAt].includes(undefined)
  ||(typeof email==='string'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ||[nextActionAt,offerDate,expectedJoinDate].some(value=>typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))
  ||!profileStatuses.includes(String(v.currentStatus)))return null;
 return Object.freeze({
  applicationNo:v.applicationNo===null?null:String(v.applicationNo),
  expectedVersion:Number(v.expectedVersion),displayName,kana,school,phone,email,preferredStore,
  currentStatus:String(v.currentStatus),nextActionAt,offerDate,expectedJoinDate,plannedStore
 });
}

export function sanitizeStudentProfileResult(value:unknown){
 const row=Array.isArray(value)&&value.length===1?value[0]:null;
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 const record=row as Record<string,unknown>;
 if(!exact(record,['application_no','profile_version','operation'])
  ||!no.test(String(record.application_no))
  ||!Number.isInteger(record.profile_version)||Number(record.profile_version)<1
  ||!['CREATE','UPDATE'].includes(String(record.operation)))return null;
 return Object.freeze({
  applicationNo:String(record.application_no),
  profileVersion:Number(record.profile_version),
  operation:String(record.operation)
 });
}

export const STUDENT_PROFILE_CONTRACT=Object.freeze({
 statuses:profileStatuses,optimisticConcurrency:true,maximumWriteRequests:1,rawValuesInResult:false
});

const stagingSupplementKeys=['stagingRecordId','expectedVersion','displayName','kana','school','phone','email','preferredStore','currentStatus','nextActionAt','offerDate','expectedJoinDate','plannedStore'];
export function parseStagingSupplement(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(!exact(v,stagingSupplementKeys)||!uuid.test(String(v.stagingRecordId))||!Number.isInteger(v.expectedVersion)||Number(v.expectedVersion)<0||typeof v.displayName!=='string')return null;
 const displayName=v.displayName.normalize('NFKC').trim();
 const kana=nullableText(v.kana,120),school=nullableText(v.school,180),phone=nullableText(v.phone,40);
 const email=nullableText(v.email,254),preferredStore=nullableText(v.preferredStore,120),nextActionAt=nullableText(v.nextActionAt,10),offerDate=nullableText(v.offerDate,10),expectedJoinDate=nullableText(v.expectedJoinDate,10),plannedStore=nullableText(v.plannedStore,120);
 if(!displayName||displayName.length>120||[kana,school,phone,email,preferredStore,nextActionAt,offerDate,expectedJoinDate,plannedStore].includes(undefined)||!profileStatuses.includes(String(v.currentStatus))
  ||(typeof email==='string'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ||[nextActionAt,offerDate,expectedJoinDate].some(value=>typeof value==='string'&&!/^\d{4}-\d{2}-\d{2}$/.test(value)))return null;
 return Object.freeze({stagingRecordId:String(v.stagingRecordId),expectedVersion:Number(v.expectedVersion),displayName,kana,school,phone,email,preferredStore,currentStatus:String(v.currentStatus),nextActionAt,offerDate,expectedJoinDate,plannedStore});
}
export function sanitizeStagingSupplementResult(value:unknown){
 const row=Array.isArray(value)&&value.length===1?value[0]:null;if(!row||typeof row!=='object'||Array.isArray(row))return null;const record=row as Record<string,unknown>;
 if(!exact(record,['staging_record_id','supplement_version','operation'])||!uuid.test(String(record.staging_record_id))||!Number.isInteger(record.supplement_version)||Number(record.supplement_version)<1||!['CREATE','UPDATE'].includes(String(record.operation)))return null;
 return Object.freeze({stagingRecordId:String(record.staging_record_id),supplementVersion:Number(record.supplement_version),operation:String(record.operation)});
}
export const STAGING_SUPPLEMENT_CONTRACT=Object.freeze({optimisticConcurrency:true,maximumWriteRequests:1,createsCanonicalApplication:false,rawValuesInResult:false});

const procedureTypes=Object.freeze(['ONBOARDING','TRANSFER','LEAVE','RETIREMENT']);
const procedureStatuses=Object.freeze(['DRAFT','READY_FOR_REVIEW','CONFIRMED','CANCELLED']);
const procedureStepKeys=Object.freeze(['BASIC_INFO','DOCUMENTS','APPROVAL','CORE_HANDOFF','CHANGE_DETAILS','STAKEHOLDER_CONFIRMATION','APPLICATION','REQUIRED_PROCEDURES','RETURN_PLAN','RETIREMENT_DATE','ASSET_RETURN']);
const procedureCaseKeys=['caseId','expectedVersion','procedureType','caseStatus','subjectLabel','effectiveDate','detail'];
export function parseWorkforceProcedureCase(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(!exact(v,procedureCaseKeys)||!(v.caseId===null||uuid.test(String(v.caseId)))
  ||!Number.isInteger(v.expectedVersion)||Number(v.expectedVersion)<0
  ||!procedureTypes.includes(String(v.procedureType))||!procedureStatuses.includes(String(v.caseStatus))
  ||typeof v.subjectLabel!=='string'||typeof v.effectiveDate!=='string')return null;
 const subjectLabel=v.subjectLabel.normalize('NFKC').trim();
 const detail=nullableText(v.detail,500);
 if(!subjectLabel||subjectLabel.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(v.effectiveDate)||detail===undefined
  ||(v.caseId===null&&v.expectedVersion!==0))return null;
 return Object.freeze({caseId:v.caseId===null?null:String(v.caseId),expectedVersion:Number(v.expectedVersion),
  procedureType:String(v.procedureType),caseStatus:String(v.caseStatus),subjectLabel,effectiveDate:v.effectiveDate,detail});
}
export function sanitizeWorkforceProcedureCaseResult(value:unknown){
 const row=Array.isArray(value)&&value.length===1?value[0]:null;
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 const record=row as Record<string,unknown>;
 if(!exact(record,['case_id','case_version','operation'])||!uuid.test(String(record.case_id))
  ||!Number.isInteger(record.case_version)||Number(record.case_version)<1||!['CREATE','UPDATE'].includes(String(record.operation)))return null;
 return Object.freeze({caseId:String(record.case_id),caseVersion:Number(record.case_version),operation:String(record.operation)});
}
export function sanitizeWorkforceProcedureCaseList(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const source=value as Record<string,unknown>;
 if(!exact(source,['cases'])||!Array.isArray(source.cases)||source.cases.length>200)return null;
 const cases=[] as Array<Record<string,unknown>>;
 for(const row of source.cases){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const record=row as Record<string,unknown>;
  if(!exact(record,['case_id','procedure_type','case_status','subject_label','effective_date','detail','version','updated_at'])
   ||!uuid.test(String(record.case_id))||!procedureTypes.includes(String(record.procedure_type))
   ||!procedureStatuses.includes(String(record.case_status))||typeof record.subject_label!=='string'
   ||!record.subject_label.trim()||record.subject_label.trim().length>120
   ||!/^\d{4}-\d{2}-\d{2}$/.test(String(record.effective_date))
   ||!(record.detail===null||typeof record.detail==='string')||(typeof record.detail==='string'&&record.detail.length>500)
   ||!Number.isInteger(record.version)||Number(record.version)<1
   ||typeof record.updated_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(record.updated_at))return null;
  cases.push(Object.freeze({caseId:String(record.case_id),procedureType:String(record.procedure_type),caseStatus:String(record.case_status),
   subjectLabel:record.subject_label.trim(),effectiveDate:String(record.effective_date),detail:record.detail===null?null:record.detail,
   version:Number(record.version),updatedAt:record.updated_at}));
 }
  return Object.freeze({cases:Object.freeze(cases)});
}
const procedureAuditFields=Object.freeze(['procedureType','caseStatus','subjectLabel','effectiveDate','detail']);
export function parseWorkforceProcedureCaseAuditQuery(value:unknown){
 return typeof value==='string'&&uuid.test(value)?value:null;
}
export function sanitizeWorkforceProcedureCaseAudit(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const source=value as Record<string,unknown>;
 if(!exact(source,['entries'])||!Array.isArray(source.entries)||source.entries.length>20)return null;
 const entries=[] as Array<Record<string,unknown>>;
 for(const row of source.entries){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const record=row as Record<string,unknown>;
  if(!exact(record,['action','changed_fields','case_version','occurred_at'])||!['CREATE','UPDATE'].includes(String(record.action))
   ||!Array.isArray(record.changed_fields)||record.changed_fields.length<1||record.changed_fields.length>5
   ||record.changed_fields.some(field=>!procedureAuditFields.includes(String(field)))
   ||new Set(record.changed_fields.map(String)).size!==record.changed_fields.length
   ||!Number.isInteger(record.case_version)||Number(record.case_version)<1
   ||typeof record.occurred_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(record.occurred_at))return null;
  entries.push(Object.freeze({action:String(record.action),changedFields:Object.freeze(record.changed_fields.map(String)),caseVersion:Number(record.case_version),occurredAt:record.occurred_at}));
 }
 return Object.freeze({entries:Object.freeze(entries)});
}
export function sanitizeWorkforceProcedureCaseSteps(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const source=value as Record<string,unknown>;
 if(!exact(source,['procedure_type','steps'])||!procedureTypes.includes(String(source.procedure_type))||!Array.isArray(source.steps)||source.steps.length!==4)return null;
 const steps=[] as Array<Record<string,unknown>>;
 for(const row of source.steps){
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const record=row as Record<string,unknown>;
  if(!exact(record,['step_key','is_completed','version','updated_at'])||!procedureStepKeys.includes(String(record.step_key))
   ||typeof record.is_completed!=='boolean'||!Number.isInteger(record.version)||Number(record.version)<0
   ||!(record.updated_at===null||(typeof record.updated_at==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(record.updated_at))))return null;
  steps.push(Object.freeze({stepKey:String(record.step_key),isCompleted:record.is_completed,version:Number(record.version),updatedAt:record.updated_at}));
 }
 if(new Set(steps.map(step=>step.stepKey)).size!==steps.length)return null;
 return Object.freeze({procedureType:String(source.procedure_type),steps:Object.freeze(steps)});
}
const procedureStepKeysPayload=['caseId','stepKey','completed','expectedVersion'];
export function parseWorkforceProcedureCaseStep(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const source=value as Record<string,unknown>;
 if(!exact(source,procedureStepKeysPayload)||!uuid.test(String(source.caseId))||!procedureStepKeys.includes(String(source.stepKey))
  ||typeof source.completed!=='boolean'||!Number.isInteger(source.expectedVersion)||Number(source.expectedVersion)<0)return null;
 return Object.freeze({caseId:String(source.caseId),stepKey:String(source.stepKey),completed:source.completed,expectedVersion:Number(source.expectedVersion)});
}
export function sanitizeWorkforceProcedureCaseStepResult(value:unknown){
 const row=Array.isArray(value)&&value.length===1?value[0]:null;
 if(!row||typeof row!=='object'||Array.isArray(row))return null;
 const record=row as Record<string,unknown>;
 if(!exact(record,['case_id','step_key','step_version','operation'])||!uuid.test(String(record.case_id))
  ||!procedureStepKeys.includes(String(record.step_key))||!Number.isInteger(record.step_version)||Number(record.step_version)<1
  ||!['COMPLETE','REOPEN'].includes(String(record.operation)))return null;
 return Object.freeze({caseId:String(record.case_id),stepKey:String(record.step_key),stepVersion:Number(record.step_version),operation:String(record.operation)});
}
export const WORKFORCE_PROCEDURE_CASE_CONTRACT=Object.freeze({
 procedureTypes,procedureStatuses,procedureStepKeys,optimisticConcurrency:true,maximumWriteRequests:1,employeeMasterMutation:false,auditReadOnly:true,checklistTracking:true,rawValuesInResult:false
});
