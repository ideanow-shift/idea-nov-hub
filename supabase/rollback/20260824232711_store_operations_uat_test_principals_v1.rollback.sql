begin;

revoke all on function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz)
  from public,anon,authenticated,service_role;
drop function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz);
drop function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz);

alter table store_operations_uat_private.external_subject_enrollment_challenges
  drop constraint external_subject_enrollment_challenges_identity_key_check,
  drop constraint external_subject_enrollment_challenges_approval_reference_check;
alter table store_operations_uat_private.external_subject_enrollment_challenges
  add constraint external_subject_enrollment_challenges_identity_key_check check (identity_key='uat-executive'),
  add constraint external_subject_enrollment_challenges_approval_reference_check
    check (approval_reference='approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1');

alter table store_operations_uat_private.external_subject_binding_decisions
  drop constraint external_subject_binding_decisions_evidence_reference_check;
alter table store_operations_uat_private.external_subject_binding_decisions
  add constraint external_subject_binding_decisions_evidence_reference_check
    check (evidence_reference='approval:OWNER-STORE-OPS-UAT-WAKITA-FIREBASE-BINDING-2026-08-24-V1');

grant execute on function public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz) to service_role;
grant execute on function public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz) to service_role;

commit;
