-- PR001-A / M003
-- Canonical corporation/store identities and immutable effective-dated rows.

create table core.corporation_identities (
  corporation_id uuid primary key,
  entity_type text not null default 'corporation',
  identity_status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz null,
  merged_into_id uuid null references core.corporation_identities(corporation_id) on delete restrict,
  constraint corporation_identities_registry_fk foreign key (corporation_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint corporation_identities_type_check check (entity_type = 'corporation'),
  constraint corporation_identities_status_check check (identity_status in ('active', 'merged', 'retired')),
  constraint corporation_identities_merge_check check (
    (identity_status = 'merged' and merged_into_id is not null and merged_into_id <> corporation_id)
    or (identity_status <> 'merged' and merged_into_id is null)
  ),
  constraint corporation_identities_retired_check check (
    (identity_status = 'retired' and retired_at is not null) or identity_status <> 'retired'
  )
);
create index corporation_identities_merged_into_idx on core.corporation_identities (merged_into_id);

create table core.corporations (
  corporation_version_id uuid primary key,
  corporation_id uuid not null references core.corporation_identities(corporation_id) on delete restrict,
  entity_type text not null default 'corporation',
  corporation_code text not null,
  legal_name text null,
  display_name text not null,
  status text not null,
  effective_from date not null,
  effective_to date null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint corporations_registry_fk foreign key (
    corporation_version_id, corporation_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint corporations_type_check check (entity_type = 'corporation'),
  constraint corporations_code_nonblank check (btrim(corporation_code) <> ''),
  constraint corporations_display_name_nonblank check (btrim(display_name) <> ''),
  constraint corporations_status_check check (status in ('active', 'inactive', 'future', 'unknown')),
  constraint corporations_valid_interval check (effective_to is null or effective_to > effective_from),
  constraint corporations_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint corporations_identity_start_unique unique (corporation_id, effective_from),
  constraint corporations_code_start_unique unique (corporation_code, effective_from),
  constraint corporations_period_excl exclude using gist (
    corporation_id with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);
create index corporations_identity_asof_idx on core.corporations (corporation_id, effective_from desc, effective_to);
create index corporations_status_asof_idx on core.corporations (status, effective_from, effective_to);
create index corporations_snapshot_idx on core.corporations (source_snapshot_id);

create table core.store_identities (
  store_id uuid primary key,
  entity_type text not null default 'store',
  identity_status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz null,
  merged_into_id uuid null references core.store_identities(store_id) on delete restrict,
  constraint store_identities_registry_fk foreign key (store_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint store_identities_type_check check (entity_type = 'store'),
  constraint store_identities_status_check check (identity_status in ('active', 'merged', 'retired')),
  constraint store_identities_merge_check check (
    (identity_status = 'merged' and merged_into_id is not null and merged_into_id <> store_id)
    or (identity_status <> 'merged' and merged_into_id is null)
  ),
  constraint store_identities_retired_check check (
    (identity_status = 'retired' and retired_at is not null) or identity_status <> 'retired'
  )
);
create index store_identities_merged_into_idx on core.store_identities (merged_into_id);

create table core.stores (
  store_version_id uuid primary key,
  store_id uuid not null references core.store_identities(store_id) on delete restrict,
  entity_type text not null default 'store',
  store_code text not null,
  display_name text not null,
  status text not null,
  opened_on date null,
  closed_on date null,
  business_timezone text not null default 'Asia/Tokyo',
  effective_from date not null,
  effective_to date null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint stores_registry_fk foreign key (
    store_version_id, store_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint stores_type_check check (entity_type = 'store'),
  constraint stores_code_nonblank check (btrim(store_code) <> ''),
  constraint stores_display_name_nonblank check (btrim(display_name) <> ''),
  constraint stores_status_check check (status in ('active', 'inactive', 'closed', 'future', 'unknown')),
  constraint stores_lifecycle_dates check (closed_on is null or opened_on is null or closed_on >= opened_on),
  constraint stores_valid_interval check (effective_to is null or effective_to > effective_from),
  constraint stores_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint stores_identity_start_unique unique (store_id, effective_from),
  constraint stores_code_start_unique unique (store_code, effective_from),
  constraint stores_period_excl exclude using gist (
    store_id with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);
create index stores_identity_asof_idx on core.stores (store_id, effective_from desc, effective_to);
create index stores_status_asof_idx on core.stores (status, effective_from, effective_to);
create index stores_snapshot_idx on core.stores (source_snapshot_id);
