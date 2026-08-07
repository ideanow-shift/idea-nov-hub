-- PR001-B1 / M011
-- Snapshot Metadata Foundation. No data load and no Consumer exposure.

do $preflight$
begin
  if exists (select 1 from governance.master_source_snapshots) then
    raise exception 'BDF_B1_REQUIRES_EMPTY_SNAPSHOT_HEADER';
  end if;
end
$preflight$;

alter table governance.master_source_snapshots
  add column total_record_count bigint not null,
  add column approval_reference text not null,
  add column created_by text not null;

alter table governance.master_source_snapshots
  add constraint master_source_snapshots_total_count_nonnegative
    check (total_record_count >= 0),
  add constraint master_source_snapshots_approval_reference_format
    check (
      char_length(approval_reference) between 3 and 256
      and approval_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    ),
  add constraint master_source_snapshots_created_by_actor_ref
    check (
      char_length(created_by) between 3 and 256
      and created_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    );

comment on column governance.master_source_snapshots.total_record_count is
  'Total normalized record count. Must equal the sum of the five Master manifests.';
comment on column governance.master_source_snapshots.approval_reference is
  'Non-secret approval packet reference. Detailed decisions are append-only rows.';
comment on column governance.master_source_snapshots.created_by is
  'Canonical or audit actor reference. Production employee IDs and credentials are prohibited.';

create table governance.snapshot_master_manifests (
  source_snapshot_id uuid not null
    references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  master_type text not null,
  record_count bigint not null,
  content_hash text not null,
  schema_version text not null,
  source_extract_version text not null,
  masking_status text not null,
  mapping_status text not null,
  validation_status text not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (source_snapshot_id, master_type),
  constraint snapshot_master_manifests_master_type_check check (
    master_type in (
      'corporations',
      'stores',
      'departments',
      'employees',
      'employee_store_assignments'
    )
  ),
  constraint snapshot_master_manifests_record_count_nonnegative check (record_count >= 0),
  constraint snapshot_master_manifests_hash_format check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint snapshot_master_manifests_schema_version_nonblank check (btrim(schema_version) <> ''),
  constraint snapshot_master_manifests_extract_version_nonblank check (btrim(source_extract_version) <> ''),
  constraint snapshot_master_manifests_masking_status_check check (
    masking_status in ('pending', 'passed', 'failed')
  ),
  constraint snapshot_master_manifests_mapping_status_check check (
    mapping_status in ('pending', 'passed', 'failed')
  ),
  constraint snapshot_master_manifests_validation_status_check check (
    validation_status in ('pending', 'passed', 'failed')
  )
);

create index snapshot_master_manifests_status_idx
  on governance.snapshot_master_manifests (
    source_snapshot_id,
    validation_status,
    masking_status,
    mapping_status
  );

create table governance.snapshot_approvals (
  snapshot_approval_id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null
    references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  approval_type text not null,
  approval_reference text not null,
  approved_by text not null,
  approved_at timestamptz not null,
  approval_status text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint snapshot_approvals_type_check check (
    approval_type in ('data_owner', 'security_privacy', 'platform_db', 'store_operations')
  ),
  constraint snapshot_approvals_reference_format check (
    char_length(approval_reference) between 3 and 256
    and approval_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint snapshot_approvals_actor_ref check (
    char_length(approved_by) between 3 and 256
    and approved_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint snapshot_approvals_status_check check (
    approval_status in ('approved', 'rejected')
  ),
  constraint snapshot_approvals_type_unique unique (source_snapshot_id, approval_type)
);

create index snapshot_approvals_status_idx
  on governance.snapshot_approvals (source_snapshot_id, approval_status, approval_type);

create table governance.snapshot_validation_results (
  snapshot_validation_result_id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null
    references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  master_type text not null,
  validation_code text not null,
  validation_status text not null,
  expected_value text not null,
  actual_value text not null,
  checked_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint snapshot_validation_results_master_type_check check (
    master_type in (
      'corporations',
      'stores',
      'departments',
      'employees',
      'employee_store_assignments'
    )
  ),
  constraint snapshot_validation_results_code_check check (
    validation_code in (
      'HASH_MATCH',
      'RECORD_COUNT_MATCH',
      'SCHEMA_MATCH',
      'MASKING_POLICY_MATCH',
      'MAPPING_CONTRACT_MATCH'
    )
  ),
  constraint snapshot_validation_results_status_check check (
    validation_status in ('passed', 'failed')
  ),
  constraint snapshot_validation_results_safe_values check (
    case validation_code
      when 'HASH_MATCH' then
        expected_value ~ '^sha256:[0-9a-f]{64}$'
        and actual_value ~ '^sha256:[0-9a-f]{64}$'
      when 'RECORD_COUNT_MATCH' then
        expected_value ~ '^count:[0-9]+$'
        and actual_value ~ '^count:[0-9]+$'
      else
        expected_value ~ '^version:[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
        and actual_value ~ '^version:[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    end
  ),
  constraint snapshot_validation_results_unique unique (
    source_snapshot_id,
    master_type,
    validation_code
  )
);

create index snapshot_validation_results_status_idx
  on governance.snapshot_validation_results (
    source_snapshot_id,
    validation_status,
    master_type
  );

comment on table governance.snapshot_validation_results is
  'Append-only validation facts. Raw records, PII, credentials, host names, and secrets are prohibited.';
comment on column governance.snapshot_validation_results.expected_value is
  'Typed safe scalar only: sha256:, count:, or version:. Never raw source data or PII.';
comment on column governance.snapshot_validation_results.actual_value is
  'Typed safe scalar only: sha256:, count:, or version:. Never raw source data or PII.';

create function governance.guard_snapshot_child_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  parent_status text;
begin
  select status into parent_status
  from governance.master_source_snapshots
  where source_snapshot_id = new.source_snapshot_id;

  if parent_status is null then
    raise exception 'BDF_SNAPSHOT_METADATA_PARENT_NOT_FOUND';
  end if;
  if parent_status not in ('candidate', 'validated') then
    raise exception 'BDF_SNAPSHOT_METADATA_PARENT_IMMUTABLE';
  end if;
  return new;
end
$function$;

create function governance.assert_snapshot_activation_ready(p_snapshot_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  header governance.master_source_snapshots%rowtype;
  manifest_count integer;
  manifest_record_count bigint;
  passed_validation_count integer;
  approved_type_count integer;
begin
  select * into header
  from governance.master_source_snapshots
  where source_snapshot_id = p_snapshot_id;

  if not found then
    raise exception 'BDF_SNAPSHOT_NOT_FOUND';
  end if;

  select count(*), coalesce(sum(record_count), 0)
    into manifest_count, manifest_record_count
  from governance.snapshot_master_manifests
  where source_snapshot_id = p_snapshot_id
    and masking_status = 'passed'
    and mapping_status = 'passed'
    and validation_status = 'passed';

  if manifest_count <> 5 then
    raise exception 'BDF_SNAPSHOT_REQUIRES_FIVE_PASSED_MANIFESTS';
  end if;
  if manifest_record_count <> header.total_record_count then
    raise exception 'BDF_SNAPSHOT_TOTAL_RECORD_COUNT_MISMATCH';
  end if;

  select count(*) into passed_validation_count
  from governance.snapshot_validation_results
  where source_snapshot_id = p_snapshot_id
    and validation_status = 'passed';

  if passed_validation_count <> 25 then
    raise exception 'BDF_SNAPSHOT_REQUIRES_ALL_MASTER_VALIDATIONS';
  end if;

  if exists (
    select 1 from governance.snapshot_validation_results
    where source_snapshot_id = p_snapshot_id
      and validation_status = 'failed'
  ) then
    raise exception 'BDF_SNAPSHOT_HAS_FAILED_VALIDATION';
  end if;

  select count(*) into approved_type_count
  from governance.snapshot_approvals
  where source_snapshot_id = p_snapshot_id
    and approval_status = 'approved';

  if approved_type_count <> 4 then
    raise exception 'BDF_SNAPSHOT_APPROVAL_INCOMPLETE';
  end if;
  if exists (
    select 1 from governance.snapshot_approvals
    where source_snapshot_id = p_snapshot_id
      and approval_status = 'rejected'
  ) then
    raise exception 'BDF_SNAPSHOT_APPROVAL_REJECTED';
  end if;
end
$function$;

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
  if new.status = 'activated' then
    perform governance.assert_snapshot_activation_ready(new.source_snapshot_id);
  end if;
  return new;
end
$function$;

create trigger guard_snapshot_master_manifest_insert
before insert on governance.snapshot_master_manifests
for each row execute function governance.guard_snapshot_child_insert();
create trigger reject_snapshot_master_manifest_mutation
before update or delete on governance.snapshot_master_manifests
for each row execute function governance.reject_immutable_mutation();

create trigger guard_snapshot_approval_insert
before insert on governance.snapshot_approvals
for each row execute function governance.guard_snapshot_child_insert();
create trigger reject_snapshot_approval_mutation
before update or delete on governance.snapshot_approvals
for each row execute function governance.reject_immutable_mutation();

create trigger guard_snapshot_validation_result_insert
before insert on governance.snapshot_validation_results
for each row execute function governance.guard_snapshot_child_insert();
create trigger reject_snapshot_validation_result_mutation
before update or delete on governance.snapshot_validation_results
for each row execute function governance.reject_immutable_mutation();

alter table governance.snapshot_master_manifests enable row level security;
alter table governance.snapshot_master_manifests force row level security;
alter table governance.snapshot_approvals enable row level security;
alter table governance.snapshot_approvals force row level security;
alter table governance.snapshot_validation_results enable row level security;
alter table governance.snapshot_validation_results force row level security;

revoke all on table governance.snapshot_master_manifests
  from public, anon, authenticated, service_role;
revoke all on table governance.snapshot_approvals
  from public, anon, authenticated, service_role;
revoke all on table governance.snapshot_validation_results
  from public, anon, authenticated, service_role;
revoke execute on function governance.guard_snapshot_child_insert()
  from public, anon, authenticated, service_role;
revoke execute on function governance.assert_snapshot_activation_ready(uuid)
  from public, anon, authenticated, service_role;
