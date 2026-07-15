-- SOURCE DESIGN ONLY. EXECUTION IS PROHIBITED.
-- Owner resolution, key generation, and snapshot binding are not installed.

do $cutover_hold$
begin
  raise exception using
    errcode = '0A000',
    message = 'CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY';
end
$cutover_hold$;

-- A later reviewed artifact must atomically install DB-owned owner resolution,
-- canonical key generation, target binding, and snapshot comparison.
