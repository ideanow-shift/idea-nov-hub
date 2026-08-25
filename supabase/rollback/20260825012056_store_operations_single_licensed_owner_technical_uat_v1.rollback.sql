-- Emergency Staging-only rollback. Existing append-only audit rows are preserved.
begin;

revoke all on function public.store_operations_technical_assumption_issue_v1(text,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_technical_assumption_consume_v1(text,text,text,text,text,integer,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_technical_assumption_validate_v1(uuid,uuid,text,timestamptz)
  from public,anon,authenticated,service_role;
revoke all on function public.store_operations_technical_assumption_revoke_v1(uuid,text)
  from public,anon,authenticated,service_role;

-- Do not restore the superseded independent-account issue/consume grants.
-- Tables and functions remain for immutable audit/read-back and fail closed.

commit;
