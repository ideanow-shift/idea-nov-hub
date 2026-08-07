-- M014 fail-closed catalog validation.
do $validation$
declare n integer; body text;
begin
  select count(*) into n from information_schema.tables where table_schema='accounting'
    and table_name in ('scenario_contracts','measure_type_contracts','accounting_versions');
  if n<>3 then raise exception 'BDF_M014_TABLE_COUNT %',n; end if;
  select count(*) into n from accounting.scenario_contracts;
  if n<>3 then raise exception 'BDF_M014_SCENARIO_COUNT %',n; end if;
  select count(*) into n from accounting.measure_type_contracts;
  if n<>2 then raise exception 'BDF_M014_MEASURE_COUNT %',n; end if;
  if not exists(select 1 from pg_constraint where conrelid='accounting.accounting_versions'::regclass
    and conname='accounting_versions_stream_sequence_unique') then raise exception 'BDF_M014_STREAM_UNIQUE'; end if;
  if not exists(select 1 from pg_constraint where conrelid='accounting.accounting_versions'::regclass
    and conname='accounting_versions_scenario_type_matrix') then raise exception 'BDF_M014_SCENARIO_MATRIX'; end if;
  select pg_get_functiondef(p.oid) into body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='accounting' and p.proname='guard_accounting_version_mutation';
  if body is null or position('BDF_ACCOUNTING_VALIDATION_NOT_AVAILABLE_BEFORE_M016' in body)=0
    or position('BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017' in body)=0
    then raise exception 'BDF_M014_LIFECYCLE_GUARD'; end if;
  select count(*) into n from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='accounting'
    and c.relname in ('scenario_contracts','measure_type_contracts','accounting_versions')
    and not t.tgisinternal;
  if n<>4 then raise exception 'BDF_M014_TRIGGER_COUNT %',n; end if;
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
    where ns.nspname='accounting' and c.relname in ('scenario_contracts','measure_type_contracts','accounting_versions')
    and c.relrowsecurity and c.relforcerowsecurity;
  if n<>3 then raise exception 'BDF_M014_RLS_FORCE_COUNT %',n; end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='accounting'
    and table_name in ('scenario_contracts','measure_type_contracts','accounting_versions')
    and grantee in ('PUBLIC','anon','authenticated','service_role')) then raise exception 'BDF_M014_FORBIDDEN_GRANTS'; end if;
  if exists(select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='accounting' and p.proname in ('guard_accounting_contract_mutation','validate_accounting_version_insert','guard_accounting_version_mutation','account_measure_type_matches') and p.prosecdef)
    then raise exception 'BDF_M014_SECURITY_DEFINER'; end if;
  if exists(select 1 from information_schema.views where table_schema in ('public','projection')
    and table_name like '%accounting%version%') then raise exception 'BDF_M014_CONSUMER_VIEW'; end if;
  if exists(select 1 from information_schema.columns where table_schema='accounting'
    and table_name in ('scenario_contracts','measure_type_contracts','accounting_versions')
    and lower(column_name) ~ '(email|phone|address|firebase|bank|insurance|family|production_id|raw_payload)')
    then raise exception 'BDF_M014_PII_OR_PRODUCTION_COLUMN'; end if;
end
$validation$;
