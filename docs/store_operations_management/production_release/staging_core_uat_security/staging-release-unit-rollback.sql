begin;

revoke all on function public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz) from service_role;
revoke all on function public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz) from service_role;
revoke all on function public.store_operations_external_subject_resolve_v1(text,text,text,text,timestamptz) from service_role;
drop function if exists public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz);
drop function if exists public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz);
drop function if exists public.store_operations_external_subject_resolve_v1(text,text,text,text,timestamptz);
drop table if exists store_operations_uat_private.external_subject_binding_decisions;
drop table if exists store_operations_uat_private.external_subject_enrollment_challenges;
drop function if exists store_operations_uat_private.guard_external_binding_decision();
drop function if exists store_operations_uat_private.reject_external_subject_mutation();

revoke all on function public.store_operations_handoff_issue_v1(text,uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,uuid,timestamptz,timestamptz) from service_role;
revoke all on function public.store_operations_handoff_consume_v1(text,text,text,text,text,text,text,text,text,timestamptz,uuid) from service_role;
revoke all on function public.store_operations_uat_resolve_hub_employee_access_v1(uuid,date) from service_role;

drop function if exists public.store_operations_handoff_consume_v1(text,text,text,text,text,text,text,text,text,timestamptz,uuid);
drop function if exists public.store_operations_handoff_issue_v1(text,uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,uuid,timestamptz,timestamptz);
drop function if exists public.store_operations_uat_resolve_hub_employee_access_v1(uuid,date);
drop schema if exists store_operations_handoff cascade;

commit;
