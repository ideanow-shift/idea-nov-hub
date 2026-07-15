-- SELECT-only, one sanitized row. No target values or identities are returned.
with target as (
  select count(*)::int as relation_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'finance_account_classification_rules'
    and c.relkind in ('r', 'p')
), snapshot_column as (
  select count(*)::int as column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'finance_account_classification_rules'
    and column_name = 'classification_snapshot'
), provider_functions as (
  select count(*)::int as function_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'read_finance_classification_snapshot_provider_status',
      'derive_finance_classification_snapshot'
    )
), provider_trigger as (
  select count(*)::int as trigger_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'finance_account_classification_rules'
    and not t.tgisinternal
    and pg_catalog.pg_get_triggerdef(t.oid) ilike '%snapshot%'
)
select
  case
    when target.relation_count <> 1 then 'TARGET_NOT_EXACT'
    when snapshot_column.column_count <> 0 then 'SNAPSHOT_OBJECT_COLLISION'
    when provider_functions.function_count <> 0 then 'SNAPSHOT_OBJECT_COLLISION'
    when provider_trigger.trigger_count <> 0 then 'SNAPSHOT_ENFORCEMENT_PRESENT'
    else 'SNAPSHOT_SUBSTRATE_PREAPPLY_READY'
  end as category,
  target.relation_count = 1 as "targetExact",
  snapshot_column.column_count = 0 as "columnAbsent",
  provider_functions.function_count = 0 as "functionsAbsent",
  provider_trigger.trigger_count = 0 as "enforcementAbsent"
from target, snapshot_column, provider_functions, provider_trigger;

