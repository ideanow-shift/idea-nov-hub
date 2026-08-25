begin;

revoke all on function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz)
  from public,anon,authenticated,service_role;
drop function public.store_operations_external_enrollment_consume_v2(text,text,text,text,text,text,integer,uuid,timestamptz);
drop function public.store_operations_external_enrollment_issue_v2(text,text,text,timestamptz);

-- The expanded CHECK domains remain so append-only UAT audit rows stay valid.
-- Rollback disables issuance/consumption without deleting or rewriting history.

grant execute on function public.store_operations_external_enrollment_issue_v1(text,text,text,timestamptz) to service_role;
grant execute on function public.store_operations_external_enrollment_consume_v1(text,text,text,text,text,integer,uuid,timestamptz) to service_role;

commit;
