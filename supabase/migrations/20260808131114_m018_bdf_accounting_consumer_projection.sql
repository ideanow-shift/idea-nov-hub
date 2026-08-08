-- PR002 / ACF-07 / M018
-- Published-only, read-only Accounting Consumer Projection.
-- Runtime Consumer role binding remains an M019 responsibility.

create function projection.m018_current_published_lines()
returns table (
  publication_id uuid,
  accounting_version_id uuid,
  published_at timestamptz,
  corporation_id uuid,
  store_id uuid,
  department_id uuid,
  accounting_period date,
  scenario_type text,
  account_id uuid,
  account_version_id uuid,
  statement_type text,
  statement_section text,
  statement_line text,
  display_order integer,
  measure_type text,
  amount numeric(20,4),
  tax_basis text,
  value_status text,
  attribution_status text,
  organization_scope_type text,
  mapping_contract_version text,
  coverage_status text,
  publication_status text
)
language sql stable security invoker set search_path=''
as $function$
  with current_publications as (
    select r.publication_id,r.published_at,m.accounting_version_id,
      m.corporation_id,m.accounting_period,m.scenario_type
    from accounting.publication_releases r
    join accounting.publication_members m on m.publication_id=r.publication_id
    join accounting.accounting_versions v
      on v.accounting_version_id=m.accounting_version_id
     and v.corporation_id=m.corporation_id
     and v.period_start=m.accounting_period
     and v.scenario_type=m.scenario_type
     and v.content_hash=m.version_content_hash
    where r.release_status='published' and v.status='published'
  ),
  projected_facts as (
    select cp.publication_id,cp.accounting_version_id,cp.published_at,
      f.corporation_id,f.store_id,f.department_id,f.accounting_period,
      cp.scenario_type,f.account_id,l.account_version_id,f.measure_type,
      f.amount,f.tax_basis,f.value_status,f.attribution_status,f.organization_scope_type
    from current_publications cp
    join accounting.accounting_facts f
      on f.accounting_version_id=cp.accounting_version_id
     and f.corporation_id=cp.corporation_id
     and f.accounting_period=cp.accounting_period
     and f.tax_basis='exclusive'
    join accounting.journal_lines l
      on l.journal_line_id=f.journal_line_id
     and l.accounting_version_id=f.accounting_version_id
     and l.account_id=f.account_id
     and l.measure_type=f.measure_type
    where not exists (
      select 1 from accounting.allocation_sets s
      where s.source_fact_id=f.accounting_fact_id
        and s.derived_accounting_version_id=cp.accounting_version_id
        and s.status='balanced'
    )
    union all
    select cp.publication_id,cp.accounting_version_id,cp.published_at,
      x.target_corporation_id,x.target_store_id,x.target_department_id,
      sf.accounting_period,cp.scenario_type,sf.account_id,l.account_version_id,
      sf.measure_type,x.allocated_amount,sf.tax_basis,'observed'::text,
      x.attribution_status,x.target_scope_type
    from current_publications cp
    join accounting.allocation_sets s
      on s.derived_accounting_version_id=cp.accounting_version_id
     and s.status='balanced'
    join accounting.accounting_allocations x
      on x.allocation_id=s.allocation_id
     and x.source_fact_id=s.source_fact_id
     and x.derived_accounting_version_id=s.derived_accounting_version_id
    join accounting.accounting_facts sf
      on sf.accounting_fact_id=s.source_fact_id
     and sf.accounting_version_id=cp.accounting_version_id
     and sf.corporation_id=cp.corporation_id
     and sf.accounting_period=cp.accounting_period
     and sf.tax_basis='exclusive'
    join accounting.journal_lines l
      on l.journal_line_id=sf.journal_line_id
     and l.accounting_version_id=sf.accounting_version_id
     and l.account_id=sf.account_id
     and l.measure_type=sf.measure_type
  )
  select p.publication_id,p.accounting_version_id,p.published_at,
    p.corporation_id,p.store_id,p.department_id,p.accounting_period,
    p.scenario_type,p.account_id,p.account_version_id,
    sm.statement_type,sm.statement_section,sm.statement_line,sm.display_order,
    p.measure_type,(p.amount*sm.contribution_sign)::numeric(20,4),
    p.tax_basis,p.value_status,p.attribution_status,p.organization_scope_type,
    sm.mapping_contract_version,
    case when p.value_status='not_applicable' then 'not_applicable' else 'complete' end,
    'current_published'::text
  from projected_facts p
  join accounting.accounts a
    on a.account_id=p.account_id and a.account_version_id=p.account_version_id
   and a.status='active' and p.accounting_period <@ a.effective_period
   and a.measure_type=p.measure_type
  join accounting.account_statement_mappings sm
    on sm.account_id=p.account_id and sm.account_version_id=p.account_version_id
   and sm.status='active' and p.accounting_period <@ sm.effective_period
   and sm.statement_type=a.statement_type
  where (sm.statement_type='pl' and p.measure_type='period_flow')
     or (sm.statement_type='bs' and p.measure_type='ending_balance');
$function$;

create view projection.accounting_publication_status_v1
with (security_invoker=true,security_barrier=true) as
select r.publication_id,m.accounting_version_id,m.corporation_id,
  m.accounting_period,m.scenario_type,r.published_at,
  'exclusive'::text as tax_basis,
  'published'::text as value_status,
  case when exists (
    select 1 from projection.m018_current_published_lines() x
    where x.publication_id=r.publication_id
  ) then 'complete' else 'no_statement_rows' end as coverage_status,
  'current_published'::text as publication_status
from accounting.publication_releases r
join accounting.publication_members m on m.publication_id=r.publication_id
join accounting.accounting_versions v
  on v.accounting_version_id=m.accounting_version_id
 and v.corporation_id=m.corporation_id
 and v.period_start=m.accounting_period
 and v.scenario_type=m.scenario_type
 and v.content_hash=m.version_content_hash
where r.release_status='published' and v.status='published';

create view projection.accounting_corporation_pl_v1
with (security_invoker=true,security_barrier=true) as
select publication_id,accounting_version_id,published_at,corporation_id,
  store_id,department_id,accounting_period,scenario_type,account_id,
  account_version_id,statement_section,statement_line,display_order,
  measure_type,amount,tax_basis,value_status,attribution_status,
  organization_scope_type,mapping_contract_version,coverage_status,
  publication_status
from projection.m018_current_published_lines()
where statement_type='pl' and measure_type='period_flow';

create view projection.accounting_corporation_bs_v1
with (security_invoker=true,security_barrier=true) as
select publication_id,accounting_version_id,published_at,corporation_id,
  store_id,department_id,accounting_period,scenario_type,account_id,
  account_version_id,statement_section,statement_line,display_order,
  measure_type,amount,tax_basis,value_status,attribution_status,
  organization_scope_type,mapping_contract_version,coverage_status,
  publication_status
from projection.m018_current_published_lines()
where statement_type='bs' and measure_type='ending_balance';

create view projection.accounting_store_profit_v1
with (security_invoker=true,security_barrier=true) as
select publication_id,accounting_version_id,published_at,corporation_id,
  store_id,accounting_period,scenario_type,account_id,account_version_id,
  statement_section,statement_line,display_order,measure_type,amount,tax_basis,
  value_status,attribution_status,mapping_contract_version,coverage_status,
  'accounting_confirmed'::text as profit_confirmation_status,
  accounting_period as accounting_confirmed_through_period,
  publication_status
from projection.m018_current_published_lines()
where statement_type='pl' and measure_type='period_flow'
  and organization_scope_type='store' and store_id is not null;

create view projection.accounting_corporation_comparison_v1
with (security_invoker=true,security_barrier=true) as
select c.publication_id,c.accounting_version_id,c.corporation_id,
  c.accounting_period,c.scenario_type,c.published_at,r.comparison_rule_id,
  r.rule_code,r.rule_version,r.period_shift_months,r.comparison_scenario,
  p.publication_id as comparison_publication_id,
  p.accounting_version_id as comparison_accounting_version_id,
  p.accounting_period as comparison_period,
  'exclusive'::text as tax_basis,
  case when p.publication_id is null then 'not_applicable' else 'published' end as value_status,
  case when p.publication_id is null then 'unavailable' else 'available' end as coverage_status,
  'current_published'::text as publication_status
from projection.accounting_publication_status_v1 c
join accounting.comparison_rules r
  on r.status='active'
 and c.accounting_period>=r.effective_from
 and (r.effective_to is null or c.accounting_period<r.effective_to)
left join projection.accounting_publication_status_v1 p
  on p.corporation_id=c.corporation_id
 and p.accounting_period=(c.accounting_period+(r.period_shift_months||' months')::interval)::date
 and p.scenario_type=r.comparison_scenario;

create view projection.accounting_cash_flow_v1
with (security_invoker=true,security_barrier=true) as
select publication_id,accounting_version_id,corporation_id,accounting_period,
  scenario_type,published_at,tax_basis,
  'not_applicable'::text as value_status,
  'cash_flow_gate_disabled'::text as coverage_status,
  publication_status
from projection.accounting_publication_status_v1
where false;

comment on function projection.m018_current_published_lines() is
  'Internal read-only current Publication line resolver. Balanced allocations replace their original unallocated source Fact without double counting.';
comment on view projection.accounting_publication_status_v1 is
  'Current published Accounting stream only; superseded and unpublished Versions are excluded.';
comment on view projection.accounting_corporation_pl_v1 is
  'Published tax-exclusive P/L period-flow lines classified only by M013 Statement Mapping.';
comment on view projection.accounting_corporation_bs_v1 is
  'Published tax-exclusive B/S ending-balance lines classified only by M013 Statement Mapping.';
comment on view projection.accounting_store_profit_v1 is
  'Published store-scope P/L lines only; corporation unallocated amounts are never assigned to a Store.';
comment on view projection.accounting_corporation_comparison_v1 is
  'Published comparison availability using M017 comparison rules; missing prior periods remain unavailable, never zero.';
comment on view projection.accounting_cash_flow_v1 is
  'Fail-closed empty contract until the Accounting Cash Flow evidence gate is separately approved.';

revoke all on function projection.m018_current_published_lines() from public,anon,authenticated,service_role;
revoke all on projection.accounting_publication_status_v1 from public,anon,authenticated,service_role;
revoke all on projection.accounting_corporation_pl_v1 from public,anon,authenticated,service_role;
revoke all on projection.accounting_corporation_bs_v1 from public,anon,authenticated,service_role;
revoke all on projection.accounting_store_profit_v1 from public,anon,authenticated,service_role;
revoke all on projection.accounting_corporation_comparison_v1 from public,anon,authenticated,service_role;
revoke all on projection.accounting_cash_flow_v1 from public,anon,authenticated,service_role;
