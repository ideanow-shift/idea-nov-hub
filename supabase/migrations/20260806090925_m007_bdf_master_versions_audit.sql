-- PR001-A / M007
-- Published master version manifest and append-only governance audit ledger.

create table governance.master_versions (
  master_version_id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  population_version_id uuid null references governance.store_population_versions(population_version_id) on delete restrict,
  status text not null default 'draft',
  effective_as_of date not null,
  content_digest text not null,
  parent_version_id uuid null references governance.master_versions(master_version_id) on delete restrict,
  validated_at timestamptz null,
  activated_at timestamptz null,
  superseded_at timestamptz null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint master_versions_status_check check (
    status in ('draft', 'validated', 'approved', 'published', 'superseded', 'rejected')
  ),
  constraint master_versions_digest_format check (content_digest ~ '^[0-9a-f]{64}$'),
  constraint master_versions_validation_check check (
    status in ('draft', 'rejected') or validated_at is not null
  ),
  constraint master_versions_activation_check check (
    status not in ('published', 'superseded') or activated_at is not null
  ),
  constraint master_versions_superseded_check check (
    status <> 'superseded' or superseded_at is not null
  ),
  constraint master_versions_content_unique unique (source_snapshot_id, content_digest)
);
create index master_versions_population_idx on governance.master_versions (population_version_id);
create index master_versions_parent_idx on governance.master_versions (parent_version_id);
create index master_versions_status_asof_idx on governance.master_versions (status, effective_as_of desc);
create table governance.master_version_members (
  master_version_id uuid not null references governance.master_versions(master_version_id) on delete restrict,
  entity_type text not null,
  entity_version_id uuid not null,
  canonical_entity_id uuid not null,
  source_snapshot_id uuid not null,
  recorded_at timestamptz not null default statement_timestamp(),
  primary key (master_version_id, entity_type, canonical_entity_id),
  constraint master_version_members_version_unique unique (master_version_id, entity_type, entity_version_id),
  constraint master_version_members_registry_fk foreign key (
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) references governance.canonical_version_registry(
    entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
  ) on delete restrict,
  constraint master_version_members_entity_type_check check (
    entity_type in ('corporation', 'store', 'department', 'employee', 'assignment', 'corporation_store_relationship')
  )
);
create index master_version_members_entity_idx
  on governance.master_version_members (entity_type, entity_version_id);
create index master_version_members_snapshot_idx
  on governance.master_version_members (source_snapshot_id);

create table governance.master_publication_releases (
  release_sequence bigint generated always as identity primary key,
  release_id uuid not null unique default gen_random_uuid(),
  master_version_id uuid not null unique references governance.master_versions(master_version_id) on delete restrict,
  released_at timestamptz not null default statement_timestamp(),
  released_by_ref text not null,
  reason_code text not null,
  constraint master_publication_releases_actor_nonblank check (btrim(released_by_ref) <> ''),
  constraint master_publication_releases_reason_nonblank check (btrim(reason_code) <> '')
);

create table governance.master_audit_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id_digest text null,
  source_snapshot_id uuid null references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  master_version_id uuid null references governance.master_versions(master_version_id) on delete restrict,
  actor_ref text not null,
  app_id text not null,
  result text not null,
  reason_code text not null,
  correlation_id uuid not null,
  occurred_at timestamptz not null default statement_timestamp(),
  metadata jsonb not null default '{}'::jsonb,
  constraint master_audit_events_type_nonblank check (btrim(event_type) <> ''),
  constraint master_audit_events_entity_type_check check (
    entity_type in ('snapshot', 'corporation', 'store', 'department', 'employee', 'assignment', 'population', 'master_version')
  ),
  constraint master_audit_events_digest_format check (
    entity_id_digest is null or entity_id_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint master_audit_events_actor_nonblank check (btrim(actor_ref) <> ''),
  constraint master_audit_events_app_nonblank check (btrim(app_id) <> ''),
  constraint master_audit_events_result_check check (result in ('accepted', 'rejected', 'failed')),
  constraint master_audit_events_reason_nonblank check (btrim(reason_code) <> ''),
  constraint master_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index master_audit_events_correlation_idx on governance.master_audit_events (correlation_id);
create index master_audit_events_snapshot_idx on governance.master_audit_events (source_snapshot_id);
create index master_audit_events_master_version_idx on governance.master_audit_events (master_version_id);
create index master_audit_events_entity_time_idx on governance.master_audit_events (entity_type, occurred_at desc);

comment on table governance.master_audit_events is
  'Append-only governance audit. Raw Production IDs and employee PII are prohibited.';

create function governance.reject_immutable_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'BDF_IMMUTABLE_ROW';
end
$function$;

create function governance.guard_master_publication_release_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from governance.master_versions
    where master_version_id = new.master_version_id
      and status = 'published'
      and activated_at is not null
  ) then
    raise exception 'BDF_RELEASE_REQUIRES_PUBLISHED_MASTER_VERSION';
  end if;
  return new;
end
$function$;

create function governance.guard_snapshot_mutation()
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

create function governance.guard_master_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'BDF_MASTER_VERSION_DELETE_FORBIDDEN';
  end if;
  if old.status in ('published', 'superseded') or old.activated_at is not null then
    raise exception 'BDF_MASTER_VERSION_ACTIVATED_IMMUTABLE';
  end if;
  if (to_jsonb(new) - 'status' - 'validated_at' - 'activated_at')
     <> (to_jsonb(old) - 'status' - 'validated_at' - 'activated_at') then
    raise exception 'BDF_MASTER_VERSION_CONTENT_IMMUTABLE';
  end if;
  if new.status = 'published' then
    if old.status <> 'approved' or new.activated_at is null then
      raise exception 'BDF_MASTER_VERSION_REQUIRES_APPROVAL';
    end if;
    if not exists (
      select 1 from governance.master_source_snapshots s
      where s.source_snapshot_id = new.source_snapshot_id and s.status = 'activated'
    ) then
      raise exception 'BDF_MASTER_VERSION_SNAPSHOT_NOT_ACTIVATED';
    end if;
    if new.population_version_id is null or not exists (
      select 1 from governance.store_population_versions p
      where p.population_version_id = new.population_version_id and p.status = 'published'
    ) then
      raise exception 'BDF_MASTER_VERSION_POPULATION_NOT_PUBLISHED';
    end if;
    if not exists (
      select 1 from governance.master_version_members m
      where m.master_version_id = new.master_version_id
    ) then
      raise exception 'BDF_MASTER_VERSION_EMPTY';
    end if;
  end if;
  return new;
end
$function$;

create function governance.guard_master_version_member_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  parent_status text;
  parent_activated_at timestamptz;
  parent_snapshot_id uuid;
  version_exists boolean := false;
begin
  select status, activated_at, source_snapshot_id
    into parent_status, parent_activated_at, parent_snapshot_id
  from governance.master_versions
  where master_version_id = case when tg_op = 'DELETE' then old.master_version_id else new.master_version_id end
  for update;
  if parent_status in ('published', 'superseded') or parent_activated_at is not null then
    raise exception 'BDF_MASTER_VERSION_MEMBERS_IMMUTABLE';
  end if;
  if tg_op <> 'DELETE' then
    if new.source_snapshot_id <> parent_snapshot_id then
      raise exception 'BDF_MASTER_VERSION_MEMBER_SNAPSHOT_MISMATCH';
    end if;
    version_exists := case new.entity_type
      when 'corporation' then exists (
        select 1 from core.corporations where corporation_version_id = new.entity_version_id
          and corporation_id = new.canonical_entity_id and source_snapshot_id = new.source_snapshot_id)
      when 'store' then exists (
        select 1 from core.stores where store_version_id = new.entity_version_id
          and store_id = new.canonical_entity_id and source_snapshot_id = new.source_snapshot_id)
      when 'department' then exists (
        select 1 from core.departments where department_version_id = new.entity_version_id
          and department_id = new.canonical_entity_id and source_snapshot_id = new.source_snapshot_id)
      when 'employee' then exists (
        select 1 from core.employees where employee_version_id = new.entity_version_id
          and employee_id = new.canonical_entity_id and source_snapshot_id = new.source_snapshot_id)
      when 'assignment' then exists (
        select 1 from core.employee_store_assignments where assignment_version_id = new.entity_version_id
          and assignment_id = new.canonical_entity_id and source_snapshot_id = new.source_snapshot_id)
      when 'corporation_store_relationship' then exists (
        select 1 from core.corporation_store_relationships where relationship_version_id = new.entity_version_id
          and relationship_id = new.canonical_entity_id and source_snapshot_id = new.source_snapshot_id)
      else false
    end;
    if not version_exists then raise exception 'BDF_MASTER_VERSION_MEMBER_ROW_NOT_FOUND'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

create trigger guard_master_source_snapshot_mutation
before update or delete on governance.master_source_snapshots
for each row execute function governance.guard_snapshot_mutation();

create trigger reject_canonical_entity_registry_mutation
before update or delete on governance.canonical_entity_registry
for each row execute function governance.reject_immutable_mutation();
create trigger reject_canonical_version_registry_mutation
before update or delete on governance.canonical_version_registry
for each row execute function governance.reject_immutable_mutation();
create trigger reject_source_crosswalk_mutation
before update or delete on governance.source_entity_crosswalks
for each row execute function governance.reject_immutable_mutation();

create trigger reject_corporations_mutation before update or delete on core.corporations
for each row execute function governance.reject_immutable_mutation();
create trigger reject_stores_mutation before update or delete on core.stores
for each row execute function governance.reject_immutable_mutation();
create trigger reject_departments_mutation before update or delete on core.departments
for each row execute function governance.reject_immutable_mutation();
create trigger reject_employees_mutation before update or delete on core.employees
for each row execute function governance.reject_immutable_mutation();
create trigger reject_assignments_mutation before update or delete on core.employee_store_assignments
for each row execute function governance.reject_immutable_mutation();
create trigger reject_corporation_store_relationships_mutation before update or delete on core.corporation_store_relationships
for each row execute function governance.reject_immutable_mutation();

create trigger guard_master_version_mutation
before update or delete on governance.master_versions
for each row execute function governance.guard_master_version_mutation();
create trigger guard_master_version_member_mutation
before insert or update or delete on governance.master_version_members
for each row execute function governance.guard_master_version_member_mutation();
create trigger guard_master_publication_release_insert
before insert on governance.master_publication_releases
for each row execute function governance.guard_master_publication_release_insert();
create trigger reject_master_publication_release_mutation
before update or delete on governance.master_publication_releases
for each row execute function governance.reject_immutable_mutation();
create trigger reject_master_audit_event_mutation
before update or delete on governance.master_audit_events
for each row execute function governance.reject_immutable_mutation();
