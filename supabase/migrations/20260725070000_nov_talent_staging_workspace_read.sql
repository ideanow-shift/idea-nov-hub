begin;

create or replace function public.get_nov_talent_staging_workspace_v1(
  p_employee_id uuid,
  p_fiscal_year smallint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_batch_id uuid;
  v_rows jsonb;
begin
  if p_fiscal_year <> 2027 then
    raise exception using errcode = '22023', message = 'unsupported_fiscal_year';
  end if;

  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);

  select b.batch_id
  into strict v_batch_id
  from public.nov_talent_historical_import_batches_v1 b
  where b.state = 'OPEN'
    and b.dry_run_only
    and b.sealed_at is null;

  select coalesce(jsonb_agg(to_jsonb(projected) order by projected.created_at, projected.staging_record_id), '[]'::jsonb)
  into v_rows
  from (
    select
      r.staging_record_id,
      r.source_sheet_code,
      r.source_payload,
      r.classification,
      r.reason_codes,
      r.business_date,
      r.created_at,
      jsonb_build_object('mapping_status', m.mapping_status) as mapping
    from public.nov_talent_historical_staging_records_v1 r
    join public.nov_talent_historical_application_mappings_v1 m
      using (staging_record_id)
    where r.batch_id = v_batch_id
      and r.source_sheet_code in ('CONTACTS_27', 'ENTRIES_27', 'OFFERS_27')
    order by r.created_at, r.staging_record_id
    limit 1000
  ) projected;

  return jsonb_build_object('rows', v_rows);
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'accepted_batch_not_exact1';
end
$function$;

revoke all on function public.get_nov_talent_staging_workspace_v1(uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_staging_workspace_v1(uuid, smallint)
  to service_role;

commit;
