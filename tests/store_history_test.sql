-- Source-only validation plan. Do not execute against production.
begin;

-- Expected after V001: FK, interval guard, RLS, and no seed/backfill side effect.
select conname
from pg_constraint
where conrelid = 'public.store_operation_history'::regclass
  and conname in (
    'store_operation_history_store_uuid_fkey',
    'store_operation_history_operating_entity_uuid_fkey',
    'store_operation_history_no_overlapping_periods'
  );

select relrowsecurity
from pg_class
where oid = 'public.store_operation_history'::regclass;

-- In a disposable staging transaction, insert one history period then assert
-- a same-store overlapping period fails with the exclusion constraint.
-- No UUID literal is supplied here; the staging harness must use a fixture row.

rollback;
