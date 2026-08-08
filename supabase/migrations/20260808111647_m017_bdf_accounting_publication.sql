-- PR002 / ACF-06 / M017
-- Immutable Accounting Publication release/member and comparison-rule contracts.
-- Consumer projections, APIs, data load, and Production bindings remain excluded.

create table accounting.publication_releases (
  publication_id uuid primary key default gen_random_uuid(),
  release_sequence bigint generated always as identity unique,
  request_key text not null unique,
  request_fingerprint text not null,
  release_kind text not null default 'standard',
  release_status text not null default 'published',
  effective_as_of date not null,
  release_reason text not null,
  published_at timestamptz not null,
  published_by text not null,
  publisher_role text not null,
  publication_approval_id uuid not null
    references accounting.approvals(approval_id) on delete restrict,
  prior_publication_id uuid null
    references accounting.publication_releases(publication_id) on delete restrict,
  reverses_publication_id uuid null
    references accounting.publication_releases(publication_id) on delete restrict,
  evidence_reference text not null,
  correlation_id uuid not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_publication_releases_request_check check (
    request_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$'
  ),
  constraint accounting_publication_releases_fingerprint_check check (
    request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_publication_releases_kind_check check (
    release_kind in ('standard','adjustment','reversal')
  ),
  constraint accounting_publication_releases_status_check check (release_status='published'),
  constraint accounting_publication_releases_reason_check check (
    release_reason ~ '^[a-z][a-z0-9._:-]{0,127}$'
  ),
  constraint accounting_publication_releases_actor_check check (
    published_by ~ '^canonical:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  constraint accounting_publication_releases_role_check check (
    publisher_role ~ '^[a-z][a-z0-9_.:-]{0,79}$'
  ),
  constraint accounting_publication_releases_evidence_check check (
    evidence_reference ~ '^(approval|evidence|ticket):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  constraint accounting_publication_releases_lineage_check check (
    publication_id is distinct from prior_publication_id
    and publication_id is distinct from reverses_publication_id
    and (release_kind='reversal')=(reverses_publication_id is not null)
  )
);

create index accounting_publication_releases_prior_idx
  on accounting.publication_releases(prior_publication_id) where prior_publication_id is not null;
create index accounting_publication_releases_reverses_idx
  on accounting.publication_releases(reverses_publication_id) where reverses_publication_id is not null;
create index accounting_publication_releases_approval_idx
  on accounting.publication_releases(publication_approval_id);

create table accounting.publication_members (
  publication_member_id uuid primary key default gen_random_uuid(),
  publication_id uuid not null unique
    references accounting.publication_releases(publication_id) on delete restrict,
  accounting_version_id uuid not null unique
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  corporation_id uuid not null
    references core.corporation_identities(corporation_id) on delete restrict,
  accounting_period date not null,
  scenario_type text not null
    references accounting.scenario_contracts(scenario_type) on delete restrict,
  version_content_hash text not null,
  validation_cycle_id uuid not null,
  supersedes_member_id uuid null unique
    references accounting.publication_members(publication_member_id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_publication_members_hash_check check (
    version_content_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_publication_members_no_self_supersede check (
    publication_member_id is distinct from supersedes_member_id
  )
);

create index accounting_publication_members_stream_idx
  on accounting.publication_members(corporation_id,accounting_period,scenario_type,recorded_at desc);
create index accounting_publication_members_cycle_idx
  on accounting.publication_members(validation_cycle_id);

create table accounting.comparison_rules (
  comparison_rule_id uuid primary key default gen_random_uuid(),
  rule_code text not null,
  rule_version bigint not null,
  period_shift_months integer not null,
  comparison_scenario text not null,
  selection_policy text not null,
  corporation_continuity text not null,
  store_continuity text not null,
  account_mapping_version text not null,
  effective_from date not null,
  effective_to date null,
  status text not null default 'draft',
  evidence_reference text not null,
  recorded_by text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_comparison_rules_code_check check (
    rule_code ~ '^[a-z][a-z0-9._:-]{0,127}$'
  ),
  constraint accounting_comparison_rules_version_check check (rule_version>0),
  constraint accounting_comparison_rules_shift_check check (period_shift_months between -120 and -1),
  constraint accounting_comparison_rules_scenario_check check (comparison_scenario='actual'),
  constraint accounting_comparison_rules_policy_check check (
    selection_policy in ('published_accounting_confirmed','explicitly_approved')
  ),
  constraint accounting_comparison_rules_continuity_check check (
    corporation_continuity in ('same_canonical','mapping_required')
    and store_continuity in ('same_canonical','mapping_required','not_applicable')
  ),
  constraint accounting_comparison_rules_mapping_check check (
    char_length(btrim(account_mapping_version)) between 1 and 128
  ),
  constraint accounting_comparison_rules_period_check check (
    effective_to is null or effective_from<effective_to
  ),
  constraint accounting_comparison_rules_status_check check (status in ('draft','active','retired')),
  constraint accounting_comparison_rules_evidence_check check (
    evidence_reference ~ '^(approval|evidence|ticket):[A-Za-z0-9][A-Za-z0-9._:/-]{0,247}$'
  ),
  constraint accounting_comparison_rules_actor_check check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_comparison_rules_version_unique unique(rule_code,rule_version)
);

create index accounting_comparison_rules_active_idx
  on accounting.comparison_rules(rule_code,effective_from,effective_to) where status='active';

alter table accounting.audit_events add column publication_id uuid null;
alter table accounting.audit_events add constraint accounting_audit_events_publication_fk
  foreign key(publication_id) references accounting.publication_releases(publication_id) on delete restrict;
create index accounting_audit_events_publication_idx
  on accounting.audit_events(publication_id) where publication_id is not null;

alter table accounting.audit_events drop constraint accounting_audit_events_action_check;
alter table accounting.audit_events add constraint accounting_audit_events_action_check check (action in (
  'validation_result_recorded','validation_passed','validation_failed','approval_recorded','version_approved',
  'publication_recorded','version_published','version_superseded'
));
alter table accounting.audit_events drop constraint accounting_audit_events_state_check;
alter table accounting.audit_events add constraint accounting_audit_events_state_check check (
  previous_state is null or previous_state in ('draft','validating','validated','approved','published','superseded','rejected')
);
alter table accounting.audit_events drop constraint accounting_audit_events_next_state_check;
alter table accounting.audit_events add constraint accounting_audit_events_next_state_check check (
  next_state is null or next_state in ('validating','validated','approved','published','superseded','rejected')
);

create function accounting.guard_m017_publication_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  raise exception 'BDF_M017_PUBLICATION_IMMUTABLE';
end
$function$;

create function accounting.m017_request_fingerprint(
  p_accounting_version_id uuid,
  p_expected_content_hash text,
  p_actor text,
  p_actor_role text,
  p_reason_code text,
  p_evidence_reference text,
  p_correlation_id uuid,
  p_expected_prior_publication_id uuid,
  p_corporation_id uuid,
  p_accounting_period date,
  p_scenario_type text
) returns text
language sql immutable security invoker set search_path=''
as $function$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_accounting_version_id,
      p_expected_content_hash,
      p_actor,
      p_actor_role,
      p_reason_code,
      p_evidence_reference,
      p_correlation_id,
      p_expected_prior_publication_id,
      p_corporation_id,
      p_accounting_period,
      p_scenario_type
    )::text,'UTF8')),
    'hex'
  )
$function$;

create function accounting.m017_required_approval_types(p_accounting_version_id uuid)
returns table(approval_type text)
language sql stable security invoker set search_path=''
as $function$
  select 'accounting_confirmed'::text
  union all select 'publication_approved'
  union all select 'import_validated' where exists (
    select 1 from accounting.accounting_versions v
    where v.accounting_version_id=p_accounting_version_id and v.scenario_type='actual'
  )
  union all select 'operations_confirmed' where exists (
    select 1 from accounting.accounting_facts f
    where f.accounting_version_id=p_accounting_version_id
      and f.organization_scope_type in ('store','department')
    union all
    select 1 from accounting.accounting_allocations a
    join accounting.allocation_sets s on s.allocation_id=a.allocation_id
    where s.derived_accounting_version_id=p_accounting_version_id
      and a.target_scope_type in ('store','department')
  )
  union all select 'adjustment_approved' where exists (
    select 1 from accounting.accounting_versions v
    where v.accounting_version_id=p_accounting_version_id and v.version_type='adjustment'
  )
  union all select 'reversal_approved' where exists (
    select 1 from accounting.accounting_versions v
    where v.accounting_version_id=p_accounting_version_id and v.version_type='reversal'
  );
$function$;

create function accounting.m017_validate_publication_commit()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare p_id uuid; member_count integer; current_count integer; m accounting.publication_members%rowtype;
begin
  p_id:=case when tg_table_name='publication_releases' then new.publication_id else new.publication_id end;
  select count(*) into member_count from accounting.publication_members where publication_id=p_id;
  if member_count<>1 then raise exception 'BDF_M017_RELEASE_MEMBER_COUNT'; end if;
  select * into m from accounting.publication_members where publication_id=p_id;
  if not exists (
    select 1 from accounting.accounting_versions v
    where v.accounting_version_id=m.accounting_version_id
      and v.corporation_id=m.corporation_id and v.period_start=m.accounting_period
      and v.scenario_type=m.scenario_type and v.content_hash=m.version_content_hash
      and v.status in ('published','superseded')
  ) then raise exception 'BDF_M017_MEMBER_VERSION_MISMATCH'; end if;
  select count(*) into current_count
  from accounting.publication_members x
  join accounting.accounting_versions v on v.accounting_version_id=x.accounting_version_id
  where x.corporation_id=m.corporation_id and x.accounting_period=m.accounting_period
    and x.scenario_type=m.scenario_type and v.status='published';
  if current_count<>1 then raise exception 'BDF_M017_CURRENT_PUBLICATION_COUNT'; end if;
  return null;
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
    if not exists (
      select 1 from accounting.publication_members m
      join accounting.publication_releases r on r.publication_id=m.publication_id
      where m.accounting_version_id=old.accounting_version_id
        and m.version_content_hash=old.content_hash and r.published_by=new.published_by
        and r.published_at=new.published_at and r.release_status='published'
    ) then raise exception 'BDF_M017_PUBLICATION_EVIDENCE_REQUIRED'; end if;
    return new;
  end if;
  if old.status='published' and new.status='superseded' then
    if not exists (
      select 1 from accounting.publication_members old_m
      join accounting.publication_members new_m on new_m.supersedes_member_id=old_m.publication_member_id
      join accounting.accounting_versions successor on successor.accounting_version_id=new_m.accounting_version_id
      where old_m.accounting_version_id=old.accounting_version_id
        and successor.corporation_id=old.corporation_id and successor.period_start=old.period_start
        and successor.scenario_type=old.scenario_type and successor.version_sequence>old.version_sequence
    ) then raise exception 'BDF_M017_SUPERSEDE_EVIDENCE_REQUIRED'; end if;
    return new;
  end if;
  raise exception 'BDF_ACCOUNTING_VERSION_INVALID_TRANSITION';
end
$function$;

create function accounting.publish_accounting_version(
  p_accounting_version_id uuid,
  p_actor text,
  p_actor_role text,
  p_reason_code text,
  p_evidence_reference text,
  p_request_key text,
  p_expected_content_hash text,
  p_expected_prior_publication_id uuid,
  p_correlation_id uuid
) returns uuid
language plpgsql security invoker set search_path=''
as $function$
declare v accounting.accounting_versions%rowtype; prior_m accounting.publication_members%rowtype;
  prior_publication uuid; publication_uuid uuid; member_uuid uuid; approval_uuid uuid;
  validation_cycle uuid; required_count integer; pass_count integer; approval_count integer;
  published_time timestamptz:=statement_timestamp(); computed_fingerprint text; request_matches boolean;
begin
  perform accounting.m016_assert_actor(p_actor,p_actor_role,true);
  select * into v from accounting.accounting_versions
  where accounting_version_id=p_accounting_version_id;
  if not found then raise exception 'BDF_M017_ORPHAN_ACCOUNTING_VERSION'; end if;
  computed_fingerprint:=accounting.m017_request_fingerprint(
    p_accounting_version_id,p_expected_content_hash,p_actor,p_actor_role,p_reason_code,
    p_evidence_reference,p_correlation_id,p_expected_prior_publication_id,
    v.corporation_id,v.period_start,v.scenario_type
  );
  perform pg_advisory_xact_lock(hashtextextended(
    v.corporation_id::text||'|'||v.period_start::text||'|'||v.scenario_type,0));
  perform pg_advisory_xact_lock(hashtextextended('m017-request|'||p_request_key,17017));

  select r.publication_id,
    r.request_fingerprint=computed_fingerprint
      and m.accounting_version_id=p_accounting_version_id
      and m.version_content_hash=p_expected_content_hash
      and r.published_by=p_actor
      and r.publisher_role=p_actor_role
      and r.release_reason=p_reason_code
      and r.evidence_reference=p_evidence_reference
      and r.correlation_id=p_correlation_id
      and r.prior_publication_id is not distinct from p_expected_prior_publication_id
      and m.corporation_id=v.corporation_id
      and m.accounting_period=v.period_start
      and m.scenario_type=v.scenario_type
  into publication_uuid,request_matches
  from accounting.publication_releases r
  join accounting.publication_members m on m.publication_id=r.publication_id
  where r.request_key=p_request_key;
  if found then
    if request_matches then return publication_uuid; end if;
    raise exception 'BDF_M017_IDEMPOTENCY_KEY_REUSE_MISMATCH';
  end if;

  select * into v from accounting.accounting_versions
  where accounting_version_id=p_accounting_version_id for update;
  if v.status<>'approved' then raise exception 'BDF_M017_APPROVED_VERSION_REQUIRED'; end if;
  if v.content_hash<>p_expected_content_hash then raise exception 'BDF_M017_STALE_VERSION'; end if;
  if exists (
    select 1 from accounting.accounting_versions newer
    where newer.corporation_id=v.corporation_id and newer.period_start=v.period_start
      and newer.scenario_type=v.scenario_type and newer.version_sequence>v.version_sequence
      and newer.status<>'rejected'
  ) then raise exception 'BDF_M017_STALE_VERSION'; end if;

  select a.validation_cycle_id into validation_cycle
  from accounting.approvals a where a.accounting_version_id=v.accounting_version_id
    and a.approval_type='accounting_confirmed' and a.approval_status='approved'
    and a.version_content_hash=v.content_hash;
  if validation_cycle is null then raise exception 'BDF_M017_APPROVAL_INCOMPLETE'; end if;
  select count(*) into required_count from accounting.m016_required_validation_codes(v.scenario_type);
  select count(*) into pass_count from accounting.validation_results x
  where x.accounting_version_id=v.accounting_version_id and x.validation_cycle_id=validation_cycle
    and x.result_status='pass' and x.actual_value is not null and x.actual_value=x.expected_value
    and x.is_blocking and x.version_content_hash=v.content_hash
    and x.validation_code in (select validation_code from accounting.m016_required_validation_codes(v.scenario_type));
  if pass_count<>required_count then raise exception 'BDF_M017_VALIDATION_INCOMPLETE'; end if;

  select count(*) into required_count from accounting.m017_required_approval_types(v.accounting_version_id);
  select count(*) into approval_count from accounting.approvals a
  where a.accounting_version_id=v.accounting_version_id and a.approval_status='approved'
    and a.version_content_hash=v.content_hash and a.validation_cycle_id=validation_cycle
    and a.approval_type in (select approval_type from accounting.m017_required_approval_types(v.accounting_version_id));
  if approval_count<>required_count then raise exception 'BDF_M017_APPROVAL_INCOMPLETE'; end if;
  select a.approval_id into approval_uuid from accounting.approvals a
  where a.accounting_version_id=v.accounting_version_id and a.approval_type='publication_approved'
    and a.approval_status='approved' and a.version_content_hash=v.content_hash;

  select m.* into prior_m from accounting.publication_members m
  join accounting.accounting_versions pv on pv.accounting_version_id=m.accounting_version_id
  where m.corporation_id=v.corporation_id and m.accounting_period=v.period_start
    and m.scenario_type=v.scenario_type and pv.status='published'
  order by pv.version_sequence desc limit 1;
  prior_publication:=prior_m.publication_id;
  if prior_publication is distinct from p_expected_prior_publication_id then
    raise exception 'BDF_M017_PRIOR_PUBLICATION_MISMATCH';
  end if;

  insert into accounting.publication_releases(
    request_key,request_fingerprint,release_kind,effective_as_of,release_reason,published_at,published_by,publisher_role,
    publication_approval_id,prior_publication_id,reverses_publication_id,evidence_reference,correlation_id
  ) values (
    p_request_key,computed_fingerprint,case when v.version_type='reversal' then 'reversal'
      when v.version_type='adjustment' then 'adjustment' else 'standard' end,
    v.period_end,p_reason_code,published_time,p_actor,p_actor_role,approval_uuid,prior_publication,
    case when v.version_type='reversal' then prior_publication else null end,p_evidence_reference,p_correlation_id
  ) returning publication_id into publication_uuid;
  insert into accounting.publication_members(
    publication_id,accounting_version_id,corporation_id,accounting_period,scenario_type,
    version_content_hash,validation_cycle_id,supersedes_member_id
  ) values (
    publication_uuid,v.accounting_version_id,v.corporation_id,v.period_start,v.scenario_type,
    v.content_hash,validation_cycle,prior_m.publication_member_id
  ) returning publication_member_id into member_uuid;

  if prior_m.accounting_version_id is not null then
    update accounting.accounting_versions set status='superseded'
    where accounting_version_id=prior_m.accounting_version_id;
    insert into accounting.audit_events(
      accounting_version_id,publication_id,action,previous_state,next_state,actor,actor_role,
      reason_code,evidence_reference,version_content_hash,correlation_id
    ) values (prior_m.accounting_version_id,publication_uuid,'version_superseded','published','superseded',
      p_actor,p_actor_role,p_reason_code,p_evidence_reference,prior_m.version_content_hash,p_correlation_id);
  end if;
  update accounting.accounting_versions set status='published',published_at=published_time,published_by=p_actor
  where accounting_version_id=v.accounting_version_id;
  insert into accounting.audit_events(
    accounting_version_id,validation_cycle_id,approval_id,publication_id,action,previous_state,next_state,
    actor,actor_role,reason_code,evidence_reference,version_content_hash,correlation_id
  ) values (v.accounting_version_id,validation_cycle,approval_uuid,publication_uuid,'publication_recorded',
    'approved','published',p_actor,p_actor_role,p_reason_code,p_evidence_reference,v.content_hash,p_correlation_id);
  insert into accounting.audit_events(
    accounting_version_id,validation_cycle_id,approval_id,publication_id,action,previous_state,next_state,
    actor,actor_role,reason_code,evidence_reference,version_content_hash,correlation_id
  ) values (v.accounting_version_id,validation_cycle,approval_uuid,publication_uuid,'version_published',
    'approved','published',p_actor,p_actor_role,p_reason_code,p_evidence_reference,v.content_hash,p_correlation_id);
  return publication_uuid;
end
$function$;

create trigger guard_publication_release_mutation before update or delete on accounting.publication_releases
for each row execute function accounting.guard_m017_publication_mutation();
create trigger guard_publication_member_mutation before update or delete on accounting.publication_members
for each row execute function accounting.guard_m017_publication_mutation();
create trigger guard_comparison_rule_mutation before update or delete on accounting.comparison_rules
for each row execute function accounting.guard_m017_publication_mutation();
create constraint trigger validate_publication_release_commit
after insert on accounting.publication_releases deferrable initially deferred
for each row execute function accounting.m017_validate_publication_commit();
create constraint trigger validate_publication_member_commit
after insert on accounting.publication_members deferrable initially deferred
for each row execute function accounting.m017_validate_publication_commit();

alter table accounting.publication_releases enable row level security;
alter table accounting.publication_releases force row level security;
alter table accounting.publication_members enable row level security;
alter table accounting.publication_members force row level security;
alter table accounting.comparison_rules enable row level security;
alter table accounting.comparison_rules force row level security;

revoke all on accounting.publication_releases from public,anon,authenticated,service_role;
revoke all on accounting.publication_members from public,anon,authenticated,service_role;
revoke all on accounting.comparison_rules from public,anon,authenticated,service_role;
revoke execute on function accounting.guard_m017_publication_mutation() from public,anon,authenticated,service_role;
revoke execute on function accounting.m017_request_fingerprint(uuid,text,text,text,text,text,uuid,uuid,uuid,date,text)
  from public,anon,authenticated,service_role;
revoke execute on function accounting.m017_required_approval_types(uuid) from public,anon,authenticated,service_role;
revoke execute on function accounting.m017_validate_publication_commit() from public,anon,authenticated,service_role;
revoke execute on function accounting.publish_accounting_version(uuid,text,text,text,text,text,text,uuid,uuid)
  from public,anon,authenticated,service_role;
