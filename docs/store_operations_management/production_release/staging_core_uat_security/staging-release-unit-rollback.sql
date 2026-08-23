begin;

revoke all on function public.store_operations_handoff_issue_v1(text,uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,uuid,timestamptz,timestamptz) from service_role;
revoke all on function public.store_operations_handoff_consume_v1(text,text,text,text,text,text,text,text,text,timestamptz,uuid) from service_role;
revoke all on function public.store_operations_uat_resolve_hub_employee_access_v1(uuid,date) from service_role;

drop function if exists public.store_operations_handoff_consume_v1(text,text,text,text,text,text,text,text,text,timestamptz,uuid);
drop function if exists public.store_operations_handoff_issue_v1(text,uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,uuid,timestamptz,timestamptz);
drop function if exists public.store_operations_uat_resolve_hub_employee_access_v1(uuid,date);
drop schema if exists store_operations_handoff cascade;

commit;
