-- Fail-closed catalog validation for the M018 Consumer Projection baseline.
do $validation$
declare n integer; body text; opts text[];
begin
  select count(*) into n from information_schema.views
  where table_schema='projection' and table_name in (
    'accounting_publication_status_v1','accounting_corporation_pl_v1',
    'accounting_corporation_bs_v1','accounting_store_profit_v1',
    'accounting_corporation_comparison_v1','accounting_cash_flow_v1'
  );
  if n<>6 then raise exception 'BDF_M018_VIEW_COUNT %',n; end if;

  if exists (
    select 1 from information_schema.views where table_schema='projection'
      and table_name like 'accounting_%_v1'
      and table_name not in (
        'accounting_publication_status_v1','accounting_corporation_pl_v1',
        'accounting_corporation_bs_v1','accounting_store_profit_v1',
        'accounting_corporation_comparison_v1','accounting_cash_flow_v1'
      )
  ) then raise exception 'BDF_M018_UNAPPROVED_VIEW_INVENTORY'; end if;

  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where s.nspname='projection' and c.relname in (
    'accounting_publication_status_v1','accounting_corporation_pl_v1',
    'accounting_corporation_bs_v1','accounting_store_profit_v1',
    'accounting_corporation_comparison_v1','accounting_cash_flow_v1'
  ) and c.relkind='v' and c.reloptions @> array['security_invoker=true']
    and c.reloptions @> array['security_barrier=true'];
  if n<>6 then raise exception 'BDF_M018_SECURITY_INVOKER_COUNT %',n; end if;

  select count(*) into n from pg_proc p join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='projection' and p.proname='m018_current_published_lines'
    and not p.prosecdef and exists (
      select 1 from unnest(p.proconfig) setting
      where setting in ('search_path=','search_path=""')
    );
  if n<>1 then raise exception 'BDF_M018_FUNCTION_SECURITY_COUNT %',n; end if;

  select pg_get_functiondef(p.oid) into body from pg_proc p
  join pg_namespace s on s.oid=p.pronamespace
  where s.nspname='projection' and p.proname='m018_current_published_lines';
  if body is null
    or position('v.status' in body)=0
    or position('r.release_status' in body)=0
    or position('''published''' in body)=0
    or position('s.status' in body)=0
    or position('''balanced''' in body)=0
    or position('not exists' in lower(body))=0
    or position('sm.contribution_sign' in body)=0
    or position('COALESCE' in upper(body))>0
    or position('cash_flow' in lower(body))>0 then
    raise exception 'BDF_M018_CURRENT_PUBLICATION_FUNCTION_CONTRACT';
  end if;

  select count(*) into n from information_schema.role_table_grants
  where table_schema='projection' and table_name in (
    'accounting_publication_status_v1','accounting_corporation_pl_v1',
    'accounting_corporation_bs_v1','accounting_store_profit_v1',
    'accounting_corporation_comparison_v1','accounting_cash_flow_v1'
  ) and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M018_FORBIDDEN_VIEW_GRANT %',n; end if;

  select count(*) into n from information_schema.routine_privileges
  where specific_schema='projection' and routine_name='m018_current_published_lines'
    and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M018_FORBIDDEN_FUNCTION_GRANT %',n; end if;

  select count(*) into n from information_schema.role_table_grants
  where table_schema='accounting' and grantee in ('PUBLIC','anon','authenticated','service_role');
  if n<>0 then raise exception 'BDF_M018_RAW_ACCOUNTING_GRANT %',n; end if;

  if exists (select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
    where s.nspname in ('projection','accounting') and p.prosecdef) then
    raise exception 'BDF_M018_SECURITY_DEFINER';
  end if;

  if exists (select 1 from information_schema.columns
    where table_schema='projection' and table_name in (
      'accounting_publication_status_v1','accounting_corporation_pl_v1',
      'accounting_corporation_bs_v1','accounting_store_profit_v1',
      'accounting_corporation_comparison_v1','accounting_cash_flow_v1'
    ) and column_name ~ '(email|phone|address|raw_|source_|digest|approval|actor|reason|evidence|production|internal_id)') then
    raise exception 'BDF_M018_FORBIDDEN_PROJECTION_COLUMN';
  end if;

  if (select count(*) from projection.accounting_cash_flow_v1)<>0 then
    raise exception 'BDF_M018_CASH_FLOW_MUST_BE_DISABLED';
  end if;

  if exists (select 1 from information_schema.tables
    where table_schema in ('accounting','projection')
      and table_name like 'm019%') then
    raise exception 'BDF_M018_FUTURE_SCOPE_OBJECT';
  end if;
end
$validation$;
