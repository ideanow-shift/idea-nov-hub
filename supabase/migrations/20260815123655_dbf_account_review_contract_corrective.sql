-- DBF Canonical Account Catalog / Owner Review contract corrective.
-- Additive and fail-closed: no source rows or accounting facts are promoted here.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table dbf_ingest.account_mapping_review_candidates
  add constraint dbf_account_review_approved_semantics_consistency check (
    decision not in ('APPROVE', 'EDIT_AND_APPROVE')
    or (row_semantics = 'POSTABLE_DETAIL' and is_postable is true and is_control_total is false)
    or (row_semantics = 'DERIVED_SUBTOTAL' and is_postable is false and is_control_total is false)
    or (row_semantics = 'CONTROL_TOTAL' and is_postable is false and is_control_total is true)
    or (row_semantics = 'DISPLAY_ONLY' and is_postable is false and is_control_total is false)
  );

create or replace function public.dbf_account_review_decide_v1(
  p_actor_employee_id uuid,p_request_id uuid,p_candidate_id uuid,p_decision text,
  p_proposed_account_code text,p_proposed_account_name text,p_account_category text,
  p_normal_balance text,p_parent_candidate_id uuid,p_hierarchy_level integer,
  p_row_semantics text,p_is_postable boolean,p_is_control_total boolean
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, accounting, dbf_ingest as $fn$
declare v_old dbf_ingest.account_mapping_review_candidates%rowtype; v_new jsonb;
  v_account_id uuid; v_account_version_id uuid; v_statement_mapping_id uuid; v_parent_account_id uuid;
begin
  if p_actor_employee_id is null or p_request_id is null then raise exception 'DBF_ACTOR_REQUIRED'; end if;
  if p_decision not in ('APPROVE','EDIT_AND_APPROVE','EXCLUDE','NEEDS_REVIEW') then raise exception 'DBF_DECISION_INVALID'; end if;

  select * into strict v_old
  from dbf_ingest.account_mapping_review_candidates
  where candidate_id=p_candidate_id
  for update;

  if exists(
    select 1 from dbf_ingest.account_mapping_review_audit
    where candidate_id=p_candidate_id and request_id=p_request_id
  ) then
    raise exception 'DBF_DUPLICATE_REVIEW_REQUEST';
  end if;

  if v_old.decision in ('APPROVE','EDIT_AND_APPROVE','EXCLUDE')
     or v_old.canonical_account_id is not null
     or v_old.canonical_account_version_id is not null
     or v_old.statement_mapping_version_id is not null then
    raise exception 'DBF_ACCOUNT_REVIEW_ALREADY_FINAL';
  end if;

  if p_decision in ('APPROVE','EDIT_AND_APPROVE') then
    if nullif(btrim(p_proposed_account_code),'') is null
       or nullif(btrim(p_proposed_account_name),'') is null
       or nullif(btrim(p_account_category),'') is null
       or p_normal_balance is null
       or p_normal_balance not in ('debit','credit')
       or p_row_semantics is null
       or p_row_semantics not in ('POSTABLE_DETAIL','DERIVED_SUBTOTAL','CONTROL_TOTAL','DISPLAY_ONLY') then
      raise exception 'DBF_APPROVAL_FIELDS_REQUIRED';
    end if;

    if not (
      (p_row_semantics='POSTABLE_DETAIL' and p_is_postable is true and p_is_control_total is false)
      or (p_row_semantics='DERIVED_SUBTOTAL' and p_is_postable is false and p_is_control_total is false)
      or (p_row_semantics='CONTROL_TOTAL' and p_is_postable is false and p_is_control_total is true)
      or (p_row_semantics='DISPLAY_ONLY' and p_is_postable is false and p_is_control_total is false)
    ) then
      raise exception 'DBF_ROW_SEMANTICS_FLAGS_MISMATCH';
    end if;
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
      select canonical_account_id into v_parent_account_id
      from dbf_ingest.account_mapping_review_candidates
      where candidate_id=p_parent_candidate_id and decision in ('APPROVE','EDIT_AND_APPROVE');
      if v_parent_account_id is null then raise exception 'DBF_PARENT_ACCOUNT_NOT_APPROVED'; end if;
    end if;

    insert into accounting.account_identities(created_by)
    values('service:dbf-account-review')
    returning account_id into v_account_id;

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
      case when p_row_semantics='POSTABLE_DETAIL' then 'add' else 'display_only' end,
      case when p_row_semantics='POSTABLE_DETAIL' then 1 else 0 end,
      v_old.effective_from,'active',v_old.mapping_version,
      encode(extensions.digest(convert_to(concat_ws('|',p_proposed_account_code,p_account_category,p_row_semantics),'UTF8'),'sha256'),'hex'),
      'service:dbf-account-review'
    ) returning statement_mapping_version_id into v_statement_mapping_id;

    update dbf_ingest.account_mapping_review_candidates set
      canonical_account_id=v_account_id,
      canonical_account_version_id=v_account_version_id,
      statement_mapping_version_id=v_statement_mapping_id
    where candidate_id=p_candidate_id;
  end if;

  select jsonb_build_object('decision',decision,'code',proposed_account_code,'name',proposed_account_name,
    'classification',account_category,'normalBalance',normal_balance,'parentCandidateId',parent_candidate_id,
    'hierarchyLevel',hierarchy_level,'rowSemantics',row_semantics,'isPostable',is_postable,'isControlTotal',is_control_total)
  into v_new
  from dbf_ingest.account_mapping_review_candidates
  where candidate_id=p_candidate_id;

  insert into dbf_ingest.account_mapping_review_audit(
    candidate_id,decision,actor_employee_id,prior_state,new_state,review_version,request_id
  ) values(
    p_candidate_id,p_decision,p_actor_employee_id,
    jsonb_build_object('decision',v_old.decision,'code',v_old.proposed_account_code,'name',v_old.proposed_account_name,
      'classification',v_old.account_category,'normalBalance',v_old.normal_balance,'parentCandidateId',v_old.parent_candidate_id,
      'hierarchyLevel',v_old.hierarchy_level,'rowSemantics',v_old.row_semantics,'isPostable',v_old.is_postable,'isControlTotal',v_old.is_control_total),
    v_new,v_old.mapping_version,p_request_id
  );

  return jsonb_build_object('candidateId',p_candidate_id,'decision',p_decision,'requestId',p_request_id);
end $fn$;

revoke all on function public.dbf_account_review_decide_v1(
  uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean
) from public,anon,authenticated;
grant execute on function public.dbf_account_review_decide_v1(
  uuid,uuid,uuid,text,text,text,text,text,uuid,integer,text,boolean,boolean
) to service_role;

commit;
