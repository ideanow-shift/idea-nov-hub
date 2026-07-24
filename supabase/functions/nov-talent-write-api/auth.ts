import { validateTalentAdminGovernance } from "./governance.ts";

const BRAND=Symbol('nov-talent-write-capability');
const EXACT_ROLE='talent_admin';
export type TalentWriteCapability=Readonly<{scope:'talent_write';actorEmployeeId:string;[BRAND]:true}>;
export interface WriteAuthorizer{authorize(bearer:string):Promise<TalentWriteCapability|null>}
const b64=(s:string)=>{try{const n=s.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(s.length/4)*4,'=');
  return Uint8Array.from(atob(n),c=>c.charCodeAt(0));}catch{return null;}};
const json=(s:string)=>{try{const bytes=b64(s);return bytes?JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)):null;}catch{return null;}};
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
export function createWriteAuthorizer({signingSecret,resolveServerGovernance,now=()=>Math.floor(Date.now()/1000)}:{
 signingSecret:string;resolveServerGovernance:(subject:string)=>Promise<unknown>;now?:()=>number}):WriteAuthorizer{
 return Object.freeze({async authorize(bearer:string){try{
  const parts=bearer.split('.');if(parts.length!==3)return null;
  const h=json(parts[0]),p=json(parts[1]),sig=b64(parts[2]);
  if(!h||!p||!exact(h,['alg','typ','v'])||!exact(p,['v','sid','sub','aud','auth_source','iat','exp','role_version_checked_at'])
    ||h.alg!=='HS256'||h.typ!=='NOV-HUB-APP-SESSION'||h.v!==1||p.aud!=='nov_hub'||p.auth_source!=='hub_pin'
    ||!Number.isSafeInteger(p.exp)||Number(p.exp)<=now()||sig?.length!==32||signingSecret.length<32)return null;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(signingSecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,sig,new TextEncoder().encode(`${parts[0]}.${parts[1]}`)))return null;
  const subject=String(p.sub||'');if(!/^[0-9a-f-]{36}$/i.test(subject))return null;
  if(!validateTalentAdminGovernance(await resolveServerGovernance(subject),now()*1000))return null;
  return Object.freeze({scope:'talent_write',actorEmployeeId:subject,[BRAND]:true}) as TalentWriteCapability;
 }catch{return null;}}});
}
export const WRITE_AUTH_CONTRACT=Object.freeze({role:EXACT_ROLE,roleSource:'server_side_governance_rpc',browserAssertionAccepted:false,assignmentLimitDays:90,reviewIntervalDays:30});
