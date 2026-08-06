-- PR001-A / M005
-- Store Scope canon: effective-dated employee/store assignments.

create table core.assignment_identities (
  assignment_id uuid primary key,
  entity_type text not null default 'assignment',
  identity_status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz null,
  merged_into_id uuid null references core.assignment_identities(assignment_id) on delete restrict,
  constraint assignment_identities_registry_fk foreign key (assignment_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint assignment_identities_type_check check (entity_type = 'assignment'),
  constraint assignment_identities_status_check check (identity_status in ('active', 'merged', 'retired')),
  constraint assignment_identities_merge_check check (
    (identity_status = 'merged' and merged_into_id is not null and merged_into_id <> assignment_id)
    or (identity_status <> 'merged' and merged_into_id is null)
  ),
  constraint assignment_identities_retired_check check (
    (identity_status = 'retired' and retired_at is not null) or identity_status <> 'retired'
  )
);
create index assignment_identities_merged_into_idx on core.assignment_identities (merged_into_id);

create table core.employee_store_assignments (
  assignment_version_id uuid primary key,
  assignment_id uuid not null references core.assignment_identities(assignment_id) on delete restrict,
  entity_type text not null default 'assignment',
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  store_id uuid not null references core.store_identities(store_id) on delete restrict,
  assignment_role_code text not null,
  assignment_kind text not null,
  allocation_ratio numeric(7,6) null,
  effective_from date not null,
  effective_to date null,
  status text not null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint employee_store_assignments_registry_fk foreign key (
    assignment_version_id, assignment_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint employee_store_assignments_type_check check (entity_type = 'assignment'),
  constraint employee_store_assignments_role_nonblank check (btrim(assignment_role_code) <> ''),
  constraint employee_store_assignments_kind_check check (
    assignment_kind in ('primary', 'secondary', 'temporary', 'support')
  ),
  constraint employee_store_assignments_status_check check (status in ('pending', 'active', 'inactive')),
  constraint employee_store_assignments_allocation_check check (
    allocation_ratio is null or (allocation_ratio > 0 and allocation_ratio <= 1)
  ),
  constraint employee_store_assignments_valid_interval check (effective_to is null or effective_to > effective_from),
  constraint employee_store_assignments_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint employee_store_assignments_identity_start_unique unique (assignment_id, effective_from),
  constraint employee_store_assignments_identity_period_excl exclude using gist (
    assignment_id with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  ),
  constraint employee_store_assignments_primary_period_excl exclude using gist (
    employee_id with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  ) where (assignment_kind = 'primary' and status = 'active'),
  constraint employee_store_assignments_semantic_period_excl exclude using gist (
    employee_id with =,
    store_id with =,
    assignment_role_code with =,
    assignment_kind with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);
create index employee_store_assignments_employee_asof_idx
  on core.employee_store_assignments (employee_id, effective_from desc, effective_to);
create index employee_store_assignments_store_asof_idx
  on core.employee_store_assignments (store_id, effective_from desc, effective_to);
create index employee_store_assignments_store_role_idx
  on core.employee_store_assignments (store_id, assignment_role_code);
create index employee_store_assignments_snapshot_idx
  on core.employee_store_assignments (source_snapshot_id);
