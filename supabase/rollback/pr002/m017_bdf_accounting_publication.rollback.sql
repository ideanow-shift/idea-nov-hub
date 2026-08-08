-- M017-only rollback. M016 and every earlier baseline object remain intact.

drop trigger validate_publication_member_commit on accounting.publication_members;
drop trigger validate_publication_release_commit on accounting.publication_releases;
drop trigger guard_comparison_rule_mutation on accounting.comparison_rules;
drop trigger guard_publication_member_mutation on accounting.publication_members;
drop trigger guard_publication_release_mutation on accounting.publication_releases;

drop function accounting.publish_accounting_version(uuid,text,text,text,text,text,text,uuid,uuid);
drop function accounting.m017_validate_publication_commit();
drop function accounting.m017_required_approval_types(uuid);
drop function accounting.guard_m017_publication_mutation();

drop index accounting.accounting_audit_events_publication_idx;
alter table accounting.audit_events drop constraint accounting_audit_events_publication_fk;
alter table accounting.audit_events drop column publication_id;
alter table accounting.audit_events drop constraint accounting_audit_events_action_check;
alter table accounting.audit_events add constraint accounting_audit_events_action_check check (action in (
  'validation_result_recorded','validation_passed','validation_failed',
  'approval_recorded','version_approved'
));
alter table accounting.audit_events drop constraint accounting_audit_events_state_check;
alter table accounting.audit_events add constraint accounting_audit_events_state_check check (
  previous_state is null or previous_state in ('draft','validating','validated','approved','rejected')
);
alter table accounting.audit_events drop constraint accounting_audit_events_next_state_check;
alter table accounting.audit_events add constraint accounting_audit_events_next_state_check check (
  next_state is null or next_state in ('validating','validated','approved','rejected')
);

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

drop table accounting.publication_members;
drop table accounting.publication_releases;
drop table accounting.comparison_rules;
