-- SOURCE DESIGN ONLY. EXECUTION IS PROHIBITED.
-- Employee, role, scope, and audit command providers are not installed.

do $cutover_hold$
begin
  raise exception using
    errcode = '0A000',
    message = 'CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY';
end
$cutover_hold$;

-- A later reviewed artifact must install DB-owned actor resolution and an
-- exact-one same-transaction audit command atomically with mutation cutover.
