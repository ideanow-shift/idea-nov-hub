begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.dbf_corporate_accounting_actual_read_v1(
  p_fiscal_month date,
  p_company_id uuid
)
returns table (
  fiscal_month date,
  company_id uuid,
  statement_type text,
  line_type text,
  account_code text,
  account_name text,
  amount_value text,
  classification text,
  aggregate_scope text,
  row_semantics text,
  is_additive boolean,
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
  if p_fiscal_month is null
     or p_fiscal_month <> pg_catalog.date_trunc('month', p_fiscal_month)::date then
    raise exception using errcode = '22023', message = 'DBF_CORPORATE_MONTH_INVALID';
  end if;

  if p_company_id is null
     or p_company_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = '22023', message = 'DBF_CORPORATE_COMPANY_SCOPE_INVALID';
  end if;

  return query
  select *
  from (
    select
      fact.fiscal_month,
      fact.company_id,
      'pl'::text as statement_type,
      'detail'::text as line_type,
      fact.account_code,
      fact.account_name,
      fact.amount::text as amount_value,
      null::text as classification,
      null::text as aggregate_scope,
      fact.row_semantics,
      fact.is_additive,
      fact.source_type,
      source_file.sha256 as source_file_sha256,
      fact.imported_at,
      fact.version as fact_version
    from public.dbf_pl_detail_facts as fact
    join dbf_ingest.source_files as source_file
      on source_file.id = fact.source_file_id
    where fact.fiscal_month = p_fiscal_month
      and fact.company_id = p_company_id
      and fact.store_id is null
      and fact.status = 'confirmed'
      and fact.is_active = true

    union all

    select
      fact.fiscal_month,
      fact.company_id,
      'pl'::text,
      'aggregate'::text,
      fact.account_code,
      fact.account_name,
      fact.amount::text,
      null::text,
      fact.aggregate_scope,
      fact.row_semantics,
      fact.is_additive,
      fact.source_type,
      source_file.sha256,
      fact.imported_at,
      fact.version
    from public.dbf_pl_aggregate_facts as fact
    join dbf_ingest.source_files as source_file
      on source_file.id = fact.source_file_id
    where fact.fiscal_month = p_fiscal_month
      and fact.company_id = p_company_id
      and fact.aggregate_scope = 'company_total'
      and fact.status = 'confirmed'
      and fact.is_active = true

    union all

    select
      fact.fiscal_month,
      fact.company_id,
      'bs'::text,
      'balance'::text,
      fact.account_code,
      fact.account_name,
      fact.amount::text,
      fact.classification,
      null::text,
      fact.row_semantics,
      fact.is_additive,
      import_batch.source_type,
      source_file.sha256,
      fact.imported_at,
      fact.version
    from public.dbf_bs_facts as fact
    join dbf_ingest.import_batches as import_batch
      on import_batch.id = fact.batch_id
     and import_batch.source_file_id = fact.source_file_id
    join dbf_ingest.source_files as source_file
      on source_file.id = fact.source_file_id
    where fact.fiscal_month = p_fiscal_month
      and fact.company_id = p_company_id
      and fact.status = 'confirmed'
      and fact.is_active = true
  ) as scoped_fact
  order by scoped_fact.statement_type, scoped_fact.line_type, scoped_fact.account_code;
end;
$$;

revoke all on function public.dbf_corporate_accounting_actual_read_v1(date, uuid)
  from public, anon, authenticated;
grant execute on function public.dbf_corporate_accounting_actual_read_v1(date, uuid)
  to service_role;

comment on function public.dbf_corporate_accounting_actual_read_v1(date, uuid) is
  'Read-only, server-scoped projection of confirmed DBF corporate P/L and B/S facts. Missing facts remain an empty preparing state in the Edge contract.';

commit;
