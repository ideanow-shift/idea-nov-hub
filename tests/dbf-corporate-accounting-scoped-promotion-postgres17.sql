\set ON_ERROR_STOP on

insert into dbf_ingest.source_files(id,sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id)
values
('4b113b1b-db39-4fbf-908f-67f83f712dce','997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1',1,'pilot.pdf','application/pdf','dbf-pilot-202606-v1','11111111-1111-4111-8111-111111111111'),
('c27acc17-fdd0-4113-90c2-73b646913f99','f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c',1,'pilot.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','dbf-pilot-202606-v1','11111111-1111-4111-8111-111111111111');

insert into dbf_ingest.import_batches(id,source_file_id,fact_kind,fiscal_month,source_type,status,created_by_employee_id)
values
('13cb25de-0b76-475a-b718-5f588be447fd','c27acc17-fdd0-4113-90c2-73b646913f99','pl','2026-06-01','yayoi_monthly_accounting_actual','owner_review','11111111-1111-4111-8111-111111111111'),
('0ffccfd2-1a39-404a-a41d-b16127ea9008','c27acc17-fdd0-4113-90c2-73b646913f99','bs','2026-06-01','yayoi_monthly_accounting_actual','owner_review','11111111-1111-4111-8111-111111111111');

insert into dbf_ingest.entity_mappings(id,source_system,entity_type,source_key,company_id,canonical_evidence_sha256,status,confirmed_by_employee_id,confirmed_at)
values('22222222-2222-4222-8222-222222222222','dbf-pilot-202606-v1','company','IDEA_NOV','e4059116-bdb3-4e13-9763-bbc77bdfe062',repeat('2',64),'active','11111111-1111-4111-8111-111111111111',now());

insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
select '13cb25de-0b76-475a-b718-5f588be447fd',g,jsonb_build_object('statement','PL'),repeat('a',64) from generate_series(1,71) g;
insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
select '0ffccfd2-1a39-404a-a41d-b16127ea9008',g,jsonb_build_object('statement','BS'),repeat('b',64) from generate_series(1,67) g;

insert into dbf_ingest.staging_rows(batch_id,raw_row_id,company_mapping_id,company_id,account_code,account_name,amount,source_row_category,mapping_status,validation_status,normalized_payload)
select r.batch_id,r.id,'22222222-2222-4222-8222-222222222222','e4059116-bdb3-4e13-9763-bbc77bdfe062',
  'PL_'||lpad(r.source_row_number::text,3,'0'),'PL fixture',r.source_row_number,'aggregate','resolved','valid',
  '{"confirmationStatus":"confirmed","taxBasis":"TAX_EXCLUSIVE","aggregateScope":"company_total"}'::jsonb
from dbf_ingest.raw_rows r where r.batch_id='13cb25de-0b76-475a-b718-5f588be447fd';
insert into dbf_ingest.staging_rows(batch_id,raw_row_id,company_mapping_id,company_id,account_code,account_name,amount,source_row_category,mapping_status,validation_status,normalized_payload)
select r.batch_id,r.id,'22222222-2222-4222-8222-222222222222','e4059116-bdb3-4e13-9763-bbc77bdfe062',
  'BS_'||lpad(r.source_row_number::text,3,'0'),'BS fixture',r.source_row_number,'detail','resolved','valid',
  '{"confirmationStatus":"confirmed","taxBasis":"TAX_EXCLUSIVE","classification":"asset"}'::jsonb
from dbf_ingest.raw_rows r where r.batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008';

insert into dbf_ingest.account_mapping_review_candidates(fiscal_month,company_id,statement_type,source_system,source_batch_id,source_account_code,source_account_name,selected_corporate_row_count,mapping_version,mapping_digest,effective_from)
select '2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',case when batch_id='13cb25de-0b76-475a-b718-5f588be447fd' then 'pl' else 'bs' end,
  'yayoi_monthly_accounting_actual',batch_id,account_code,account_name,1,'dbf-pilot-202606-account-owner-review-v1',repeat('c',64),'2026-06-01'
from dbf_ingest.staging_rows;

do $$
declare p jsonb;
begin
  p:=public.dbf_corporate_accounting_promotion_preflight_v1();
  if (p#>>'{review,total}')::int<>138 or (p#>>'{review,unreviewed}')::int<>138 then raise exception 'CURRENT_REVIEW_TRUTH_MISMATCH'; end if;
  if (p->>'promotionAllowed')::boolean then raise exception 'INCOMPLETE_REVIEW_ALLOWED'; end if;
  if not (p->'blockingReasons' ?& array['OWNER_REVIEW_INCOMPLETE','ROW_SEMANTICS_INCOMPLETE','ACCOUNT_MAPPING_UNAPPROVED']) then raise exception 'BLOCKERS_MISSING'; end if;
  if (p#>>'{canonicalCandidates,plDetail}')::int<>0 or (p#>>'{canonicalCandidates,plAggregate}')::int<>0 or (p#>>'{canonicalCandidates,bs}')::int<>0 then raise exception 'NONZERO_CANDIDATE_WHILE_BLOCKED'; end if;
  if (select count(*) from public.dbf_pl_detail_facts)<>0 or (select count(*) from public.dbf_pl_aggregate_facts)<>0 or (select count(*) from public.dbf_bs_facts)<>0 then raise exception 'FACT_WRITE_DETECTED'; end if;
  if has_table_privilege('anon','dbf_ingest.corporate_accounting_promotion_receipts','select')
    or has_table_privilege('authenticated','dbf_ingest.corporate_accounting_promotion_receipts','insert') then raise exception 'BROWSER_PRIVILEGE_DETECTED'; end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid='dbf_ingest.corporate_accounting_promotion_receipts'::regclass) then raise exception 'FORCE_RLS_MISSING'; end if;
end $$;

begin;
update dbf_ingest.import_batches
set status='approved',
  approved_by_employee_id='11111111-1111-4111-8111-111111111111',
  approved_at=statement_timestamp()
where id='13cb25de-0b76-475a-b718-5f588be447fd';
do $$
declare v_error text;
begin
  begin
    perform public.dbf_import_promote_v1(
      '11111111-1111-4111-8111-111111111111',
      '13cb25de-0b76-475a-b718-5f588be447fd'
    );
    raise exception 'GENERIC_PROMOTION_SCOPE_REJECTION_MISSING';
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error<>'DBF_GENERIC_PROMOTION_CORPORATE_SCOPE_REJECTED' then raise; end if;
  end;
  if (select count(*) from public.dbf_pl_detail_facts)<>0
    or (select count(*) from public.dbf_pl_aggregate_facts)<>0 then
    raise exception 'GENERIC_PROMOTION_PARTIAL_WRITE';
  end if;
end $$;
rollback;

begin;
insert into dbf_ingest.corporate_accounting_approval_receipts(scope_code,fiscal_month,company_id,approval_scope_digest,mapping_digest,row_semantics_digest,approved_by_employee_id)
values('CORPORATE_ACCOUNTING_ACTUAL_V1','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',repeat('d',64),repeat('e',64),repeat('f',64),'11111111-1111-4111-8111-111111111111');
savepoint mutation_guard;
do $$ begin
  begin update dbf_ingest.corporate_accounting_approval_receipts set approval_scope_digest=repeat('0',64); raise exception 'APPEND_ONLY_UPDATE_ALLOWED';
  exception when others then if sqlerrm='APPEND_ONLY_UPDATE_ALLOWED' then raise; end if; end;
end $$;
rollback to mutation_guard;
rollback;

begin;
update dbf_ingest.account_mapping_review_candidates c set
  proposed_account_code=case c.source_account_code
    when 'PL_067' then 'TOTAL_SALES' when 'PL_068' then 'TECHNICAL_SALES' when 'PL_069' then 'PRODUCT_SALES'
    when 'PL_070' then 'EC_SALES' when 'PL_071' then 'ORDINARY_PROFIT'
    when 'BS_065' then 'TOTAL_ASSETS' when 'BS_066' then 'TOTAL_LIABILITIES' when 'BS_067' then 'TOTAL_EQUITY'
    else 'CANON_'||c.source_account_code end,
  proposed_account_name='Canonical '||c.source_account_name,
  account_category=case when c.statement_type='pl' then 'revenue' when c.source_account_code='BS_066' then 'current_liability' when c.source_account_code='BS_067' then 'equity' else 'current_asset' end,
  normal_balance=case when c.statement_type='pl' or c.source_account_code in('BS_066','BS_067') then 'credit' else 'debit' end,
  hierarchy_level=0,
  row_semantics=case when c.source_account_code in('PL_067','PL_068','PL_069','PL_070','PL_071','BS_065','BS_066','BS_067') then 'CONTROL_TOTAL' else 'POSTABLE_DETAIL' end,
  is_postable=c.source_account_code not in('PL_067','PL_068','PL_069','PL_070','PL_071','BS_065','BS_066','BS_067'),
  is_control_total=c.source_account_code in('PL_067','PL_068','PL_069','PL_070','PL_071','BS_065','BS_066','BS_067'),
  decision='APPROVE',reviewed_by_employee_id='11111111-1111-4111-8111-111111111111',reviewed_at=now();

update dbf_ingest.staging_rows set amount=case account_code
  when 'PL_067' then 88066258 when 'PL_068' then 72040100 when 'PL_069' then 14776957 when 'PL_070' then 1249201 when 'PL_071' then 5704265
  when 'BS_065' then 570155249 when 'BS_066' then 213188431 when 'BS_067' then 356966818 else amount end,
  normalized_payload=case account_code when 'BS_066' then normalized_payload||'{"classification":"liability"}'::jsonb
    when 'BS_067' then normalized_payload||'{"classification":"equity"}'::jsonb else normalized_payload end;

do $$
declare c record; aid uuid; avid uuid; mid uuid;
begin
  for c in select * from dbf_ingest.account_mapping_review_candidates order by statement_type,source_account_code loop
    insert into accounting.account_identities(created_by) values('canonical:fixture') returning account_id into aid;
    insert into accounting.accounts(account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,status,source_version,mapping_contract_version,content_digest,recorded_by)
    values(aid,1,c.proposed_account_code,c.proposed_account_name,'posting',c.statement_type,c.account_category,c.normal_balance,'natural',case when c.statement_type='pl' then 'period_flow' else 'ending_balance' end,null,1,'2026-06-01','active','fixture','v1',repeat('a',64),'service:fixture') returning account_version_id into avid;
    insert into accounting.account_statement_mappings(account_id,account_version_id,version_no,statement_type,statement_section,statement_line,display_order,aggregation_behavior,contribution_sign,effective_from,status,mapping_contract_version,content_digest,recorded_by)
    values(aid,avid,1,c.statement_type,case when c.statement_type='pl' then 'revenue' else 'assets' end,c.proposed_account_code,1,case when c.row_semantics='CONTROL_TOTAL' then 'display_only' else 'add' end,case when c.row_semantics='CONTROL_TOTAL' then 0 else 1 end,'2026-06-01','active','v1',repeat('b',64),'service:fixture') returning statement_mapping_version_id into mid;
    update dbf_ingest.account_mapping_review_candidates set canonical_account_id=aid,canonical_account_version_id=avid,statement_mapping_version_id=mid where candidate_id=c.candidate_id;
    insert into dbf_ingest.account_mapping_review_audit(candidate_id,decision,actor_employee_id,prior_state,new_state,review_version,request_id)
    values(c.candidate_id,'APPROVE','11111111-1111-4111-8111-111111111111','{"decision":"UNREVIEWED"}',jsonb_build_object('decision','APPROVE','rowSemantics',c.row_semantics),c.mapping_version,gen_random_uuid());
  end loop;
end $$;

do $$
declare p jsonb; promoted jsonb;
begin
  p:=public.dbf_corporate_accounting_promotion_preflight_v1();
  if not (p->'blockingReasons' ? 'APPROVAL_RECEIPT_MISSING') then raise exception 'APPROVAL_BLOCKER_MISSING'; end if;
  if p->'blockingReasons' ?| array['OWNER_REVIEW_INCOMPLETE','ROW_SEMANTICS_INCOMPLETE','ACCOUNT_MAPPING_UNAPPROVED','CONTROL_TOTAL_MISMATCH'] then raise exception 'COMPLETE_FIXTURE_PREFLIGHT_FAILED: %',p; end if;
  insert into dbf_ingest.corporate_accounting_approval_receipts(scope_code,fiscal_month,company_id,approval_scope_digest,mapping_digest,row_semantics_digest,approved_by_employee_id)
  values('CORPORATE_ACCOUNTING_ACTUAL_V1','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',repeat('d',64),p->>'mappingDigest',p->>'rowSemanticsDigest','11111111-1111-4111-8111-111111111111');
  p:=public.dbf_corporate_accounting_promotion_preflight_v1();
  if not (p->>'promotionAllowed')::boolean then raise exception 'COMPLETE_FIXTURE_NOT_ALLOWED: %',p; end if;
  promoted:=public.dbf_import_promote_corporate_accounting_v1(
    '11111111-1111-4111-8111-111111111111','CORPORATE_ACCOUNTING_ACTUAL_V1',repeat('1',64),'2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
    '13cb25de-0b76-475a-b718-5f588be447fd','0ffccfd2-1a39-404a-a41d-b16127ea9008',
    '["4b113b1b-db39-4fbf-908f-67f83f712dce","c27acc17-fdd0-4113-90c2-73b646913f99"]',
    '["997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1","f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c"]',
    p->>'selectedRowDigest',p->>'mappingVersion',p->>'mappingDigest',p->>'rowSemanticsDigest',repeat('2',64),repeat('3',64),repeat('d',64),repeat('4',64),
    71,67,'{"plDetail":0,"plAggregate":0,"bs":0,"budget":0,"storeMetrics":0}',
    '{"plDetail":66,"plAggregate":5,"bs":67,"budget":0,"storeMetrics":0}');
  if (promoted->>'status')<>'promoted' or (select count(*) from public.dbf_pl_detail_facts)<>66
    or (select count(*) from public.dbf_pl_aggregate_facts)<>5 or (select count(*) from public.dbf_bs_facts)<>67
    or (select count(*) from dbf_ingest.corporate_accounting_promotion_receipts)<>1
    or (select count(*) from dbf_ingest.corporate_accounting_promotion_audit)<>1 then raise exception 'ATOMIC_POST_STATE_MISMATCH'; end if;
  begin
    perform public.dbf_import_promote_corporate_accounting_v1(
      '11111111-1111-4111-8111-111111111111','CORPORATE_ACCOUNTING_ACTUAL_V1',repeat('1',64),'2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
      '13cb25de-0b76-475a-b718-5f588be447fd','0ffccfd2-1a39-404a-a41d-b16127ea9008',
      '["4b113b1b-db39-4fbf-908f-67f83f712dce","c27acc17-fdd0-4113-90c2-73b646913f99"]',
      '["997e89c54b12334d3aa477a78aff9487d46042822a5ff9ab0cd9fe0f86f073d1","f18c9464a9a070ff641140178b19532dbd8dd319e739eb2e2bcef325adfda54c"]',
      p->>'selectedRowDigest',p->>'mappingVersion',p->>'mappingDigest',p->>'rowSemanticsDigest',repeat('2',64),repeat('3',64),repeat('d',64),repeat('4',64),
      71,67,'{"plDetail":0,"plAggregate":0,"bs":0,"budget":0,"storeMetrics":0}',
      '{"plDetail":66,"plAggregate":5,"bs":67,"budget":0,"storeMetrics":0}'
    );
    raise exception 'IDEMPOTENCY_REPLAY_ALLOWED';
  exception when others then
    if sqlerrm not in('DBF_IDEMPOTENCY_REPLAY','DBF_PREFLIGHT_REJECTED') then raise; end if;
  end;
  if (select count(*) from dbf_ingest.corporate_accounting_promotion_receipts)<>1
    or (select count(*) from dbf_ingest.corporate_accounting_promotion_audit)<>1
    or (select count(*) from public.dbf_pl_detail_facts)<>66
    or (select count(*) from public.dbf_pl_aggregate_facts)<>5
    or (select count(*) from public.dbf_bs_facts)<>67 then
    raise exception 'IDEMPOTENCY_REPLAY_PARTIAL_WRITE';
  end if;
end $$;
rollback;

do $$ begin
  if (select count(*) from public.dbf_pl_detail_facts)<>0 or (select count(*) from public.dbf_pl_aggregate_facts)<>0
    or (select count(*) from public.dbf_bs_facts)<>0 or (select count(*) from dbf_ingest.corporate_accounting_promotion_receipts)<>0
    or (select count(*) from dbf_ingest.corporate_accounting_promotion_audit)<>0 then raise exception 'TEST_TRANSACTION_ROLLBACK_FAILED'; end if;
end $$;

select 'DBF corporate accounting scoped promotion PostgreSQL 17 current-state gate: PASS' as result;
