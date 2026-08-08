-- Review-only rollback for the NOV Talent Fair Attribution Population v2 executor.
-- Do not run as part of Population. This removes only the service-side executor RPC.
-- It intentionally preserves the canonical Attribution and append-only Audit tables.

begin;

do $rollback_guard$
declare
  v_executor_count integer;
begin
  select count(*)::integer
    into v_executor_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'nov_talent_population_fair_attribution_queue_v2'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_actor_employee_id uuid, p_actor_role text, p_environment text, p_manifest_file_sha256 text, p_manifest jsonb';

  if v_executor_count <> 1 then
    raise exception 'population_v2_rollback_executor_identity_mismatch';
  end if;

  if to_regclass('public.nov_talent_candidate_fair_attributions_v1') is null
    or to_regclass('public.nov_talent_candidate_fair_attribution_audit_v1') is null then
    raise exception 'population_v2_rollback_canonical_tables_missing';
  end if;
end
$rollback_guard$;

drop function public.nov_talent_population_fair_attribution_queue_v2(uuid,text,text,text,jsonb);

commit;
