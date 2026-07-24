export const AUDIT_EVENTS=Object.freeze(['ASSIGNMENT_APPROVED','ASSIGNMENT_REVIEWED','ASSIGNMENT_REVOKED','WRITE_AUTHORIZED','WRITE_DENIED']);
export const AUDIT_REASONS=Object.freeze(['APPROVED','EXPIRED','REVIEW_OVERDUE','ROLE_CHANGED','EMPLOYMENT_ENDED','SECURITY_INCIDENT','OWNER_REVOKED','AMBIGUOUS_ROLE','UNAUTHORIZED']);

export type SafeTalentAdminAuditEntry=Readonly<{
  event:typeof AUDIT_EVENTS[number];
  reasonCode:typeof AUDIT_REASONS[number];
  outcome:'ALLOW'|'DENY';
  occurredAt:string;
}>;
export type PrivateTalentAdminAuditRecord=Readonly<SafeTalentAdminAuditEntry&{
  actor_employee_id:string;
  application_id:string;
  funnel_event_id:string;
}>;

const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

export function validateSafeAuditEntry(value:unknown):SafeTalentAdminAuditEntry|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(!exact(v,['event','reasonCode','outcome','occurredAt'])
  ||!AUDIT_EVENTS.includes(String(v.event))||!AUDIT_REASONS.includes(String(v.reasonCode))
  ||!['ALLOW','DENY'].includes(String(v.outcome))||typeof v.occurredAt!=='string'||!Number.isFinite(Date.parse(v.occurredAt)))return null;
 return Object.freeze(v) as SafeTalentAdminAuditEntry;
}

export function validatePrivateAuditRecord(value:unknown):PrivateTalentAdminAuditRecord|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as Record<string,unknown>;
 if(!exact(v,['event','reasonCode','outcome','occurredAt','actor_employee_id','application_id','funnel_event_id']))return null;
 const safe=validateSafeAuditEntry({event:v.event,reasonCode:v.reasonCode,outcome:v.outcome,occurredAt:v.occurredAt});
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!safe||!uuid.test(String(v.actor_employee_id))||!uuid.test(String(v.application_id))||!uuid.test(String(v.funnel_event_id)))return null;
 return Object.freeze(v) as PrivateTalentAdminAuditRecord;
}

export const AUDIT_CONTRACT=Object.freeze({
  appendOnly:true,
  serverTimestampRequired:true,
  fixedFields:Object.freeze(['event','reasonCode','outcome','occurredAt']),
  backendPrivateFields:Object.freeze(['actor_employee_id','application_id','funnel_event_id']),
  backendPrivateFieldsOutputAllowed:false,
  prohibited:Object.freeze(['token','claims','personalValues','rawError','freeText','applicationNo','applicationUUID']),
  storageBindingStatus:'MIGRATION_CANDIDATE_BOUND',
  transactionBoundary:'MUTATION_AND_AUDIT_SAME_RPC_TRANSACTION',
  physicalUpdateOrDelete:false,
  bindingMissingBehavior:'FAIL_CLOSED_WITHOUT_WRITE_ENABLEMENT',
});
