\set ON_ERROR_STOP on

begin;

insert into dbf_ingest.source_files
  (id,sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id)
values
  ('71000000-0000-4000-8000-000000000001',repeat('a',64),1,'original.csv','text/csv','correction-test','71000000-0000-4000-8000-000000000010'),
  ('71000000-0000-4000-8000-000000000002',repeat('b',64),1,'correction.csv','text/csv','correction-test','71000000-0000-4000-8000-000000000010');

insert into dbf_ingest.import_batches
  (id,source_file_id,fact_kind,fiscal_month,source_type,status,revision,correction_of_batch_id,correction_reason,created_by_employee_id,approved_by_employee_id,approved_at,promoted_at)
values
  ('71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000001','store_operating_result','2026-06-01','manual_entry','promoted',1,null,null,'71000000-0000-4000-8000-000000000010','71000000-0000-4000-8000-000000000010',statement_timestamp(),statement_timestamp()),
  ('71000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000002','store_operating_result','2026-06-01','manual_entry','received',2,'71000000-0000-4000-8000-000000000003','確定値への変更','71000000-0000-4000-8000-000000000010',null,null,null);

insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
values
  ('71000000-0000-4000-8000-000000000003',1,'{}',repeat('c',64)),
  ('71000000-0000-4000-8000-000000000004',1,'{}',repeat('d',64));

insert into dbf_ingest.staging_rows
  (batch_id,raw_row_id,metric_code,amount,source_row_category,normalized_payload)
select '71000000-0000-4000-8000-000000000003',id,'TOTAL_SALES',100,'detail','{"definitionVersion":"v1","confirmationStatus":"provisional"}'::jsonb
from dbf_ingest.raw_rows where batch_id='71000000-0000-4000-8000-000000000003';

insert into dbf_ingest.staging_rows
  (batch_id,raw_row_id,metric_code,amount,source_row_category,normalized_payload)
select '71000000-0000-4000-8000-000000000004',id,'TOTAL_SALES',100,'detail','{"definitionVersion":"v1","confirmationStatus":"provisional"}'::jsonb
from dbf_ingest.raw_rows where batch_id='71000000-0000-4000-8000-000000000004';

do $$
begin
  begin
    update dbf_ingest.import_batches set status='owner_review' where id='71000000-0000-4000-8000-000000000004';
    raise exception 'unchanged correction unexpectedly passed';
  exception when sqlstate '22023' then
    if sqlerrm <> 'DBF_CORRECTION_NO_CHANGES' then raise; end if;
  end;
end
$$;

update dbf_ingest.staging_rows
set normalized_payload = jsonb_set(normalized_payload,'{confirmationStatus}','"confirmed"')
where batch_id='71000000-0000-4000-8000-000000000004';
update dbf_ingest.import_batches set status='owner_review' where id='71000000-0000-4000-8000-000000000004';

do $$
begin
  if (select status from dbf_ingest.import_batches where id='71000000-0000-4000-8000-000000000004') <> 'owner_review' then
    raise exception 'status-only correction was not accepted';
  end if;
end
$$;

rollback;
