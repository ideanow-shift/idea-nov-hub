-- SOURCE DESIGN ONLY. EXECUTION IS PROHIBITED.
-- Canonical month/range and trusted scope resolvers are not installed.

do $cutover_hold$
begin
  raise exception using
    errcode = '0A000',
    message = 'CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY';
end
$cutover_hold$;

-- A later reviewed artifact must install canonical calendar conversion,
-- inclusive closed-range comparison, and DB-owned scope binding atomically.
