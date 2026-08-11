export const RECRUITING_PLANNING_CONTRACT_VERSION = "1.0.0";
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const PERIOD = /^[A-Z0-9][A-Z0-9_-]{0,31}$/u;
const TRACKS = new Set(["NEW_GRAD", "MID_CAREER"]);
const METRICS = new Set(["CONTACT_COUNT", "SALON_VISIT_COUNT", "APPLICATION_COUNT", "OFFERED_COUNT", "OFFER_ACCEPTED_COUNT"]);
const CHANNELS = new Set(["JOB_FAIR","SCHOOL_GUIDANCE","SCHOOL_VISIT","PAID_JOB_MEDIA","FREE_JOB_MEDIA","SNS","OWNED_WEB","REFERRAL","HELLO_WORK","REHIRE","DEALER_REFERRAL","OTHER"]);

export const ACTUAL_SOURCE = Object.freeze({
  CONTACT_COUNT: "ACTUAL_SOURCE_UNAVAILABLE", SALON_VISIT_COUNT: "ACTUAL_SOURCE_UNAVAILABLE",
  APPLICATION_COUNT: "SELECTION_HISTORY:APPLICATION_RECEIVED", OFFERED_COUNT: "SELECTION_HISTORY:OFFERED",
  OFFER_ACCEPTED_COUNT: "SELECTION_HISTORY:OFFER_ACCEPTED", EXPECTED_JOIN_COUNT: "NOT_OPERATIONAL",
});

export function planningCapabilityEnvelope(canWritePlanning: boolean) {
  return Object.freeze({
    ok: true,
    data: Object.freeze({
      recruiting_planning_capability_contract_version: RECRUITING_PLANNING_CONTRACT_VERSION,
      canWritePlanning: canWritePlanning === true,
    }),
  });
}

export function cleanPlanningTargetDraft(value: unknown) {
  if (!exact(value,["recruitingTrack","graduationYear","targetMetric","periodCode","periodStart","periodEnd","targetCount","effectiveFrom","effectiveTo","reason"])) return null;
  const x=value as Record<string,unknown>; const track=String(x.recruitingTrack); const year=x.graduationYear; const reason=String(x.reason||"").trim();
  if(!TRACKS.has(track)||!METRICS.has(String(x.targetMetric))||!PERIOD.test(String(x.periodCode))||!dates(x)||typeof x.targetCount!=="number"||!Number.isInteger(x.targetCount)||x.targetCount<0||reason.length<1||reason.length>500) return null;
  if(track==="NEW_GRAD"&&(!Number.isInteger(year)||Number(year)<2020||Number(year)>2100)) return null;
  if(track==="MID_CAREER"&&year!==null) return null;
  return Object.freeze({recruitingTrack:track,graduationYear:year as number|null,targetMetric:String(x.targetMetric),periodCode:String(x.periodCode),periodStart:String(x.periodStart),periodEnd:String(x.periodEnd),targetCount:x.targetCount,effectiveFrom:String(x.effectiveFrom),effectiveTo:String(x.effectiveTo),reason});
}
export function cleanPlanningBudgetDraft(value:unknown){
  if(!exact(value,["recruitingTrack","graduationYear","periodCode","periodStart","periodEnd","totalBudget","currency","effectiveFrom","effectiveTo","reason","lines"])) return null;
  const x=value as Record<string,unknown>; const track=String(x.recruitingTrack); const year=x.graduationYear; const reason=String(x.reason||"").trim();
  if(!TRACKS.has(track)||!PERIOD.test(String(x.periodCode))||!dates(x)||x.currency!=="JPY"||typeof x.totalBudget!=="number"||!Number.isSafeInteger(x.totalBudget)||x.totalBudget<0||reason.length<1||reason.length>500||!Array.isArray(x.lines)) return null;
  if(track==="NEW_GRAD"&&(!Number.isInteger(year)||Number(year)<2020||Number(year)>2100)||track==="MID_CAREER"&&year!==null) return null;
  const seen=new Set<string>(); const lines=[] as Array<{channelCode:string,amount:number,reason:string}>;
  for(const raw of x.lines){ if(!exact(raw,["channelCode","amount","reason"])) return null; const l=raw as Record<string,unknown>; const code=String(l.channelCode); const why=String(l.reason||"").trim(); if(!CHANNELS.has(code)||seen.has(code)||typeof l.amount!=="number"||!Number.isSafeInteger(l.amount)||l.amount<0||why.length<1||why.length>500)return null; seen.add(code);lines.push({channelCode:code,amount:l.amount,reason:why}); }
  if(lines.reduce((n,l)=>n+l.amount,0)>Number(x.totalBudget))return null;
  return Object.freeze({recruitingTrack:track,graduationYear:year as number|null,periodCode:String(x.periodCode),periodStart:String(x.periodStart),periodEnd:String(x.periodEnd),totalBudget:x.totalBudget,currency:"JPY",effectiveFrom:String(x.effectiveFrom),effectiveTo:String(x.effectiveTo),reason,lines:Object.freeze(lines)});
}
export function cleanPlanningState(value:unknown){if(!exact(value,["expectedRowVersion"]))return null;const n=(value as any).expectedRowVersion;return Number.isInteger(n)&&n>=1?Object.freeze({expectedRowVersion:n}):null;}
export function planningEnvelope(kind:string,targets:unknown[],budgets:unknown[],lines:unknown[]=[]){if(!Array.isArray(targets)||!Array.isArray(budgets)||!Array.isArray(lines))return null;const ts=targets.map(targetView),bs=budgets.map(budgetView),ls=lines.map(lineView);if([...ts,...bs,...ls].some(x=>!x))return null;return Object.freeze({ok:true,data:Object.freeze({recruiting_planning_contract_version:RECRUITING_PLANNING_CONTRACT_VERSION,kind,targets:Object.freeze(ts),budgets:Object.freeze(bs),budgetLines:Object.freeze(ls),actualSources:ACTUAL_SOURCE,sourceAvailability:true})});}
function targetView(v:unknown){const x=v as any;if(!x||!TRACKS.has(String(x.recruiting_track))||!METRICS.has(String(x.target_metric)))return null;return Object.freeze({targetId:String(x.target_id),recruitingTrack:String(x.recruiting_track),graduationYear:x.graduation_year===null?null:Number(x.graduation_year),targetMetric:String(x.target_metric),period:{code:String(x.recruiting_period_code),start:String(x.recruiting_period_start),end:String(x.recruiting_period_end)},scope:"COMPANY",targetCount:Number(x.target_count),version:Number(x.version),rowVersion:Number(x.row_version),state:String(x.record_state),effectivePeriod:{from:String(x.effective_from),to:String(x.effective_to)},reason:String(x.reason),approvedAt:x.approved_at??null});}
function budgetView(v:unknown){const x=v as any;if(!x||!TRACKS.has(String(x.recruiting_track))||x.currency!=="JPY")return null;return Object.freeze({budgetId:String(x.budget_id),recruitingTrack:String(x.recruiting_track),graduationYear:x.graduation_year===null?null:Number(x.graduation_year),period:{code:String(x.recruiting_period_code),start:String(x.recruiting_period_start),end:String(x.recruiting_period_end)},scope:"COMPANY",totalBudget:Number(x.total_budget),currency:"JPY",version:Number(x.version),rowVersion:Number(x.row_version),state:String(x.record_state),effectivePeriod:{from:String(x.effective_from),to:String(x.effective_to)},reason:String(x.reason),approvedAt:x.approved_at??null});}
function lineView(v:unknown){const x=v as any;if(!x||!CHANNELS.has(String(x.channel_code)))return null;return Object.freeze({budgetId:String(x.budget_id),channelCode:String(x.channel_code),amount:Number(x.amount),reason:String(x.reason)});}
function dates(x:Record<string,unknown>){return DATE.test(String(x.periodStart))&&DATE.test(String(x.periodEnd))&&String(x.periodStart)<=String(x.periodEnd)&&DATE.test(String(x.effectiveFrom))&&DATE.test(String(x.effectiveTo))&&String(x.effectiveFrom)<=String(x.effectiveTo);}
function exact(v:unknown,keys:string[]){if(!v||typeof v!=="object"||Array.isArray(v))return false;const a=Object.keys(v as object).sort(),b=keys.slice().sort();return a.length===b.length&&a.every((k,i)=>k===b[i]);}
