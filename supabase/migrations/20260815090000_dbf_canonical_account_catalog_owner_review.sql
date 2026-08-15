begin;

create table dbf_ingest.account_mapping_review_candidates (
  candidate_id uuid primary key default gen_random_uuid(),
  fiscal_month date not null,
  company_id uuid not null,
  statement_type text not null check (statement_type in ('pl','bs')),
  source_system text not null,
  source_batch_id uuid not null references dbf_ingest.import_batches(id) on delete restrict,
  source_account_code text not null,
  source_account_name text not null,
  proposed_account_code text,
  proposed_account_name text,
  account_category text,
  normal_balance text check (normal_balance is null or normal_balance in ('debit','credit')),
  parent_candidate_id uuid references dbf_ingest.account_mapping_review_candidates(candidate_id) on delete restrict,
  hierarchy_level integer check (hierarchy_level is null or hierarchy_level between 0 and 32),
  row_semantics text check (row_semantics is null or row_semantics in (
    'POSTABLE_DETAIL','DERIVED_SUBTOTAL','CONTROL_TOTAL','DISPLAY_ONLY','NEEDS_OWNER_REVIEW'
  )),
  is_postable boolean,
  is_control_total boolean,
  selected_corporate_row_count integer not null check (selected_corporate_row_count > 0),
  future_store_detail_row_count integer not null default 0 check (future_store_detail_row_count >= 0),
  decision text not null default 'UNREVIEWED' check (decision in (
    'UNREVIEWED','APPROVE','EDIT_AND_APPROVE','EXCLUDE','NEEDS_REVIEW'
  )),
  canonical_account_id uuid references accounting.account_identities(account_id) on delete restrict,
  canonical_account_version_id uuid references accounting.accounts(account_version_id) on delete restrict,
  statement_mapping_version_id uuid references accounting.account_statement_mappings(statement_mapping_version_id) on delete restrict,
  mapping_version text not null,
  mapping_digest text not null check (mapping_digest ~ '^[0-9a-f]{64}$'),
  effective_from date not null,
  effective_to date,
  reviewed_by_employee_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (effective_to is null or effective_to > effective_from),
  check ((decision <> 'UNREVIEWED') = (reviewed_at is not null and reviewed_by_employee_id is not null)),
  check (decision not in ('APPROVE','EDIT_AND_APPROVE') or (
    proposed_account_code is not null and proposed_account_name is not null and account_category is not null
    and normal_balance is not null and row_semantics is not null and row_semantics <> 'NEEDS_OWNER_REVIEW'
    and is_postable is not null and is_control_total is not null
  )),
  unique (fiscal_month, company_id, statement_type, source_system, source_account_code, mapping_version)
);

create index dbf_account_review_status_idx on dbf_ingest.account_mapping_review_candidates
  (fiscal_month, company_id, decision, statement_type, source_account_code);

create table dbf_ingest.account_mapping_review_audit (
  audit_id bigint generated always as identity primary key,
  candidate_id uuid not null references dbf_ingest.account_mapping_review_candidates(candidate_id) on delete restrict,
  decision text not null check (decision in ('INITIALIZE','APPROVE','EDIT_AND_APPROVE','EXCLUDE','NEEDS_REVIEW')),
  actor_employee_id uuid not null,
  occurred_at timestamptz not null default statement_timestamp(),
  prior_state jsonb not null,
  new_state jsonb not null,
  review_version text not null,
  request_id uuid not null,
  check (not (prior_state ?| array['amount','sourceRow','accessToken','session','requestBody'])),
  check (not (new_state ?| array['amount','sourceRow','accessToken','session','requestBody']))
);

create unique index dbf_account_review_request_once_idx
  on dbf_ingest.account_mapping_review_audit(candidate_id, request_id);

create function dbf_ingest.guard_account_review_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  raise exception 'DBF_ACCOUNT_REVIEW_AUDIT_APPEND_ONLY';
end $fn$;

create trigger guard_account_review_audit_mutation
before update or delete on dbf_ingest.account_mapping_review_audit
for each row execute function dbf_ingest.guard_account_review_audit_mutation();

create function public.dbf_account_review_initialize_v1(
  p_actor_employee_id uuid,
  p_request_id uuid,
  p_company_id uuid,
  p_mapping_version text,
  p_mapping_digest text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, dbf_ingest as $fn$
declare v_count integer;
begin
  if p_actor_employee_id is null or p_request_id is null then raise exception 'DBF_ACTOR_REQUIRED'; end if;
  if p_company_id <> 'e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid then raise exception 'DBF_COMPANY_SCOPE_REJECTED'; end if;
  if p_mapping_version <> 'dbf-pilot-202606-account-owner-review-v1'
     or p_mapping_digest !~ '^[0-9a-f]{64}$' then raise exception 'DBF_REVIEW_CONTRACT_REJECTED'; end if;

  insert into dbf_ingest.account_mapping_review_candidates (
    fiscal_month,company_id,statement_type,source_system,source_batch_id,
    source_account_code,source_account_name,selected_corporate_row_count,
    future_store_detail_row_count,mapping_version,mapping_digest,effective_from
  )
  select date '2026-06-01', p_company_id,
    case when s.batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid then 'pl' else 'bs' end,
    'yayoi_monthly_accounting_actual',s.batch_id,s.account_code,min(s.account_name),count(*)::integer,
    case when s.batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid then
      (select count(*)::integer from dbf_ingest.staging_rows d
       where d.batch_id=s.batch_id and d.source_row_category='detail' and d.account_code=s.account_code)
    else 0 end,
    p_mapping_version,p_mapping_digest,date '2026-06-01'
  from dbf_ingest.staging_rows s
  where (s.batch_id='13cb25de-0b76-475a-b718-5f588be447fd'::uuid and s.source_row_category='aggregate' and s.store_id is null)
     or (s.batch_id='0ffccfd2-1a39-404a-a41d-b16127ea9008'::uuid and s.store_id is null)
  group by s.batch_id,s.account_code
  on conflict do nothing;

  insert into dbf_ingest.account_mapping_review_audit
    (candidate_id,decision,actor_employee_id,prior_state,new_state,review_version,request_id)
  select c.candidate_id,'INITIALIZE',p_actor_employee_id,'{}'::jsonb,
    jsonb_build_object('decision','UNREVIEWED','statementType',upper(c.statement_type),'candidateSourceCode',c.source_account_code),
    c.mapping_version,p_request_id
  from dbf_ingest.account_mapping_review_candidates c
  where c.fiscal_month=date '2026-06-01' and c.company_id=p_company_id and c.mapping_version=p_mapping_version
    and not exists(select 1 from dbf_ingest.account_mapping_review_audit a where a.candidate_id=c.candidate_id and a.decision='INITIALIZE');

  select count(*) into v_count from dbf_ingest.account_mapping_review_candidates
   where fiscal_month=date '2026-06-01' and company_id=p_company_id and mapping_version=p_mapping_version;
  if v_count <> 138 then raise exception 'DBF_ACCOUNT_CANDIDATE_COUNT_MISMATCH'; end if;
  return jsonb_build_object('candidateCount',v_count,'status','UNAPPROVED');
end $fn$;

create function public.dbf_account_review_list_v1(p_company_id uuid, p_fiscal_month date)
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, dbf_ingest as $fn$
select jsonb_build_object(
  'pilotMonth',to_char(p_fiscal_month,'YYYY-MM'),'companyId',p_company_id,
  'companyName','株式会社イディア・ノブ','promotionEnabled',false,
  'masterBaseline',jsonb_build_object('corporations',6,'storeMasterTotal',22,'activeRecords',21,'inactiveRecords',1,'operatingStores',20,'direct',13,'fc',7,'headOffice',1),
  'summary',jsonb_build_object(
    'candidates',count(*),'approved',count(*) filter(where decision='APPROVE'),
    'editAndApproved',count(*) filter(where decision='EDIT_AND_APPROVE'),
    'excluded',count(*) filter(where decision='EXCLUDE'),
    'needsReview',count(*) filter(where decision='NEEDS_REVIEW'),
    'unreviewed',count(*) filter(where decision='UNREVIEWED'),
    'corporatePlRows',coalesce(sum(selected_corporate_row_count) filter(where statement_type='pl'),0),
    'corporateBsRows',coalesce(sum(selected_corporate_row_count) filter(where statement_type='bs'),0),
    'storeDetailStatus','OUT_OF_SCOPE'
  ),
  'items',coalesce(jsonb_agg(jsonb_build_object(
    'candidateId',candidate_id,'sourceAccountName',source_account_name,'candidateSourceCode',source_account_code,
    'proposedCanonicalAccountCode',proposed_account_code,'proposedCanonicalAccountName',proposed_account_name,
    'statementType',upper(statement_type),'classification',account_category,'normalBalance',normal_balance,
    'parentCandidateId',parent_candidate_id,'hierarchyLevel',hierarchy_level,'rowSemantics',row_semantics,
    'isPostable',is_postable,'isControlTotal',is_control_total,
    'selectedCorporateRowCount',selected_corporate_row_count,'futureStoreDetailRowCount',future_store_detail_row_count,
    'mappingStatus',decision,'warning',case when decision='UNREVIEWED' then 'OWNER_REVIEW_REQUIRED' else null end
  ) order by statement_type,source_account_code),'[]'::jsonb)
)
from dbf_ingest.account_mapping_review_candidates
where company_id=p_company_id and fiscal_month=p_fiscal_month
  and p_company_id='e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid and p_fiscal_month=date '2026-06-01';
$fn$;

create function public.dbf_account_review_decide_v1(
  p_actor_employee_id uuid,p_request_id uuid,p_candidate_id uuid,p_decision text,
  p_proposed_account_code text,p_proposed_account_name text,p_account_category text,
  p_normal_balance text,p_parent_candidate_id uuid,p_hierarchy_level integer,
  p_row_semantics text,p_is_postable boolean,p_is_control_total boolean
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, accounting, dbf_ingest as $fn$
declare v_old dbf_ingest.account_mapping_review_candidates%rowtype; v_new jsonb;
  v_account_id uuid; v_account_version_id uuid; v_statement_mapping_id uuid; v_parent_account_id uuid;
begin
  if p_actor_employee_id is null or p_request_id is null then raise exception 'DBF_ACTOR_REQUIRED'; end if;
  if p_decision not in ('APPROVE','EDIT_AND_APPROVE','EXCLUDE','NEEDS_REVIEW') then raise exception 'DBF_DECISION_INVALID'; end if;
  select * into strict v_old from dbf_ingest.account_mapping_review_candidates where candidate_id=p_candidate_id for update;
  if exists(select 1 from dbf_ingest.account_mapping_review_audit where candidate_id=p_candidate_id and request_id=p_request_id) then
    raise exception 'DBF_DUPLICATE_REVIEW_REQUEST';
  end if;
  update dbf_ingest.account_mapping_review_candidates set
    proposed_account_code=p_proposed_account_code,proposed_account_name=p_proposed_account_name,
    account_category=p_account_category,normal_balance=p_normal_balance,parent_candidate_id=p_parent_candidate_id,
    hierarchy_level=p_hierarchy_level,row_semantics=p_row_semantics,is_postable=p_is_postable,
    is_control_total=p_is_control_total,decision=p_decision,reviewed_by_employee_id=p_actor_employee_id,
    reviewed_at=statement_timestamp(),updated_at=statement_timestamp()
  where candidate_id=p_candidate_id;
  if p_decision in ('APPROVE','EDIT_AND_APPROVE') then
    if p_parent_candidate_id is not null then
      select canonical_account_id into v_parent_account_id from dbf_ingest.account_mapping_review_candidates
       where candidate_id=p_parent_candidate_id and decision in ('APPROVE','EDIT_AND_APPROVE');
      if v_parent_account_id is null then raise exception 'DBF_PARENT_ACCOUNT_NOT_APPROVED'; end if;
    end if;
    insert into accounting.account_identities(created_by) values('service:dbf-account-review') returning account_id into v_account_id;
    insert into accounting.accounts(
      account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,
      sign_policy,measure_type,parent_account_id,display_order,effective_from,status,source_version,mapping_contract_version,
      content_digest,recorded_by
    ) values(
      v_account_id,1,p_proposed_account_code,p_proposed_account_name,'posting',v_old.statement_type,p_account_category,p_normal_balance,
      case when p_normal_balance='debit' then 'debit_positive' else 'credit_positive' end,
      case when v_old.statement_type='pl' then 'period_flow' else 'ending_balance' end,
      v_parent_account_id,coalesce(p_hierarchy_level,0),v_old.effective_from,'active',v_old.mapping_version,v_old.mapping_version,
      encode(extensions.digest(convert_to(concat_ws('|',p_proposed_account_code,p_proposed_account_name,v_old.statement_type,p_account_category,p_normal_balance,p_row_semantics),'UTF8'),'sha256'),'hex'),
      'service:dbf-account-review'
    ) returning account_version_id into v_account_version_id;
    insert into accounting.account_statement_mappings(
      account_id,account_version_id,version_no,statement_type,statement_section,statement_line,display_order,
      aggregation_behavior,contribution_sign,effective_from,status,mapping_contract_version,content_digest,recorded_by
    ) values(
      v_account_id,v_account_version_id,1,v_old.statement_type,p_account_category,lower(p_proposed_account_code),coalesce(p_hierarchy_level,0),
      case when p_row_semantics in ('POSTABLE_DETAIL','DERIVED_SUBTOTAL') then 'add' else 'display_only' end,
      case when p_row_semantics in ('POSTABLE_DETAIL','DERIVED_SUBTOTAL') then 1 else 0 end,
      v_old.effective_from,'active',v_old.mapping_version,
      encode(extensions.digest(convert_to(concat_ws('|',p_proposed_account_code,p_account_category,p_row_semantics),'UTF8'),'sha256'),'hex'),
      'service:dbf-account-review'
    ) returning statement_mapping_version_id into v_statement_mapping_id;
    update dbf_ingest.account_mapping_review_candidates set canonical_account_id=v_account_id,
      canonical_account_version_id=v_account_version_id,statement_mapping_version_id=v_statement_mapping_id
      where candidate_id=p_candidate_id;
  end if;
  select jsonb_build_object('decision',decision,'code',proposed_account_code,'name',proposed_account_name,
    'classification',account_category,'normalBalance',normal_balance,'parentCandidateId',parent_candidate_id,
    'hierarchyLevel',hierarchy_level,'rowSemantics',row_semantics,'isPostable',is_postable,'isControlTotal',is_control_total)
  into v_new from dbf_ingest.account_mapping_review_candidates where candidate_id=p_candidate_id;
  insert into dbf_ingest.account_mapping_review_audit(candidate_id,decision,actor_employee_id,prior_state,new_state,review_version,request_id)
  values(p_candidate_id,p_decision,p_actor_employee_id,
    jsonb_build_object('decision',v_old.decision,'code',v_old.proposed_account_code,'name',v_old.proposed_account_name,
      'classification',v_old.account_category,'normalBalance',v_old.normal_balance,'parentCandidateId',v_old.parent_candidate_id,
      'hierarchyLevel',v_old.hierarchy_level,'rowSemantics',v_old.row_semantics,'isPostable',v_old.is_postable,'isControlTotal',v_old.is_control_total),
    v_new,v_old.mapping_version,p_request_id);
  return jsonb_build_object('candidateId',p_candidate_id,'decision',p_decision,'requestId',p_request_id);
end $fn$;

alter table dbf_ingest.account_mapping_review_candidates enable row level security;
alter table dbf_ingest.account_mapping_review_candidates force row level security;
alter table dbf_ingest.account_mapping_review_audit enable row level security;
alter table dbf_ingest.account_mapping_review_audit force row level security;

revoke all on dbf_ingest.account_mapping_review_candidates from public,anon,authenticated,service_role;
revoke all on dbf_ingest.account_mapping_review_audit from public,anon,authenticated,service_role;
revoke all on sequence dbf_ingest.account_mapping_review_audit_audit_id_seq from public,anon,authenticated,service_role;
revoke all on function dbf_ingest.guard_account_review_audit_mutation() from public,anon,authenticated,service_role;
revoke all on function public.dbf_account_review_initialize_v1(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.dbf_account_review_list_v1(uuid,date) from public,anon,authenticated;
revoke all on function public.dbf_account_review_decide_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.dbf_account_review_initialize_v1(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.dbf_account_review_list_v1(uuid,date) to service_role;
grant execute on function public.dbf_account_review_decide_v1(uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean) to service_role;

commit;
