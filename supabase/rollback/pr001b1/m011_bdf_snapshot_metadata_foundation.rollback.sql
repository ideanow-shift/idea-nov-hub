-- PR001-B1 / M011 rollback. Run only before any Snapshot publication.
-- Dependency-expanding drops are forbidden. Existing PR001 objects are preserved.

drop trigger reject_snapshot_validation_result_mutation
  on governance.snapshot_validation_results;
drop trigger guard_snapshot_validation_result_insert
  on governance.snapshot_validation_results;
drop trigger reject_snapshot_approval_mutation
  on governance.snapshot_approvals;
drop trigger guard_snapshot_approval_insert
  on governance.snapshot_approvals;
drop trigger reject_snapshot_master_manifest_mutation
  on governance.snapshot_master_manifests;
drop trigger guard_snapshot_master_manifest_insert
  on governance.snapshot_master_manifests;

drop function governance.assert_snapshot_activation_ready(uuid);
drop function governance.guard_snapshot_child_insert();

drop table governance.snapshot_validation_results;
drop table governance.snapshot_approvals;
drop table governance.snapshot_master_manifests;

create or replace function governance.guard_snapshot_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'BDF_SNAPSHOT_DELETE_FORBIDDEN';
  end if;
  if old.status not in ('candidate', 'validated') then
    raise exception 'BDF_SNAPSHOT_CONFIRMED_IMMUTABLE';
  end if;
  if (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
    raise exception 'BDF_SNAPSHOT_CONTENT_IMMUTABLE';
  end if;
  if not (
    (old.status = 'candidate' and new.status in ('validated', 'rejected'))
    or (old.status = 'validated' and new.status in ('activated', 'rejected'))
  ) then
    raise exception 'BDF_SNAPSHOT_INVALID_TRANSITION';
  end if;
  return new;
end
$function$;

alter table governance.master_source_snapshots
  drop constraint master_source_snapshots_created_by_actor_ref,
  drop constraint master_source_snapshots_approval_reference_format,
  drop constraint master_source_snapshots_total_count_nonnegative,
  drop column created_by,
  drop column approval_reference,
  drop column total_record_count;
