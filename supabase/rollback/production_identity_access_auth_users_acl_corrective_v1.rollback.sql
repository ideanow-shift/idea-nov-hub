-- Emergency containment only. Do not restore direct auth.users access.
begin;
revoke all on function public.store_operations_production_access_v1(text) from public,anon,authenticated,service_role;
revoke all on function identity_access.auth_user_active_v1(uuid) from public,anon,authenticated,service_role;
revoke insert on identity_access.auth01_binding_decisions from service_role;
commit;
