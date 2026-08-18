\set ON_ERROR_STOP on

begin;

select current_setting('server_version') as dbf_postgresql_server_version;

do $test$
declare
  v_candidate_rls boolean;
  v_audit_rls boolean;
begin
  if current_setting('server_version_num')::integer < 170000 then
    raise exception 'DBF_POSTGRESQL_17_REQUIRED';
  end if;
  select relrowsecurity and relforcerowsecurity into v_candidate_rls
  from pg_class where oid='dbf_ingest.account_mapping_review_candidates'::regclass;
  select relrowsecurity and relforcerowsecurity into v_audit_rls
  from pg_class where oid='dbf_ingest.account_mapping_review_audit'::regclass;
  if not v_candidate_rls or not v_audit_rls then raise exception 'DBF_ACCOUNT_REVIEW_RLS_NOT_FORCED'; end if;
  if has_table_privilege('anon','dbf_ingest.account_mapping_review_candidates','select,insert,update,delete,truncate')
     or has_table_privilege('authenticated','dbf_ingest.account_mapping_review_candidates','select,insert,update,delete,truncate')
     or has_table_privilege('service_role','dbf_ingest.account_mapping_review_candidates','select,insert,update,delete,truncate') then
    raise exception 'DBF_ACCOUNT_REVIEW_TABLE_GRANT_LEAK';
  end if;
  if to_regprocedure('public.dbf_account_review_decide_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean)') is null then
    raise exception 'DBF_ACCOUNT_REVIEW_RPC_MISSING';
  end if;
  if not exists(
    select 1 from pg_constraint
    where conrelid='dbf_ingest.account_mapping_review_candidates'::regclass
      and conname='dbf_account_review_approved_semantics_consistency'
      and convalidated
  ) then raise exception 'DBF_ACCOUNT_REVIEW_SEMANTICS_CONSTRAINT_MISSING'; end if;
  if not has_function_privilege(
    'service_role',
    'public.dbf_account_review_decide_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean)',
    'execute'
  ) then raise exception 'DBF_ACCOUNT_REVIEW_RPC_GRANT_MISSING'; end if;
  if has_function_privilege(
       'anon',
       'public.dbf_account_review_decide_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean)',
       'execute'
     ) or has_function_privilege(
       'authenticated',
       'public.dbf_account_review_decide_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean)',
       'execute'
     ) then raise exception 'DBF_ACCOUNT_REVIEW_RPC_BROWSER_GRANT_LEAK'; end if;
end
$test$;

insert into dbf_ingest.source_files(
  id,sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id
) values(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',repeat('c',64),1,'fixture','text/plain','fixture',
  '11111111-1111-4111-8111-111111111111'
);

insert into dbf_ingest.import_batches(
  id,source_file_id,fact_kind,fiscal_month,source_type,status,created_by_employee_id
) values(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'pl','2026-06-01','fixture','owner_review','11111111-1111-4111-8111-111111111111'
);

insert into dbf_ingest.account_mapping_review_candidates(
  candidate_id,fiscal_month,company_id,statement_type,source_system,source_batch_id,
  source_account_code,source_account_name,selected_corporate_row_count,mapping_version,
  mapping_digest,effective_from
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
   'pl','fixture','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','YAYOI_PL_R001','fixture one',1,
   'dbf-pilot-202606-account-owner-review-v1',repeat('a',64),'2026-06-01'),
  ('99999999-9999-4999-8999-999999999999','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
   'pl','fixture','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','YAYOI_PL_R002','fixture two',1,
   'dbf-pilot-202606-account-owner-review-v1',repeat('a',64),'2026-06-01'),
  ('66666666-6666-4666-8666-666666666666','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
   'pl','fixture','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','YAYOI_PL_R003','fixture three',1,
   'dbf-pilot-202606-account-owner-review-v1',repeat('a',64),'2026-06-01'),
  ('77777777-7777-4777-8777-777777777777','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
   'pl','fixture','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','YAYOI_PL_R004','fixture exclude',1,
   'dbf-pilot-202606-account-owner-review-v1',repeat('a',64),'2026-06-01'),
  ('88888888-8888-4888-8888-888888888888','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062',
   'pl','fixture','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','YAYOI_PL_R005','fixture needs review',1,
   'dbf-pilot-202606-account-owner-review-v1',repeat('a',64),'2026-06-01');

set role service_role;
select public.dbf_account_review_decide_v1(
  '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','APPROVE','PL.TEST','Test account','revenue',
  'credit',null,1,'POSTABLE_DETAIL',true,false
);
reset role;

do $test$
declare
  v_error text;
begin
  begin
    perform public.dbf_account_review_decide_v1(
      '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','APPROVE','PL.TEST','Test account','revenue',
      'credit',null,1,'POSTABLE_DETAIL',true,false
    );
    raise exception 'DBF_EXPECTED_DUPLICATE_REQUEST_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'DBF_DUPLICATE_REVIEW_REQUEST' then raise; end if;
  end;

  if (select count(*) from dbf_ingest.account_mapping_review_audit
      where candidate_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'DBF_DUPLICATE_REQUEST_AUDIT_APPENDED';
  end if;
end
$test$;

do $test$
declare
  v_error text;
begin
  begin
    perform public.dbf_account_review_decide_v1(
      '11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EDIT_AND_APPROVE','PL.TEST.EDIT','Duplicate',
      'revenue','credit',null,1,'POSTABLE_DETAIL',true,false
    );
    raise exception 'DBF_EXPECTED_FINAL_REVIEW_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'DBF_ACCOUNT_REVIEW_ALREADY_FINAL' then raise; end if;
  end;

  if (select count(*) from accounting.account_identities) <> 1
     or (select count(*) from accounting.accounts) <> 1
     or (select count(*) from accounting.account_statement_mappings) <> 1 then
    raise exception 'DBF_DUPLICATE_CANONICAL_ACCOUNT_CREATED';
  end if;
end
$test$;

-- EXCLUDE is a successful terminal owner decision and must not create canonical objects.
select public.dbf_account_review_decide_v1(
  '11111111-1111-4111-8111-111111111111','77777777-1111-4777-8777-111111111111',
  '77777777-7777-4777-8777-777777777777','EXCLUDE',null,null,null,
  null,null,null,null,null,null
);

do $test$
declare
  v_error text;
  v_audit_count bigint;
begin
  if (select decision from dbf_ingest.account_mapping_review_candidates
      where candidate_id='77777777-7777-4777-8777-777777777777') <> 'EXCLUDE' then
    raise exception 'DBF_EXCLUDE_DECISION_NOT_PERSISTED';
  end if;

  select count(*) into v_audit_count
  from dbf_ingest.account_mapping_review_audit
  where candidate_id='77777777-7777-4777-8777-777777777777';
  if v_audit_count <> 1 then raise exception 'DBF_EXCLUDE_AUDIT_COUNT_INVALID'; end if;

  if exists(
    select 1 from dbf_ingest.account_mapping_review_candidates
    where candidate_id='77777777-7777-4777-8777-777777777777'
      and (canonical_account_id is not null
        or canonical_account_version_id is not null
        or statement_mapping_version_id is not null)
  ) then raise exception 'DBF_EXCLUDE_CANONICAL_OBJECT_CREATED'; end if;

  begin
    perform public.dbf_account_review_decide_v1(
      '11111111-1111-4111-8111-111111111111','77777777-2222-4777-8777-222222222222',
      '77777777-7777-4777-8777-777777777777','APPROVE','PL.TEST.EXCLUDED','Must stay excluded',
      'revenue','credit',null,1,'POSTABLE_DETAIL',true,false
    );
    raise exception 'DBF_EXPECTED_EXCLUDE_FINAL_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'DBF_ACCOUNT_REVIEW_ALREADY_FINAL' then raise; end if;
  end;

  if (select decision from dbf_ingest.account_mapping_review_candidates
      where candidate_id='77777777-7777-4777-8777-777777777777') <> 'EXCLUDE'
     or (select count(*) from dbf_ingest.account_mapping_review_audit
         where candidate_id='77777777-7777-4777-8777-777777777777') <> 1
     or exists(
       select 1 from dbf_ingest.account_mapping_review_candidates
       where candidate_id='77777777-7777-4777-8777-777777777777'
         and (canonical_account_id is not null
           or canonical_account_version_id is not null
           or statement_mapping_version_id is not null)
     ) then raise exception 'DBF_EXCLUDE_REDECISION_PARTIAL_WRITE'; end if;
end
$test$;

-- NEEDS_REVIEW remains non-terminal and can be finalized later.
select public.dbf_account_review_decide_v1(
  '11111111-1111-4111-8111-111111111111','88888888-1111-4888-8888-111111111111',
  '88888888-8888-4888-8888-888888888888','NEEDS_REVIEW',null,null,null,
  null,null,null,null,null,null
);
select public.dbf_account_review_decide_v1(
  '11111111-1111-4111-8111-111111111111','88888888-2222-4888-8888-222222222222',
  '88888888-8888-4888-8888-888888888888','APPROVE','PL.TEST.REVIEWED','Reviewed account',
  'revenue','credit',null,1,'POSTABLE_DETAIL',true,false
);

do $test$
begin
  if (select decision from dbf_ingest.account_mapping_review_candidates
      where candidate_id='88888888-8888-4888-8888-888888888888') <> 'APPROVE'
     or (select count(*) from dbf_ingest.account_mapping_review_audit
         where candidate_id='88888888-8888-4888-8888-888888888888') <> 2
     or not exists(
       select 1 from dbf_ingest.account_mapping_review_candidates
       where candidate_id='88888888-8888-4888-8888-888888888888'
         and canonical_account_id is not null
         and canonical_account_version_id is not null
         and statement_mapping_version_id is not null
     ) then raise exception 'DBF_NEEDS_REVIEW_FINALIZATION_FAILED'; end if;
end
$test$;

do $test$
declare
  v_error text;
begin
  begin
    perform public.dbf_account_review_decide_v1(
      '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
      '99999999-9999-4999-8999-999999999999','APPROVE','PL.BAD.SUBTOTAL','Invalid subtotal',
      'gross_profit','credit',null,2,'DERIVED_SUBTOTAL',true,false
    );
    raise exception 'DBF_EXPECTED_SEMANTICS_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'DBF_ROW_SEMANTICS_FLAGS_MISMATCH' then raise; end if;
  end;

  if (select decision from dbf_ingest.account_mapping_review_candidates
      where candidate_id='99999999-9999-4999-8999-999999999999') <> 'UNREVIEWED' then
    raise exception 'DBF_INVALID_SEMANTICS_PARTIAL_UPDATE';
  end if;
end
$test$;

select public.dbf_account_review_decide_v1(
  '11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666','APPROVE','PL.TEST.SUBTOTAL','Valid subtotal',
  'gross_profit','credit',null,2,'DERIVED_SUBTOTAL',false,false
);

do $test$
begin
  if not exists(
    select 1
    from accounting.account_statement_mappings m
    join dbf_ingest.account_mapping_review_candidates c
      on c.statement_mapping_version_id=m.statement_mapping_version_id
    where c.candidate_id='66666666-6666-4666-8666-666666666666'
      and m.aggregation_behavior='display_only'
      and m.contribution_sign=0
  ) then raise exception 'DBF_DERIVED_SUBTOTAL_DOUBLE_COUNT_RISK'; end if;

  if (select count(*) from public.dbf_pl_detail_facts) <> 0
     or (select count(*) from public.dbf_pl_aggregate_facts) <> 0
     or (select count(*) from public.dbf_bs_facts) <> 0
     or (select count(*) from public.dbf_store_monthly_metric_facts) <> 0
     or (select count(*) from public.dbf_budget_facts) <> 0 then
    raise exception 'DBF_FACT_WRITE_DETECTED';
  end if;
end
$test$;

do $test$
declare
  v_error text;
begin
  begin
    update dbf_ingest.account_mapping_review_audit set new_state='{}'::jsonb;
    raise exception 'DBF_EXPECTED_AUDIT_APPEND_ONLY_REJECTION';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'DBF_ACCOUNT_REVIEW_AUDIT_APPEND_ONLY' then raise; end if;
  end;
end
$test$;

rollback;

do $test$
begin
  if (select count(*) from dbf_ingest.account_mapping_review_candidates) <> 0
     or (select count(*) from dbf_ingest.account_mapping_review_audit) <> 0
     or (select count(*) from accounting.account_identities) <> 0
     or (select count(*) from accounting.accounts) <> 0
     or (select count(*) from accounting.account_statement_mappings) <> 0
     or (select count(*) from public.dbf_pl_detail_facts) <> 0
     or (select count(*) from public.dbf_pl_aggregate_facts) <> 0
     or (select count(*) from public.dbf_bs_facts) <> 0
     or (select count(*) from public.dbf_store_monthly_metric_facts) <> 0
     or (select count(*) from public.dbf_budget_facts) <> 0 then
    raise exception 'DBF_ACCOUNT_REVIEW_ROLLBACK_FIXTURE_FAILED';
  end if;
end
$test$;
