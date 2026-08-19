begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.dbf_store_monthly_actual_range_read_v1(
  p_start_month date,
  p_end_month date,
  p_company_id uuid,
  p_store_ids uuid[]
)
returns table (
  fiscal_month date,
  company_id uuid,
  store_id uuid,
  metric_code text,
  value_kind text,
  metric_value text,
  definition_version text,
  display_name text,
  description text,
  source_type text,
  source_file_sha256 text,
  imported_at timestamptz,
  fact_version integer
)
language plpgsql
security invoker
set search_path = pg_catalog, dbf_ingest
as $$
begin
  if p_start_month is null or p_end_month is null
     or p_start_month <> pg_catalog.date_trunc('month', p_start_month)::date
     or p_end_month <> pg_catalog.date_trunc('month', p_end_month)::date
     or p_start_month > p_end_month
     or p_end_month > (p_start_month + interval '23 months')::date then
    raise exception using errcode = '22023', message = 'DBF_STORE_MONTH_RANGE_INVALID';
  end if;
  if p_company_id is null
     or p_company_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = '22023', message = 'DBF_COMPANY_SCOPE_INVALID';
  end if;
  if p_store_ids is null or pg_catalog.cardinality(p_store_ids) < 1
     or pg_catalog.cardinality(p_store_ids) > 20
     or pg_catalog.cardinality(p_store_ids) <> (
       select pg_catalog.count(distinct scoped.store_id)
       from pg_catalog.unnest(p_store_ids) as scoped(store_id)
     )
     or exists (
       select 1 from pg_catalog.unnest(p_store_ids) as scoped(store_id)
       where scoped.store_id is null
          or scoped.store_id = '00000000-0000-0000-0000-000000000000'::uuid
     ) then
    raise exception using errcode = '22023', message = 'DBF_STORE_SCOPE_INVALID';
  end if;

  return query
  select fact.fiscal_month, fact.company_id, fact.store_id, fact.metric_code,
    definition.value_kind,
    case definition.value_kind when 'amount' then fact.amount::text
      when 'quantity' then fact.quantity::text when 'rate' then fact.rate::text else null end,
    fact.definition_version, definition.display_name, definition.description,
    fact.source_type, source_file.sha256, fact.imported_at, fact.version
  from public.dbf_store_monthly_metric_facts as fact
  join dbf_ingest.metric_definitions as definition
    on definition.metric_code = fact.metric_code
   and definition.definition_version = fact.definition_version
   and definition.is_active = true
  join dbf_ingest.source_files as source_file on source_file.id = fact.source_file_id
  where fact.fiscal_month between p_start_month and p_end_month
    and fact.company_id = p_company_id
    and fact.store_id = any (p_store_ids)
    and fact.status = 'confirmed' and fact.is_active = true
  order by fact.fiscal_month, fact.store_id, fact.metric_code;
end;
$$;

revoke all on function public.dbf_store_monthly_actual_range_read_v1(date, date, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.dbf_store_monthly_actual_range_read_v1(date, date, uuid, uuid[])
  to service_role;

create or replace function public.dbf_store_monthly_budget_range_read_v1(
  p_start_month date,
  p_end_month date,
  p_company_id uuid,
  p_store_ids uuid[]
)
returns table (
  fiscal_month date,
  company_id uuid,
  store_id uuid,
  scenario_code text,
  metric_code text,
  budget_amount text,
  source_file_sha256 text,
  imported_at timestamptz,
  fact_version integer
)
language plpgsql
security invoker
set search_path = pg_catalog, dbf_ingest
as $$
begin
  if p_start_month is null or p_end_month is null
     or p_start_month <> pg_catalog.date_trunc('month', p_start_month)::date
     or p_end_month <> pg_catalog.date_trunc('month', p_end_month)::date
     or p_start_month > p_end_month
     or p_end_month > (p_start_month + interval '23 months')::date then
    raise exception using errcode = '22023', message = 'DBF_BUDGET_MONTH_RANGE_INVALID';
  end if;
  if p_company_id is null
     or p_company_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = '22023', message = 'DBF_COMPANY_SCOPE_INVALID';
  end if;
  if p_store_ids is null or pg_catalog.cardinality(p_store_ids) < 1
     or pg_catalog.cardinality(p_store_ids) > 20
     or pg_catalog.cardinality(p_store_ids) <> (
       select pg_catalog.count(distinct scoped.store_id)
       from pg_catalog.unnest(p_store_ids) as scoped(store_id)
     )
     or exists (
       select 1 from pg_catalog.unnest(p_store_ids) as scoped(store_id)
       where scoped.store_id is null
          or scoped.store_id = '00000000-0000-0000-0000-000000000000'::uuid
     ) then
    raise exception using errcode = '22023', message = 'DBF_STORE_SCOPE_INVALID';
  end if;

  return query
  select fact.fiscal_month, fact.company_id, fact.store_id, fact.scenario_code,
    fact.metric_code, fact.amount::text, source_file.sha256,
    fact.imported_at, fact.version
  from public.dbf_budget_facts as fact
  join dbf_ingest.source_files as source_file on source_file.id = fact.source_file_id
  where fact.fiscal_month between p_start_month and p_end_month
    and fact.company_id = p_company_id
    and fact.store_id = any (p_store_ids)
    and fact.organization_id is null
    and fact.metric_code is not null
    and fact.status = 'confirmed' and fact.is_active = true
  order by fact.fiscal_month, fact.store_id, fact.metric_code, fact.scenario_code;
end;
$$;

revoke all on function public.dbf_store_monthly_budget_range_read_v1(date, date, uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.dbf_store_monthly_budget_range_read_v1(date, date, uuid, uuid[])
  to service_role;

comment on function public.dbf_store_monthly_actual_range_read_v1(date, date, uuid, uuid[]) is
  'Server-scoped read-only range of confirmed canonical Store Monthly Actual facts for comparison projections.';
comment on function public.dbf_store_monthly_budget_range_read_v1(date, date, uuid, uuid[]) is
  'Server-scoped read-only range of confirmed canonical store metric Budget facts. Scenario selection remains fail-closed in the consumer projection.';

commit;
