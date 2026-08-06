-- PR001-A / M006
-- Corporation/store operating relationships and Human Review-gated population.

create table core.corporation_store_relationship_identities (
  relationship_id uuid primary key,
  entity_type text not null default 'corporation_store_relationship',
  created_at timestamptz not null default statement_timestamp(),
  constraint corporation_store_relationship_identities_registry_fk foreign key (relationship_id, entity_type)
    references governance.canonical_entity_registry(canonical_entity_id, entity_type) on delete restrict,
  constraint corporation_store_relationship_identities_type_check check (
    entity_type = 'corporation_store_relationship'
  )
);

create table core.corporation_store_relationships (
  relationship_version_id uuid primary key,
  relationship_id uuid not null references core.corporation_store_relationship_identities(relationship_id) on delete restrict,
  entity_type text not null default 'corporation_store_relationship',
  store_id uuid not null references core.store_identities(store_id) on delete restrict,
  corporation_id uuid not null references core.corporation_identities(corporation_id) on delete restrict,
  relationship_type text not null,
  operating_model text not null,
  effective_from date not null,
  effective_to date null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_record_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint corporation_store_relationships_registry_fk foreign key (
    relationship_version_id, relationship_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint corporation_store_relationships_entity_type_check check (
    entity_type = 'corporation_store_relationship'
  ),
  constraint corporation_store_relationships_type_check check (
    relationship_type in ('owner', 'operator', 'employer', 'sales', 'accounting')
  ),
  constraint corporation_store_relationships_model_check check (
    operating_model in ('direct', 'franchise', 'other', 'unresolved')
  ),
  constraint corporation_store_relationships_valid_interval check (effective_to is null or effective_to > effective_from),
  constraint corporation_store_relationships_digest_format check (source_record_digest ~ '^[0-9a-f]{64}$'),
  constraint corporation_store_relationships_period_excl exclude using gist (
    store_id with =,
    relationship_type with =,
    source_snapshot_id with =,
    daterange(effective_from, effective_to, '[)') with &&
  )
);
create index corporation_store_relationships_store_idx
  on core.corporation_store_relationships (store_id, effective_from desc, effective_to);
create index corporation_store_relationships_corporation_idx
  on core.corporation_store_relationships (corporation_id, effective_from desc, effective_to);
create index corporation_store_relationships_model_idx
  on core.corporation_store_relationships (operating_model);
create index corporation_store_relationships_snapshot_idx
  on core.corporation_store_relationships (source_snapshot_id);

create table governance.store_population_versions (
  population_version_id uuid primary key default gen_random_uuid(),
  version_code text not null unique,
  status text not null default 'draft',
  as_of date not null,
  expected_official_count integer not null default 20,
  expected_direct_count integer not null default 13,
  expected_franchise_count integer not null default 7,
  expected_item_count integer not null default 20,
  approved_by_ref text null,
  approved_at timestamptz null,
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  content_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint store_population_versions_code_nonblank check (btrim(version_code) <> ''),
  constraint store_population_versions_status_check check (
    status in ('draft', 'validated', 'approved', 'published', 'superseded')
  ),
  constraint store_population_versions_counts_check check (
    expected_official_count >= 0
    and expected_direct_count >= 0
    and expected_franchise_count >= 0
    and expected_item_count >= expected_official_count
    and expected_direct_count + expected_franchise_count = expected_official_count
  ),
  constraint store_population_versions_approval_check check (
    status not in ('approved', 'published', 'superseded')
    or (approved_by_ref is not null and approved_at is not null)
  ),
  constraint store_population_versions_digest_format check (content_digest ~ '^[0-9a-f]{64}$')
);
create index store_population_versions_status_asof_idx
  on governance.store_population_versions (status, as_of desc);
create index store_population_versions_snapshot_idx
  on governance.store_population_versions (source_snapshot_id);
create table governance.store_population_items (
  population_version_id uuid not null references governance.store_population_versions(population_version_id) on delete restrict,
  store_id uuid not null references core.store_identities(store_id) on delete restrict,
  classification text not null,
  operating_model text not null,
  in_official_population boolean not null default false,
  review_status text not null default 'pending_review',
  reason_code text not null,
  reviewed_by_ref text null,
  reviewed_at timestamptz null,
  valid_from date not null,
  valid_to date null,
  recorded_at timestamptz not null default statement_timestamp(),
  primary key (population_version_id, store_id),
  constraint store_population_items_classification_check check (
    classification in ('official_operating', 'pending_review', 'excluded', 'non_operational', 'unresolved')
  ),
  constraint store_population_items_model_check check (
    operating_model in ('direct', 'franchise', 'other', 'unresolved')
  ),
  constraint store_population_items_review_status_check check (
    review_status in ('pending_review', 'approved', 'rejected')
  ),
  constraint store_population_items_reason_nonblank check (btrim(reason_code) <> ''),
  constraint store_population_items_valid_interval check (valid_to is null or valid_to > valid_from),
  constraint store_population_items_official_check check (
    not in_official_population
    or (
      classification = 'official_operating'
      and operating_model in ('direct', 'franchise')
      and review_status = 'approved'
      and reviewed_by_ref is not null
      and reviewed_at is not null
    )
  )
);
create index store_population_items_store_idx on governance.store_population_items (store_id);
create index store_population_items_classification_idx
  on governance.store_population_items (population_version_id, classification, operating_model);

create function governance.guard_store_population_item_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  parent_status text;
begin
  select status into parent_status
  from governance.store_population_versions
  where population_version_id = case when tg_op = 'DELETE' then old.population_version_id else new.population_version_id end
  for update;

  if parent_status in ('published', 'superseded') then
    raise exception 'BDF_POPULATION_ITEMS_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

create trigger guard_store_population_item_mutation
before insert or update or delete on governance.store_population_items
for each row execute function governance.guard_store_population_item_mutation();

create function governance.guard_store_population_publication()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  item_count integer;
  official_count integer;
  direct_count integer;
  franchise_count integer;
  pending_count integer;
  unresolved_count integer;
  rejected_official_count integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'BDF_POPULATION_VERSION_DELETE_FORBIDDEN';
  end if;
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'BDF_POPULATION_MUST_START_DRAFT';
  end if;

  if tg_op = 'UPDATE' then
    if old.status in ('published', 'superseded') then
      raise exception 'BDF_POPULATION_VERSION_IMMUTABLE';
    end if;
    if (to_jsonb(new) - 'status' - 'approved_by_ref' - 'approved_at')
       <> (to_jsonb(old) - 'status' - 'approved_by_ref' - 'approved_at') then
      raise exception 'BDF_POPULATION_HEADER_CONTENT_IMMUTABLE';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if tg_op <> 'UPDATE' or old.status <> 'approved' then
      raise exception 'BDF_POPULATION_REQUIRES_APPROVED_STATE';
    end if;

    select
      count(*),
      count(*) filter (where in_official_population),
      count(*) filter (where in_official_population and operating_model = 'direct'),
      count(*) filter (where in_official_population and operating_model = 'franchise'),
      count(*) filter (where review_status = 'pending_review'),
      count(*) filter (where classification = 'unresolved' or operating_model = 'unresolved'),
      count(*) filter (where in_official_population and review_status = 'rejected')
    into item_count, official_count, direct_count, franchise_count,
         pending_count, unresolved_count, rejected_official_count
    from governance.store_population_items
    where population_version_id = new.population_version_id;

    if item_count = 0
       or item_count <> new.expected_item_count
       or official_count <> new.expected_official_count
       or direct_count <> new.expected_direct_count
       or franchise_count <> new.expected_franchise_count
       or official_count <> 20
       or direct_count <> 13
       or franchise_count <> 7
       or pending_count <> 0
       or unresolved_count <> 0
       or rejected_official_count <> 0 then
      raise exception 'BDF_POPULATION_PUBLICATION_GATE_FAILED';
    end if;
  end if;

  return new;
end
$function$;

create trigger guard_store_population_publication
before insert or update or delete on governance.store_population_versions
for each row execute function governance.guard_store_population_publication();
