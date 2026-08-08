-- PR002 / ACF-05 / M016
-- Accounting Version validation, one-stage checker approval, and immutable audit.
-- Publication, Consumer projection, data load, and concrete production role grants remain excluded.

create table accounting.validation_results (
  validation_result_id uuid primary key default gen_random_uuid(),
  accounting_version_id uuid not null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  validation_cycle_id uuid not null,
  validation_code text not null,
  severity text not null,
  result_status text not null,
  expected_value text not null,
  actual_value text null,
  evidence_reference text not null,
  checked_at timestamptz not null default statement_timestamp(),
  checked_by text not null,
  checker_role text not null,
  validator_version text not null,
  version_content_hash text not null,
  is_blocking boolean not null default true,
  correlation_id uuid not null,
  constraint accounting_validation_results_code_check check (validation_code in (
    'journal_completeness','debit_credit_integrity','account_validity',
    'organization_scope_validity','period_validity','measure_type_integrity',
    'actual_source_completeness','tax_rounding_evidence','planning_contract_completeness',
    'allocation_completeness','unallocated_state','duplicate_prevention',
    'source_lineage','fact_completeness'
  )),
  constraint accounting_validation_results_severity_check check (
    severity in ('info','warning','error','critical')
  ),
  constraint accounting_validation_results_status_check check (
    result_status in ('pass','fail','pending')
  ),
  constraint accounting_validation_results_token_check check (
    expected_value ~ '^[A-Za-z0-9][A-Za-z0-9._:/=,+-]{0,255}$'
    and (actual_value is null or actual_value ~ '^[A-Za-z0-9][A-Za-z0-9._:/=,+-]{0,255}$')
  ),
  constraint accounting_validation_results_result_evidence_check check (
    (result_status = 'pass' and actual_value is not null and actual_value = expected_value)
    or (result_status = 'fail' and actual_value is not null and actual_value <> expected_value)
    or (result_status = 'pending' and actual_value is null)
  ),
  constraint accounting_validation_results_evidence_ref_check check (
    evidence_reference ~ '^(evidence|catalog|query|fixture):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  constraint accounting_validation_results_actor_check check (
    checked_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_validation_results_role_check check (
    checker_role ~ '^[a-z][a-z0-9_.:-]{0,79}$'
  ),
  constraint accounting_validation_results_validator_check check (
    validator_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
  ),
  constraint accounting_validation_results_hash_check check (
    version_content_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_validation_results_cycle_code_unique unique (
    accounting_version_id, validation_cycle_id, validation_code
  )
);

create index accounting_validation_results_version_idx
  on accounting.validation_results(accounting_version_id, validation_cycle_id);
create index accounting_validation_results_status_idx
  on accounting.validation_results(accounting_version_id, result_status, is_blocking);

create table accounting.approvals (
  approval_id uuid primary key default gen_random_uuid(),
  accounting_version_id uuid not null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  validation_cycle_id uuid not null,
  approval_type text not null,
  decision_sequence bigint not null,
  approval_status text not null,
  approval_reference text not null,
  approved_by text not null,
  approver_role text not null,
  approved_at timestamptz not null default statement_timestamp(),
  reason_code text not null,
  version_content_hash text not null,
  correlation_id uuid not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_approvals_type_check check (approval_type in (
    'import_validated','operations_confirmed','accounting_confirmed',
    'publication_approved','adjustment_approved','reversal_approved'
  )),
  constraint accounting_approvals_sequence_positive check (decision_sequence > 0),
  constraint accounting_approvals_status_check check (approval_status in ('approved','rejected')),
  constraint accounting_approvals_reference_check check (
    approval_reference ~ '^(approval|evidence|ticket):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  constraint accounting_approvals_actor_check check (
    approved_by ~ '^canonical:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  constraint accounting_approvals_role_check check (
    approver_role ~ '^[a-z][a-z0-9_.:-]{0,79}$'
  ),
  constraint accounting_approvals_reason_check check (
    reason_code ~ '^[a-z][a-z0-9._:-]{0,127}$'
  ),
  constraint accounting_approvals_hash_check check (version_content_hash ~ '^[0-9a-f]{64}$'),
  constraint accounting_approvals_sequence_unique unique (
    accounting_version_id, approval_type, decision_sequence
  )
);

create unique index accounting_approvals_one_approved_type_idx
  on accounting.approvals(accounting_version_id, approval_type)
  where approval_status = 'approved';
create index accounting_approvals_version_cycle_idx
  on accounting.approvals(accounting_version_id, validation_cycle_id);

create table accounting.audit_events (
  audit_event_id uuid primary key default gen_random_uuid(),
  accounting_version_id uuid not null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  validation_cycle_id uuid null,
  approval_id uuid null references accounting.approvals(approval_id) on delete restrict,
  action text not null,
  previous_state text null,
  next_state text null,
  actor text not null,
  actor_role text not null,
  occurred_at timestamptz not null default statement_timestamp(),
  reason_code text not null,
  evidence_reference text not null,
  version_content_hash text not null,
  correlation_id uuid not null,
  constraint accounting_audit_events_action_check check (action in (
    'validation_result_recorded','validation_passed','validation_failed',
    'approval_recorded','version_approved'
  )),
  constraint accounting_audit_events_state_check check (
    previous_state is null or previous_state in ('draft','validating','validated','approved','rejected')
  ),
  constraint accounting_audit_events_next_state_check check (
    next_state is null or next_state in ('validating','validated','approved','rejected')
  ),
  constraint accounting_audit_events_actor_check check (
    actor ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_audit_events_role_check check (
    actor_role ~ '^[a-z][a-z0-9_.:-]{0,79}$'
  ),
  constraint accounting_audit_events_reason_check check (
    reason_code ~ '^[a-z][a-z0-9._:-]{0,127}$'
  ),
  constraint accounting_audit_events_evidence_ref_check check (
    evidence_reference ~ '^(evidence|catalog|query|fixture|approval):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  constraint accounting_audit_events_hash_check check (version_content_hash ~ '^[0-9a-f]{64}$')
);

create index accounting_audit_events_version_idx
  on accounting.audit_events(accounting_version_id, occurred_at, audit_event_id);
create index accounting_audit_events_cycle_idx
  on accounting.audit_events(validation_cycle_id) where validation_cycle_id is not null;
create index accounting_audit_events_approval_idx
  on accounting.audit_events(approval_id) where approval_id is not null;

create function accounting.m016_required_validation_codes(p_scenario text)
returns table(validation_code text)
language sql immutable security invoker set search_path = ''
as $function$
  select code from (values
    ('journal_completeness','all'),('debit_credit_integrity','all'),
    ('account_validity','all'),('organization_scope_validity','all'),
    ('period_validity','all'),('measure_type_integrity','all'),
    ('allocation_completeness','all'),('unallocated_state','all'),
    ('duplicate_prevention','all'),('source_lineage','all'),('fact_completeness','all'),
    ('actual_source_completeness','actual'),('tax_rounding_evidence','actual'),
    ('planning_contract_completeness','planning')
  ) v(code,applies_to)
  where applies_to = 'all'
    or applies_to = p_scenario
    or (applies_to = 'planning' and p_scenario in ('budget','forecast'))
$function$;

create function accounting.m016_assert_actor(
  p_actor text, p_actor_role text, p_require_human boolean
) returns void
language plpgsql stable security invoker set search_path = ''
as $function$
declare employee_uuid uuid;
begin
  if p_actor is null or p_actor !~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    or p_actor_role is null or p_actor_role !~ '^[a-z][a-z0-9_.:-]{0,79}$' then
    raise exception 'BDF_M016_UNAUTHORIZED_ACTOR';
  end if;
  if p_require_human and p_actor !~ '^canonical:[0-9a-f-]{36}$' then
    raise exception 'BDF_M016_HUMAN_APPROVER_REQUIRED';
  end if;
  if p_actor like 'canonical:%' then
    begin employee_uuid := substring(p_actor from 11)::uuid;
    exception when others then raise exception 'BDF_M016_UNAUTHORIZED_ACTOR'; end;
    if not exists (select 1 from core.employee_identities e
      where e.employee_id = employee_uuid and e.identity_status = 'active') then
      raise exception 'BDF_M016_UNAUTHORIZED_ACTOR';
    end if;
  end if;
end
$function$;

create function accounting.m016_validation_violation_count(
  p_accounting_version_id uuid, p_validation_code text
) returns bigint
language plpgsql stable security invoker set search_path = ''
as $function$
declare v accounting.accounting_versions%rowtype; n bigint; fact_count bigint;
begin
  select * into v from accounting.accounting_versions
  where accounting_version_id = p_accounting_version_id;
  if not found then raise exception 'BDF_M016_ORPHAN_ACCOUNTING_VERSION'; end if;
  select count(*) into fact_count from accounting.accounting_facts
  where accounting_version_id = p_accounting_version_id;

  if p_validation_code = 'journal_completeness' then
    select (case when count(*) = 0 then 1 else 0 end)
      + count(*) filter (where not exists (select 1 from accounting.journal_lines l
          where l.journal_entry_id=e.journal_entry_id))
    into n from accounting.journal_entries e where e.accounting_version_id=p_accounting_version_id;
  elsif p_validation_code = 'debit_credit_integrity' then
    select count(*) into n from (
      select e.journal_entry_id
      from accounting.journal_entries e
      left join accounting.accounting_facts f on f.journal_entry_id=e.journal_entry_id
      where e.accounting_version_id=p_accounting_version_id
      group by e.journal_entry_id
      having count(f.accounting_fact_id)=0 or coalesce(sum(f.amount),0)<>0
    ) q;
  elsif p_validation_code = 'account_validity' then
    select count(*) into n from accounting.journal_lines l
    where l.accounting_version_id=p_accounting_version_id and not accounting.account_version_matches_period(
      l.account_id,l.account_version_id,l.measure_type,v.period_start,v.period_end);
  elsif p_validation_code = 'organization_scope_validity' then
    select count(*) into n from accounting.journal_lines l
    where l.accounting_version_id=p_accounting_version_id and not accounting.organization_scope_is_valid(
      l.organization_scope_type,l.corporation_id,l.corporation_version_id,
      l.store_id,l.store_version_id,l.store_relationship_version_id,
      l.department_id,l.department_version_id,v.period_start,v.period_end);
  elsif p_validation_code = 'period_validity' then
    select count(*) into n from accounting.accounting_facts f
    where f.accounting_version_id=p_accounting_version_id and f.accounting_period<>v.period_start;
  elsif p_validation_code = 'measure_type_integrity' then
    select count(*) into n from accounting.accounting_facts f
    join accounting.journal_lines l on l.journal_line_id=f.journal_line_id
    where f.accounting_version_id=p_accounting_version_id and f.measure_type<>l.measure_type;
  elsif p_validation_code = 'actual_source_completeness' then
    select count(*) into n from accounting.journal_lines l
    where l.accounting_version_id=p_accounting_version_id
      and (v.scenario_type<>'actual' or l.source_batch_id is null or l.source_batch_id<>v.source_batch_id
        or l.source_file_id is null or l.staging_line_id is null);
  elsif p_validation_code = 'tax_rounding_evidence' then
    select count(*) into n from accounting.accounting_facts f
    left join accounting.journal_lines l on l.journal_line_id=f.journal_line_id
    left join accounting.import_staging_lines s on s.staging_line_id=l.staging_line_id
    where f.accounting_version_id=p_accounting_version_id and (
      f.tax_basis<>'exclusive' or (v.scenario_type='actual' and (
        s.validation_status<>'valid' or s.normalization_status<>'passed' or s.mapping_status<>'passed'
        or s.source_amount is null or s.source_amount in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
      )));
  elsif p_validation_code = 'planning_contract_completeness' then
    select count(*) into n from accounting.journal_lines l
    where l.accounting_version_id=p_accounting_version_id and (
      v.scenario_type not in ('budget','forecast') or l.staging_line_id is not null
      or nullif(btrim(l.planning_contract_version),'') is null);
  elsif p_validation_code = 'allocation_completeness' then
    select count(*) into n from accounting.accounting_facts f
    where f.accounting_version_id=p_accounting_version_id and f.attribution_status='unallocated'
      and not exists (select 1 from accounting.allocation_sets s
        where s.source_fact_id=f.accounting_fact_id and s.status='balanced');
  elsif p_validation_code = 'unallocated_state' then
    select count(*) into n from accounting.accounting_facts f
    where f.accounting_version_id=p_accounting_version_id and f.attribution_status='unallocated'
      and (f.organization_scope_type<>'corporation' or f.value_status<>'observed'
        or f.amount is null or f.amount=0);
  elsif p_validation_code = 'duplicate_prevention' then
    select count(*) into n from (
      select journal_line_id from accounting.accounting_facts
      where accounting_version_id=p_accounting_version_id group by journal_line_id having count(*)>1
    ) q;
  elsif p_validation_code = 'source_lineage' then
    select count(*) into n from accounting.journal_lines l
    where l.accounting_version_id=p_accounting_version_id and (
      (v.scenario_type='actual' and l.staging_line_id is null)
      or (v.scenario_type in ('budget','forecast') and nullif(btrim(l.planning_contract_version),'') is null)
    );
  elsif p_validation_code = 'fact_completeness' then
    select abs((select count(*) from accounting.journal_lines
      where accounting_version_id=p_accounting_version_id)-fact_count) into n;
  else
    raise exception 'BDF_M016_UNKNOWN_VALIDATION_CODE';
  end if;
  return coalesce(n,0);
end
$function$;

create function accounting.record_accounting_validation(
  p_accounting_version_id uuid,
  p_validation_cycle_id uuid,
  p_validation_code text,
  p_actor text,
  p_actor_role text,
  p_validator_version text,
  p_evidence_reference text,
  p_expected_content_hash text,
  p_correlation_id uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $function$
declare v accounting.accounting_versions%rowtype; violations bigint; status_value text;
  result_id uuid; expected_value text := '0'; actual_value text;
begin
  perform accounting.m016_assert_actor(p_actor,p_actor_role,false);
  select * into v from accounting.accounting_versions
  where accounting_version_id=p_accounting_version_id for update;
  if not found then raise exception 'BDF_M016_ORPHAN_ACCOUNTING_VERSION'; end if;
  if v.status<>'validating' then raise exception 'BDF_M016_VERSION_NOT_VALIDATING'; end if;
  if v.content_hash<>p_expected_content_hash then raise exception 'BDF_M016_STALE_VERSION'; end if;
  if not exists (select 1 from accounting.m016_required_validation_codes(v.scenario_type) r
    where r.validation_code=p_validation_code) then raise exception 'BDF_M016_VALIDATION_CODE_NOT_REQUIRED'; end if;
  violations := accounting.m016_validation_violation_count(p_accounting_version_id,p_validation_code);
  if violations=0 then status_value:='pass'; actual_value:='0';
  elsif p_validation_code<>'journal_completeness' and not exists (
    select 1 from accounting.accounting_facts where accounting_version_id=p_accounting_version_id
  ) then status_value:='pending'; actual_value:=null;
  else status_value:='fail'; actual_value:=violations::text; end if;

  insert into accounting.validation_results(
    accounting_version_id,validation_cycle_id,validation_code,severity,result_status,
    expected_value,actual_value,evidence_reference,checked_by,checker_role,
    validator_version,version_content_hash,is_blocking,correlation_id
  ) values (
    p_accounting_version_id,p_validation_cycle_id,p_validation_code,
    case when status_value='pass' then 'info' else 'critical' end,status_value,
    expected_value,actual_value,p_evidence_reference,p_actor,p_actor_role,
    p_validator_version,v.content_hash,true,p_correlation_id
  ) returning validation_result_id into result_id;
  insert into accounting.audit_events(
    accounting_version_id,validation_cycle_id,action,previous_state,next_state,actor,actor_role,
    reason_code,evidence_reference,version_content_hash,correlation_id
  ) values (p_accounting_version_id,p_validation_cycle_id,'validation_result_recorded',v.status,v.status,
    p_actor,p_actor_role,'validation_recorded',p_evidence_reference,v.content_hash,p_correlation_id);
  return result_id;
end
$function$;

create function accounting.finalize_accounting_validation(
  p_accounting_version_id uuid,
  p_validation_cycle_id uuid,
  p_actor text,
  p_actor_role text,
  p_reason_code text,
  p_evidence_reference text,
  p_expected_content_hash text,
  p_correlation_id uuid
) returns text
language plpgsql security invoker set search_path = ''
as $function$
declare v accounting.accounting_versions%rowtype; required_count integer; recorded_count integer;
  pending_count integer; failed_count integer; next_status text;
begin
  perform accounting.m016_assert_actor(p_actor,p_actor_role,false);
  select * into v from accounting.accounting_versions
  where accounting_version_id=p_accounting_version_id for update;
  if not found then raise exception 'BDF_M016_ORPHAN_ACCOUNTING_VERSION'; end if;
  if v.status<>'validating' then raise exception 'BDF_M016_VERSION_NOT_VALIDATING'; end if;
  if v.content_hash<>p_expected_content_hash then raise exception 'BDF_M016_STALE_VERSION'; end if;
  select count(*) into required_count from accounting.m016_required_validation_codes(v.scenario_type);
  select count(*),count(*) filter(where result_status='pending'),count(*) filter(where result_status='fail')
    into recorded_count,pending_count,failed_count
  from accounting.validation_results r
  where r.accounting_version_id=p_accounting_version_id
    and r.validation_cycle_id=p_validation_cycle_id and r.is_blocking
    and r.version_content_hash=v.content_hash
    and r.validation_code in (select validation_code from accounting.m016_required_validation_codes(v.scenario_type));
  if recorded_count<>required_count then raise exception 'BDF_M016_VALIDATION_INCOMPLETE'; end if;
  if pending_count>0 then raise exception 'BDF_M016_VALIDATION_PENDING'; end if;
  if failed_count>0 then
    next_status:='rejected';
    update accounting.accounting_versions set status='rejected',rejected_at=statement_timestamp(),rejected_by=p_actor
      where accounting_version_id=p_accounting_version_id;
  else
    next_status:='validated';
    update accounting.accounting_versions set status='validated',validated_at=statement_timestamp(),validated_by=p_actor
      where accounting_version_id=p_accounting_version_id;
  end if;
  insert into accounting.audit_events(
    accounting_version_id,validation_cycle_id,action,previous_state,next_state,actor,actor_role,
    reason_code,evidence_reference,version_content_hash,correlation_id
  ) values (p_accounting_version_id,p_validation_cycle_id,
    case when next_status='validated' then 'validation_passed' else 'validation_failed' end,
    'validating',next_status,p_actor,p_actor_role,p_reason_code,p_evidence_reference,v.content_hash,p_correlation_id);
  return next_status;
end
$function$;

create function accounting.record_accounting_approval(
  p_accounting_version_id uuid,
  p_validation_cycle_id uuid,
  p_approval_type text,
  p_approval_status text,
  p_actor text,
  p_actor_role text,
  p_reason_code text,
  p_approval_reference text,
  p_expected_content_hash text,
  p_correlation_id uuid
) returns uuid
language plpgsql security invoker set search_path = ''
as $function$
declare v accounting.accounting_versions%rowtype; approval_uuid uuid; next_sequence bigint;
  required_count integer; pass_count integer;
begin
  perform accounting.m016_assert_actor(p_actor,p_actor_role,true);
  select * into v from accounting.accounting_versions
  where accounting_version_id=p_accounting_version_id for update;
  if not found then raise exception 'BDF_M016_ORPHAN_ACCOUNTING_VERSION'; end if;
  if v.content_hash<>p_expected_content_hash then raise exception 'BDF_M016_STALE_VERSION'; end if;
  if exists (select 1 from accounting.approvals a where a.accounting_version_id=p_accounting_version_id
    and a.approval_type=p_approval_type and a.approval_status='approved') then
    raise exception 'BDF_M016_DUPLICATE_APPROVAL';
  end if;
  if v.status<>'validated' then raise exception 'BDF_M016_VALIDATION_PASS_REQUIRED'; end if;
  if p_actor=v.created_by or p_actor=v.validated_by then raise exception 'BDF_M016_SELF_APPROVAL_FORBIDDEN'; end if;
  select count(*) into required_count from accounting.m016_required_validation_codes(v.scenario_type);
  select count(*) into pass_count from accounting.validation_results r
  where r.accounting_version_id=p_accounting_version_id and r.validation_cycle_id=p_validation_cycle_id
    and r.result_status='pass' and r.is_blocking and r.version_content_hash=v.content_hash
    and r.validation_code in (select validation_code from accounting.m016_required_validation_codes(v.scenario_type));
  if pass_count<>required_count then raise exception 'BDF_M016_VALIDATION_PASS_REQUIRED'; end if;
  select coalesce(max(decision_sequence),0)+1 into next_sequence from accounting.approvals
  where accounting_version_id=p_accounting_version_id and approval_type=p_approval_type;
  insert into accounting.approvals(
    accounting_version_id,validation_cycle_id,approval_type,decision_sequence,approval_status,
    approval_reference,approved_by,approver_role,reason_code,version_content_hash,correlation_id
  ) values (p_accounting_version_id,p_validation_cycle_id,p_approval_type,next_sequence,p_approval_status,
    p_approval_reference,p_actor,p_actor_role,p_reason_code,v.content_hash,p_correlation_id)
  returning approval_id into approval_uuid;
  insert into accounting.audit_events(
    accounting_version_id,validation_cycle_id,approval_id,action,previous_state,next_state,
    actor,actor_role,reason_code,evidence_reference,version_content_hash,correlation_id
  ) values (p_accounting_version_id,p_validation_cycle_id,approval_uuid,'approval_recorded','validated','validated',
    p_actor,p_actor_role,p_reason_code,p_approval_reference,v.content_hash,p_correlation_id);
  if p_approval_type='accounting_confirmed' and p_approval_status='approved' then
    update accounting.accounting_versions set status='approved',approved_at=statement_timestamp(),approved_by=p_actor
    where accounting_version_id=p_accounting_version_id;
    insert into accounting.audit_events(
      accounting_version_id,validation_cycle_id,approval_id,action,previous_state,next_state,
      actor,actor_role,reason_code,evidence_reference,version_content_hash,correlation_id
    ) values (p_accounting_version_id,p_validation_cycle_id,approval_uuid,'version_approved','validated','approved',
      p_actor,p_actor_role,p_reason_code,p_approval_reference,v.content_hash,p_correlation_id);
  end if;
  return approval_uuid;
end
$function$;

create function accounting.guard_m016_evidence_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  raise exception 'BDF_M016_EVIDENCE_IMMUTABLE';
end
$function$;

create or replace function accounting.guard_accounting_version_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare required_count integer; evidence_count integer;
begin
  if tg_op='DELETE' then raise exception 'BDF_ACCOUNTING_VERSION_IMMUTABLE'; end if;
  if row(old.accounting_version_id,old.corporation_id,old.scenario_type,old.version_type,
    old.fiscal_year,old.period_grain,old.period_start,old.period_end,old.version_sequence,
    old.version_label,old.source_snapshot_id,old.source_batch_id,old.parent_version_id,
    old.reverses_version_id,old.content_hash,old.created_at,old.created_by)
    is distinct from
    row(new.accounting_version_id,new.corporation_id,new.scenario_type,new.version_type,
    new.fiscal_year,new.period_grain,new.period_start,new.period_end,new.version_sequence,
    new.version_label,new.source_snapshot_id,new.source_batch_id,new.parent_version_id,
    new.reverses_version_id,new.content_hash,new.created_at,new.created_by) then
    raise exception 'BDF_ACCOUNTING_VERSION_CONTENT_IMMUTABLE';
  end if;
  if old.status='draft' and new.status='validating' then return new; end if;
  select count(*) into required_count from accounting.m016_required_validation_codes(old.scenario_type);
  if old.status='validating' and new.status='validated' then
    select count(*) into evidence_count from accounting.validation_results r
    where r.accounting_version_id=old.accounting_version_id and r.result_status='pass'
      and r.is_blocking and r.version_content_hash=old.content_hash
      and r.validation_code in (select validation_code from accounting.m016_required_validation_codes(old.scenario_type))
      and r.validation_cycle_id in (
        select validation_cycle_id from accounting.validation_results
        where accounting_version_id=old.accounting_version_id
        group by validation_cycle_id having count(*) filter(where result_status='pass' and is_blocking)=required_count
      );
    if evidence_count<>required_count then raise exception 'BDF_M016_VALIDATION_PASS_REQUIRED'; end if;
    return new;
  end if;
  if old.status='validating' and new.status='rejected' then
    if not exists (select 1 from accounting.validation_results r
      where r.accounting_version_id=old.accounting_version_id and r.result_status='fail'
        and r.is_blocking and r.version_content_hash=old.content_hash) then
      raise exception 'BDF_M016_VALIDATION_FAILURE_REQUIRED';
    end if;
    return new;
  end if;
  if old.status='validated' and new.status='approved' then
    if not exists (select 1 from accounting.approvals a
      where a.accounting_version_id=old.accounting_version_id
        and a.approval_type='accounting_confirmed' and a.approval_status='approved'
        and a.version_content_hash=old.content_hash and a.approved_by=new.approved_by) then
      raise exception 'BDF_M016_APPROVAL_EVIDENCE_REQUIRED';
    end if;
    return new;
  end if;
  if old.status='approved' and new.status='published' then
    raise exception 'BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017';
  end if;
  raise exception 'BDF_ACCOUNTING_VERSION_INVALID_TRANSITION';
end
$function$;

create trigger guard_validation_result_mutation before update or delete on accounting.validation_results
for each row execute function accounting.guard_m016_evidence_mutation();
create trigger guard_approval_mutation before update or delete on accounting.approvals
for each row execute function accounting.guard_m016_evidence_mutation();
create trigger guard_audit_event_mutation before update or delete on accounting.audit_events
for each row execute function accounting.guard_m016_evidence_mutation();

alter table accounting.validation_results enable row level security;
alter table accounting.validation_results force row level security;
alter table accounting.approvals enable row level security;
alter table accounting.approvals force row level security;
alter table accounting.audit_events enable row level security;
alter table accounting.audit_events force row level security;

revoke all on accounting.validation_results from public,anon,authenticated,service_role;
revoke all on accounting.approvals from public,anon,authenticated,service_role;
revoke all on accounting.audit_events from public,anon,authenticated,service_role;
revoke execute on function accounting.m016_required_validation_codes(text) from public,anon,authenticated,service_role;
revoke execute on function accounting.m016_assert_actor(text,text,boolean) from public,anon,authenticated,service_role;
revoke execute on function accounting.m016_validation_violation_count(uuid,text) from public,anon,authenticated,service_role;
revoke execute on function accounting.record_accounting_validation(uuid,uuid,text,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;
revoke execute on function accounting.finalize_accounting_validation(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;
revoke execute on function accounting.record_accounting_approval(uuid,uuid,text,text,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;
revoke execute on function accounting.guard_m016_evidence_mutation() from public,anon,authenticated,service_role;
