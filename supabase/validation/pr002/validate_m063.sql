-- M063 fail-closed catalog validation.
do $validation$
declare
  body text;
  n integer;
begin
  select pg_get_functiondef(p.oid) into body
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='guard_import_membership_seal_m063';
  if body is null
    or position('order by b.import_batch_id' in body)=0
    or position('for update' in body)=0
    or position('BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED' in body)=0
    or position('lock table' in body)>0 then
    raise exception 'BDF_M063_BATCH_LOCAL_GUARD_INVALID';
  end if;

  select pg_get_functiondef(p.oid) into body
  from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting' and p.proname='revalidate_import_batch_membership_m063';
  if body is null
    or position('BDF_ACCOUNTING_IMPORT_BATCH_VALIDATION_INCOMPLETE' in body)=0
    or position('f.row_count' in body)=0
    or position('s.validation_status = ''valid''' in body)=0 then
    raise exception 'BDF_M063_DEFERRED_REVALIDATION_INVALID';
  end if;

  select count(*) into n
  from (values
    ('import_batches','a_m015_lock_import_batch_membership','guard_import_membership_seal_m063',19),
    ('import_files','a_m015_seal_import_files','guard_import_membership_seal_m063',31),
    ('import_staging_lines','a_m015_seal_import_staging_lines','guard_import_membership_seal_m063',31)
  ) expected(table_name,trigger_name,function_name,trigger_type)
  join pg_namespace ns on ns.nspname='accounting'
  join pg_class c on c.relnamespace=ns.oid and c.relname=expected.table_name
  join pg_trigger t on t.tgrelid=c.oid and t.tgname=expected.trigger_name
    and t.tgtype=expected.trigger_type and not t.tgisinternal
  join pg_proc p on p.oid=t.tgfoid and p.proname=expected.function_name;
  if n<>3 then raise exception 'BDF_M063_ACTIVE_TRIGGER_BINDING_COUNT %',n; end if;

  select count(*) into n
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace ns on ns.oid=c.relnamespace
  join pg_proc p on p.oid=t.tgfoid
  where ns.nspname='accounting' and c.relname='import_batches'
    and t.tgname='revalidate_import_batch_membership_m063'
    and p.proname='revalidate_import_batch_membership_m063'
    and t.tgtype=17 and t.tgconstraint<>0
    and t.tgdeferrable and t.tginitdeferred and not t.tgisinternal;
  if n<>1 then raise exception 'BDF_M063_DEFERRED_TRIGGER_MISSING'; end if;

  if exists (
    select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid
    join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='accounting'
      and p.proname='guard_import_membership_seal_m015'
      and not t.tgisinternal
  ) then raise exception 'BDF_M063_GLOBAL_GUARD_STILL_BOUND'; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='accounting'
    and p.proname in ('guard_import_membership_seal_m063','revalidate_import_batch_membership_m063')
    and not p.prosecdef
    and exists (select 1 from unnest(p.proconfig) setting where setting in ('search_path=','search_path=""'));
  if n<>2 then raise exception 'BDF_M063_SECURITY_INVOKER_FUNCTIONS %',n; end if;

  if exists (
    select 1 from information_schema.routine_privileges
    where specific_schema='accounting'
      and routine_name in ('guard_import_membership_seal_m063','revalidate_import_batch_membership_m063')
      and grantee in ('PUBLIC','anon','authenticated','service_role')
  ) then raise exception 'BDF_M063_FORBIDDEN_FUNCTION_GRANT'; end if;

  select count(*) into n from information_schema.tables
  where table_schema='accounting' and table_name in (
    'journal_entries','journal_lines','accounting_facts',
    'allocation_rule_versions','allocation_sets','accounting_allocations'
  );
  if n<>6 then raise exception 'BDF_M063_M015_TABLE_DRIFT %',n; end if;

  if to_regclass('accounting.validation_results') is not null
    or to_regclass('accounting.approvals') is not null
    or to_regclass('accounting.publication_releases') is not null then
    raise exception 'BDF_M063_FUTURE_SCOPE_LEAK';
  end if;
end
$validation$;
