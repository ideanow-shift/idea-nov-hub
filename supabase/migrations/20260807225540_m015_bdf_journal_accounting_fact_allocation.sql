-- PR002 / ACF-04 / M015
-- Journal source evidence, one-to-one Canonical Accounting Facts, and derived allocation layer.
-- M016 Validation/Approval/Audit, M017 Publication, M018 Consumer projections, and data load are excluded.

create table accounting.journal_entries (
  journal_entry_id uuid primary key default gen_random_uuid(),
  accounting_version_id uuid not null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  source_kind text not null,
  source_system text not null,
  source_batch_id uuid null
    references accounting.import_batches(import_batch_id) on delete restrict,
  source_reference_digest text not null,
  source_entry_key_digest text not null,
  entry_date date not null,
  posting_period date not null,
  description_code text null,
  evidence_digest text not null,
  entry_type text not null,
  reversal_of_journal_entry_id uuid null
    references accounting.journal_entries(journal_entry_id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_journal_entries_source_kind_check check (
    source_kind in ('import', 'planning')
  ),
  constraint accounting_journal_entries_source_system_format check (
    source_system ~ '^[a-z][a-z0-9._-]{1,63}$'
  ),
  constraint accounting_journal_entries_source_shape check (
    (source_kind = 'import' and source_batch_id is not null)
    or (source_kind = 'planning' and source_batch_id is null)
  ),
  constraint accounting_journal_entries_reference_digest_format check (
    source_reference_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_journal_entries_entry_key_digest_format check (
    source_entry_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_journal_entries_month_period_check check (
    posting_period = date_trunc('month', posting_period)::date
    and entry_date >= posting_period
    and entry_date < (posting_period + interval '1 month')::date
  ),
  constraint accounting_journal_entries_description_code_check check (
    description_code is null
    or (char_length(description_code) between 1 and 128
      and description_code ~ '^[a-z][a-z0-9._-]*$')
  ),
  constraint accounting_journal_entries_evidence_digest_format check (
    evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_journal_entries_type_check check (
    entry_type in ('source', 'opening_balance', 'closing_balance', 'adjustment', 'reversal', 'planning')
  ),
  constraint accounting_journal_entries_reversal_shape check (
    (entry_type = 'reversal' and reversal_of_journal_entry_id is not null)
    or (entry_type <> 'reversal' and reversal_of_journal_entry_id is null)
  ),
  constraint accounting_journal_entries_no_self_reversal check (
    reversal_of_journal_entry_id is null or reversal_of_journal_entry_id <> journal_entry_id
  ),
  constraint accounting_journal_entries_actor_ref check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_journal_entries_version_source_unique unique (
    accounting_version_id, source_system, source_entry_key_digest
  ),
  constraint accounting_journal_entries_version_row_unique unique (
    journal_entry_id, accounting_version_id
  )
);

create index accounting_journal_entries_batch_idx
  on accounting.journal_entries(source_batch_id) where source_batch_id is not null;
create index accounting_journal_entries_reversal_idx
  on accounting.journal_entries(reversal_of_journal_entry_id)
  where reversal_of_journal_entry_id is not null;
create index accounting_journal_entries_period_idx
  on accounting.journal_entries(accounting_version_id, posting_period, entry_date);

comment on table accounting.journal_entries is
  'Immutable posting envelope. Source identifiers are irreversible digests; raw source IDs and PII are prohibited.';

create table accounting.journal_lines (
  journal_line_id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null,
  accounting_version_id uuid not null,
  source_system text not null,
  source_batch_id uuid null,
  source_file_id uuid null,
  staging_line_id uuid null
    references accounting.import_staging_lines(staging_line_id) on delete restrict,
  source_record_key_digest text not null,
  source_line_no bigint not null,
  stable_line_key_digest text not null,
  line_sequence integer not null,
  account_id uuid not null
    references accounting.account_identities(account_id) on delete restrict,
  account_version_id uuid not null
    references accounting.accounts(account_version_id) on delete restrict,
  corporation_id uuid not null
    references core.corporation_identities(corporation_id) on delete restrict,
  corporation_version_id uuid not null
    references core.corporations(corporation_version_id) on delete restrict,
  organization_scope_type text not null,
  store_id uuid null references core.store_identities(store_id) on delete restrict,
  store_version_id uuid null references core.stores(store_version_id) on delete restrict,
  store_relationship_version_id uuid null
    references core.corporation_store_relationships(relationship_version_id) on delete restrict,
  department_id uuid null references core.department_identities(department_id) on delete restrict,
  department_version_id uuid null references core.departments(department_version_id) on delete restrict,
  measure_type text not null
    references accounting.measure_type_contracts(measure_type) on delete restrict,
  posting_side text not null,
  planning_contract_version text null,
  normalization_evidence_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_journal_lines_entry_version_fk foreign key (
    journal_entry_id, accounting_version_id
  ) references accounting.journal_entries(journal_entry_id, accounting_version_id) on delete restrict,
  constraint accounting_journal_lines_batch_file_fk foreign key (
    source_batch_id, source_file_id
  ) references accounting.import_files(import_batch_id, import_file_id) on delete restrict,
  constraint accounting_journal_lines_source_system_format check (
    source_system ~ '^[a-z][a-z0-9._-]{1,63}$'
  ),
  constraint accounting_journal_lines_record_digest_format check (
    source_record_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_journal_lines_source_line_positive check (source_line_no > 0),
  constraint accounting_journal_lines_stable_digest_format check (
    stable_line_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_journal_lines_sequence_positive check (line_sequence > 0),
  constraint accounting_journal_lines_scope_shape check (
    (organization_scope_type = 'corporation'
      and store_id is null and store_version_id is null and store_relationship_version_id is null
      and department_id is null and department_version_id is null)
    or (organization_scope_type = 'store'
      and store_id is not null and store_version_id is not null
      and store_relationship_version_id is not null
      and department_id is null and department_version_id is null)
    or (organization_scope_type = 'department'
      and department_id is not null and department_version_id is not null
      and store_id is null and store_version_id is null and store_relationship_version_id is null)
  ),
  constraint accounting_journal_lines_posting_side_check check (
    posting_side in ('debit', 'credit', 'zero', 'not_applicable')
  ),
  constraint accounting_journal_lines_source_shape check (
    (source_batch_id is not null and source_file_id is not null and staging_line_id is not null
      and planning_contract_version is null)
    or (source_batch_id is null and source_file_id is null and staging_line_id is null
      and planning_contract_version is not null
      and char_length(btrim(planning_contract_version)) between 1 and 128)
  ),
  constraint accounting_journal_lines_evidence_digest_format check (
    normalization_evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_journal_lines_actor_ref check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_journal_lines_entry_sequence_unique unique (
    journal_entry_id, line_sequence
  ),
  constraint accounting_journal_lines_row_version_unique unique (
    journal_line_id, accounting_version_id, journal_entry_id
  )
);

create unique index accounting_journal_lines_import_stable_unique
  on accounting.journal_lines (
    source_system, source_batch_id, source_file_id, source_record_key_digest,
    source_line_no, accounting_version_id, account_id, measure_type
  ) where source_batch_id is not null;
create unique index accounting_journal_lines_planning_stable_unique
  on accounting.journal_lines (
    source_system, source_record_key_digest, source_line_no,
    accounting_version_id, account_id, measure_type
  ) where source_batch_id is null;
create index accounting_journal_lines_version_idx on accounting.journal_lines(accounting_version_id);
create index accounting_journal_lines_batch_file_idx
  on accounting.journal_lines(source_batch_id, source_file_id) where source_batch_id is not null;
create index accounting_journal_lines_staging_idx
  on accounting.journal_lines(staging_line_id) where staging_line_id is not null;
create index accounting_journal_lines_account_idx
  on accounting.journal_lines(account_id, account_version_id);
create index accounting_journal_lines_account_version_idx
  on accounting.journal_lines(account_version_id);
create index accounting_journal_lines_corporation_idx
  on accounting.journal_lines(corporation_id, corporation_version_id);
create index accounting_journal_lines_corporation_version_idx
  on accounting.journal_lines(corporation_version_id);
create index accounting_journal_lines_store_idx
  on accounting.journal_lines(store_id, store_version_id) where store_id is not null;
create index accounting_journal_lines_store_version_idx
  on accounting.journal_lines(store_version_id) where store_version_id is not null;
create index accounting_journal_lines_relationship_idx
  on accounting.journal_lines(store_relationship_version_id)
  where store_relationship_version_id is not null;
create index accounting_journal_lines_department_idx
  on accounting.journal_lines(department_id, department_version_id) where department_id is not null;
create index accounting_journal_lines_department_version_idx
  on accounting.journal_lines(department_version_id) where department_version_id is not null;

comment on table accounting.journal_lines is
  'Immutable source-posting line identity and Canonical mapping evidence. Monetary truth exists once in the one-to-one Accounting Fact.';

create table accounting.accounting_facts (
  accounting_fact_id uuid primary key default gen_random_uuid(),
  journal_line_id uuid not null unique,
  journal_entry_id uuid not null,
  accounting_version_id uuid not null,
  corporation_id uuid not null
    references core.corporation_identities(corporation_id) on delete restrict,
  organization_scope_type text not null,
  store_id uuid null references core.store_identities(store_id) on delete restrict,
  department_id uuid null references core.department_identities(department_id) on delete restrict,
  accounting_period date not null,
  account_id uuid not null references accounting.account_identities(account_id) on delete restrict,
  measure_type text not null
    references accounting.measure_type_contracts(measure_type) on delete restrict,
  amount numeric(20,4) null,
  currency_code char(3) not null,
  tax_basis text not null,
  value_status text not null,
  attribution_status text not null,
  derivation_status text not null,
  source_line_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_facts_line_version_fk foreign key (
    journal_line_id, accounting_version_id, journal_entry_id
  ) references accounting.journal_lines(
    journal_line_id, accounting_version_id, journal_entry_id
  ) on delete restrict,
  constraint accounting_facts_month_period_check check (
    accounting_period = date_trunc('month', accounting_period)::date
  ),
  constraint accounting_facts_scope_shape check (
    (organization_scope_type = 'corporation' and store_id is null and department_id is null)
    or (organization_scope_type = 'store' and store_id is not null and department_id is null)
    or (organization_scope_type = 'department' and store_id is null and department_id is not null)
  ),
  constraint accounting_facts_currency_check check (currency_code = 'JPY'),
  constraint accounting_facts_tax_basis_check check (tax_basis = 'exclusive'),
  constraint accounting_facts_value_status_check check (
    value_status in ('observed', 'zero', 'not_applicable')
  ),
  constraint accounting_facts_amount_semantics check (
    (value_status = 'observed' and amount is not null and amount <> 0)
    or (value_status = 'zero' and amount = 0)
    or (value_status = 'not_applicable' and amount is null)
  ),
  constraint accounting_facts_amount_finite check (
    amount is null or amount not in (
      'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric
    )
  ),
  constraint accounting_facts_attribution_check check (
    (attribution_status = 'directly_attributed'
      and organization_scope_type in ('corporation', 'store', 'department')
      and value_status in ('observed', 'zero'))
    or (attribution_status = 'unallocated'
      and organization_scope_type = 'corporation'
      and value_status = 'observed')
    or (attribution_status = 'not_applicable'
      and organization_scope_type in ('corporation', 'store', 'department')
      and value_status = 'not_applicable')
  ),
  constraint accounting_facts_derivation_check check (
    derivation_status in ('source_normalized', 'planning', 'adjustment', 'reversal')
  ),
  constraint accounting_facts_source_line_digest_format check (
    source_line_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_facts_actor_ref check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  )
);

create index accounting_facts_entry_idx on accounting.accounting_facts(journal_entry_id);
create index accounting_facts_version_period_idx
  on accounting.accounting_facts(accounting_version_id, accounting_period, measure_type);
create index accounting_facts_account_idx on accounting.accounting_facts(account_id);
create index accounting_facts_corporation_idx on accounting.accounting_facts(corporation_id);
create index accounting_facts_store_idx on accounting.accounting_facts(store_id) where store_id is not null;
create index accounting_facts_department_idx
  on accounting.accounting_facts(department_id) where department_id is not null;

comment on table accounting.accounting_facts is
  'One immutable tax-exclusive Canonical Fact per Journal Line. Scenario is derived only from Accounting Version.';

create table accounting.allocation_rule_versions (
  allocation_rule_version_id uuid primary key default gen_random_uuid(),
  allocation_rule_id uuid not null,
  version_no bigint not null,
  rule_code text not null,
  basis_type text not null,
  source_scope_type text not null,
  target_scope_type text not null,
  precision_scale smallint not null,
  rounding_mode text not null,
  remainder_handling text not null,
  effective_from date not null,
  effective_to date null,
  effective_period daterange generated always as (
    daterange(effective_from, effective_to, '[)')
  ) stored,
  status text not null default 'candidate',
  approval_reference text not null,
  mapping_contract_version text not null,
  content_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_allocation_rules_version_positive check (version_no > 0),
  constraint accounting_allocation_rules_code_format check (
    rule_code ~ '^[a-z][a-z0-9._-]{1,127}$'
  ),
  constraint accounting_allocation_rules_basis_check check (
    basis_type in ('fixed_ratio', 'driver_weight', 'equal_split', 'manual_evidence')
  ),
  constraint accounting_allocation_rules_source_scope_check check (
    source_scope_type in ('corporation', 'store', 'department')
  ),
  constraint accounting_allocation_rules_target_scope_check check (
    target_scope_type in ('store', 'department')
  ),
  constraint accounting_allocation_rules_precision_check check (precision_scale between 0 and 4),
  constraint accounting_allocation_rules_rounding_check check (
    rounding_mode in ('floor', 'ceiling', 'half_up', 'half_even', 'truncate')
  ),
  constraint accounting_allocation_rules_remainder_check check (
    remainder_handling in ('explicit_unallocated', 'largest_remainder', 'explicit_adjustment')
  ),
  constraint accounting_allocation_rules_period_check check (
    effective_to is null or effective_to > effective_from
  ),
  constraint accounting_allocation_rules_status_check check (
    status in ('candidate', 'active', 'inactive', 'superseded')
  ),
  constraint accounting_allocation_rules_approval_nonblank check (
    char_length(btrim(approval_reference)) between 1 and 256
  ),
  constraint accounting_allocation_rules_contract_nonblank check (
    char_length(btrim(mapping_contract_version)) between 1 and 128
  ),
  constraint accounting_allocation_rules_digest_format check (
    content_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_allocation_rules_actor_ref check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_allocation_rules_identity_version_unique unique (
    allocation_rule_id, version_no
  ),
  constraint accounting_allocation_rules_identity_period_excl exclude using gist (
    allocation_rule_id with =,
    effective_period with &&
  )
);

create index accounting_allocation_rules_current_idx
  on accounting.allocation_rule_versions(rule_code, source_scope_type, target_scope_type)
  where status in ('candidate', 'active') and effective_to is null;

comment on table accounting.allocation_rule_versions is
  'Append-only effective-dated allocation rule evidence. M016 owns approval activation; M015 accepts candidate rows only.';

create table accounting.allocation_sets (
  allocation_id uuid primary key default gen_random_uuid(),
  source_fact_id uuid not null
    references accounting.accounting_facts(accounting_fact_id) on delete restrict,
  allocation_rule_version_id uuid not null
    references accounting.allocation_rule_versions(allocation_rule_version_id) on delete restrict,
  derived_accounting_version_id uuid not null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  allocable_amount numeric(20,4) not null,
  currency_code char(3) not null,
  tax_basis text not null,
  rounding_difference_amount numeric(20,4) not null,
  status text not null default 'draft',
  evidence_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  balanced_at timestamptz null,
  balanced_by text null,
  constraint accounting_allocation_sets_currency_check check (currency_code = 'JPY'),
  constraint accounting_allocation_sets_tax_basis_check check (tax_basis = 'exclusive'),
  constraint accounting_allocation_sets_amount_finite check (
    allocable_amount not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and rounding_difference_amount not in (
      'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric
    )
  ),
  constraint accounting_allocation_sets_status_check check (status in ('draft', 'balanced')),
  constraint accounting_allocation_sets_evidence_digest_format check (
    evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_allocation_sets_actor_ref check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    and (balanced_by is null
      or balanced_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$')
  ),
  constraint accounting_allocation_sets_lifecycle_evidence check (
    (status = 'draft' and balanced_at is null and balanced_by is null)
    or (status = 'balanced' and balanced_at is not null and balanced_by is not null)
  ),
  constraint accounting_allocation_sets_source_derived_unique unique (
    source_fact_id, derived_accounting_version_id
  )
);

create index accounting_allocation_sets_rule_idx
  on accounting.allocation_sets(allocation_rule_version_id);
create index accounting_allocation_sets_derived_version_idx
  on accounting.allocation_sets(derived_accounting_version_id);

create table accounting.accounting_allocations (
  accounting_allocation_id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null
    references accounting.allocation_sets(allocation_id) on delete restrict,
  source_fact_id uuid not null
    references accounting.accounting_facts(accounting_fact_id) on delete restrict,
  derived_accounting_version_id uuid not null
    references accounting.accounting_versions(accounting_version_id) on delete restrict,
  target_scope_type text not null,
  target_corporation_id uuid not null
    references core.corporation_identities(corporation_id) on delete restrict,
  target_corporation_version_id uuid not null
    references core.corporations(corporation_version_id) on delete restrict,
  target_store_id uuid null references core.store_identities(store_id) on delete restrict,
  target_store_version_id uuid null references core.stores(store_version_id) on delete restrict,
  target_store_relationship_version_id uuid null
    references core.corporation_store_relationships(relationship_version_id) on delete restrict,
  target_department_id uuid null references core.department_identities(department_id) on delete restrict,
  target_department_version_id uuid null
    references core.departments(department_version_id) on delete restrict,
  attribution_status text not null,
  allocation_ratio numeric(18,12) null,
  allocated_amount numeric(20,4) not null,
  rounding_adjustment_amount numeric(20,4) not null,
  evidence_digest text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  recorded_by text not null,
  constraint accounting_allocations_scope_shape check (
    (target_scope_type = 'corporation'
      and target_store_id is null and target_store_version_id is null
      and target_store_relationship_version_id is null
      and target_department_id is null and target_department_version_id is null)
    or (target_scope_type = 'store'
      and target_store_id is not null and target_store_version_id is not null
      and target_store_relationship_version_id is not null
      and target_department_id is null and target_department_version_id is null)
    or (target_scope_type = 'department'
      and target_department_id is not null and target_department_version_id is not null
      and target_store_id is null and target_store_version_id is null
      and target_store_relationship_version_id is null)
  ),
  constraint accounting_allocations_attribution_check check (
    (attribution_status = 'allocated'
      and target_scope_type in ('store', 'department')
      and allocation_ratio is not null
      and allocation_ratio > 0 and allocation_ratio <= 1)
    or (attribution_status = 'unallocated'
      and target_scope_type = 'corporation'
      and allocation_ratio is null)
  ),
  constraint accounting_allocations_amount_nonzero check (allocated_amount <> 0),
  constraint accounting_allocations_amount_finite check (
    (allocation_ratio is null or allocation_ratio not in (
      'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric
    ))
    and allocated_amount not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    and rounding_adjustment_amount not in (
      'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric
    )
  ),
  constraint accounting_allocations_evidence_digest_format check (
    evidence_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_allocations_actor_ref check (
    recorded_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_allocations_target_unique unique nulls not distinct (
    allocation_id, target_scope_type, target_corporation_id,
    target_store_id, target_department_id
  )
);

create index accounting_allocations_source_fact_idx
  on accounting.accounting_allocations(source_fact_id);
create index accounting_allocations_derived_version_idx
  on accounting.accounting_allocations(derived_accounting_version_id);
create index accounting_allocations_target_corporation_idx
  on accounting.accounting_allocations(target_corporation_id, target_corporation_version_id);
create index accounting_allocations_target_corporation_version_idx
  on accounting.accounting_allocations(target_corporation_version_id);
create index accounting_allocations_target_store_idx
  on accounting.accounting_allocations(target_store_id, target_store_version_id)
  where target_store_id is not null;
create index accounting_allocations_target_store_version_idx
  on accounting.accounting_allocations(target_store_version_id)
  where target_store_version_id is not null;
create index accounting_allocations_target_relationship_idx
  on accounting.accounting_allocations(target_store_relationship_version_id)
  where target_store_relationship_version_id is not null;
create index accounting_allocations_target_department_idx
  on accounting.accounting_allocations(target_department_id, target_department_version_id)
  where target_department_id is not null;
create index accounting_allocations_target_department_version_idx
  on accounting.accounting_allocations(target_department_version_id)
  where target_department_version_id is not null;

comment on table accounting.accounting_allocations is
  'Append-only derived allocation results. Original Fact is never updated; unallocated remainder remains explicit corporation scope.';

create function accounting.organization_scope_is_valid(
  p_scope_type text,
  p_corporation_id uuid,
  p_corporation_version_id uuid,
  p_store_id uuid,
  p_store_version_id uuid,
  p_store_relationship_version_id uuid,
  p_department_id uuid,
  p_department_version_id uuid,
  p_period_start date,
  p_period_end date
) returns boolean
language sql stable security invoker set search_path = ''
as $function$
  select exists (
    select 1
    from core.corporations c
    where c.corporation_version_id = p_corporation_version_id
      and c.corporation_id = p_corporation_id
      and c.status = 'active'
      and c.effective_from <= p_period_start
      and (c.effective_to is null or c.effective_to >= p_period_end)
  ) and case p_scope_type
    when 'corporation' then
      p_store_id is null and p_store_version_id is null
      and p_store_relationship_version_id is null
      and p_department_id is null and p_department_version_id is null
    when 'store' then
      p_store_id is not null and p_store_version_id is not null
      and p_store_relationship_version_id is not null
      and p_department_id is null and p_department_version_id is null
      and exists (
        select 1 from core.stores s
        where s.store_version_id = p_store_version_id and s.store_id = p_store_id
          and s.status = 'active' and s.effective_from <= p_period_start
          and (s.effective_to is null or s.effective_to >= p_period_end)
      )
      and exists (
        select 1 from core.corporation_store_relationships r
        where r.relationship_version_id = p_store_relationship_version_id
          and r.store_id = p_store_id and r.corporation_id = p_corporation_id
          and r.relationship_type = 'accounting'
          and r.operating_model in ('direct', 'franchise', 'other')
          and r.effective_from <= p_period_start
          and (r.effective_to is null or r.effective_to >= p_period_end)
      )
    when 'department' then
      p_department_id is not null and p_department_version_id is not null
      and p_store_id is null and p_store_version_id is null
      and p_store_relationship_version_id is null
      and exists (
        select 1 from core.departments d
        where d.department_version_id = p_department_version_id
          and d.department_id = p_department_id
          and d.corporation_id = p_corporation_id and d.status = 'active'
          and d.effective_from <= p_period_start
          and (d.effective_to is null or d.effective_to >= p_period_end)
      )
    else false
  end
$function$;

create function accounting.account_version_matches_period(
  p_account_id uuid,
  p_account_version_id uuid,
  p_measure_type text,
  p_period_start date,
  p_period_end date
) returns boolean
language sql stable security invoker set search_path = ''
as $function$
  select exists (
    select 1
    from accounting.accounts a
    join accounting.measure_type_contracts m on m.measure_type = p_measure_type
    where a.account_id = p_account_id
      and a.account_version_id = p_account_version_id
      and a.status = 'active'
      and a.account_type = 'posting'
      and a.statement_type in ('pl', 'bs')
      and a.account_category not in ('gross_profit', 'operating_profit')
      and a.statement_type = m.statement_type
      and a.measure_type = p_measure_type
      and a.effective_from <= p_period_start
      and (a.effective_to is null or a.effective_to >= p_period_end)
  )
$function$;

create function accounting.reject_ledger_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  raise exception 'BDF_ACCOUNTING_LEDGER_IMMUTABLE';
end
$function$;

create function accounting.validate_journal_entry_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v accounting.accounting_versions%rowtype;
  original_entry accounting.journal_entries%rowtype;
begin
  select * into v from accounting.accounting_versions
  where accounting_version_id = new.accounting_version_id for update;
  if not found or v.status <> 'draft' then
    raise exception 'BDF_JOURNAL_REQUIRES_DRAFT_VERSION';
  end if;
  if new.posting_period <> v.period_start
    or new.entry_date < v.period_start or new.entry_date >= v.period_end then
    raise exception 'BDF_JOURNAL_PERIOD_MISMATCH';
  end if;

  if new.source_kind = 'import' then
    if v.source_batch_id is distinct from new.source_batch_id
      or not exists (
        select 1 from accounting.import_batches b
        where b.import_batch_id = new.source_batch_id
          and b.source_system = new.source_system
          and b.status = 'validated'
          and b.source_period = v.reporting_period
      ) then
      raise exception 'BDF_JOURNAL_IMPORT_SOURCE_NOT_ELIGIBLE';
    end if;
  elsif v.scenario_type = 'actual' or v.source_batch_id is not null then
    raise exception 'BDF_JOURNAL_ACTUAL_IMPORT_REQUIRED';
  end if;

  if v.version_type = 'reversal' then
    if new.entry_type <> 'reversal' or new.reversal_of_journal_entry_id is null then
      raise exception 'BDF_JOURNAL_REVERSAL_LINEAGE_REQUIRED';
    end if;
    select * into original_entry from accounting.journal_entries
    where journal_entry_id = new.reversal_of_journal_entry_id;
    if not found or original_entry.accounting_version_id is distinct from v.reverses_version_id then
      raise exception 'BDF_JOURNAL_REVERSAL_STREAM_MISMATCH';
    end if;
  elsif v.version_type = 'adjustment' then
    if new.entry_type <> 'adjustment' then
      raise exception 'BDF_JOURNAL_ADJUSTMENT_ENTRY_REQUIRED';
    end if;
  elsif v.scenario_type = 'actual' then
    if new.entry_type not in ('source', 'opening_balance', 'closing_balance') then
      raise exception 'BDF_JOURNAL_ACTUAL_ENTRY_TYPE_INVALID';
    end if;
  elsif new.entry_type <> 'planning' then
    raise exception 'BDF_JOURNAL_PLANNING_ENTRY_REQUIRED';
  end if;
  return new;
end
$function$;

create function accounting.validate_journal_line_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v accounting.accounting_versions%rowtype;
  e accounting.journal_entries%rowtype;
begin
  select * into v from accounting.accounting_versions
  where accounting_version_id = new.accounting_version_id for update;
  if not found or v.status <> 'draft' then
    raise exception 'BDF_JOURNAL_LINE_REQUIRES_DRAFT_VERSION';
  end if;
  select * into e from accounting.journal_entries
  where journal_entry_id = new.journal_entry_id;
  if not found or e.accounting_version_id <> new.accounting_version_id
    or e.source_system <> new.source_system
    or e.source_batch_id is distinct from new.source_batch_id then
    raise exception 'BDF_JOURNAL_LINE_ENTRY_MISMATCH';
  end if;
  if not accounting.account_version_matches_period(
    new.account_id, new.account_version_id, new.measure_type, v.period_start, v.period_end
  ) then
    raise exception 'BDF_JOURNAL_LINE_ACCOUNT_MEASURE_MISMATCH';
  end if;
  if not accounting.organization_scope_is_valid(
    new.organization_scope_type, new.corporation_id, new.corporation_version_id,
    new.store_id, new.store_version_id, new.store_relationship_version_id,
    new.department_id, new.department_version_id, v.period_start, v.period_end
  ) or new.corporation_id <> v.corporation_id then
    raise exception 'BDF_JOURNAL_LINE_ORGANIZATION_SCOPE_INVALID';
  end if;

  if new.source_batch_id is not null then
    if e.source_kind <> 'import' or not exists (
      select 1
      from accounting.import_staging_lines s
      join accounting.import_batches b on b.import_batch_id = s.import_batch_id
      where s.staging_line_id = new.staging_line_id
        and s.import_batch_id = new.source_batch_id
        and s.import_file_id = new.source_file_id
        and s.source_record_key_digest = new.source_record_key_digest
        and s.source_line_no = new.source_line_no
        and s.accounting_period = v.period_start
        and s.scenario_type = v.scenario_type
        and s.measure_type = new.measure_type
        and s.validation_status = 'valid'
        and s.normalization_status = 'passed'
        and s.mapping_status = 'passed'
        and s.tax_basis = 'exclusive'
        and (s.normalized_amount is null or s.normalized_amount not in (
          'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric
        ))
        and b.status = 'validated'
        and b.source_system = new.source_system
    ) then
      raise exception 'BDF_JOURNAL_LINE_IMPORT_SOURCE_NOT_ELIGIBLE';
    end if;
  elsif e.source_kind <> 'planning' or v.scenario_type = 'actual' then
    raise exception 'BDF_JOURNAL_LINE_PLANNING_SOURCE_INVALID';
  end if;
  return new;
end
$function$;

create function accounting.validate_accounting_fact_insert()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v accounting.accounting_versions%rowtype;
  l accounting.journal_lines%rowtype;
  e accounting.journal_entries%rowtype;
  expected_derivation text;
begin
  select * into v from accounting.accounting_versions
  where accounting_version_id = new.accounting_version_id for update;
  if not found or v.status <> 'draft' then
    raise exception 'BDF_ACCOUNTING_FACT_REQUIRES_DRAFT_VERSION';
  end if;
  select * into l from accounting.journal_lines where journal_line_id = new.journal_line_id;
  if not found then
    raise exception 'BDF_ACCOUNTING_FACT_JOURNAL_MISMATCH';
  end if;
  select * into e from accounting.journal_entries where journal_entry_id = new.journal_entry_id;
  if not found or l.journal_entry_id <> new.journal_entry_id
    or l.accounting_version_id <> new.accounting_version_id
    or l.corporation_id <> new.corporation_id
    or l.organization_scope_type <> new.organization_scope_type
    or l.store_id is distinct from new.store_id
    or l.department_id is distinct from new.department_id
    or l.account_id <> new.account_id
    or l.measure_type <> new.measure_type
    or l.stable_line_key_digest <> new.source_line_digest
    or new.accounting_period <> v.period_start then
    raise exception 'BDF_ACCOUNTING_FACT_JOURNAL_MISMATCH';
  end if;

  if l.source_batch_id is not null and not exists (
    select 1 from accounting.import_staging_lines s
    where s.staging_line_id = l.staging_line_id
      and s.normalized_amount is not distinct from new.amount
      and s.value_status = new.value_status
      and s.tax_basis = new.tax_basis
      and s.validation_status = 'valid'
      and s.normalization_status = 'passed'
      and s.mapping_status = 'passed'
  ) then
    raise exception 'BDF_ACCOUNTING_FACT_TAX_NORMALIZATION_MISMATCH';
  end if;

  if not coalesce(
    (l.posting_side = 'debit' and new.value_status = 'observed' and new.amount > 0)
    or (l.posting_side = 'credit' and new.value_status = 'observed' and new.amount < 0)
    or (l.posting_side = 'zero' and new.value_status = 'zero'
      and new.amount is not distinct from 0::numeric)
    or (l.posting_side = 'not_applicable' and new.value_status = 'not_applicable'
      and new.amount is null),
    false
  ) then
    raise exception 'BDF_ACCOUNTING_FACT_POSTING_SIDE_MISMATCH';
  end if;

  expected_derivation := case e.entry_type
    when 'source' then 'source_normalized'
    when 'opening_balance' then 'source_normalized'
    when 'closing_balance' then 'source_normalized'
    when 'planning' then 'planning'
    when 'adjustment' then 'adjustment'
    when 'reversal' then 'reversal'
  end;
  if new.derivation_status <> expected_derivation then
    raise exception 'BDF_ACCOUNTING_FACT_DERIVATION_MISMATCH';
  end if;
  return new;
end
$function$;

create function accounting.guard_allocation_rule_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'candidate' then
      raise exception 'BDF_ALLOCATION_RULE_INITIAL_STATUS_CANDIDATE_REQUIRED';
    end if;
    return new;
  end if;
  raise exception 'BDF_ALLOCATION_RULE_IMMUTABLE';
end
$function$;

create function accounting.guard_allocation_set_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  sf accounting.accounting_facts%rowtype;
  source_v accounting.accounting_versions%rowtype;
  derived_v accounting.accounting_versions%rowtype;
  rule_v accounting.allocation_rule_versions%rowtype;
  allocation_count bigint;
  unallocated_count bigint;
  amount_total numeric(20,4);
  ratio_total numeric(30,12);
  rounding_total numeric(20,4);
begin
  if tg_op = 'DELETE' then
    raise exception 'BDF_ALLOCATION_SET_IMMUTABLE';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended((case when tg_op = 'INSERT' then new.source_fact_id else old.source_fact_id end)::text, 15015)
  );
  select * into sf from accounting.accounting_facts
  where accounting_fact_id = case when tg_op = 'INSERT' then new.source_fact_id else old.source_fact_id end;
  if not found then raise exception 'BDF_ALLOCATION_SOURCE_FACT_NOT_FOUND'; end if;
  perform 1 from accounting.accounting_versions
  where accounting_version_id in (
    sf.accounting_version_id,
    case when tg_op = 'INSERT' then new.derived_accounting_version_id else old.derived_accounting_version_id end
  ) order by accounting_version_id for update;
  select * into source_v from accounting.accounting_versions
  where accounting_version_id = sf.accounting_version_id;
  select * into derived_v from accounting.accounting_versions
  where accounting_version_id = case when tg_op = 'INSERT' then new.derived_accounting_version_id else old.derived_accounting_version_id end;
  select * into rule_v from accounting.allocation_rule_versions
  where allocation_rule_version_id = case when tg_op = 'INSERT' then new.allocation_rule_version_id else old.allocation_rule_version_id end;

  if source_v.status <> 'draft' or derived_v.status <> 'draft' then
    raise exception 'BDF_ALLOCATION_REQUIRES_DRAFT_VERSIONS';
  end if;
  if sf.attribution_status <> 'unallocated' or sf.organization_scope_type <> 'corporation'
    or sf.value_status <> 'observed' or sf.amount is null or sf.amount = 0 then
    raise exception 'BDF_ALLOCATION_SOURCE_FACT_NOT_ALLOCABLE';
  end if;
  if derived_v.corporation_id <> source_v.corporation_id
    or derived_v.scenario_type <> source_v.scenario_type
    or derived_v.period_start <> source_v.period_start
    or derived_v.period_end <> source_v.period_end
    or not (
      derived_v.accounting_version_id = source_v.accounting_version_id
      or (derived_v.version_sequence > source_v.version_sequence
        and derived_v.parent_version_id = source_v.accounting_version_id)
    ) then
    raise exception 'BDF_ALLOCATION_DERIVED_VERSION_MISMATCH';
  end if;
  if rule_v.status <> 'candidate'
    or rule_v.source_scope_type <> sf.organization_scope_type
    or rule_v.effective_from > source_v.period_start
    or (rule_v.effective_to is not null and rule_v.effective_to < source_v.period_end) then
    raise exception 'BDF_ALLOCATION_RULE_NOT_ELIGIBLE';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.allocable_amount <> sf.amount
      or new.currency_code <> sf.currency_code or new.tax_basis <> sf.tax_basis then
      raise exception 'BDF_ALLOCATION_SET_SOURCE_MISMATCH';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - 'status' - 'balanced_at' - 'balanced_by')
    <> (to_jsonb(old) - 'status' - 'balanced_at' - 'balanced_by') then
    raise exception 'BDF_ALLOCATION_SET_CONTENT_IMMUTABLE';
  end if;
  if old.status <> 'draft' or new.status <> 'balanced' then
    raise exception 'BDF_ALLOCATION_SET_INVALID_TRANSITION';
  end if;

  select count(*),
    count(*) filter (where attribution_status = 'unallocated'),
    coalesce(sum(allocated_amount), 0),
    coalesce(sum(allocation_ratio) filter (where attribution_status = 'allocated'), 0),
    coalesce(sum(rounding_adjustment_amount), 0)
  into allocation_count, unallocated_count, amount_total, ratio_total, rounding_total
  from accounting.accounting_allocations where allocation_id = new.allocation_id;

  if allocation_count = 0 or unallocated_count > 1
    or amount_total <> new.allocable_amount
    or ratio_total > 1
    or rounding_total <> new.rounding_difference_amount then
    raise exception 'BDF_ALLOCATION_RECONCILIATION_FAILED';
  end if;
  return new;
end
$function$;

create function accounting.guard_accounting_allocation_mutation()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  aset accounting.allocation_sets%rowtype;
  sf accounting.accounting_facts%rowtype;
  derived_v accounting.accounting_versions%rowtype;
  rule_v accounting.allocation_rule_versions%rowtype;
  running_total numeric(20,4);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'BDF_ACCOUNTING_ALLOCATION_IMMUTABLE';
  end if;
  select * into aset from accounting.allocation_sets
  where allocation_id = new.allocation_id for update;
  if not found or aset.status <> 'draft' then
    raise exception 'BDF_ALLOCATION_SET_NOT_DRAFT';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(aset.source_fact_id::text, 15015)
  );
  select * into sf from accounting.accounting_facts where accounting_fact_id = aset.source_fact_id;
  select * into derived_v from accounting.accounting_versions
  where accounting_version_id = aset.derived_accounting_version_id for update;
  select * into rule_v from accounting.allocation_rule_versions
  where allocation_rule_version_id = aset.allocation_rule_version_id;
  if derived_v.status <> 'draft'
    or new.source_fact_id <> aset.source_fact_id
    or new.derived_accounting_version_id <> aset.derived_accounting_version_id
    or new.target_corporation_id <> sf.corporation_id then
    raise exception 'BDF_ACCOUNTING_ALLOCATION_PARENT_MISMATCH';
  end if;
  if not accounting.organization_scope_is_valid(
    new.target_scope_type, new.target_corporation_id, new.target_corporation_version_id,
    new.target_store_id, new.target_store_version_id, new.target_store_relationship_version_id,
    new.target_department_id, new.target_department_version_id,
    derived_v.period_start, derived_v.period_end
  ) then
    raise exception 'BDF_ACCOUNTING_ALLOCATION_SCOPE_INVALID';
  end if;
  if new.attribution_status = 'allocated'
    and new.target_scope_type <> rule_v.target_scope_type then
    raise exception 'BDF_ACCOUNTING_ALLOCATION_RULE_SCOPE_MISMATCH';
  end if;
  if (aset.allocable_amount > 0 and new.allocated_amount <= 0)
    or (aset.allocable_amount < 0 and new.allocated_amount >= 0) then
    raise exception 'BDF_ACCOUNTING_ALLOCATION_SIGN_MISMATCH';
  end if;
  select coalesce(sum(allocated_amount), 0) into running_total
  from accounting.accounting_allocations where allocation_id = new.allocation_id;
  if pg_catalog.abs(running_total + new.allocated_amount) > pg_catalog.abs(aset.allocable_amount) then
    raise exception 'BDF_ACCOUNTING_ALLOCATION_OVERAGE';
  end if;
  return new;
end
$function$;

create function accounting.guard_import_membership_seal_m015()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  batch_id uuid;
  batch_status text;
begin
  if tg_table_name = 'import_batches' then
    if tg_op = 'UPDATE'
      and old.status not in ('validated', 'rejected', 'promoted', 'superseded')
      and new.status in ('validated', 'rejected', 'promoted', 'superseded') then
      lock table accounting.import_files in share mode;
      lock table accounting.import_staging_lines in share mode;
    end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    batch_id := old.import_batch_id;
    select b.status into batch_status
    from accounting.import_batches b where b.import_batch_id = batch_id;
    if batch_status in ('validated', 'rejected', 'promoted', 'superseded') then
      raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    batch_id := new.import_batch_id;
    select b.status into batch_status
    from accounting.import_batches b where b.import_batch_id = batch_id;
    if batch_status in ('validated', 'rejected', 'promoted', 'superseded') then
      raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_MEMBERSHIP_SEALED';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

-- Prefix ensures the lock/seal executes before M012's guard_* trigger.
create trigger a_m015_lock_import_batch_membership
before update of status on accounting.import_batches
for each row execute function accounting.guard_import_membership_seal_m015();
create trigger a_m015_seal_import_files
before insert or update or delete on accounting.import_files
for each row execute function accounting.guard_import_membership_seal_m015();
create trigger a_m015_seal_import_staging_lines
before insert or update or delete on accounting.import_staging_lines
for each row execute function accounting.guard_import_membership_seal_m015();

create trigger validate_journal_entry_insert
before insert on accounting.journal_entries
for each row execute function accounting.validate_journal_entry_insert();
create trigger reject_journal_entry_mutation
before update or delete on accounting.journal_entries
for each row execute function accounting.reject_ledger_mutation();

create trigger validate_journal_line_insert
before insert on accounting.journal_lines
for each row execute function accounting.validate_journal_line_insert();
create trigger reject_journal_line_mutation
before update or delete on accounting.journal_lines
for each row execute function accounting.reject_ledger_mutation();

create trigger validate_accounting_fact_insert
before insert on accounting.accounting_facts
for each row execute function accounting.validate_accounting_fact_insert();
create trigger reject_accounting_fact_mutation
before update or delete on accounting.accounting_facts
for each row execute function accounting.reject_ledger_mutation();

create trigger guard_allocation_rule_mutation
before insert or update or delete on accounting.allocation_rule_versions
for each row execute function accounting.guard_allocation_rule_mutation();
create trigger guard_allocation_set_mutation
before insert or update or delete on accounting.allocation_sets
for each row execute function accounting.guard_allocation_set_mutation();
create trigger guard_accounting_allocation_mutation
before insert or update or delete on accounting.accounting_allocations
for each row execute function accounting.guard_accounting_allocation_mutation();

alter table accounting.journal_entries enable row level security;
alter table accounting.journal_entries force row level security;
alter table accounting.journal_lines enable row level security;
alter table accounting.journal_lines force row level security;
alter table accounting.accounting_facts enable row level security;
alter table accounting.accounting_facts force row level security;
alter table accounting.allocation_rule_versions enable row level security;
alter table accounting.allocation_rule_versions force row level security;
alter table accounting.allocation_sets enable row level security;
alter table accounting.allocation_sets force row level security;
alter table accounting.accounting_allocations enable row level security;
alter table accounting.accounting_allocations force row level security;

revoke all on accounting.journal_entries from public, anon, authenticated, service_role;
revoke all on accounting.journal_lines from public, anon, authenticated, service_role;
revoke all on accounting.accounting_facts from public, anon, authenticated, service_role;
revoke all on accounting.allocation_rule_versions from public, anon, authenticated, service_role;
revoke all on accounting.allocation_sets from public, anon, authenticated, service_role;
revoke all on accounting.accounting_allocations from public, anon, authenticated, service_role;

revoke execute on function accounting.organization_scope_is_valid(text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date)
  from public, anon, authenticated, service_role;
revoke execute on function accounting.account_version_matches_period(uuid,uuid,text,date,date)
  from public, anon, authenticated, service_role;
revoke execute on function accounting.reject_ledger_mutation()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.validate_journal_entry_insert()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.validate_journal_line_insert()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.validate_accounting_fact_insert()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.guard_allocation_rule_mutation()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.guard_allocation_set_mutation()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.guard_accounting_allocation_mutation()
  from public, anon, authenticated, service_role;
revoke execute on function accounting.guard_import_membership_seal_m015()
  from public, anon, authenticated, service_role;
