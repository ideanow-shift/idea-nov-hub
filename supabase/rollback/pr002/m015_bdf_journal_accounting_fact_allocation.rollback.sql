-- M015-only rollback. Preserve M001-M014, M061, M062 and every earlier Accounting object.
drop trigger a_m015_seal_import_staging_lines on accounting.import_staging_lines;
drop trigger a_m015_seal_import_files on accounting.import_files;
drop trigger a_m015_lock_import_batch_membership on accounting.import_batches;
drop trigger guard_accounting_allocation_mutation on accounting.accounting_allocations;
drop trigger guard_allocation_set_mutation on accounting.allocation_sets;
drop trigger guard_allocation_rule_mutation on accounting.allocation_rule_versions;
drop trigger reject_accounting_fact_mutation on accounting.accounting_facts;
drop trigger validate_accounting_fact_insert on accounting.accounting_facts;
drop trigger reject_journal_line_mutation on accounting.journal_lines;
drop trigger validate_journal_line_insert on accounting.journal_lines;
drop trigger reject_journal_entry_mutation on accounting.journal_entries;
drop trigger validate_journal_entry_insert on accounting.journal_entries;

drop function accounting.guard_accounting_allocation_mutation();
drop function accounting.guard_import_membership_seal_m015();
drop function accounting.guard_allocation_set_mutation();
drop function accounting.guard_allocation_rule_mutation();
drop function accounting.validate_accounting_fact_insert();
drop function accounting.validate_journal_line_insert();
drop function accounting.validate_journal_entry_insert();
drop function accounting.reject_ledger_mutation();
drop function accounting.account_version_matches_period(uuid,uuid,text,date,date);
drop function accounting.organization_scope_is_valid(text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,date,date);

drop table accounting.accounting_allocations;
drop table accounting.allocation_sets;
drop table accounting.allocation_rule_versions;
drop table accounting.accounting_facts;
drop table accounting.journal_lines;
drop table accounting.journal_entries;
