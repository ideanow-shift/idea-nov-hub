begin;

create or replace function public.dbf_import_preview_v1(p_batch_id uuid)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, dbf_ingest
as $$
  select jsonb_build_object(
    'batchId', b.id, 'factKind', b.fact_kind, 'fiscalMonth', to_char(b.fiscal_month, 'YYYY-MM'),
    'sourceType', b.source_type, 'status', b.status, 'revision', b.revision,
    'correctionOfBatchId', b.correction_of_batch_id,
    'rowCount', (select count(*) from dbf_ingest.staging_rows s where s.batch_id = b.id),
    'validCount', (select count(*) from dbf_ingest.staging_rows s where s.batch_id = b.id and s.validation_status in ('valid','warning')),
    'quarantinedCount', (select count(*) from dbf_ingest.staging_rows s where s.batch_id = b.id and (s.mapping_status <> 'resolved' or s.validation_status = 'quarantined')),
    'errorCount', (select count(*) from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'error'),
    'warningCount', (select count(*) from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'warning'),
    'issues', coalesce((select jsonb_agg(jsonb_build_object('severity', i.severity,
      'ruleCode', i.rule_code, 'fieldName', i.field_name, 'message', i.sanitized_message)
      order by i.id) from dbf_ingest.validation_issues i where i.batch_id = b.id), '[]'::jsonb),
    'promotionAllowed', b.status = 'approved'
      and not exists (select 1 from dbf_ingest.validation_issues i where i.batch_id = b.id and i.severity = 'error')
      and not exists (select 1 from dbf_ingest.staging_rows s where s.batch_id = b.id
        and (s.mapping_status <> 'resolved' or s.validation_status not in ('valid','warning'))),
    'correctionRows', case
      when b.fact_kind in ('pl','bs','budget','store_operating_result')
        and b.status in ('promoted','superseded') then
        coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'companyId', s.company_id,
          'storeId', s.store_id,
          'organizationId', s.organization_id,
          'accountCode', s.account_code,
          'accountName', s.account_name,
          'metricCode', s.metric_code,
          'amount', s.amount,
          'value', coalesce(s.amount, s.quantity::numeric, s.rate),
          'scenarioCode', s.normalized_payload->>'scenarioCode',
          'classification', s.normalized_payload->>'classification',
          'sourceRowCategory', s.source_row_category,
          'aggregateScope', s.normalized_payload->>'aggregateScope',
          'definitionVersion', s.normalized_payload->>'definitionVersion',
          'confirmationStatus', s.normalized_payload->>'confirmationStatus'
        )) order by s.source_row_category, s.account_code, s.metric_code, s.id)
        from dbf_ingest.staging_rows s where s.batch_id = b.id), '[]'::jsonb)
      else '[]'::jsonb
    end
  ) from dbf_ingest.import_batches b where b.id = p_batch_id;
$$;

revoke all on function public.dbf_import_preview_v1(uuid) from public, anon, authenticated;
grant execute on function public.dbf_import_preview_v1(uuid) to service_role;

comment on function public.dbf_import_preview_v1(uuid) is
  'Service-role-only owner preview. Promoted DBF batches include bounded correction-prefill rows; no mutation occurs.';

create or replace function dbf_ingest.reject_unchanged_correction_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dbf_ingest
as $$
begin
  if new.status = 'owner_review'
     and old.status is distinct from new.status
     and new.correction_of_batch_id is not null
     and not exists (
       (select s.company_id, s.store_id, s.employee_id, s.organization_id,
          s.account_code, s.account_name, s.metric_code, s.amount, s.quantity, s.rate,
          s.source_row_category, s.normalized_payload
        from dbf_ingest.staging_rows s where s.batch_id = new.id
        except all
        select s.company_id, s.store_id, s.employee_id, s.organization_id,
          s.account_code, s.account_name, s.metric_code, s.amount, s.quantity, s.rate,
          s.source_row_category, s.normalized_payload
        from dbf_ingest.staging_rows s where s.batch_id = new.correction_of_batch_id)
       union all
       (select s.company_id, s.store_id, s.employee_id, s.organization_id,
          s.account_code, s.account_name, s.metric_code, s.amount, s.quantity, s.rate,
          s.source_row_category, s.normalized_payload
        from dbf_ingest.staging_rows s where s.batch_id = new.correction_of_batch_id
        except all
        select s.company_id, s.store_id, s.employee_id, s.organization_id,
          s.account_code, s.account_name, s.metric_code, s.amount, s.quantity, s.rate,
          s.source_row_category, s.normalized_payload
        from dbf_ingest.staging_rows s where s.batch_id = new.id)
     ) then
    raise exception using errcode = '22023', message = 'DBF_CORRECTION_NO_CHANGES';
  end if;
  return new;
end;
$$;

revoke all on function dbf_ingest.reject_unchanged_correction_v1() from public, anon, authenticated;

create trigger dbf_import_batches_reject_unchanged_correction_v1
before update of status on dbf_ingest.import_batches
for each row execute function dbf_ingest.reject_unchanged_correction_v1();

commit;
