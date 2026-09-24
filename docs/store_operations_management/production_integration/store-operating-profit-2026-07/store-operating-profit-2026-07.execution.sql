-- REVIEW-ONLY until a separate fixed-SHA Production execution approval.
-- Project: nkmxevmioczcmnldreyo
-- Source SHA-256: 97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D
-- Package SHA-256: 10F012FDFA51303B3C68DDC7ACB9B854A85630DCC2DA423B16557966B4E0B7B3
-- Request fingerprint: 4DDE38C734D36C60E20B4D70D847DB13BB6B229F4B05C050506853CC3E0F88E8
-- Planned inserts: source_files=1, import_batches=1, raw_rows=13,
-- staging_rows=13, import_events=4, canonical_facts=13; DDL=0.
do $approval_gate$
begin
  if current_setting('app.store_operations_july_profit_execution_approval', true) is distinct from 'OWNER_APPROVAL_REQUIRED_AFTER_FIXED_SHA_REVIEW' then
    raise exception using errcode='42501', message='OWNER_APPROVAL_GATE_REQUIRED';
  end if;
end
$approval_gate$;
begin;
set local statement_timeout = '120s';
set local lock_timeout = '15s';
select pg_advisory_xact_lock(hashtextextended('4DDE38C734D36C60E20B4D70D847DB13BB6B229F4B05C050506853CC3E0F88E8', 0));

do $store_profit$
declare
  v_actor constant uuid := '369d9cd5-f6ba-4e53-9428-f631f0893469'::uuid;
  v_source_file_id constant uuid := '757739f8-dd68-54ad-8cd2-000fe49fcbab'::uuid;
  v_batch_id constant uuid := '8bc9f51e-e574-5343-b6cf-880859d799ea'::uuid;
  v_count integer;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.employees where id=v_actor and is_active
  ) then
    raise exception using errcode='22023', message='ACTOR_NOT_ACTIVE';
  end if;
  if not exists (
    select 1 from public.corporations
    where id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid and corporation_no='0001' and is_active
  ) then
    raise exception using errcode='22023', message='COMPANY_MASTER_MISMATCH';
  end if;

  if not exists (
    select 1 from dbf_ingest.metric_definitions
    where metric_code='OPERATING_PROFIT' and definition_version='v1'
      and value_kind='amount' and is_active
  ) then
    raise exception using errcode='22023', message='OPERATING_PROFIT_DEFINITION_MISSING';
  end if;

  if not exists (
    select 1 from dbf_ingest.entity_mappings
    where id='c9214c45-a309-53ac-a073-8f55464d66fe'::uuid and source_system='accounting_store_operating_profit_v1'
      and entity_type='company' and source_key='0001'
      and company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid and status='active'
  ) then
    raise exception using errcode='22023', message='COMPANY_MAPPING_MISMATCH';
  end if;

  select count(*) into v_count
  from jsonb_to_recordset('[{"mappingId":"d944170a-46f8-54a8-a4df-9db4321b71ec","sourceKey":"BASSA所沢店","storeId":"1285ac70-9181-44db-9443-cbd043ab908b"},{"mappingId":"a14822f2-661a-5d6f-a585-25a03b96925d","sourceKey":"BASSA上石神井店","storeId":"1bcba30a-d063-4cdb-be74-425e250aeb25"},{"mappingId":"69363eba-a099-5a75-80fe-3bc34fce54a6","sourceKey":"BASSA ANNEX店","storeId":"2980442d-294c-4aae-a9bb-78f530a3a20a"},{"mappingId":"60853a08-5e79-587a-842f-42a115d6e3a0","sourceKey":"BASSA池袋店","storeId":"36c222de-0554-4265-b177-3b68285cc4a4"},{"mappingId":"07628f9d-bfb2-5db0-bc2e-e95b30dd6cf2","sourceKey":"BASSA江古田店","storeId":"4e5526cc-9ec7-42aa-ac60-579b6c438c88"},{"mappingId":"f798a0d9-4ba2-5010-9232-ca1884afe36b","sourceKey":"BASSA立川店","storeId":"5f66193f-d360-4967-b9c7-a100c8ee5e94"},{"mappingId":"b882a116-f383-57df-97b7-fa1cce042a49","sourceKey":"BASSA保谷店","storeId":"73ee82b5-86fa-42e7-ab03-0e075d218dc3"},{"mappingId":"bbb0d75d-3fd7-51e5-8f5b-8e04654a3eb5","sourceKey":"BASSA高田馬場店","storeId":"887da14c-2c0d-46b3-8953-962c7c8dd590"},{"mappingId":"1c1271b7-a93b-5c2a-8592-a9e071da32c2","sourceKey":"KYARA HALF","storeId":"ac20934d-ef15-4363-8c2f-759193c7fcc7"},{"mappingId":"634e6e8e-ef7e-5dac-bafc-1872bc62b304","sourceKey":"BASSA石神井公園店","storeId":"ad931406-22de-4ba7-a6eb-4502d5c50a91"},{"mappingId":"9cef2bf0-1a22-5c57-91a7-47b183256f73","sourceKey":"BASSA野方店","storeId":"b898c63f-1cc1-42c5-be4f-916f24f49cb6"},{"mappingId":"df163a99-8426-59f0-9ce5-61600b4bd8aa","sourceKey":"BASSA東大和店","storeId":"e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6"},{"mappingId":"bc64d0dc-7e9f-5e67-8136-09c00b33c2cb","sourceKey":"BASSA下井草店","storeId":"fec1e181-ca5b-482d-a865-3f488f19128f"}]'::jsonb)
    as x("mappingId" text, "sourceKey" text, "storeId" text)
  join dbf_ingest.entity_mappings m
    on m.id=x."mappingId"::uuid and m.source_system='accounting_store_operating_profit_v1'
   and m.entity_type='store' and m.source_key=x."sourceKey"
   and m.store_id=x."storeId"::uuid and m.status='active'
  join public.stores s on s.id=x."storeId"::uuid and s.is_active
   and s.corporation_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid;
  if v_count <> 13 then
    raise exception using errcode='22023', message='STORE_MAPPING_OR_MASTER_MISMATCH';
  end if;

  if exists (
    select 1 from public.dbf_store_monthly_metric_facts
    where fiscal_month=date '2026-07-01' and metric_code='OPERATING_PROFIT' and is_active
  ) then
    raise exception using errcode='23505', message='JULY_OPERATING_PROFIT_ALREADY_ACTIVE';
  end if;
  if exists (select 1 from dbf_ingest.source_files where id=v_source_file_id)
     or exists (select 1 from dbf_ingest.import_batches where id=v_batch_id)
     or exists (
       select 1 from dbf_ingest.source_files
       where source_system='accounting_store_operating_profit_v1' and sha256=lower('97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D')
         and byte_size=4012486
     ) then
    raise exception using errcode='23505', message='FIXED_PACKAGE_ALREADY_PRESENT';
  end if;

  insert into dbf_ingest.source_files
    (id,sha256,byte_size,original_file_name,media_type,source_system,
     received_by_employee_id,received_via)
  values
    (v_source_file_id,lower('97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D'),4012486,
     '会計_法人管理正本.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'accounting_store_operating_profit_v1',v_actor,'nov_hub_secure_session');

  insert into dbf_ingest.import_batches
    (id,source_file_id,fact_kind,fiscal_month,source_type,status,revision,
     created_by_employee_id)
  values
    (v_batch_id,v_source_file_id,'store_operating_result',date '2026-07-01',
     'accounting_store_operating_profit_exact_v1','owner_review',1,v_actor);

  with input as (
    select * from jsonb_to_recordset('[{"payload":{"amount":"1514582.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA所沢店","metricCode":"OPERATING_PROFIT","sourceLabel":"所沢","sourceRowNumber":22,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"744bdd6bebf62f53fc0b40691df2eaea1b98d3875df4403677aa14010d9a2436","sourceRowNumber":22},{"payload":{"amount":"1501426.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA上石神井店","metricCode":"OPERATING_PROFIT","sourceLabel":"上石神井","sourceRowNumber":15,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"c2b008d78a58130917ada79c80ca6cc151d6a703541e1d0d00d62399ffb86646","sourceRowNumber":15},{"payload":{"amount":"1069433.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA ANNEX店","metricCode":"OPERATING_PROFIT","sourceLabel":"アネックス","sourceRowNumber":14,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"169e8839f959a7fc88ca16016e0335fa4075cba2aef31370b6d9db60d86825c3","sourceRowNumber":14},{"payload":{"amount":"591234.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA池袋店","metricCode":"OPERATING_PROFIT","sourceLabel":"池袋","sourceRowNumber":34,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"6979870c745348bc7370645dc1ddf8ed317678298c4aad9831434e6872f669e6","sourceRowNumber":34},{"payload":{"amount":"1700381.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA江古田店","metricCode":"OPERATING_PROFIT","sourceLabel":"江古田","sourceRowNumber":33,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"063a5205114996b15b8470b86f6d60d825c37551da1aa7f5118ebf8346dfcc2f","sourceRowNumber":33},{"payload":{"amount":"-318450.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA立川店","metricCode":"OPERATING_PROFIT","sourceLabel":"立川","sourceRowNumber":36,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"f1c56479c80c9c5388dcdfaae8853c35c3f9b2db4633850529f89d3d5f8d0e0b","sourceRowNumber":36},{"payload":{"amount":"390488.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA保谷店","metricCode":"OPERATING_PROFIT","sourceLabel":"保谷","sourceRowNumber":18,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"3b96eb786d62773c3a9877a185092beee9b924d5f9ede428821b7a6331e05d63","sourceRowNumber":18},{"payload":{"amount":"737932.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA高田馬場店","metricCode":"OPERATING_PROFIT","sourceLabel":"高田馬場","sourceRowNumber":39,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"3470e59a05b78f0a974423cb0c57f92e1b0ca9e7b8e6ede32a481c849bf0a8e8","sourceRowNumber":39},{"payload":{"amount":"-438050.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"KYARA HALF","metricCode":"OPERATING_PROFIT","sourceLabel":"KYARA HALF","sourceRowNumber":13,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"127d9c5c6c66fb59ffba03f772a424cc07f8ebc043db5a403740e60c41849df8","sourceRowNumber":13},{"payload":{"amount":"1292788.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA石神井公園店","metricCode":"OPERATING_PROFIT","sourceLabel":"石神井公園","sourceRowNumber":35,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"0ce1cb8affcaafc9ca6466041f847a2b566080e3447a1cf53dbda28e8653ecdd","sourceRowNumber":35},{"payload":{"amount":"-85667.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA野方店","metricCode":"OPERATING_PROFIT","sourceLabel":"野方","sourceRowNumber":38,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"4202c4b70167a2d144aa461440284d71981a80e7f03126942366aa0815317a53","sourceRowNumber":38},{"payload":{"amount":"1708374.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA東大和店","metricCode":"OPERATING_PROFIT","sourceLabel":"東大和","sourceRowNumber":32,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"bdff6525a8e4d861d662d368c0f4be0e874239cdff48633715e45dde02c407ac","sourceRowNumber":32},{"payload":{"amount":"1412776.00","companyKey":"0001","fiscalMonth":"2026-07","mappingSourceKey":"BASSA下井草店","metricCode":"OPERATING_PROFIT","sourceLabel":"下井草","sourceRowNumber":16,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbook":"イディアノブ　年次・部門　残高試算表8月まで.xlsx","taxBasis":"net","verificationStatus":"PASS_CURRENT_ONLY"},"payloadSha256":"dd4f27a8ef210521647fd999148874e3b7cf95adc87de9c4ae98060268876afc","sourceRowNumber":16}]'::jsonb)
      as x("sourceRowNumber" integer, payload jsonb, "payloadSha256" text)
  )
  insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
  select v_batch_id,"sourceRowNumber",payload,"payloadSha256"
  from input order by "sourceRowNumber";

  with input as (
    select * from jsonb_to_recordset('[{"amount":"1514582.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"所沢","sourceRowNumber":22,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":22,"storeId":"1285ac70-9181-44db-9443-cbd043ab908b","storeMappingId":"d944170a-46f8-54a8-a4df-9db4321b71ec"},{"amount":"1501426.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"上石神井","sourceRowNumber":15,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":15,"storeId":"1bcba30a-d063-4cdb-be74-425e250aeb25","storeMappingId":"a14822f2-661a-5d6f-a585-25a03b96925d"},{"amount":"1069433.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"アネックス","sourceRowNumber":14,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":14,"storeId":"2980442d-294c-4aae-a9bb-78f530a3a20a","storeMappingId":"69363eba-a099-5a75-80fe-3bc34fce54a6"},{"amount":"591234.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"池袋","sourceRowNumber":34,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":34,"storeId":"36c222de-0554-4265-b177-3b68285cc4a4","storeMappingId":"60853a08-5e79-587a-842f-42a115d6e3a0"},{"amount":"1700381.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"江古田","sourceRowNumber":33,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":33,"storeId":"4e5526cc-9ec7-42aa-ac60-579b6c438c88","storeMappingId":"07628f9d-bfb2-5db0-bc2e-e95b30dd6cf2"},{"amount":"-318450.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"立川","sourceRowNumber":36,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":36,"storeId":"5f66193f-d360-4967-b9c7-a100c8ee5e94","storeMappingId":"f798a0d9-4ba2-5010-9232-ca1884afe36b"},{"amount":"390488.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"保谷","sourceRowNumber":18,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":18,"storeId":"73ee82b5-86fa-42e7-ab03-0e075d218dc3","storeMappingId":"b882a116-f383-57df-97b7-fa1cce042a49"},{"amount":"737932.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"高田馬場","sourceRowNumber":39,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":39,"storeId":"887da14c-2c0d-46b3-8953-962c7c8dd590","storeMappingId":"bbb0d75d-3fd7-51e5-8f5b-8e04654a3eb5"},{"amount":"-438050.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"KYARA HALF","sourceRowNumber":13,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":13,"storeId":"ac20934d-ef15-4363-8c2f-759193c7fcc7","storeMappingId":"1c1271b7-a93b-5c2a-8592-a9e071da32c2"},{"amount":"1292788.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"石神井公園","sourceRowNumber":35,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":35,"storeId":"ad931406-22de-4ba7-a6eb-4502d5c50a91","storeMappingId":"634e6e8e-ef7e-5dac-bafc-1872bc62b304"},{"amount":"-85667.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"野方","sourceRowNumber":38,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":38,"storeId":"b898c63f-1cc1-42c5-be4f-916f24f49cb6","storeMappingId":"9cef2bf0-1a22-5c57-91a7-47b183256f73"},{"amount":"1708374.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"東大和","sourceRowNumber":32,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":32,"storeId":"e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6","storeMappingId":"df163a99-8426-59f0-9ce5-61600b4bd8aa"},{"amount":"1412776.00","normalizedPayload":{"confirmationStatus":"confirmed","definitionVersion":"v1","sourceLabel":"下井草","sourceRowNumber":16,"sourceSheet":"13_PL_ENTITY_SUMMARY","sourceWorkbookSha256":"97E5F6E360DFCD00CE6E69F974C1E9F19BC8EFFE8B89684FD290946D8872485D"},"sourceRowNumber":16,"storeId":"fec1e181-ca5b-482d-a865-3f488f19128f","storeMappingId":"bc64d0dc-7e9f-5e67-8136-09c00b33c2cb"}]'::jsonb)
      as x("sourceRowNumber" integer,"storeMappingId" text,"storeId" text,
           amount text,"normalizedPayload" jsonb)
  )
  insert into dbf_ingest.staging_rows(
    batch_id,raw_row_id,company_mapping_id,store_mapping_id,company_id,store_id,
    metric_code,amount,quantity,rate,source_row_category,mapping_status,
    validation_status,normalized_payload
  )
  select v_batch_id,r.id,'c9214c45-a309-53ac-a073-8f55464d66fe'::uuid,x."storeMappingId"::uuid,
         'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid,x."storeId"::uuid,'OPERATING_PROFIT',x.amount::numeric,
         null,null,'detail','resolved','valid',x."normalizedPayload"
  from input x
  join dbf_ingest.raw_rows r
    on r.batch_id=v_batch_id and r.source_row_number=x."sourceRowNumber";

  insert into dbf_ingest.import_events(
    batch_id,event_type,from_status,to_status,actor_employee_id,summary
  ) values
    (v_batch_id,'SOURCE_PARSED','received','parsed',v_actor,
     jsonb_build_object('rowCount',13,'packageSha256','10F012FDFA51303B3C68DDC7ACB9B854A85630DCC2DA423B16557966B4E0B7B3',
       'requestFingerprint','4DDE38C734D36C60E20B4D70D847DB13BB6B229F4B05C050506853CC3E0F88E8')),
    (v_batch_id,'VALIDATION_COMPLETED','parsed','owner_review',v_actor,
     jsonb_build_object('rowCount',13,'warningCount',0,'packageSha256','10F012FDFA51303B3C68DDC7ACB9B854A85630DCC2DA423B16557966B4E0B7B3',
       'requestFingerprint','4DDE38C734D36C60E20B4D70D847DB13BB6B229F4B05C050506853CC3E0F88E8'));

  v_result := public.dbf_import_approve_v1(v_actor,v_batch_id);
  if v_result->>'status' <> 'approved' or (v_result->>'rowCount')::integer <> 13 then
    raise exception using errcode='22023', message='APPROVAL_RESULT_MISMATCH';
  end if;
  v_result := public.dbf_import_promote_v1(v_actor,v_batch_id);
  if v_result->>'status' <> 'promoted' or (v_result->>'rowCount')::integer <> 13 then
    raise exception using errcode='22023', message='PROMOTION_RESULT_MISMATCH';
  end if;

  select count(*) into v_count
  from jsonb_to_recordset('[{"amount":"1514582.00","storeId":"1285ac70-9181-44db-9443-cbd043ab908b"},{"amount":"1501426.00","storeId":"1bcba30a-d063-4cdb-be74-425e250aeb25"},{"amount":"1069433.00","storeId":"2980442d-294c-4aae-a9bb-78f530a3a20a"},{"amount":"591234.00","storeId":"36c222de-0554-4265-b177-3b68285cc4a4"},{"amount":"1700381.00","storeId":"4e5526cc-9ec7-42aa-ac60-579b6c438c88"},{"amount":"-318450.00","storeId":"5f66193f-d360-4967-b9c7-a100c8ee5e94"},{"amount":"390488.00","storeId":"73ee82b5-86fa-42e7-ab03-0e075d218dc3"},{"amount":"737932.00","storeId":"887da14c-2c0d-46b3-8953-962c7c8dd590"},{"amount":"-438050.00","storeId":"ac20934d-ef15-4363-8c2f-759193c7fcc7"},{"amount":"1292788.00","storeId":"ad931406-22de-4ba7-a6eb-4502d5c50a91"},{"amount":"-85667.00","storeId":"b898c63f-1cc1-42c5-be4f-916f24f49cb6"},{"amount":"1708374.00","storeId":"e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6"},{"amount":"1412776.00","storeId":"fec1e181-ca5b-482d-a865-3f488f19128f"}]'::jsonb)
    as x("storeId" text, amount text)
  join public.dbf_store_monthly_metric_facts f
    on f.batch_id=v_batch_id and f.fiscal_month=date '2026-07-01'
   and f.company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid and f.store_id=x."storeId"::uuid
   and f.metric_code='OPERATING_PROFIT' and f.amount=x.amount::numeric
   and f.quantity is null and f.rate is null
   and f.definition_version='v1' and f.status='confirmed' and f.is_active;
  if v_count <> 13 then
    raise exception using errcode='22023', message='CANONICAL_READBACK_MISMATCH';
  end if;
  if (select count(*) from dbf_ingest.raw_rows where batch_id=v_batch_id) <> 13
     or (select count(*) from dbf_ingest.staging_rows where batch_id=v_batch_id) <> 13
     or (select count(*) from dbf_ingest.import_events where batch_id=v_batch_id) <> 4
     or (select count(*) from public.dbf_store_monthly_metric_facts
         where fiscal_month=date '2026-07-01' and metric_code='OPERATING_PROFIT'
           and is_active) <> 13
     or (select status from dbf_ingest.import_batches where id=v_batch_id) <> 'promoted' then
    raise exception using errcode='22023', message='POSTFLIGHT_COUNT_MISMATCH';
  end if;
end
$store_profit$;
commit;
