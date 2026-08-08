-- M016-only rollback. M015/M063 and earlier history remain intact; drops are explicit.

drop trigger guard_audit_event_mutation on accounting.audit_events;
drop trigger guard_approval_mutation on accounting.approvals;
drop trigger guard_validation_result_mutation on accounting.validation_results;

drop function accounting.record_accounting_approval(uuid,uuid,text,text,text,text,text,text,text,uuid);
drop function accounting.finalize_accounting_validation(uuid,uuid,text,text,text,text,text,uuid);
drop function accounting.record_accounting_validation(uuid,uuid,text,text,text,text,text,text,uuid);
drop function accounting.m016_validation_violation_count(uuid,text);
drop function accounting.m016_assert_actor(text,text,boolean);
drop function accounting.m016_required_validation_codes(text);
drop function accounting.guard_m016_evidence_mutation();

create or replace function accounting.guard_accounting_version_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
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
  if old.status='validating' and new.status='validated' then
    raise exception 'BDF_ACCOUNTING_VALIDATION_NOT_AVAILABLE_BEFORE_M016';
  end if;
  if old.status='validated' and new.status='approved' then
    raise exception 'BDF_ACCOUNTING_APPROVAL_NOT_AVAILABLE_BEFORE_M016';
  end if;
  if old.status='approved' and new.status='published' then
    raise exception 'BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017';
  end if;
  raise exception 'BDF_ACCOUNTING_VERSION_INVALID_TRANSITION';
end
$function$;

drop table accounting.audit_events;
drop table accounting.approvals;
drop table accounting.validation_results;
