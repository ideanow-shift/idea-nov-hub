-- REVIEW ONLY. Production application requires a separate Owner approval.
-- Server-only effective-dated store/corporation resolver for Store Operations.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function identity_access.store_corporation_effective_operator_range_read_internal_v1(
  p_start_month date,
  p_end_month date,
  p_store_ids uuid[]
)
returns table (
  fiscal_month date,
  store_id uuid,
  corporation_id uuid,
  corporation_no text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_start_month is null or p_end_month is null
     or p_start_month <> pg_catalog.date_trunc('month', p_start_month)::date
     or p_end_month <> pg_catalog.date_trunc('month', p_end_month)::date
     or p_start_month > p_end_month
     or p_end_month > (p_start_month + interval '23 months')::date then
    raise exception using errcode = '22023', message = 'STORE_CORPORATION_MONTH_RANGE_INVALID';
  end if;

  if p_store_ids is null
     or pg_catalog.cardinality(p_store_ids) < 1
     or pg_catalog.cardinality(p_store_ids) > 21
     or pg_catalog.cardinality(p_store_ids) <> (
       select pg_catalog.count(distinct scoped.store_id)
       from pg_catalog.unnest(p_store_ids) as scoped(store_id)
     )
     or exists (
       select 1
       from pg_catalog.unnest(p_store_ids) as scoped(store_id)
       where scoped.store_id is null
          or scoped.store_id = '00000000-0000-0000-0000-000000000000'::uuid
     ) then
    raise exception using errcode = '22023', message = 'STORE_CORPORATION_STORE_SCOPE_INVALID';
  end if;

  return query
  select
    month_scope.fiscal_month,
    history.store_id,
    history.corporation_id,
    history.corporation_no
  from (
    select generated_month::date as fiscal_month
    from pg_catalog.generate_series(
      p_start_month::timestamp,
      p_end_month::timestamp,
      interval '1 month'
    ) as generated_month
  ) as month_scope
  join identity_access.store_corporation_history_v1 as history
    on history.valid_period @> month_scope.fiscal_month
   and history.store_id = any (p_store_ids)
  order by month_scope.fiscal_month, history.store_id;
end;
$$;

alter function identity_access.store_corporation_effective_operator_range_read_internal_v1(date, date, uuid[])
  owner to postgres;
revoke all on function identity_access.store_corporation_effective_operator_range_read_internal_v1(date, date, uuid[])
  from public, anon, authenticated, service_role;
grant usage on schema identity_access to service_role;
grant execute on function identity_access.store_corporation_effective_operator_range_read_internal_v1(date, date, uuid[])
  to service_role;

create or replace function public.store_corporation_effective_operator_range_read_v1(
  p_start_month date,
  p_end_month date,
  p_store_ids uuid[]
)
returns table (
  fiscal_month date,
  store_id uuid,
  corporation_id uuid,
  corporation_no text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from identity_access.store_corporation_effective_operator_range_read_internal_v1(
    p_start_month,
    p_end_month,
    p_store_ids
  );
$$;

alter function public.store_corporation_effective_operator_range_read_v1(date, date, uuid[])
  owner to postgres;
revoke all on function public.store_corporation_effective_operator_range_read_v1(date, date, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.store_corporation_effective_operator_range_read_v1(date, date, uuid[])
  to service_role;

comment on function identity_access.store_corporation_effective_operator_range_read_internal_v1(date, date, uuid[]) is
  'Private security-definer resolver for the server-only public invoker wrapper.';
comment on function public.store_corporation_effective_operator_range_read_v1(date, date, uuid[]) is
  'Server-only effective-dated store/corporation resolver. Missing periods are omitted and must remain analysis-excluded; current ownership must never be backcast.';

commit;
