-- PR002 / ACF-03 / M014
-- Scenario, measure-type, and Accounting Version lifecycle skeleton only.
-- M015 Journal/Fact, M016 Validation/Approval, and M017 Publication are excluded.

create table accounting.scenario_contracts (
  scenario_type text primary key,
  created_at timestamptz not null default statement_timestamp(),
  constraint accounting_scenario_contracts_type_check check (
    scenario_type in ('actual', 'budget', 'forecast')
  )
);

insert into accounting.scenario_contracts (scenario_type)
values ('actual'), ('budget'), ('forecast');

create table accounting.measure_type_contracts (
  measure_type text primary key,
  statement_type text not null unique,
  created_at timestamptz not null default statement_timestamp(),
  constraint accounting_measure_type_contracts_type_check check (
    measure_type in ('period_flow', 'ending_balance')
  ),
  constraint accounting_measure_type_contracts_statement_check check (
    (measure_type = 'period_flow' and statement_type = 'pl')
    or (measure_type = 'ending_balance' and statement_type = 'bs')
  )
);

insert into accounting.measure_type_contracts (measure_type, statement_type)
values ('period_flow', 'pl'), ('ending_balance', 'bs');

create table accounting.accounting_versions (
  accounting_version_id uuid primary key default gen_random_uuid(),
  corporation_id uuid not null
    references core.corporation_identities(corporation_id) on delete restrict,
  scenario_type text not null
    references accounting.scenario_contracts(scenario_type) on delete restrict,
  version_type text not null,
  fiscal_year integer not null,
  period_grain text not null default 'month',
  period_start date not null,
  period_end date not null,
  reporting_period daterange generated always as (
    daterange(period_start, period_end, '[)')
  ) stored,
  version_sequence bigint not null,
  version_label text not null,
  status text not null default 'draft',
  source_snapshot_id uuid null
    references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_batch_id uuid null
    references accounting.import_batches(import_batch_id) on delete restrict,
  parent_version_id uuid null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  reverses_version_id uuid null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  content_hash text not null,
  created_at timestamptz not null default statement_timestamp(),
  created_by text not null,
  validating_at timestamptz null,
  validating_by text null,
  validated_at timestamptz null,
  validated_by text null,
  approved_at timestamptz null,
  approved_by text null,
  published_at timestamptz null,
  published_by text null,
  rejected_at timestamptz null,
  rejected_by text null,
  constraint accounting_versions_scenario_type_matrix check (
    (scenario_type = 'actual' and version_type in (
      'preliminary', 'operations_confirmed', 'accounting_confirmed', 'adjustment', 'reversal'
    ))
    or (scenario_type = 'budget' and version_type in (
      'baseline', 'revision', 'adjustment', 'reversal'
    ))
    or (scenario_type = 'forecast' and version_type in (
      'rolling_forecast', 'revision', 'adjustment', 'reversal'
    ))
  ),
  constraint accounting_versions_fiscal_year_check check (fiscal_year between 2000 and 2200),
  constraint accounting_versions_period_grain_check check (period_grain = 'month'),
  constraint accounting_versions_period_check check (
    period_start = date_trunc('month', period_start)::date
    and period_end = (period_start + interval '1 month')::date
  ),
  constraint accounting_versions_sequence_positive check (version_sequence > 0),
  constraint accounting_versions_label_nonblank check (
    char_length(btrim(version_label)) between 1 and 128
  ),
  constraint accounting_versions_status_check check (
    status in ('draft', 'validating', 'validated', 'approved', 'published', 'superseded', 'rejected')
  ),
  constraint accounting_versions_actual_source_check check (
    scenario_type <> 'actual' or source_batch_id is not null
  ),
  constraint accounting_versions_lineage_check check (
    (version_sequence = 1 and parent_version_id is null)
    or (version_sequence > 1 and parent_version_id is not null)
  ),
  constraint accounting_versions_reversal_check check (
    (version_type = 'reversal' and reverses_version_id is not null and version_sequence > 1)
    or (version_type <> 'reversal' and reverses_version_id is null)
  ),
  constraint accounting_versions_no_self_lineage check (
    (parent_version_id is null or parent_version_id <> accounting_version_id)
    and (reverses_version_id is null or reverses_version_id <> accounting_version_id)
  ),
  constraint accounting_versions_content_hash_format check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint accounting_versions_actor_ref check (
    created_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    and (validating_by is null or validating_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$')
    and (validated_by is null or validated_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$')
    and (approved_by is null or approved_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$')
    and (published_by is null or published_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$')
    and (rejected_by is null or rejected_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$')
  ),
  constraint accounting_versions_lifecycle_evidence check (
    (status = 'draft' and validating_at is null and validating_by is null
      and validated_at is null and validated_by is null and approved_at is null and approved_by is null
      and published_at is null and published_by is null and rejected_at is null and rejected_by is null)
    or (status = 'validating' and validating_at is not null and validating_by is not null
      and validated_at is null and validated_by is null and approved_at is null and approved_by is null
      and published_at is null and published_by is null and rejected_at is null and rejected_by is null)
    or (status = 'validated' and validating_at is not null and validating_by is not null
      and validated_at is not null and validated_by is not null and approved_at is null and approved_by is null
      and published_at is null and published_by is null and rejected_at is null and rejected_by is null)
    or (status = 'approved' and validated_at is not null and validated_by is not null
      and approved_at is not null and approved_by is not null and published_at is null and published_by is null
      and rejected_at is null and rejected_by is null)
    or (status in ('published', 'superseded') and validated_at is not null and validated_by is not null
      and approved_at is not null and approved_by is not null
      and published_at is not null and published_by is not null
      and rejected_at is null and rejected_by is null)
    or (status = 'rejected' and rejected_at is not null and rejected_by is not null
      and approved_at is null and approved_by is null and published_at is null and published_by is null)
  ),
  constraint accounting_versions_stream_sequence_unique unique (
    corporation_id, fiscal_year, period_start, scenario_type, version_sequence
  ),
  constraint accounting_versions_stream_label_unique unique (
    corporation_id, fiscal_year, period_start, scenario_type, version_label
  ),
  constraint accounting_versions_source_batch_unique unique (source_batch_id)
);

create index accounting_versions_stream_status_idx on accounting.accounting_versions
  (corporation_id, period_start, scenario_type, status, version_sequence desc);
create index accounting_versions_parent_idx on accounting.accounting_versions(parent_version_id)
  where parent_version_id is not null;
create index accounting_versions_reverses_idx on accounting.accounting_versions(reverses_version_id)
  where reverses_version_id is not null;
create index accounting_versions_snapshot_idx on accounting.accounting_versions(source_snapshot_id)
  where source_snapshot_id is not null;

create function accounting.guard_accounting_contract_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  raise exception 'BDF_ACCOUNTING_CONTRACT_IMMUTABLE';
end
$function$;

create function accounting.validate_accounting_version_insert()
returns trigger language plpgsql security invoker set search_path=''
as $function$
declare parent_row accounting.accounting_versions%rowtype;
begin
  if new.status <> 'draft' then
    raise exception 'BDF_ACCOUNTING_VERSION_INITIAL_STATUS_DRAFT_REQUIRED';
  end if;
  if new.source_batch_id is not null and not exists (
    select 1 from accounting.import_batches b
    where b.import_batch_id=new.source_batch_id and b.status='validated'
      and b.source_period = pg_catalog.daterange(new.period_start, new.period_end, '[)')
  ) then raise exception 'BDF_ACCOUNTING_VERSION_SOURCE_BATCH_NOT_ELIGIBLE'; end if;
  if new.parent_version_id is not null then
    select * into parent_row from accounting.accounting_versions where accounting_version_id=new.parent_version_id;
    if not found or parent_row.corporation_id<>new.corporation_id
      or parent_row.scenario_type<>new.scenario_type or parent_row.fiscal_year<>new.fiscal_year
      or parent_row.period_start<>new.period_start or parent_row.period_end<>new.period_end
      or parent_row.version_sequence>=new.version_sequence then
      raise exception 'BDF_ACCOUNTING_VERSION_PARENT_STREAM_MISMATCH';
    end if;
  end if;
  if new.reverses_version_id is not null and not exists (
    select 1 from accounting.accounting_versions r
    where r.accounting_version_id=new.reverses_version_id
      and r.corporation_id=new.corporation_id and r.scenario_type=new.scenario_type
      and r.fiscal_year=new.fiscal_year and r.period_start=new.period_start
      and r.period_end=new.period_end and r.version_sequence<new.version_sequence
  ) then raise exception 'BDF_ACCOUNTING_VERSION_REVERSAL_STREAM_MISMATCH'; end if;
  return new;
end
$function$;

create function accounting.guard_accounting_version_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $function$
begin
  if tg_op='DELETE' then raise exception 'BDF_ACCOUNTING_VERSION_IMMUTABLE'; end if;
  if row(old.accounting_version_id,old.corporation_id,old.scenario_type,old.version_type,
    old.fiscal_year,old.period_grain,old.period_start,old.period_end,old.version_sequence,
    old.version_label,old.source_snapshot_id,old.source_batch_id,old.parent_version_id,
    old.reverses_version_id,old.content_hash,old.created_at,old.created_by)
    is distinct from
    row(new.accounting_version_id,new.corporation_id,new.scenario_type,new.version_type,
    new.fiscal_year,new.period_grain,new.period_start,new.period_end,new.version_sequence,
    new.version_label,new.source_snapshot_id,new.source_batch_id,new.parent_version_id,
    new.reverses_version_id,new.content_hash,new.created_at,new.created_by) then
    raise exception 'BDF_ACCOUNTING_VERSION_CONTENT_IMMUTABLE';
  end if;
  if old.status='draft' and new.status='validating' then return new; end if;
  if old.status='validating' and new.status='validated' then
    raise exception 'BDF_ACCOUNTING_VALIDATION_NOT_AVAILABLE_BEFORE_M016';
  end if;
  if old.status='validated' and new.status='approved' then
    raise exception 'BDF_ACCOUNTING_APPROVAL_NOT_AVAILABLE_BEFORE_M016';
  end if;
  if old.status='approved' and new.status='published' then
    raise exception 'BDF_ACCOUNTING_PUBLICATION_NOT_AVAILABLE_BEFORE_M017';
  end if;
  raise exception 'BDF_ACCOUNTING_VERSION_INVALID_TRANSITION';
end
$function$;

create function accounting.account_measure_type_matches(
  p_account_id uuid, p_measure_type text, p_as_of date
) returns boolean language sql stable security invoker set search_path=''
as $function$
  select exists (
    select 1 from accounting.accounts a
    join accounting.measure_type_contracts m on m.measure_type=p_measure_type
    where a.account_id=p_account_id and a.effective_period @> p_as_of
      and a.status='active' and a.statement_type=m.statement_type
      and a.measure_type=m.measure_type
  )
$function$;

create trigger guard_scenario_contract_mutation before update or delete on accounting.scenario_contracts
for each row execute function accounting.guard_accounting_contract_mutation();
create trigger guard_measure_contract_mutation before update or delete on accounting.measure_type_contracts
for each row execute function accounting.guard_accounting_contract_mutation();
create trigger validate_accounting_version_insert before insert on accounting.accounting_versions
for each row execute function accounting.validate_accounting_version_insert();
create trigger guard_accounting_version_mutation before update or delete on accounting.accounting_versions
for each row execute function accounting.guard_accounting_version_mutation();

alter table accounting.scenario_contracts enable row level security;
alter table accounting.scenario_contracts force row level security;
alter table accounting.measure_type_contracts enable row level security;
alter table accounting.measure_type_contracts force row level security;
alter table accounting.accounting_versions enable row level security;
alter table accounting.accounting_versions force row level security;

revoke all on accounting.scenario_contracts from public,anon,authenticated,service_role;
revoke all on accounting.measure_type_contracts from public,anon,authenticated,service_role;
revoke all on accounting.accounting_versions from public,anon,authenticated,service_role;
revoke execute on function accounting.guard_accounting_contract_mutation() from public,anon,authenticated,service_role;
revoke execute on function accounting.validate_accounting_version_insert() from public,anon,authenticated,service_role;
revoke execute on function accounting.guard_accounting_version_mutation() from public,anon,authenticated,service_role;
revoke execute on function accounting.account_measure_type_matches(uuid,text,date) from public,anon,authenticated,service_role;
