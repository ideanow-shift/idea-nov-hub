export const TALENT_ADMIN_GOVERNANCE = Object.freeze({
  exactRole: 'talent_admin',
  assignmentTimeLimitDays: 90,
  reviewIntervalDays: 30,
  browserAuthority: false,
  duplicateOrAmbiguousRole: 'FAIL_CLOSED',
  serverSideRevalidationRequired: true,
  revocationSla: Object.freeze({
    securityIncident: 'IMMEDIATE',
    employmentEndOrRoleChange: 'SAME_BUSINESS_DAY',
    other: 'ONE_BUSINESS_DAY',
  }),
});

export type TalentAdminGovernanceRecord = Readonly<{
  role: 'talent_admin';
  active: true;
  assignmentApproved: true;
  assignedAt: string;
  expiresAt: string;
  reviewedAt: string;
  revoked: false;
}>;

const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const DAY=86_400_000;
const time=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;

export function validateTalentAdminGovernance(value:unknown,nowMs=Date.now()):TalentAdminGovernanceRecord|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(!exact(v,['role','active','assignmentApproved','assignedAt','expiresAt','reviewedAt','revoked'])
  ||v.role!=='talent_admin'||v.active!==true||v.assignmentApproved!==true||v.revoked!==false)return null;
 const assigned=time(v.assignedAt),expires=time(v.expiresAt),reviewed=time(v.reviewedAt);
 if(assigned===null||expires===null||reviewed===null||assigned>nowMs||reviewed>nowMs||expires<=nowMs)return null;
 if(expires-assigned>90*DAY||nowMs-reviewed>30*DAY)return null;
 return Object.freeze(v) as TalentAdminGovernanceRecord;
}

export const GOVERNANCE_BINDING_CONTRACT=Object.freeze({
  source:'server_side_only',
  storageMappingStatus:'CANONICAL_GOVERNANCE_RELATION_APPLIED',
  relation:'nov_talent_admin_assignments_v1',
  resolver:'resolve_nov_talent_admin_governance_v1',
  unmappedBehavior:'FAIL_CLOSED',
});
