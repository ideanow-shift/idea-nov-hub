-- PR002 / ACF-02 / M013
-- Canonical Account identity, immutable effective-dated versions, and typed P/L/B/S mapping.
-- No Accounting Version, Fact, Cash Flow Fact, Publication, Projection, or data load.

create table accounting.account_identities (
  account_id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default statement_timestamp(),
  created_by text not null,
  constraint accounting_account_identities_actor_ref check (
    char_length(created_by) between 3 and 256
    and created_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  )
);

comment on table accounting.account_identities is
  'Stable Canonical Account UUID registry. Production internal identifiers are prohibited.';

create table accounting.accounts (
  account_version_id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references accounting.account_identities(account_id) on delete restrict,
  version_no bigint not null,
  account_code text not null,
  account_name text not null,
  account_type text not null,
  statement_type text not null,
  account_category text not null,
  normal_balance text not null,
  sign_policy text not null,
  measure_type text,
  parent_account_id uuid
    references accounting.account_identities(account_id) on delete restrict,
  display_order integer not null,
  effective_from date not null,
  effective_to date,
  effective_period daterange generated always as (
    daterange(effective_from, effective_to, '[)')
  ) stored,
  status text not null,
  source_snapshot_id uuid
    references governance.master_source_snapshots(source_snapshot_id) on delete restrict,
  source_version text not null,
  mapping_contract_version text not null,
  content_digest text not null,
  supersedes_account_version_id uuid,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_accounts_version_positive check (version_no > 0),
  constraint accounting_accounts_code_format check (
    char_length(account_code) between 1 and 64
    and account_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
  ),
  constraint accounting_accounts_name_nonblank check (
    char_length(btrim(account_name)) between 1 and 256
  ),
  constraint accounting_accounts_type_check check (
    account_type in ('posting', 'memo')
  ),
  constraint accounting_accounts_statement_type_check check (
    statement_type in ('pl', 'bs', 'cash_flow_support', 'memo', 'non_statement')
  ),
  constraint accounting_accounts_category_check check (
    (statement_type = 'pl' and account_category in (
      'revenue', 'cost_of_sales', 'gross_profit', 'personnel_cost',
      'operating_expense', 'operating_profit'
    ))
    or (statement_type = 'bs' and account_category in (
      'current_asset', 'noncurrent_asset', 'current_liability',
      'noncurrent_liability', 'equity'
    ))
    or (statement_type = 'cash_flow_support' and account_category = 'cash_flow_support')
    or (statement_type = 'memo' and account_category = 'memo')
    or (statement_type = 'non_statement' and account_category = 'non_statement')
  ),
  constraint accounting_accounts_type_statement_consistency check (
    (statement_type = 'memo' and account_type = 'memo')
    or (statement_type <> 'memo' and account_type = 'posting')
  ),
  constraint accounting_accounts_normal_balance_check check (
    normal_balance in ('debit', 'credit', 'none')
  ),
  constraint accounting_accounts_balance_statement_consistency check (
    (statement_type in ('pl', 'bs', 'cash_flow_support') and normal_balance in ('debit', 'credit'))
    or (statement_type in ('memo', 'non_statement') and normal_balance = 'none')
  ),
  constraint accounting_accounts_sign_policy_check check (
    sign_policy in ('debit_positive', 'credit_positive', 'natural', 'invert_for_display')
  ),
  constraint accounting_accounts_measure_statement_consistency check (
    (statement_type = 'pl' and measure_type = 'period_flow')
    or (statement_type = 'bs' and measure_type = 'ending_balance')
    or (statement_type not in ('pl', 'bs') and measure_type is null)
  ),
  constraint accounting_accounts_parent_not_self check (
    parent_account_id is null or parent_account_id <> account_id
  ),
  constraint accounting_accounts_display_order_nonnegative check (display_order >= 0),
  constraint accounting_accounts_period_valid check (
    effective_to is null or effective_to > effective_from
  ),
  constraint accounting_accounts_status_check check (status in ('active', 'inactive')),
  constraint accounting_accounts_source_version_nonblank check (
    char_length(btrim(source_version)) between 1 and 128
  ),
  constraint accounting_accounts_mapping_contract_nonblank check (
    char_length(btrim(mapping_contract_version)) between 1 and 128
  ),
  constraint accounting_accounts_content_digest_format check (
    content_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_accounts_actor_ref check (
    char_length(recorded_by) between 3 and 256
    and recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_accounts_identity_version_unique unique (account_id, version_no),
  constraint accounting_accounts_identity_version_row_unique unique (account_id, account_version_id),
  constraint accounting_accounts_identity_start_unique unique (account_id, effective_from),
  constraint accounting_accounts_supersedes_fk foreign key (
    account_id, supersedes_account_version_id
  ) references accounting.accounts(account_id, account_version_id) on delete restrict,
  constraint accounting_accounts_identity_period_excl exclude using gist (
    account_id with =,
    effective_period with &&
  ),
  constraint accounting_accounts_code_period_excl exclude using gist (
    account_code with =,
    effective_period with &&
  )
);

create index accounting_accounts_parent_idx
  on accounting.accounts (parent_account_id)
  where parent_account_id is not null;
create index accounting_accounts_snapshot_idx
  on accounting.accounts (source_snapshot_id)
  where source_snapshot_id is not null;
create index accounting_accounts_current_idx
  on accounting.accounts (statement_type, account_code, account_id)
  where status = 'active' and effective_to is null;

comment on table accounting.accounts is
  'Append-only effective-dated Account definitions. Current means active and containing the requested as-of date; no mutable latest-row rule.';

create table accounting.account_statement_mappings (
  statement_mapping_version_id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  account_version_id uuid not null,
  version_no bigint not null,
  statement_type text not null,
  statement_section text not null,
  statement_line text not null,
  display_order integer not null,
  aggregation_behavior text not null,
  contribution_sign smallint not null,
  effective_from date not null,
  effective_to date,
  effective_period daterange generated always as (
    daterange(effective_from, effective_to, '[)')
  ) stored,
  status text not null,
  mapping_contract_version text not null,
  content_digest text not null,
  supersedes_mapping_version_id uuid,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_statement_mappings_account_version_fk foreign key (
    account_id, account_version_id
  ) references accounting.accounts(account_id, account_version_id) on delete restrict,
  constraint accounting_statement_mappings_version_positive check (version_no > 0),
  constraint accounting_statement_mappings_type_check check (statement_type in ('pl', 'bs')),
  constraint accounting_statement_mappings_section_check check (
    (statement_type = 'pl' and statement_section in (
      'revenue', 'cost_of_sales', 'gross_profit', 'personnel_cost',
      'operating_expense', 'operating_profit'
    ))
    or (statement_type = 'bs' and statement_section in (
      'current_asset', 'noncurrent_asset', 'current_liability',
      'noncurrent_liability', 'equity'
    ))
  ),
  constraint accounting_statement_mappings_line_format check (
    char_length(statement_line) between 1 and 128
    and statement_line ~ '^[a-z][a-z0-9._-]*$'
  ),
  constraint accounting_statement_mappings_display_order_nonnegative check (display_order >= 0),
  constraint accounting_statement_mappings_aggregation_check check (
    aggregation_behavior in ('add', 'subtract', 'display_only')
  ),
  constraint accounting_statement_mappings_sign_consistency check (
    (aggregation_behavior = 'add' and contribution_sign = 1)
    or (aggregation_behavior = 'subtract' and contribution_sign = -1)
    or (aggregation_behavior = 'display_only' and contribution_sign = 0)
  ),
  constraint accounting_statement_mappings_period_valid check (
    effective_to is null or effective_to > effective_from
  ),
  constraint accounting_statement_mappings_status_check check (status in ('active', 'inactive')),
  constraint accounting_statement_mappings_contract_nonblank check (
    char_length(btrim(mapping_contract_version)) between 1 and 128
  ),
  constraint accounting_statement_mappings_content_digest_format check (
    content_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_statement_mappings_actor_ref check (
    char_length(recorded_by) between 3 and 256
    and recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_statement_mappings_identity_version_unique unique (account_id, version_no),
  constraint accounting_statement_mappings_identity_version_row_unique unique (
    account_id, statement_mapping_version_id
  ),
  constraint accounting_statement_mappings_supersedes_fk foreign key (
    account_id, supersedes_mapping_version_id
  ) references accounting.account_statement_mappings(account_id, statement_mapping_version_id) on delete restrict,
  constraint accounting_statement_mappings_account_period_excl exclude using gist (
    account_id with =,
    statement_type with =,
    effective_period with &&
  )
);

create index accounting_statement_mappings_account_version_idx
  on accounting.account_statement_mappings (account_version_id);
create index accounting_statement_mappings_current_idx
  on accounting.account_statement_mappings (statement_type, statement_section, display_order, account_id)
  where status = 'active' and effective_to is null;

comment on table accounting.account_statement_mappings is
  'Typed append-only P/L or B/S display mapping. Cash Flow is not a Canonical statement mapping in M013.';

create function accounting.guard_account_master_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'BDF_ACCOUNT_MASTER_IMMUTABLE';
  end if;
  return new;
end
$function$;

create function accounting.validate_account_version_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  cycle_found boolean;
begin
  if new.parent_account_id is not null then
    if not exists (
      select 1
      from accounting.accounts parent
      where parent.account_id = new.parent_account_id
        and parent.statement_type = new.statement_type
        and parent.effective_period @> new.effective_from
        and (new.effective_to is null or parent.effective_to is null or parent.effective_to >= new.effective_to)
    ) then
      raise exception 'BDF_ACCOUNT_PARENT_VERSION_NOT_COMPATIBLE';
    end if;

    with recursive ancestors(account_id, parent_account_id) as (
      select parent.account_id, parent.parent_account_id
      from accounting.accounts parent
      where parent.account_id = new.parent_account_id
        and parent.effective_period @> new.effective_from
      union all
      select parent.account_id, parent.parent_account_id
      from accounting.accounts parent
      join ancestors a on parent.account_id = a.parent_account_id
      where parent.effective_period @> new.effective_from
    )
    select coalesce(bool_or(account_id = new.account_id), false)
      into cycle_found
    from ancestors;

    if cycle_found then
      raise exception 'BDF_ACCOUNT_HIERARCHY_CYCLE';
    end if;
  end if;
  return new;
end
$function$;

create function accounting.validate_statement_mapping_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from accounting.accounts a
    where a.account_id = new.account_id
      and a.account_version_id = new.account_version_id
      and a.statement_type = new.statement_type
      and a.status = 'active'
      and a.effective_from <= new.effective_from
      and (new.effective_to is null
        or a.effective_to is null
        or a.effective_to >= new.effective_to)
  ) then
    raise exception 'BDF_ACCOUNT_STATEMENT_MAPPING_MISMATCH';
  end if;
  return new;
end
$function$;

create trigger guard_account_identities_mutation
before update or delete on accounting.account_identities
for each row execute function accounting.guard_account_master_mutation();
create trigger validate_account_version_insert
before insert on accounting.accounts
for each row execute function accounting.validate_account_version_insert();
create trigger guard_accounts_mutation
before update or delete on accounting.accounts
for each row execute function accounting.guard_account_master_mutation();
create trigger validate_statement_mapping_insert
before insert on accounting.account_statement_mappings
for each row execute function accounting.validate_statement_mapping_insert();
create trigger guard_statement_mappings_mutation
before update or delete on accounting.account_statement_mappings
for each row execute function accounting.guard_account_master_mutation();

alter table accounting.account_identities enable row level security;
alter table accounting.account_identities force row level security;
alter table accounting.accounts enable row level security;
alter table accounting.accounts force row level security;
alter table accounting.account_statement_mappings enable row level security;
alter table accounting.account_statement_mappings force row level security;

revoke all on accounting.account_identities from public, anon, authenticated, service_role;
revoke all on accounting.accounts from public, anon, authenticated, service_role;
revoke all on accounting.account_statement_mappings from public, anon, authenticated, service_role;
revoke execute on function accounting.guard_account_master_mutation() from public, anon, authenticated, service_role;
revoke execute on function accounting.validate_account_version_insert() from public, anon, authenticated, service_role;
revoke execute on function accounting.validate_statement_mapping_insert() from public, anon, authenticated, service_role;
