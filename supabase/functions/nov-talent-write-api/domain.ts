export const METRIC_EVENT=Object.freeze({contacts:'CONTACT_RECORDED',lineRegistrations:'LINE_REGISTERED',
 salonTours:'SALON_TOUR_COMPLETED',interviews:'INTERVIEW_COMPLETED',passed:'SELECTION_PASSED',offers:'OFFER_ISSUED',expectedJoiners:'EXPECTED_JOIN_CONFIRMED'});
const no=/^NT-[0-9]{4}-[0-9]{6}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
