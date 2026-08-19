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
      when b.fact_kind = 'store_operating_result' and b.status in ('promoted', 'superseded') then
        coalesce((select jsonb_agg(jsonb_build_object(
          'companyId', s.company_id,
          'storeId', s.store_id,
          'metricCode', s.metric_code,
          'value', coalesce(s.amount, s.quantity::numeric, s.rate),
          'definitionVersion', s.normalized_payload->>'definitionVersion',
          'confirmationStatus', s.normalized_payload->>'confirmationStatus'
        ) order by s.source_row_category, s.metric_code, s.id)
        from dbf_ingest.staging_rows s where s.batch_id = b.id), '[]'::jsonb)
      else '[]'::jsonb
    end
  ) from dbf_ingest.import_batches b where b.id = p_batch_id;
$$;

revoke all on function public.dbf_import_preview_v1(uuid) from public, anon, authenticated;
grant execute on function public.dbf_import_preview_v1(uuid) to service_role;

comment on function public.dbf_import_preview_v1(uuid) is
  'Service-role-only owner preview. Promoted Store Monthly batches include bounded correction-prefill rows; no mutation occurs.';

commit;
