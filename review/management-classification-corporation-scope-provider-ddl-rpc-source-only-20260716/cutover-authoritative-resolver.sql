-- SOURCE DESIGN ONLY. EXECUTION IS PROHIBITED.
-- Authoritative actor/role/scope/target resolvers are not installed.

do $cutover_hold$
begin
  raise exception using
    errcode = '0A000',
    message = 'CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY';
end
$cutover_hold$;

-- A later separately reviewed artifact must atomically install DB-owned actor,
-- permission, target, corporation, and common-rule policy resolvers.
