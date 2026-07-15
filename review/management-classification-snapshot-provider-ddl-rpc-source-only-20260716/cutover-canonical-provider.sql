-- DESIGN ARTIFACT ONLY. EXECUTION INELIGIBLE.
begin;
do $hold$
begin
  raise exception using
    errcode = '55000',
    message = 'CUTOVER_INELIGIBLE_SIX_PROVIDER_IDENTITIES_NOT_READY';
end
$hold$;

-- A later reviewed artifact must lock the relation, derive CRSNAP2 bytes from
-- DB-owned evidence, bind classification_version atomically, populate every
-- snapshot, verify collision-free round trips, and enable the provider last.
rollback;

