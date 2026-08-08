-- Fail-closed catalog validation for the current M017 baseline.
do $validation$
declare n integer; body text;
begin
  select count(*) into n from information_schema.tables
  where table_schema='accounting' and table_name in (
    'publication_releases','publication_members','comparison_rules'
  );
  if n<>3 then raise exception 'BDF_M017_TABLE_COUNT %',n; end if;

  select count(*) into n from pg_constraint c
  join pg_class t on t.oid=c.conrelid join pg_namespace s on s.oid=t.relnamespace
  where s.nspname='accounting' and c.conname in (
    'accounting_publication_releases_request_check',
    'accounting_publication_releases_fingerprint_check',
    'accounting_publication_releases_lineage_check',
    'accounting_publication_members_hash_check',
    'accounting_publication_members_no_self_supersede',
    'accounting_comparison_rules_scenario_check',
    'accounting_comparison_rules_version_unique',
    'accounting_audit_events_publication_fk'
  );
  if n<>8 then raise exception 'BDF_M017_CONSTRAINT_COUNT %',n; end if;

  select count(*) into n from pg_indexes where schemaname='accounting' and indexname in (
    'accounting_publication_releases_prior_idx',
    'accounting_publication_releases_reverses_idx',
    'accounting_publication_releases_approval_idx',
    'accounting_publication_members_stream_idx',
    'accounting_publication_members_cycle_idx',
    'accounting_comparison_rules_active_idx',
    'accounting_audit_events_publication_idx'
  );
  if n<>7 then raise exception 'BDF_M017_INDEX_COUNT %',n; end if;

  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname in (
    'guard_m017_publication_mutation','m017_request_fingerprint','m017_required_approval_types',
    'm017_validate_publication_commit','publish_accounting_version'
  ) and not p.prosecdef and exists (
    select 1 from unnest(p.proconfig) setting
    where setting in ('search_path=','search_path=""')
  );
  if n<>5 then raise exception 'BDF_M017_FUNCTION_SECURITY_COUNT %',n; end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname='m017_request_fingerprint';
  if body is null
    or position('p_accounting_version_id' in body)=0
    or position('p_expected_content_hash' in body)=0
    or position('p_actor' in body)=0
    or position('p_actor_role' in body)=0
    or position('p_reason_code' in body)=0
    or position('p_evidence_reference' in body)=0
    or position('p_correlation_id' in body)=0
    or position('p_expected_prior_publication_id' in body)=0
    or position('p_corporation_id' in body)=0
    or position('p_accounting_period' in body)=0
    or position('p_scenario_type' in body)=0
    or position('sha256' in body)=0 then
    raise exception 'BDF_M017_REQUEST_FINGERPRINT_CONTRACT';
  end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='accounting' and p.proname='publish_accounting_version';
  if body is null
    or position('pg_advisory_xact_lock' in body)=0
    or position('m017-request|' in body)=0
    or position('m017_request_fingerprint' in body)=0
    or position('request_fingerprint=computed_fingerprint' in replace(body,' ',''))=0
    or position('BDF_M017_IDEMPOTENCY_KEY_REUSE_MISMATCH' in body)=0
    or position('m017-request|' in body)>position('where r.request_key=p_request_key' in lower(body))
    or position('for update' in lower(body))=0
    or position('BDF_M017_STALE_VERSION' in body)=0
    or position('BDF_M017_VALIDATION_INCOMPLETE' in body)=0
    or position('BDF_M017_APPROVAL_INCOMPLETE' in body)=0
    or position('publication_approved' in body)=0
    or position('version_superseded' in body)=0 then
    raise exception 'BDF_M017_PUBLISH_COMMAND_CONTRACT';
  end if;

  select count(*) into n from pg_trigger g join pg_class t on t.oid=g.tgrelid
  join pg_namespace s on s.oid=t.relnamespace
  where s.nspname='accounting' and not g.tgisinternal and g.tgname in (
    'guard_publication_release_mutation','guard_publication_member_mutation',
    'guard_comparison_rule_mutation','validate_publication_release_commit',
    'validate_publication_member_commit'
  );
  if n<>5 then raise exception 'BDF_M017_TRIGGER_BINDING_COUNT %',n; end if;

  select count(*) into n from pg_class t join pg_namespace s on s.oid=t.relnamespace
  where s.nspname='accounting' and t.relname in (
    'publication_releases','publication_members','comparison_rules'
  ) and t.relrowsecurity and t.relforcerowsecurity;
  if n<>3 then raise exception 'BDF_M017_RLS_COUNT %',n; end if;

  select count(*) into n from information_schema.role_table_grants
  where table_schema='accounting' and table_name in (
    'publication_releases','publication_members','comparison_rules'
  ) and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M017_FORBIDDEN_TABLE_GRANT %',n; end if;

  select count(*) into n from information_schema.routine_privileges
  where specific_schema='accounting' and routine_name in (
    'guard_m017_publication_mutation','m017_request_fingerprint','m017_required_approval_types',
    'm017_validate_publication_commit','publish_accounting_version'
  ) and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M017_FORBIDDEN_FUNCTION_GRANT %',n; end if;

  select count(*) into n from pg_policies where schemaname='accounting'
    and tablename in ('publication_releases','publication_members','comparison_rules');
  if n<>0 then raise exception 'BDF_M017_POLICY_COUNT %',n; end if;

  select count(*) into n from information_schema.views
  where table_schema in ('accounting','projection')
    and (table_name like '%publication%' or table_name like '%consumer%');
  if n<>0 then raise exception 'BDF_M017_CONSUMER_VIEW_COUNT %',n; end if;

  select count(*) into n from information_schema.columns
  where table_schema='accounting' and table_name in (
    'publication_releases','publication_members','comparison_rules'
  ) and (column_name ~ '(email|phone|address|name|production|internal_id|raw_)');
  if n<>0 then raise exception 'BDF_M017_FORBIDDEN_COLUMN %',n; end if;

  if not exists (
    select 1 from information_schema.columns where table_schema='accounting'
      and table_name='audit_events' and column_name='publication_id'
  ) then raise exception 'BDF_M017_AUDIT_PUBLICATION_REFERENCE'; end if;

  if exists (
    select 1 from information_schema.tables where table_schema in ('accounting','projection')
      and (table_name like 'm018%' or table_name like '%consumer_projection%' or table_name like '%cash_flow%')
  ) then raise exception 'BDF_M017_FUTURE_SCOPE_OBJECT'; end if;
end
$validation$;
