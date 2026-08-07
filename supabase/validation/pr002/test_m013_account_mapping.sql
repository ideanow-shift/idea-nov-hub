-- Synthetic-only M013 fixture and negative tests. Entire fixture is rolled back.
begin;

insert into accounting.account_identities (account_id, created_by) values
  ('13000000-0000-4000-8000-000000000001', 'audit:m013-fixture'),
  ('13000000-0000-4000-8000-000000000002', 'audit:m013-fixture'),
  ('13000000-0000-4000-8000-000000000003', 'audit:m013-fixture'),
  ('13000000-0000-4000-8000-000000000004', 'audit:m013-fixture');

insert into accounting.accounts (
  account_version_id, account_id, version_no, account_code, account_name, account_type,
  statement_type, account_category, normal_balance, sign_policy, measure_type,
  parent_account_id, display_order, effective_from, effective_to, status,
  source_version, mapping_contract_version, content_digest, recorded_by
) values
  ('13100000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 1,
   'PL-ROOT', 'P/L root', 'posting', 'pl', 'revenue', 'credit', 'credit_positive',
   'period_flow', null, 0, date '2026-01-01', null, 'active', 'synthetic-v1', 'account-map-v1',
   repeat('1', 64), 'audit:m013-fixture'),
  ('13100000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000002', 1,
   'PL-REVENUE', 'Revenue', 'posting', 'pl', 'revenue', 'credit', 'credit_positive',
   'period_flow', '13000000-0000-4000-8000-000000000001', 10, date '2026-01-01', null,
   'active', 'synthetic-v1', 'account-map-v1', repeat('2', 64), 'audit:m013-fixture'),
  ('13100000-0000-4000-8000-000000000003', '13000000-0000-4000-8000-000000000003', 1,
   'BS-CASH', 'Cash', 'posting', 'bs', 'current_asset', 'debit', 'debit_positive',
   'ending_balance', null, 10, date '2026-01-01', null, 'active', 'synthetic-v1',
   'account-map-v1', repeat('3', 64), 'audit:m013-fixture');

insert into accounting.account_statement_mappings (
  statement_mapping_version_id, account_id, account_version_id, version_no,
  statement_type, statement_section, statement_line, display_order,
  aggregation_behavior, contribution_sign, effective_from, effective_to, status,
  mapping_contract_version, content_digest, recorded_by
) values
  ('13200000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002',
   '13100000-0000-4000-8000-000000000002', 1, 'pl', 'revenue', 'net_sales', 10,
   'add', 1, date '2026-01-01', null, 'active', 'account-map-v1', repeat('4', 64),
   'audit:m013-fixture'),
  ('13200000-0000-4000-8000-000000000002', '13000000-0000-4000-8000-000000000003',
   '13100000-0000-4000-8000-000000000003', 1, 'bs', 'current_asset', 'cash', 10,
   'add', 1, date '2026-01-01', null, 'active', 'account-map-v1', repeat('5', 64),
   'audit:m013-fixture');

do $tests$
begin
  -- Duplicate effective Account interval.
  begin
    insert into accounting.accounts (
      account_id, version_no, account_code, account_name, account_type, statement_type,
      account_category, normal_balance, sign_policy, measure_type, display_order,
      effective_from, status, source_version, mapping_contract_version, content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000002', 2, 'PL-REVENUE-2', 'Overlap',
      'posting', 'pl', 'revenue', 'credit', 'credit_positive', 'period_flow', 11,
      date '2026-06-01', 'active', 'synthetic-v2', 'account-map-v1', repeat('6',64),
      'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_ACCOUNT_OVERLAP';
  exception when exclusion_violation then null; end;

  -- Duplicate account code in an overlapping interval.
  begin
    insert into accounting.accounts (
      account_id, version_no, account_code, account_name, account_type, statement_type,
      account_category, normal_balance, sign_policy, measure_type, display_order,
      effective_from, status, source_version, mapping_contract_version, content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000004', 1, 'PL-REVENUE', 'Duplicate code',
      'posting', 'pl', 'revenue', 'credit', 'credit_positive', 'period_flow', 12,
      date '2026-01-01', 'active', 'synthetic-v2', 'account-map-v1', repeat('7',64),
      'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_ACCOUNT_CODE';
  exception when exclusion_violation then null; end;

  -- Orphan parent identity.
  begin
    insert into accounting.accounts (
      account_id, version_no, account_code, account_name, account_type, statement_type,
      account_category, normal_balance, sign_policy, measure_type, parent_account_id,
      display_order, effective_from, status, source_version, mapping_contract_version,
      content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000003', 2, 'BS-ORPHAN', 'Orphan',
      'posting', 'bs', 'current_asset', 'debit', 'debit_positive', 'ending_balance',
      '13999999-0000-4000-8000-000000000999', 12, date '2027-01-01', 'active',
      'synthetic-v2', 'account-map-v1', repeat('8',64), 'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_ORPHAN_PARENT';
  exception when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm = 'BDF_M013_NEGATIVE_MISPASS_ORPHAN_PARENT' then raise; end if;
      if sqlerrm <> 'BDF_ACCOUNT_PARENT_VERSION_NOT_COMPATIBLE' then raise; end if;
  end;

  -- P/L account cannot map to B/S and Cash Flow is not an M013 mapping.
  begin
    insert into accounting.account_statement_mappings (
      account_id, account_version_id, version_no, statement_type, statement_section,
      statement_line, display_order, aggregation_behavior, contribution_sign,
      effective_from, status, mapping_contract_version, content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000002',
      '13100000-0000-4000-8000-000000000002', 2, 'bs', 'current_asset', 'bad', 20,
      'add', 1, date '2027-01-01', 'active', 'account-map-v2', repeat('9',64),
      'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_STATEMENT_MISMATCH';
  exception when raise_exception then
    if sqlerrm = 'BDF_M013_NEGATIVE_MISPASS_STATEMENT_MISMATCH' then raise; end if;
  end;
  begin
    insert into accounting.account_statement_mappings (
      account_id, account_version_id, version_no, statement_type, statement_section,
      statement_line, display_order, aggregation_behavior, contribution_sign,
      effective_from, status, mapping_contract_version, content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000002',
      '13100000-0000-4000-8000-000000000002', 2, 'cash_flow', 'operating', 'bad', 20,
      'add', 1, date '2027-01-01', 'active', 'account-map-v2', repeat('a',64),
      'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_CASH_FLOW';
  exception when check_violation then null;
    when raise_exception then
      if sqlerrm = 'BDF_M013_NEGATIVE_MISPASS_CASH_FLOW' then raise; end if;
      if sqlerrm <> 'BDF_ACCOUNT_STATEMENT_MAPPING_MISMATCH' then raise; end if;
  end;

  -- Duplicate mapping interval and invalid display order.
  begin
    insert into accounting.account_statement_mappings (
      account_id, account_version_id, version_no, statement_type, statement_section,
      statement_line, display_order, aggregation_behavior, contribution_sign,
      effective_from, status, mapping_contract_version, content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000002',
      '13100000-0000-4000-8000-000000000002', 2, 'pl', 'revenue', 'duplicate', 20,
      'add', 1, date '2026-02-01', 'active', 'account-map-v2', repeat('b',64),
      'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_MAPPING_OVERLAP';
  exception when exclusion_violation then null; end;
  begin
    insert into accounting.account_statement_mappings (
      account_id, account_version_id, version_no, statement_type, statement_section,
      statement_line, display_order, aggregation_behavior, contribution_sign,
      effective_from, status, mapping_contract_version, content_digest, recorded_by
    ) values ('13000000-0000-4000-8000-000000000003',
      '13100000-0000-4000-8000-000000000003', 2, 'bs', 'current_asset', 'bad_order', -1,
      'add', 1, date '2027-01-01', 'active', 'account-map-v2', repeat('c',64),
      'audit:m013-fixture');
    raise exception 'BDF_M013_NEGATIVE_MISPASS_DISPLAY_ORDER';
  exception when check_violation then null; end;

  -- Every identity, version, and mapping row is immutable.
  begin
    update accounting.accounts set account_name = 'Changed'
    where account_id = '13000000-0000-4000-8000-000000000002';
    raise exception 'BDF_M013_NEGATIVE_MISPASS_ACCOUNT_UPDATE';
  exception when raise_exception then
    if sqlerrm = 'BDF_M013_NEGATIVE_MISPASS_ACCOUNT_UPDATE' then raise; end if;
  end;
  begin
    delete from accounting.account_statement_mappings
    where account_id = '13000000-0000-4000-8000-000000000002';
    raise exception 'BDF_M013_NEGATIVE_MISPASS_MAPPING_DELETE';
  exception when raise_exception then
    if sqlerrm = 'BDF_M013_NEGATIVE_MISPASS_MAPPING_DELETE' then raise; end if;
  end;

  if (select count(*) from accounting.accounts a
      where a.account_id = '13000000-0000-4000-8000-000000000002'
        and a.status = 'active' and a.effective_period @> date '2026-08-01') <> 1 then
    raise exception 'BDF_M013_CURRENT_ROW_NOT_UNIQUE';
  end if;
end
$tests$;

rollback;
