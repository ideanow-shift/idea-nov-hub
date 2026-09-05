-- Emergency containment only; never auto-execute. No master or audit row is removed.
-- Disable the consumer rollout before approved execution; do not restore legacy auth fallback.
begin;
revoke all on function public.store_operations_production_access_v1(text) from public,anon,authenticated,service_role;
revoke insert on identity_access.auth01_binding_decisions,identity_access.m019_scope_decisions,
 identity_access.consumer_access_decisions,identity_access.store_alias_decisions from service_role;
commit;
