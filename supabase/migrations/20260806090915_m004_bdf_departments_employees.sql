-- PR001-A / M004
-- Canonical department/employee identities and minimal immutable rows.

create table core.department_identities (
  department_id uuid primary key,
  entity_type text not null default 'department',
  identity_status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz null,
  merged_into_id uuid null references core.department_identities(department_id) on delete restrict,
  constraint department_identities_registry_fk foreign key (department_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint department_identities_type_check check (entity_type = 'department'),
  constraint department_identities_status_check check (identity_status in ('active', 'merged', 'retired')),
  constraint department_identities_merge_check check (
    (identity_status = 'merged' and merged_into_id is not null and merged_into_id <> department_id)
    or (identity_status <> 'merged' and merged_into_id is null)
  ),
  constraint department_identities_retired_check check (
    (identity_status = 'retired' and retired_at is not null) or identity_status <> 'retired'
  )
);
create index department_identities_merged_into_idx on core.department_identities (merged_into_id);

create table core.departments (
  department_version_id uuid primary key,
  department_id uuid not null references core.department_identities(department_id) on delete restrict,
  entity_type text not null default 'department',
  department_code text not null,
  display_name text not null,
  corporation_id uuid not null references core.corporation_identities(corporation_id) on delete restrict,
  parent_department_id uuid null references core.department_identities(department_id) on delete restrict,
  status text not null,
  effective_from date not null,
  effective_to date null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint departments_registry_fk foreign key (
    department_version_id, department_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint departments_type_check check (entity_type = 'department'),
  constraint departments_code_nonblank check (btrim(department_code) <> ''),
  constraint departments_display_name_nonblank check (btrim(display_name) <> ''),
  constraint departments_status_check check (status in ('active', 'inactive', 'future', 'unknown')),
  constraint departments_not_self_parent check (parent_department_id is null or parent_department_id <> department_id),
  constraint departments_valid_interval check (effective_to is null or effective_to > effective_from),
  constraint departments_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint departments_identity_start_unique unique (department_id, effective_from),
  constraint departments_code_start_unique unique (corporation_id, department_code, effective_from),
  constraint departments_period_excl exclude using gist (
    department_id with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);
create index departments_identity_asof_idx on core.departments (department_id, effective_from desc, effective_to);
create index departments_corporation_idx on core.departments (corporation_id);
create index departments_parent_idx on core.departments (parent_department_id);
create index departments_status_asof_idx on core.departments (status, effective_from, effective_to);
create index departments_snapshot_idx on core.departments (source_snapshot_id);

create table core.employee_identities (
  employee_id uuid primary key,
  entity_type text not null default 'employee',
  identity_status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz null,
  merged_into_id uuid null references core.employee_identities(employee_id) on delete restrict,
  constraint employee_identities_registry_fk foreign key (employee_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint employee_identities_type_check check (entity_type = 'employee'),
  constraint employee_identities_status_check check (identity_status in ('active', 'merged', 'retired')),
  constraint employee_identities_merge_check check (
    (identity_status = 'merged' and merged_into_id is not null and merged_into_id <> employee_id)
    or (identity_status <> 'merged' and merged_into_id is null)
  ),
  constraint employee_identities_retired_check check (
    (identity_status = 'retired' and retired_at is not null) or identity_status <> 'retired'
  )
);
create index employee_identities_merged_into_idx on core.employee_identities (merged_into_id);

create table core.employees (
  employee_version_id uuid primary key,
  employee_id uuid not null references core.employee_identities(employee_id) on delete restrict,
  entity_type text not null default 'employee',
  display_alias text not null,
  status text not null,
  primary_department_id uuid null references core.department_identities(department_id) on delete restrict,
  effective_from date not null,
  effective_to date null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint employees_registry_fk foreign key (
    employee_version_id, employee_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint employees_type_check check (entity_type = 'employee'),
  constraint employees_alias_nonblank check (btrim(display_alias) <> ''),
  constraint employees_status_check check (status in ('active', 'leave', 'inactive', 'retired', 'unknown')),
  constraint employees_valid_interval check (effective_to is null or effective_to > effective_from),
  constraint employees_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint employees_identity_start_unique unique (employee_id, effective_from),
  constraint employees_period_excl exclude using gist (
    employee_id with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);
create index employees_identity_asof_idx on core.employees (employee_id, effective_from desc, effective_to);
create index employees_department_idx on core.employees (primary_department_id);
create index employees_status_asof_idx on core.employees (status, effective_from, effective_to);
create index employees_snapshot_idx on core.employees (source_snapshot_id);

comment on table core.employees is
  'Minimal Staging employee identity only. Production names, email, auth UID, phone, address, payroll, tax, insurance, family, and documents are prohibited.';
