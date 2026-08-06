-- PR001-A / M002
-- Snapshot metadata, canonical source envelope, and private crosswalk.

create table governance.master_source_snapshots (
  source_snapshot_id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_environment text not null,
  source_version text not null,
  snapshot_version text not null,
  source_as_of timestamptz not null,
  content_digest text not null,
  mapping_contract_version text not null,
  masking_policy_version text not null,
  status text not null default 'candidate',
  parent_source_snapshot_id uuid null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint master_source_snapshots_source_system_nonblank check (btrim(source_system) <> ''),
  constraint master_source_snapshots_source_version_nonblank check (btrim(source_version) <> ''),
  constraint master_source_snapshots_snapshot_version_nonblank check (btrim(snapshot_version) <> ''),
  constraint master_source_snapshots_digest_format check (content_digest ~ '^[0-9a-f]{64}$'),
  constraint master_source_snapshots_status_check check (
    status in ('candidate', 'validated', 'activated', 'rejected', 'superseded')
  ),
  constraint master_source_snapshots_source_version_unique unique (
    source_system,
    source_version,
    mapping_contract_version,
    masking_policy_version
  ),
  constraint master_source_snapshots_snapshot_version_unique unique (source_system, snapshot_version),
  constraint master_source_snapshots_content_unique unique (
    source_system,
    content_digest,
    mapping_contract_version,
    masking_policy_version
  )
);

create index master_source_snapshots_status_as_of_idx
  on governance.master_source_snapshots (status, source_as_of desc);
create index master_source_snapshots_parent_idx
  on governance.master_source_snapshots (parent_source_snapshot_id);

create table governance.canonical_entity_registry (
  canonical_entity_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint canonical_entity_registry_type_check check (
    entity_type in ('corporation', 'store', 'department', 'employee', 'assignment', 'corporation_store_relationship')
  ),
  constraint canonical_entity_registry_identity_unique unique (canonical_entity_id, entity_type)
);

create table governance.canonical_version_registry (
  entity_version_id uuid primary key default gen_random_uuid(),
  canonical_entity_id uuid not null,
  entity_type text not null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint canonical_version_registry_entity_fk foreign key (canonical_entity_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint canonical_version_registry_identity_unique unique (
    entity_version_id,
    canonical_entity_id,
    entity_type,
    source_snapshot_id
  )
);
create index canonical_version_registry_entity_idx
  on governance.canonical_version_registry (entity_type, canonical_entity_id);
create index canonical_version_registry_snapshot_idx
  on governance.canonical_version_registry (source_snapshot_id);

create table governance.source_entity_crosswalks (
  crosswalk_version_id uuid primary key default gen_random_uuid(),
  canonical_entity_id uuid not null,
  entity_type text not null,
  source_system text not null,
  source_record_key text not null,
  source_version text not null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  valid_from date not null,
  valid_to date null,
  mapping_contract_version text not null,
  masking_policy_version text not null,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint source_entity_crosswalks_canonical_fk foreign key (canonical_entity_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint source_entity_crosswalks_entity_type_check check (
    entity_type in ('corporation', 'store', 'department', 'employee', 'assignment')
  ),
  constraint source_entity_crosswalks_source_system_nonblank check (btrim(source_system) <> ''),
  constraint source_entity_crosswalks_record_key_nonblank check (btrim(source_record_key) <> ''),
  constraint source_entity_crosswalks_source_version_nonblank check (btrim(source_version) <> ''),
  constraint source_entity_crosswalks_valid_interval check (valid_to is null or valid_to > valid_from),
  constraint source_entity_crosswalks_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint source_entity_crosswalks_source_version_unique unique (
    source_system,
    entity_type,
    source_record_key,
    source_version
  ),
  constraint source_entity_crosswalks_period_excl exclude using gist (
    source_system with =,
    entity_type with =,
    source_record_key with =,
    source_snapshot_id with =,
    daterange(valid_from, valid_to, '[)') with &&
  )
);

create index source_entity_crosswalks_canonical_idx
  on governance.source_entity_crosswalks (entity_type, canonical_entity_id, valid_from desc);
create index source_entity_crosswalks_snapshot_idx
  on governance.source_entity_crosswalks (source_snapshot_id);

comment on column governance.source_entity_crosswalks.source_record_key is
  'Private masked or pseudonymized source key. Never expose through Consumer APIs.';
