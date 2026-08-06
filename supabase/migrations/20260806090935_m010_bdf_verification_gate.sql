-- PR001-A / M010
-- Fail-closed Release Verification Gate. Uses synthetic fixtures only inside
-- PL/pgSQL exception subtransactions so no fixture can persist.

do $catalog_gate$
declare
  required_views constant text[] := array[
    'corporation_master_v1',
    'department_master_v1',
    'employee_assignment_v1',
    'master_manifest_v1',
    'store_master_v1'
  ];
  expected_view_count integer := cardinality(required_views);
  actual_view_count integer;
  missing_view_names text[];
  unexpected_view_names text[];
  insecure_view_names text[];
  missing_table_count integer;
  rls_disabled_count integer;
  rls_not_forced_count integer;
  exposed_grant_count integer;
  prohibited_pii_column_count integer;
begin
  select count(*) into missing_table_count
  from (
    values
      ('core', 'corporation_identities'),
      ('core', 'corporations'),
      ('core', 'store_identities'),
      ('core', 'stores'),
      ('core', 'department_identities'),
      ('core', 'departments'),
      ('core', 'employee_identities'),
      ('core', 'employees'),
      ('core', 'assignment_identities'),
      ('core', 'employee_store_assignments'),
      ('core', 'corporation_store_relationship_identities'),
      ('core', 'corporation_store_relationships'),
      ('governance', 'master_source_snapshots'),
      ('governance', 'canonical_entity_registry'),
      ('governance', 'canonical_version_registry'),
      ('governance', 'source_entity_crosswalks'),
      ('governance', 'store_population_versions'),
      ('governance', 'store_population_items'),
      ('governance', 'master_versions'),
      ('governance', 'master_version_members'),
      ('governance', 'master_publication_releases'),
      ('governance', 'master_audit_events')
  ) required(schema_name, table_name)
  where to_regclass(format('%I.%I', required.schema_name, required.table_name)) is null;

  if missing_table_count <> 0 then raise exception 'BDF_PR001A_MISSING_TABLES'; end if;

  select count(*) filter (where not c.relrowsecurity),
         count(*) filter (where not c.relforcerowsecurity)
    into rls_disabled_count, rls_not_forced_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('core', 'governance') and c.relkind = 'r';

  if rls_disabled_count <> 0 then raise exception 'BDF_PR001A_RLS_DISABLED'; end if;
  if rls_not_forced_count <> 0 then raise exception 'BDF_PR001A_RLS_NOT_FORCED'; end if;

  select count(*) into exposed_grant_count
  from information_schema.table_privileges
  where table_schema in ('core', 'governance', 'projection')
    and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');
  if exposed_grant_count <> 0 then raise exception 'BDF_PR001A_UNAPPROVED_GRANT'; end if;

  select count(*) into actual_view_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'projection' and c.relkind = 'v';

  select coalesce(array_agg(v order by v), array[]::text[]) into missing_view_names
  from unnest(required_views) v
  where not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'projection' and c.relname = v and c.relkind = 'v'
  );

  select coalesce(array_agg(c.relname order by c.relname), array[]::text[])
    into unexpected_view_names
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'projection' and c.relkind = 'v'
    and not (c.relname = any(required_views));

  select coalesce(array_agg(c.relname order by c.relname), array[]::text[])
    into insecure_view_names
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'projection' and c.relkind = 'v'
    and c.relname = any(required_views)
    and not ('security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])));

  raise notice 'BDF_PR001A_VIEW_CONTRACT expected_view_count=%, actual_view_count=%, missing_view_names=%, unexpected_view_names=%, insecure_view_names=%',
    expected_view_count, actual_view_count, missing_view_names, unexpected_view_names, insecure_view_names;

  if actual_view_count <> expected_view_count
     or cardinality(missing_view_names) <> 0
     or cardinality(unexpected_view_names) <> 0
     or cardinality(insecure_view_names) <> 0 then
    raise exception 'BDF_PR001A_REQUIRED_VIEW_CONTRACT_FAILED';
  end if;

  select count(*) into prohibited_pii_column_count
  from information_schema.columns
  where table_schema in ('core', 'governance', 'projection')
    and lower(column_name) ~ '(email|firebase|phone|address|bank|tax|insurance|family|birth|ssn|personal_uid)';
  if prohibited_pii_column_count <> 0 then raise exception 'BDF_PR001A_PROHIBITED_PII_COLUMN'; end if;
end
$catalog_gate$;

-- Negative fixture: orphan canonical identity and crosswalk type mismatch.
do $reference_negative$
declare
  entity_id uuid := gen_random_uuid();
  snapshot_id uuid := gen_random_uuid();
  rejected boolean;
begin
  begin
    insert into governance.master_source_snapshots (
      source_snapshot_id, source_system, source_environment, source_version,
      snapshot_version, source_as_of, content_digest, mapping_contract_version, masking_policy_version
    ) values (
      snapshot_id, 'synthetic', 'staging', gen_random_uuid()::text,
      gen_random_uuid()::text, statement_timestamp(), repeat('a', 64), 'm1', 'p1'
    );

    rejected := false;
    begin
      insert into core.corporation_identities (corporation_id) values (entity_id);
    exception when foreign_key_violation or raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_ORPHAN_FK_ACCEPTED'; end if;

    insert into governance.canonical_entity_registry (canonical_entity_id, entity_type)
    values (entity_id, 'corporation');
    rejected := false;
    begin
      insert into governance.source_entity_crosswalks (
        canonical_entity_id, entity_type, source_system, source_record_key, source_version,
        source_snapshot_id, valid_from, mapping_contract_version, masking_policy_version,
        source_record_digest
      ) values (
        entity_id, 'employee', 'synthetic', 'masked-key', 'v1', snapshot_id,
        current_date, 'm1', 'p1', repeat('b', 64)
      );
    exception when foreign_key_violation then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_CROSSWALK_TYPE_MISMATCH_ACCEPTED'; end if;
    raise exception 'BDF_TEST_ROLLBACK';
  exception when raise_exception then
    if sqlerrm <> 'BDF_TEST_ROLLBACK' then raise; end if;
  end;
end
$reference_negative$;

-- Negative fixture: duplicate Snapshot idempotency.
do $snapshot_negative$
declare
  rejected boolean := false;
  source_version_value text := gen_random_uuid()::text;
begin
  begin
    insert into governance.master_source_snapshots (
      source_system, source_environment, source_version, snapshot_version, source_as_of,
      content_digest, mapping_contract_version, masking_policy_version
    ) values ('synthetic', 'staging', source_version_value, gen_random_uuid()::text,
      statement_timestamp(), repeat('c', 64), 'm1', 'p1');
    begin
      insert into governance.master_source_snapshots (
        source_system, source_environment, source_version, snapshot_version, source_as_of,
        content_digest, mapping_contract_version, masking_policy_version
      ) values ('synthetic', 'staging', source_version_value, gen_random_uuid()::text,
        statement_timestamp(), repeat('d', 64), 'm1', 'p1');
    exception when unique_violation then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_DUPLICATE_SNAPSHOT_ACCEPTED'; end if;
    raise exception 'BDF_TEST_ROLLBACK';
  exception when raise_exception then
    if sqlerrm <> 'BDF_TEST_ROLLBACK' then raise; end if;
  end;
end
$snapshot_negative$;

-- Negative fixture: business-period overlap, immutable history, and bad Version Member.
do $version_negative$
declare
  snapshot_id uuid := gen_random_uuid();
  entity_id uuid := gen_random_uuid();
  version_id_1 uuid := gen_random_uuid();
  version_id_2 uuid := gen_random_uuid();
  master_id uuid := gen_random_uuid();
  audit_event_id uuid := gen_random_uuid();
  rejected boolean;
begin
  begin
    insert into governance.master_source_snapshots (
      source_snapshot_id, source_system, source_environment, source_version,
      snapshot_version, source_as_of, content_digest, mapping_contract_version, masking_policy_version
    ) values (snapshot_id, 'synthetic', 'staging', gen_random_uuid()::text,
      gen_random_uuid()::text, statement_timestamp(), repeat('e', 64), 'm1', 'p1');
    insert into governance.canonical_entity_registry (canonical_entity_id, entity_type)
    values (entity_id, 'corporation');
    insert into core.corporation_identities (corporation_id) values (entity_id);
    insert into governance.canonical_version_registry (
      entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
    ) values
      (version_id_1, entity_id, 'corporation', snapshot_id),
      (version_id_2, entity_id, 'corporation', snapshot_id);
    insert into core.corporations (
      corporation_version_id, corporation_id, corporation_code, display_name, status,
      effective_from, effective_to, source_snapshot_id, source_record_digest
    ) values (version_id_1, entity_id, 'SYN-CORP', 'Synthetic', 'active',
      date '2026-01-01', date '2026-02-01', snapshot_id, repeat('f', 64));

    rejected := false;
    begin
      insert into core.corporations (
        corporation_version_id, corporation_id, corporation_code, display_name, status,
        effective_from, source_snapshot_id, source_record_digest
      ) values (version_id_2, entity_id, 'SYN-CORP-2', 'Synthetic 2', 'active',
        date '2026-01-15', snapshot_id, repeat('1', 64));
    exception when exclusion_violation then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_OVERLAPPING_PERIOD_ACCEPTED'; end if;

    rejected := false;
    begin update core.corporations set display_name = 'Mutated' where corporation_version_id = version_id_1;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_IMMUTABLE_UPDATE_ACCEPTED'; end if;

    rejected := false;
    begin delete from core.corporations where corporation_version_id = version_id_1;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_IMMUTABLE_DELETE_ACCEPTED'; end if;

    insert into governance.master_versions (
      master_version_id, source_snapshot_id, status, effective_as_of, content_digest
    ) values (master_id, snapshot_id, 'draft', current_date, repeat('2', 64));
    rejected := false;
    begin
      insert into governance.master_version_members (
        master_version_id, entity_type, entity_version_id, canonical_entity_id, source_snapshot_id
      ) values (master_id, 'corporation', version_id_2, entity_id, snapshot_id);
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_VERSION_MEMBER_ORPHAN_ROW_ACCEPTED'; end if;
    rejected := false;
    begin
      insert into governance.master_version_members (
        master_version_id, entity_type, entity_version_id, canonical_entity_id, source_snapshot_id
      ) values (master_id, 'store', version_id_1, entity_id, snapshot_id);
    exception when foreign_key_violation or raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_VERSION_MEMBER_TYPE_MISMATCH_ACCEPTED'; end if;

    if exists (select 1 from projection.master_manifest_v1 where master_version_id = master_id) then
      raise exception 'BDF_TEST_UNPUBLISHED_PROJECTION_VISIBLE';
    end if;
    insert into governance.master_audit_events (
      event_id, event_type, entity_type, actor_ref, app_id, result, reason_code, correlation_id
    ) values (audit_event_id, 'synthetic', 'master_version', 'tester', 'pr001a',
      'accepted', 'synthetic', gen_random_uuid());
    rejected := false;
    begin update governance.master_audit_events set reason_code = 'mutated' where event_id = audit_event_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_AUDIT_UPDATE_ACCEPTED'; end if;
    rejected := false;
    begin delete from governance.master_audit_events where event_id = audit_event_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_AUDIT_DELETE_ACCEPTED'; end if;
    raise exception 'BDF_TEST_ROLLBACK';
  exception when raise_exception then
    if sqlerrm <> 'BDF_TEST_ROLLBACK' then raise; end if;
  end;
end
$version_negative$;

-- Negative fixture: primary assignment overlap in one system-version Snapshot.
do $assignment_negative$
declare
  snapshot_id uuid := gen_random_uuid();
  employee_id_value uuid := gen_random_uuid();
  store_id_value uuid := gen_random_uuid();
  assignment_id_1 uuid := gen_random_uuid();
  assignment_id_2 uuid := gen_random_uuid();
  assignment_version_1 uuid := gen_random_uuid();
  assignment_version_2 uuid := gen_random_uuid();
  rejected boolean := false;
begin
  begin
    insert into governance.master_source_snapshots (
      source_snapshot_id, source_system, source_environment, source_version,
      snapshot_version, source_as_of, content_digest, mapping_contract_version, masking_policy_version
    ) values (snapshot_id, 'synthetic', 'staging', gen_random_uuid()::text,
      gen_random_uuid()::text, statement_timestamp(), repeat('3', 64), 'm1', 'p1');
    insert into governance.canonical_entity_registry (canonical_entity_id, entity_type) values
      (employee_id_value, 'employee'), (store_id_value, 'store'),
      (assignment_id_1, 'assignment'), (assignment_id_2, 'assignment');
    insert into core.employee_identities (employee_id) values (employee_id_value);
    insert into core.store_identities (store_id) values (store_id_value);
    insert into core.assignment_identities (assignment_id) values (assignment_id_1), (assignment_id_2);
    insert into governance.canonical_version_registry (
      entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
    ) values
      (assignment_version_1, assignment_id_1, 'assignment', snapshot_id),
      (assignment_version_2, assignment_id_2, 'assignment', snapshot_id);
    insert into core.employee_store_assignments (
      assignment_version_id, assignment_id, employee_id, store_id, assignment_role_code,
      assignment_kind, effective_from, status, source_snapshot_id, source_record_digest
    ) values (assignment_version_1, assignment_id_1, employee_id_value, store_id_value,
      'store_manager', 'primary', current_date, 'active', snapshot_id, repeat('4', 64));
    begin
      insert into core.employee_store_assignments (
        assignment_version_id, assignment_id, employee_id, store_id, assignment_role_code,
        assignment_kind, effective_from, status, source_snapshot_id, source_record_digest
      ) values (assignment_version_2, assignment_id_2, employee_id_value, store_id_value,
        'area_manager', 'primary', current_date, 'active', snapshot_id, repeat('5', 64));
    exception when exclusion_violation then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PRIMARY_ASSIGNMENT_OVERLAP_ACCEPTED'; end if;
    raise exception 'BDF_TEST_ROLLBACK';
  exception when raise_exception then
    if sqlerrm <> 'BDF_TEST_ROLLBACK' then raise; end if;
  end;
end
$assignment_negative$;

-- Synthetic publication fixture: every rejected state must fail; the exact
-- approved 20/13/7 population must be the only successful transition.
do $population_negative$
declare
  fixture_date constant date := date '2026-08-06';
  fixture_timestamp constant timestamptz := timestamptz '2026-08-06 09:00:00+09';
  snapshot_id constant uuid := 'a1000000-0000-0000-0000-000000000001';
  fixture_corporation_id constant uuid := 'a1000000-0000-0000-0000-000000000100';
  corporation_version_id constant uuid := 'a1000000-0000-0000-0000-000000000101';
  population_id constant uuid := 'a1000000-0000-0000-0000-000000000200';
  pending_population_id constant uuid := 'a1000000-0000-0000-0000-000000000202';
  pending_store_id constant uuid := 'a1000000-0000-0000-0007-000000000001';
  zero_population_id constant uuid := 'a1000000-0000-0000-0000-000000000201';
  master_id constant uuid := 'a1000000-0000-0000-0000-000000000300';
  store_ids uuid[] := array[]::uuid[];
  store_version_ids uuid[] := array[]::uuid[];
  store_id_value uuid;
  store_version_id uuid;
  relationship_id uuid;
  relationship_version_id uuid;
  fixture_count integer;
  official_count integer;
  direct_count integer;
  franchise_count integer;
  pending_count integer;
  unresolved_count integer;
  rejected_official_count integer;
  rejected boolean;
  i integer;
begin
  begin
    insert into governance.master_source_snapshots (
      source_snapshot_id, source_system, source_environment, source_version,
      snapshot_version, source_as_of, content_digest, mapping_contract_version, masking_policy_version
    ) values (snapshot_id, 'synthetic', 'staging', 'm010-population-source-v1',
      'm010-population-snapshot-v1', fixture_timestamp, repeat('6', 64), 'm1', 'p1');

    -- One Canonical Corporation/version owns all 20 Store relationships. It is
    -- never duplicated per Store.
    insert into governance.canonical_entity_registry (canonical_entity_id, entity_type)
    values (fixture_corporation_id, 'corporation');
    insert into core.corporation_identities (corporation_id) values (fixture_corporation_id);
    insert into governance.canonical_version_registry (
      entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
    ) values (corporation_version_id, fixture_corporation_id, 'corporation', snapshot_id);
    insert into core.corporations (
      corporation_version_id, corporation_id, corporation_code, display_name, status,
      effective_from, source_snapshot_id, source_record_digest
    ) values (corporation_version_id, fixture_corporation_id, 'M010-CORP-01',
      'M010 Fixture Corporation', 'active', fixture_date, snapshot_id, repeat('a', 64));
    insert into governance.source_entity_crosswalks (
      crosswalk_version_id, canonical_entity_id, entity_type, source_system,
      source_record_key, source_version, source_snapshot_id, valid_from,
      mapping_contract_version, masking_policy_version, source_record_digest
    ) values ('a1000000-0000-0000-0000-000000000102', fixture_corporation_id, 'corporation',
      'synthetic', 'm010-corporation-01', 'm010-population-source-v1', snapshot_id,
      fixture_date, 'm1', 'p1', repeat('b', 64));

    insert into governance.store_population_versions (
      population_version_id, version_code, status, as_of, expected_item_count,
      source_snapshot_id, content_digest
    ) values (population_id, 'm010-population-v1', 'draft', fixture_date, 20,
      snapshot_id, repeat('7', 64));

    for i in 1..20 loop
      store_id_value := ('a1000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid;
      store_version_id := ('a1000000-0000-0000-0002-' || lpad(i::text, 12, '0'))::uuid;
      relationship_id := ('a1000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid;
      relationship_version_id := ('a1000000-0000-0000-0004-' || lpad(i::text, 12, '0'))::uuid;
      store_ids := array_append(store_ids, store_id_value);
      store_version_ids := array_append(store_version_ids, store_version_id);
      insert into governance.canonical_entity_registry (canonical_entity_id, entity_type)
      values (store_id_value, 'store'), (relationship_id, 'corporation_store_relationship');
      insert into core.store_identities (store_id) values (store_id_value);
      insert into core.corporation_store_relationship_identities (relationship_id)
      values (relationship_id);
      insert into governance.canonical_version_registry (
        entity_version_id, canonical_entity_id, entity_type, source_snapshot_id
      ) values
        (store_version_id, store_id_value, 'store', snapshot_id),
        (relationship_version_id, relationship_id, 'corporation_store_relationship', snapshot_id);
      insert into core.stores (
        store_version_id, store_id, store_code, display_name, status,
        effective_from, source_snapshot_id, source_record_digest
      ) values (store_version_id, store_id_value, 'M010-STORE-' || lpad(i::text, 2, '0'),
        'M010 Fixture Store ' || lpad(i::text, 2, '0'), 'active', fixture_date,
        snapshot_id, encode(sha256(('m010-store-' || i)::bytea), 'hex'));
      insert into core.corporation_store_relationships (
        relationship_version_id, relationship_id, store_id, corporation_id,
        relationship_type, operating_model, effective_from, source_snapshot_id,
        source_record_digest
      ) values (relationship_version_id, relationship_id, store_id_value, fixture_corporation_id,
        'operator', case when i <= 13 then 'direct' else 'franchise' end,
        fixture_date, snapshot_id,
        encode(sha256(('m010-relationship-' || i)::bytea), 'hex'));
      insert into governance.source_entity_crosswalks (
        crosswalk_version_id, canonical_entity_id, entity_type, source_system,
        source_record_key, source_version, source_snapshot_id, valid_from,
        mapping_contract_version, masking_policy_version, source_record_digest
      ) values (('a1000000-0000-0000-0005-' || lpad(i::text, 12, '0'))::uuid,
        store_id_value, 'store', 'synthetic', 'm010-store-' || lpad(i::text, 2, '0'),
        'm010-population-source-v1', snapshot_id, fixture_date, 'm1', 'p1',
        encode(sha256(('m010-crosswalk-' || i)::bytea), 'hex'));
      insert into governance.store_population_items (
        population_version_id, store_id, classification, operating_model,
        in_official_population, review_status, reason_code, reviewed_by_ref,
        reviewed_at, valid_from
      ) values (
        population_id, store_id_value, 'official_operating',
        case when i <= 12 then 'direct' else 'franchise' end,
        true, 'approved', 'synthetic', 'reviewer', fixture_timestamp, fixture_date
      );
    end loop;

    select count(*) into fixture_count from core.corporations c
      where c.source_snapshot_id = snapshot_id and c.corporation_id = fixture_corporation_id;
    if fixture_count <> 1 then raise exception 'BDF_TEST_CORPORATION_FIXTURE_COUNT_MISMATCH'; end if;
    select count(*) into fixture_count from core.stores where source_snapshot_id = snapshot_id;
    if fixture_count <> 20 then raise exception 'BDF_TEST_STORE_FIXTURE_COUNT_MISMATCH'; end if;
    select count(*) into fixture_count from core.corporation_store_relationships r
      where r.source_snapshot_id = snapshot_id and r.corporation_id = fixture_corporation_id;
    if fixture_count <> 20 then raise exception 'BDF_TEST_STORE_CORPORATION_LINK_COUNT_MISMATCH'; end if;
    if exists (
      select 1 from core.stores s
      left join core.corporation_store_relationships r
        on r.store_id = s.store_id and r.source_snapshot_id = s.source_snapshot_id
       and r.corporation_id = fixture_corporation_id and r.relationship_type = 'operator'
      where s.source_snapshot_id = snapshot_id and r.relationship_version_id is null
    ) then raise exception 'BDF_TEST_STORE_CORPORATION_LINK_MISSING'; end if;
    -- Candidate-review Population: the 20 official items are already approved;
    -- the 21st Store remains outside the official population in review state.
    insert into governance.store_population_versions (
      population_version_id, version_code, status, as_of, expected_item_count,
      source_snapshot_id, content_digest
    ) values (pending_population_id, 'm010-pending-population-v1', 'draft',
      fixture_date, 21, snapshot_id, repeat('c', 64));
    for i in 1..20 loop
      insert into governance.store_population_items (
        population_version_id, store_id, classification, operating_model,
        in_official_population, review_status, reason_code, reviewed_by_ref,
        reviewed_at, valid_from
      ) values (
        pending_population_id, store_ids[i], 'official_operating',
        case when i <= 13 then 'direct' else 'franchise' end,
        true, 'approved', 'synthetic-approved', 'reviewer', fixture_timestamp, fixture_date
      );
    end loop;
    insert into governance.canonical_entity_registry (canonical_entity_id, entity_type)
    values (pending_store_id, 'store');
    insert into core.store_identities (store_id) values (pending_store_id);
    insert into governance.store_population_items (
      population_version_id, store_id, classification, operating_model,
      in_official_population, review_status, reason_code, reviewed_by_ref,
      reviewed_at, valid_from
    ) values (pending_population_id, pending_store_id, 'pending_review', 'other',
      false, 'pending_review', 'human-review-required', null, null, fixture_date);
    update governance.store_population_versions
      set status = 'approved', approved_by_ref = 'approver', approved_at = fixture_timestamp
      where population_version_id = pending_population_id;

    select count(*),
           count(*) filter (where in_official_population),
           count(*) filter (where in_official_population and operating_model = 'direct'),
           count(*) filter (where in_official_population and operating_model = 'franchise'),
           count(*) filter (where review_status = 'pending_review'),
           count(*) filter (where classification = 'unresolved' or operating_model = 'unresolved'),
           count(*) filter (where in_official_population and review_status = 'rejected')
      into fixture_count, official_count, direct_count, franchise_count,
           pending_count, unresolved_count, rejected_official_count
    from governance.store_population_items
    where population_version_id = pending_population_id;
    if fixture_count <> 21 or official_count <> 20
       or direct_count <> 13 or franchise_count <> 7 or pending_count <> 1
       or unresolved_count <> 0 or rejected_official_count <> 0 then
      raise exception 'BDF_TEST_PENDING_REVIEW_FIXTURE_CONTRACT_MISMATCH';
    end if;

    rejected := false;
    begin
      update governance.store_population_versions set status = 'published'
        where population_version_id = pending_population_id;
    exception when raise_exception then
      rejected := sqlerrm = 'BDF_POPULATION_PUBLICATION_GATE_FAILED';
    end;
    if not rejected then raise exception 'BDF_TEST_PENDING_REVIEW_PUBLICATION_ACCEPTED'; end if;
    raise notice 'BDF_TEST_PENDING_REVIEW_REJECTED pending_review_count=1';

    update governance.store_population_versions
      set status = 'approved', approved_by_ref = 'approver', approved_at = fixture_timestamp
      where population_version_id = population_id;
    rejected := false;
    begin update governance.store_population_versions set status = 'published'
      where population_version_id = population_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_20_13_7_MISMATCH_ACCEPTED'; end if;

    update governance.store_population_items set operating_model = 'direct'
      where population_version_id = population_id and store_id = store_ids[13];
    rejected := false;
    begin
      update governance.store_population_items set review_status = 'rejected'
      where population_version_id = population_id and store_id = store_ids[1];
    exception when check_violation then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_REJECTED_OFFICIAL_STORE_ACCEPTED'; end if;

    update governance.store_population_items
      set in_official_population = false, classification = 'unresolved', operating_model = 'unresolved'
      where population_version_id = population_id and store_id = store_ids[1];
    rejected := false;
    begin update governance.store_population_versions set status = 'published'
      where population_version_id = population_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_UNRESOLVED_PUBLICATION_ACCEPTED'; end if;
    update governance.store_population_items
      set in_official_population = true, classification = 'official_operating', operating_model = 'direct'
      where population_version_id = population_id and store_id = store_ids[1];

    select count(*),
           count(*) filter (where in_official_population and operating_model = 'direct'),
           count(*) filter (where in_official_population and operating_model = 'franchise'),
           count(*) filter (where review_status = 'pending_review'),
           count(*) filter (where classification = 'unresolved' or operating_model = 'unresolved'),
           count(*) filter (where in_official_population and review_status = 'rejected')
      into fixture_count, direct_count, franchise_count, pending_count,
           unresolved_count, rejected_official_count
    from governance.store_population_items
    where population_version_id = population_id;
    if fixture_count <> 20 or direct_count <> 13 or franchise_count <> 7
       or pending_count <> 0 or unresolved_count <> 0 or rejected_official_count <> 0 then
      raise exception 'BDF_TEST_POPULATION_FIXTURE_CONTRACT_MISMATCH';
    end if;

    store_id_value := 'a1000000-0000-0000-0006-000000000001';
    insert into governance.canonical_entity_registry (canonical_entity_id, entity_type)
    values (store_id_value, 'store');
    insert into core.store_identities (store_id) values (store_id_value);
    insert into governance.store_population_items (
      population_version_id, store_id, classification, operating_model,
      in_official_population, review_status, reason_code, reviewed_by_ref, reviewed_at, valid_from
    ) values (population_id, store_id_value, 'excluded', 'other', false, 'approved',
      'synthetic-extra', 'reviewer', fixture_timestamp, fixture_date);
    rejected := false;
    begin update governance.store_population_versions set status = 'published'
      where population_version_id = population_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_HEADER_ITEM_MISMATCH_ACCEPTED'; end if;
    delete from governance.store_population_items
      where population_version_id = population_id and store_id = store_id_value;

    update governance.store_population_versions set status = 'published'
      where population_version_id = population_id;
    raise notice 'BDF_TEST_NORMAL_PUBLICATION_SUCCEEDED official=20 direct=13 franchise=7 pending=0';

    rejected := false;
    begin update governance.store_population_items set reason_code = 'mutated'
      where population_version_id = population_id and store_id = store_ids[1];
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_POPULATION_ITEM_UPDATE_ACCEPTED'; end if;
    rejected := false;
    begin delete from governance.store_population_items
      where population_version_id = population_id and store_id = store_ids[1];
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_POPULATION_ITEM_DELETE_ACCEPTED'; end if;
    rejected := false;
    begin
      insert into governance.store_population_items (
        population_version_id, store_id, classification, operating_model,
        in_official_population, review_status, reason_code, reviewed_by_ref, reviewed_at, valid_from
      ) values (population_id, store_ids[1], 'official_operating', 'direct', true,
        'approved', 'late-insert', 'reviewer', statement_timestamp(), current_date);
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_POPULATION_ITEM_INSERT_ACCEPTED'; end if;
    rejected := false;
    begin update governance.store_population_versions set approved_by_ref = 'mutated'
      where population_version_id = population_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_POPULATION_UPDATE_ACCEPTED'; end if;

    update governance.master_source_snapshots set status = 'validated'
      where source_snapshot_id = snapshot_id;
    update governance.master_source_snapshots set status = 'activated'
      where source_snapshot_id = snapshot_id;
    rejected := false;
    begin delete from governance.master_source_snapshots where source_snapshot_id = snapshot_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_CONFIRMED_SNAPSHOT_DELETE_ACCEPTED'; end if;
    rejected := false;
    begin update governance.master_source_snapshots set status = 'superseded'
      where source_snapshot_id = snapshot_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_CONFIRMED_SNAPSHOT_UPDATE_ACCEPTED'; end if;

    insert into governance.master_versions (
      master_version_id, source_snapshot_id, population_version_id, status,
      effective_as_of, content_digest
    ) values (master_id, snapshot_id, population_id, 'draft', fixture_date, repeat('0', 64));
    insert into governance.master_version_members (
      master_version_id, entity_type, entity_version_id, canonical_entity_id, source_snapshot_id
    ) values (master_id, 'store', store_version_ids[1], store_ids[1], snapshot_id);
    update governance.master_versions set status = 'approved', validated_at = statement_timestamp()
      where master_version_id = master_id;
    update governance.master_versions set status = 'published', activated_at = statement_timestamp()
      where master_version_id = master_id;
    insert into governance.master_publication_releases (
      master_version_id, released_by_ref, reason_code
    ) values (master_id, 'approver', 'synthetic-release');
    rejected := false;
    begin delete from governance.master_publication_releases where master_version_id = master_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLICATION_RELEASE_DELETE_ACCEPTED'; end if;
    rejected := false;
    begin update governance.master_versions set effective_as_of = fixture_date + 1
      where master_version_id = master_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_MASTER_UPDATE_ACCEPTED'; end if;
    rejected := false;
    begin delete from governance.master_version_members
      where master_version_id = master_id and canonical_entity_id = store_ids[1];
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_MEMBER_DELETE_ACCEPTED'; end if;
    rejected := false;
    begin update governance.master_version_members set recorded_at = statement_timestamp()
      where master_version_id = master_id and canonical_entity_id = store_ids[1];
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_PUBLISHED_MEMBER_UPDATE_ACCEPTED'; end if;

    insert into governance.store_population_versions (
      population_version_id, version_code, status, as_of, expected_item_count,
      source_snapshot_id, content_digest
    ) values (zero_population_id, 'm010-zero-population-v1', 'draft', fixture_date, 20,
      snapshot_id, repeat('8', 64));
    update governance.store_population_versions
      set status = 'approved', approved_by_ref = 'approver', approved_at = statement_timestamp()
      where population_version_id = zero_population_id;
    rejected := false;
    begin update governance.store_population_versions set status = 'published'
      where population_version_id = zero_population_id;
    exception when raise_exception then rejected := true;
    end;
    if not rejected then raise exception 'BDF_TEST_ZERO_ITEM_PUBLICATION_ACCEPTED'; end if;
    -- The fixed IDs deliberately prove rerun safety: this exception rolls back
    -- every fixture row, so a second execution starts from the same empty state.
    raise exception 'BDF_TEST_ROLLBACK';
  exception when raise_exception then
    if sqlerrm <> 'BDF_TEST_ROLLBACK' then raise; end if;
  end;
  select count(*) into fixture_count
  from governance.master_source_snapshots
  where source_snapshot_id = snapshot_id;
  if fixture_count <> 0 then raise exception 'BDF_TEST_FIXTURE_RESIDUE_DETECTED'; end if;
  raise notice 'BDF_TEST_FIXTURE_CLEANUP_SUCCEEDED residue=0';
end
$population_negative$;

-- Stable negative-test markers consumed by the static contract suite.
-- BDF_NEGATIVE_DUPLICATE_EFFECTIVE_PERIOD
-- BDF_NEGATIVE_PRIMARY_ASSIGNMENT_OVERLAP
-- BDF_NEGATIVE_PENDING_REVIEW_PUBLICATION
-- BDF_NEGATIVE_UNRESOLVED_PUBLICATION
-- BDF_NEGATIVE_20_13_7_MISMATCH
-- BDF_NEGATIVE_ZERO_ITEM_PUBLICATION
-- BDF_NEGATIVE_REJECTED_OFFICIAL_STORE
-- BDF_NEGATIVE_HEADER_ITEM_MISMATCH
-- BDF_NEGATIVE_UNPUBLISHED_PROJECTION
-- BDF_NEGATIVE_MISSING_REQUIRED_VIEW
-- BDF_NEGATIVE_UNAUTHORIZED_ROLE
-- BDF_NEGATIVE_IMMUTABLE_UPDATE
-- BDF_NEGATIVE_IMMUTABLE_DELETE
-- BDF_NEGATIVE_VERSION_MEMBER_TYPE_MISMATCH
