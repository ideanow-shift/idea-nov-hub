-- PR002 / ACF-01 / M012
-- Accounting namespace, default-deny, Import Batch/File, and typed staging boundary.
-- Authoring artifact only. No data load, Consumer API, or database apply is authorized.

create schema accounting;

revoke all on schema accounting from public, anon, authenticated, service_role;

alter default privileges in schema accounting
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema accounting
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema accounting
  revoke execute on functions from public, anon, authenticated, service_role;

create table accounting.import_batches (
  import_batch_id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_version text not null,
  source_file text not null,
  source_period daterange not null,
  imported_at timestamptz not null default statement_timestamp(),
  source_hash text not null,
  schema_version text not null,
  mapping_contract_version text not null,
  tax_normalization_contract_version text not null,
  status text not null default 'received',
  created_by text not null,
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_import_batches_source_system_format check (
    source_system ~ '^[a-z][a-z0-9._-]{1,63}$'
  ),
  constraint accounting_import_batches_source_version_nonblank check (
    char_length(btrim(source_version)) between 1 and 128
  ),
  constraint accounting_import_batches_source_file_safe check (
    char_length(btrim(source_file)) between 1 and 256
    and source_file !~ '[\\/]'
    and source_file !~ '[[:cntrl:]]'
  ),
  constraint accounting_import_batches_period_bounded check (
    not isempty(source_period)
    and lower(source_period) is not null
    and upper(source_period) is not null
    and lower_inc(source_period)
    and not upper_inc(source_period)
  ),
  constraint accounting_import_batches_hash_format check (
    source_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_batches_schema_version_nonblank check (
    char_length(btrim(schema_version)) between 1 and 128
  ),
  constraint accounting_import_batches_mapping_version_nonblank check (
    char_length(btrim(mapping_contract_version)) between 1 and 128
  ),
  constraint accounting_import_batches_tax_version_nonblank check (
    char_length(btrim(tax_normalization_contract_version)) between 1 and 128
  ),
  constraint accounting_import_batches_status_check check (
    status in ('received', 'validating', 'validated', 'rejected', 'promoted', 'superseded')
  ),
  constraint accounting_import_batches_actor_ref check (
    char_length(created_by) between 3 and 256
    and created_by ~ '^(canonical|service|audit):[A-Za-z0-9][A-Za-z0-9._:/-]*$'
  ),
  constraint accounting_import_batches_source_version_unique
    unique (source_system, source_version),
  constraint accounting_import_batches_source_digest_unique
    unique (source_system, source_hash, schema_version)
);

create index accounting_import_batches_period_status_idx
  on accounting.import_batches (lower(source_period), upper(source_period), status);

comment on table accounting.import_batches is
  'Immutable Accounting source identity plus controlled lifecycle status. No credentials, host names, Production IDs, or raw data.';

create table accounting.import_files (
  import_file_id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null
    references accounting.import_batches(import_batch_id) on delete restrict,
  file_name text not null,
  file_type text not null,
  file_hash text not null,
  row_count bigint not null,
  validation_status text not null default 'received',
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_import_files_name_safe check (
    char_length(btrim(file_name)) between 1 and 256
    and file_name !~ '[\\/]'
    and file_name !~ '[[:cntrl:]]'
  ),
  constraint accounting_import_files_type_format check (
    file_type ~ '^[a-z][a-z0-9._-]{1,63}$'
  ),
  constraint accounting_import_files_hash_format check (
    file_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_files_row_count_nonnegative check (row_count >= 0),
  constraint accounting_import_files_validation_status_check check (
    validation_status in ('received', 'validating', 'validated', 'rejected')
  ),
  constraint accounting_import_files_batch_hash_unique unique (import_batch_id, file_hash),
  constraint accounting_import_files_batch_file_unique unique (import_batch_id, import_file_id)
);

create index accounting_import_files_batch_status_idx
  on accounting.import_files (import_batch_id, validation_status);

comment on table accounting.import_files is
  'Logical sanitized file metadata only. Paths, binary payloads, credentials, and raw workbook cells are prohibited.';

create table accounting.import_staging_lines (
  staging_line_id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null,
  import_file_id uuid not null,
  source_record_key_digest text not null,
  source_line_no bigint not null,
  row_digest text not null,
  accounting_period date not null,
  corporation_source_key_digest text not null,
  store_source_key_digest text,
  department_source_key_digest text,
  account_source_key_digest text not null,
  scenario_type text not null,
  measure_type text not null,
  source_amount numeric(20,4),
  source_tax_basis text not null,
  source_tax_category text not null,
  source_tax_rate numeric(9,6),
  tax_rate_source_version text not null,
  rounding_mode text not null,
  rounding_scope text not null,
  rounding_unit numeric(20,4),
  rounding_difference_amount numeric(20,4),
  normalized_amount numeric(20,4),
  tax_basis text,
  value_status text not null,
  normalization_status text not null default 'pending',
  mapping_status text not null default 'pending',
  validation_status text not null default 'received',
  recorded_at timestamptz not null default statement_timestamp(),
  constraint accounting_import_staging_lines_batch_file_fk
    foreign key (import_batch_id, import_file_id)
    references accounting.import_files(import_batch_id, import_file_id)
    on delete restrict,
  constraint accounting_import_staging_lines_record_digest_format check (
    source_record_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_staging_lines_line_positive check (source_line_no > 0),
  constraint accounting_import_staging_lines_row_digest_format check (
    row_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_staging_lines_period_month_start check (
    accounting_period = date_trunc('month', accounting_period)::date
  ),
  constraint accounting_import_staging_lines_corporation_digest_format check (
    corporation_source_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_staging_lines_store_digest_format check (
    store_source_key_digest is null or store_source_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_staging_lines_department_digest_format check (
    department_source_key_digest is null or department_source_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_staging_lines_account_digest_format check (
    account_source_key_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint accounting_import_staging_lines_scenario_check check (
    scenario_type in ('actual', 'budget', 'forecast')
  ),
  constraint accounting_import_staging_lines_measure_check check (
    measure_type in ('period_flow', 'ending_balance')
  ),
  constraint accounting_import_staging_lines_source_tax_basis_check check (
    source_tax_basis in ('exclusive', 'inclusive', 'exempt', 'non_taxable', 'unknown')
  ),
  constraint accounting_import_staging_lines_tax_category_format check (
    source_tax_category ~ '^[a-z][a-z0-9._-]{1,63}$'
  ),
  constraint accounting_import_staging_lines_tax_rate_range check (
    source_tax_rate is null or source_tax_rate between 0 and 1
  ),
  constraint accounting_import_staging_lines_tax_rate_source_nonblank check (
    char_length(btrim(tax_rate_source_version)) between 1 and 128
  ),
  constraint accounting_import_staging_lines_rounding_mode_check check (
    rounding_mode in ('floor', 'ceiling', 'half_up', 'half_even', 'truncate', 'not_applicable', 'unknown')
  ),
  constraint accounting_import_staging_lines_rounding_scope_check check (
    rounding_scope in ('line', 'document', 'not_applicable', 'unknown')
  ),
  constraint accounting_import_staging_lines_rounding_unit_positive check (
    rounding_unit is null or rounding_unit > 0
  ),
  constraint accounting_import_staging_lines_canonical_tax_basis check (
    tax_basis is null or tax_basis = 'exclusive'
  ),
  constraint accounting_import_staging_lines_value_status_check check (
    value_status in ('observed', 'zero', 'missing', 'not_applicable', 'pending', 'validation_failed')
  ),
  constraint accounting_import_staging_lines_amount_semantics check (
    (value_status = 'observed' and normalized_amount is not null and normalized_amount <> 0)
    or (value_status = 'zero' and normalized_amount = 0)
    or (value_status in ('missing', 'not_applicable', 'pending', 'validation_failed') and normalized_amount is null)
  ),
  constraint accounting_import_staging_lines_normalization_status_check check (
    normalization_status in ('pending', 'passed', 'failed')
  ),
  constraint accounting_import_staging_lines_mapping_status_check check (
    mapping_status in ('pending', 'passed', 'failed')
  ),
  constraint accounting_import_staging_lines_validation_status_check check (
    validation_status in ('received', 'valid', 'invalid', 'excluded')
  ),
  constraint accounting_import_staging_lines_normalization_consistency check (
    (normalization_status = 'passed' and source_tax_basis <> 'unknown'
      and tax_rate_source_version <> 'unknown'
      and rounding_mode <> 'unknown'
      and rounding_scope <> 'unknown'
      and tax_basis = 'exclusive'
      and (source_tax_basis not in ('inclusive', 'exclusive') or source_tax_rate is not null)
      and value_status in ('observed', 'zero', 'not_applicable'))
    or (normalization_status = 'failed' and tax_basis is null and value_status = 'validation_failed')
    or (normalization_status = 'pending' and tax_basis is null and value_status in ('missing', 'pending'))
  ),
  constraint accounting_import_staging_lines_stable_key_unique unique (
    import_batch_id,
    import_file_id,
    source_record_key_digest,
    source_line_no
  )
);

create index accounting_import_staging_lines_gate_idx
  on accounting.import_staging_lines (
    import_batch_id,
    validation_status,
    normalization_status,
    mapping_status
  );

create index accounting_import_staging_lines_period_scenario_idx
  on accounting.import_staging_lines (accounting_period, scenario_type, measure_type);

comment on table accounting.import_staging_lines is
  'Typed quarantine candidates only. No free-form payload, source identifier, Production internal ID, PII, credential, or secret.';

create function accounting.guard_import_boundary_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'import_batches' then
      if new.status <> 'received' then
        raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_INITIAL_STATUS_INVALID';
      end if;
    elsif tg_table_name = 'import_files' then
      if new.validation_status <> 'received' then
        raise exception 'BDF_ACCOUNTING_IMPORT_FILE_INITIAL_STATUS_INVALID';
      end if;
    elsif tg_table_name = 'import_staging_lines' then
      if new.validation_status <> 'received' then
        raise exception 'BDF_ACCOUNTING_STAGING_LINE_INITIAL_STATUS_INVALID';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'BDF_ACCOUNTING_IMPORT_DELETE_FORBIDDEN';
  end if;

  if tg_table_name = 'import_batches' then
    if (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
      raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_IMMUTABLE';
    end if;
    if new.status in ('promoted', 'superseded') then
      raise exception 'BDF_ACCOUNTING_IMPORT_PROMOTION_NOT_AVAILABLE_BEFORE_M014';
    end if;
    if not (
      (old.status = 'received' and new.status = 'validating')
      or (old.status = 'validating' and new.status in ('validated', 'rejected'))
    ) then
      raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_INVALID_TRANSITION';
    end if;
    if new.status = 'validated' and (
      not exists (
        select 1 from accounting.import_files f
        where f.import_batch_id = new.import_batch_id
      )
      or exists (
        select 1 from accounting.import_files f
        where f.import_batch_id = new.import_batch_id
          and f.validation_status <> 'validated'
      )
      or not exists (
        select 1 from accounting.import_staging_lines s
        where s.import_batch_id = new.import_batch_id
      )
      or exists (
        select 1 from accounting.import_staging_lines s
        where s.import_batch_id = new.import_batch_id
          and s.validation_status not in ('valid', 'excluded')
      )
      or not exists (
        select 1 from accounting.import_staging_lines s
        where s.import_batch_id = new.import_batch_id
          and s.validation_status = 'valid'
      )
      or exists (
        select 1
        from accounting.import_files f
        where f.import_batch_id = new.import_batch_id
          and f.row_count <> (
            select count(*)
            from accounting.import_staging_lines s
            where s.import_batch_id = f.import_batch_id
              and s.import_file_id = f.import_file_id
          )
      )
    ) then
      raise exception 'BDF_ACCOUNTING_IMPORT_BATCH_VALIDATION_INCOMPLETE';
    end if;
  elsif tg_table_name = 'import_files' then
    if (to_jsonb(new) - 'validation_status') <> (to_jsonb(old) - 'validation_status') then
      raise exception 'BDF_ACCOUNTING_IMPORT_FILE_IMMUTABLE';
    end if;
    if not (
      (old.validation_status = 'received' and new.validation_status = 'validating')
      or (old.validation_status = 'validating' and new.validation_status in ('validated', 'rejected'))
    ) then
      raise exception 'BDF_ACCOUNTING_IMPORT_FILE_INVALID_TRANSITION';
    end if;
  else
    if old.validation_status in ('valid', 'invalid', 'excluded') then
      raise exception 'BDF_ACCOUNTING_STAGING_LINE_IMMUTABLE';
    end if;
    if (
      to_jsonb(new)
        - 'normalized_amount' - 'tax_basis' - 'value_status'
        - 'normalization_status' - 'mapping_status' - 'validation_status'
    ) <> (
      to_jsonb(old)
        - 'normalized_amount' - 'tax_basis' - 'value_status'
        - 'normalization_status' - 'mapping_status' - 'validation_status'
    ) then
      raise exception 'BDF_ACCOUNTING_STAGING_SOURCE_FIELDS_IMMUTABLE';
    end if;
    if (old.normalization_status <> new.normalization_status
        and (old.normalization_status <> 'pending' or new.normalization_status not in ('passed', 'failed')))
      or (old.mapping_status <> new.mapping_status
        and (old.mapping_status <> 'pending' or new.mapping_status not in ('passed', 'failed')))
      or (old.validation_status <> new.validation_status
        and (old.validation_status <> 'received' or new.validation_status not in ('valid', 'invalid', 'excluded'))) then
      raise exception 'BDF_ACCOUNTING_STAGING_INVALID_TRANSITION';
    end if;
    if new.validation_status = 'valid'
      and (new.normalization_status <> 'passed' or new.mapping_status <> 'passed') then
      raise exception 'BDF_ACCOUNTING_STAGING_GATE_INCOMPLETE';
    end if;
    if new.validation_status = 'valid' and not exists (
      select 1 from accounting.import_files f
      where f.import_batch_id = new.import_batch_id
        and f.import_file_id = new.import_file_id
        and f.validation_status = 'validated'
    ) then
      raise exception 'BDF_ACCOUNTING_STAGING_FILE_NOT_VALIDATED';
    end if;
  end if;
  return new;
end
$function$;

create trigger guard_import_batches_mutation
before insert or update or delete on accounting.import_batches
for each row execute function accounting.guard_import_boundary_mutation();

create trigger guard_import_files_mutation
before insert or update or delete on accounting.import_files
for each row execute function accounting.guard_import_boundary_mutation();

create trigger guard_import_staging_lines_mutation
before insert or update or delete on accounting.import_staging_lines
for each row execute function accounting.guard_import_boundary_mutation();

alter table accounting.import_batches enable row level security;
alter table accounting.import_batches force row level security;
alter table accounting.import_files enable row level security;
alter table accounting.import_files force row level security;
alter table accounting.import_staging_lines enable row level security;
alter table accounting.import_staging_lines force row level security;
revoke all on all tables in schema accounting from public, anon, authenticated, service_role;
revoke all on all sequences in schema accounting from public, anon, authenticated, service_role;
revoke execute on all functions in schema accounting from public, anon, authenticated, service_role;
