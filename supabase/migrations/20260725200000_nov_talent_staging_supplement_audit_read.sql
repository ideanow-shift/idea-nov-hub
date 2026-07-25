begin;

create or replace function public.get_nov_talent_staging_supplement_audit_v1(
  p_employee_id uuid,
  p_staging_record_id uuid
)
returns table(
  action text,
  changed_fields text[],
  supplement_version integer,
  occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_batch_id uuid;
begin
  perform public.assert_nov_talent_accountable_owner_v1(p_employee_id);
  if p_staging_record_id is null then
    raise exception using errcode = '22023', message = 'invalid_staging_record_id';
  end if;

  select r.batch_id
  into strict v_batch_id
  from public.nov_talent_historical_staging_records_v1 r
  join public.nov_talent_historical_import_batches_v1 b using (batch_id)
  where r.staging_record_id = p_staging_record_id
    and r.source_sheet_code in ('CONTACTS_27', 'ENTRIES_27', 'OFFERS_27')
    and b.state = 'OPEN'
    and b.dry_run_only
    and b.sealed_at is null;

  return query
  select h.action, h.changed_fields, h.supplement_version, h.occurred_at
  from public.nov_talent_historical_staging_supplement_audit_v1 h
  where h.staging_record_id = p_staging_record_id
  order by h.occurred_at desc, h.audit_id desc
  limit 20;
exception
  when no_data_found or too_many_rows then
    raise exception using errcode = '55000', message = 'staging_record_not_exact1';
end
$function$;

revoke all on function public.get_nov_talent_staging_supplement_audit_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_nov_talent_staging_supplement_audit_v1(uuid, uuid)
  to service_role;

commit;
