import { createWriteAuthorizer, type TalentWriteCapability } from './auth.ts';
import type { Deps } from './http.ts';

const SECRET='HUB_APP_SESSION_SIGNING_SECRET';
const URL_KEY='SUPABASE_URL';
const SERVICE_KEY='SUPABASE_SERVICE_ROLE_KEY';
const EXACT_ROLE='talent_admin';
const ALLOWED_RPCS=new Set([
  'create_nov_talent_application_with_event_audited_v2',
  'record_nov_talent_funnel_event_audited_v2',
  'invalidate_nov_talent_funnel_event_audited_v2',
  'apply_nov_talent_historical_review_v1',
  'save_nov_talent_student_profile_v2',
  'save_nov_talent_staging_supplement_v1'
]);
const GOVERNANCE_RPC='resolve_nov_talent_admin_governance_v1';
export interface RuntimeEnv{get(name:string):string|undefined}
export type RuntimeFetch=(input:string,init:RequestInit)=>Promise<Response>;
const fixed=(env:RuntimeEnv)=>({base:(env.get(URL_KEY)||'').replace(/\/+$/,''),key:env.get(SERVICE_KEY)||''});
const headers=(key:string)=>({apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'});

export function createWriteRuntime(env:RuntimeEnv,fetchImpl:RuntimeFetch):Deps{
 const authorizer=createWriteAuthorizer({signingSecret:env.get(SECRET)||'',async resolveServerGovernance(subject){
  const {base,key}=fixed(env);if(!base||!key||!/^[0-9a-f-]{36}$/i.test(subject))return null;
  try{const response=await fetchImpl(`${base}/rest/v1/rpc/${GOVERNANCE_RPC}`,{method:'POST',headers:headers(key),body:JSON.stringify({p_employee_id:subject})});
   if(!response.ok)return null;const rows=await response.json();return Array.isArray(rows)&&rows.length===1?rows[0]:null;
  }catch{return null;}
 }});
 return Object.freeze({authorizer,async rpc(_cap:TalentWriteCapability,name:string,args:Record<string,unknown>){
  if(!ALLOWED_RPCS.has(name))throw new Error('rpc_not_allowed');const {base,key}=fixed(env);if(!base||!key)throw new Error('runtime_not_ready');
  const response=await fetchImpl(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:headers(key),body:JSON.stringify(args)});
  if(!response.ok)throw new Error('rpc_unavailable');return await response.json();
 }});
}
export const WRITE_RUNTIME_CONTRACT=Object.freeze({secretName:SECRET,role:EXACT_ROLE,roleSource:'server_side_governance_rpc',governanceRpc:GOVERNANCE_RPC,rpcAllowlist:[...ALLOWED_RPCS],retry:0,rawOutput:false});
