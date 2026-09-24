\set ON_ERROR_STOP on

do $assert$
declare
  v_batch_id uuid;
  v_count integer;
  v_sum numeric;
begin
  select b.id into strict v_batch_id
  from dbf_ingest.import_batches b
  join dbf_ingest.source_files s on s.id=b.source_file_id
  where s.source_system='accounting_store_operating_profit_v1'
    and s.sha256='97e5f6e360dfcd00ce6e69f974c1e9f19bc8effe8b89684fd290946d8872485d'
    and s.byte_size=4012486
    and b.fact_kind='store_operating_result'
    and b.fiscal_month=date '2026-07-01'
    and b.status='promoted';

  if (select count(*) from dbf_ingest.raw_rows where batch_id=v_batch_id) <> 13
     or (select count(*) from dbf_ingest.staging_rows where batch_id=v_batch_id) <> 13
     or (select count(*) from dbf_ingest.import_events where batch_id=v_batch_id) <> 4 then
    raise exception 'JULY_PROFIT_INGEST_COUNTS_MISMATCH';
  end if;

  with expected(store_id,amount) as (values
    ('2980442d-294c-4aae-a9bb-78f530a3a20a'::uuid,1069433.00::numeric),
    ('fec1e181-ca5b-482d-a865-3f488f19128f'::uuid,1412776.00::numeric),
    ('4e5526cc-9ec7-42aa-ac60-579b6c438c88'::uuid,1700381.00::numeric),
    ('887da14c-2c0d-46b3-8953-962c7c8dd590'::uuid,737932.00::numeric),
    ('1285ac70-9181-44db-9443-cbd043ab908b'::uuid,1514582.00::numeric),
    ('1bcba30a-d063-4cdb-be74-425e250aeb25'::uuid,1501426.00::numeric),
    ('ad931406-22de-4ba7-a6eb-4502d5c50a91'::uuid,1292788.00::numeric),
    ('36c222de-0554-4265-b177-3b68285cc4a4'::uuid,591234.00::numeric),
    ('e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6'::uuid,1708374.00::numeric),
    ('73ee82b5-86fa-42e7-ab03-0e075d218dc3'::uuid,390488.00::numeric),
    ('b898c63f-1cc1-42c5-be4f-916f24f49cb6'::uuid,-85667.00::numeric),
    ('5f66193f-d360-4967-b9c7-a100c8ee5e94'::uuid,-318450.00::numeric),
    ('ac20934d-ef15-4363-8c2f-759193c7fcc7'::uuid,-438050.00::numeric)
  )
  select count(*),sum(f.amount) into v_count,v_sum
  from expected e
  join public.dbf_store_monthly_metric_facts f
    on f.batch_id=v_batch_id and f.fiscal_month=date '2026-07-01'
   and f.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid
   and f.store_id=e.store_id and f.metric_code='OPERATING_PROFIT'
   and f.amount=e.amount and f.quantity is null and f.rate is null
   and f.definition_version='v1' and f.status='confirmed' and f.is_active;
  if v_count <> 13 or v_sum <> 11077247.00 then
    raise exception 'JULY_PROFIT_CANONICAL_VALUES_MISMATCH count=% sum=%',v_count,v_sum;
  end if;

  if exists (
    select 1 from public.dbf_store_monthly_metric_facts
    where batch_id=v_batch_id and store_id in (
      '3ba5e54d-5f39-4bcd-b917-7daaea34a8e9'::uuid,
      '71551fcf-853f-4cad-ac94-82b93e75de82'::uuid,
      'acc91785-3bb5-49f0-a2f6-0be6e5d511eb'::uuid,
      '02d29285-6df0-44b2-bca8-4d61bfe1f5a8'::uuid,
      'e7ecb022-6b19-4952-bf4b-fbf5f4c53895'::uuid
    )
  ) then
    raise exception 'EXCLUDED_FC_ROW_PROMOTED';
  end if;
end
$assert$;
