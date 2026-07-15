-- SELECT-only, one sanitized row. No employee, role, audit, session, or target identity is returned.
with target as (
  select count(*)::int as relation_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'finance_account_classification_rules'
    and c.relkind in ('r', 'p')
), provider_role as (
  select count(*)::int as role_count from pg_catalog.pg_roles
  where rolname = 'classification_actor_audit_provider_owner'
), provider_functions as (
  select count(*)::int as function_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'read_finance_classification_actor_audit_provider_status',
      'resolve_finance_classification_actor_audit'
    )
), audit_trigger as (
  select count(*)::int as trigger_count
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'finance_account_classification_rules'
    and not t.tgisinternal
    and pg_catalog.pg_get_triggerdef(t.oid) ilike '%audit%'
)
select
  case
    when target.relation_count <> 1 then 'TARGET_NOT_EXACT'
    when provider_role.role_count <> 0 then 'ACTOR_AUDIT_OBJECT_COLLISION'
    when provider_functions.function_count <> 0 then 'ACTOR_AUDIT_OBJECT_COLLISION'
    when audit_trigger.trigger_count <> 0 then 'ACTOR_AUDIT_ENFORCEMENT_PRESENT'
    else 'ACTOR_AUDIT_SUBSTRATE_PREAPPLY_READY'
  end as category,
  target.relation_count = 1 as "targetExact",
  provider_role.role_count = 0 as "roleAbsent",
  provider_functions.function_count = 0 as "functionsAbsent",
  audit_trigger.trigger_count = 0 as "enforcementAbsent"
from target, provider_role, provider_functions, audit_trigger;
