-- PR002 / ACF-02 / M013 rollback.
-- M012 accounting import boundary and all PR001 objects remain intact.

drop trigger guard_statement_mappings_mutation on accounting.account_statement_mappings;
drop trigger validate_statement_mapping_insert on accounting.account_statement_mappings;
drop trigger guard_accounts_mutation on accounting.accounts;
drop trigger validate_account_version_insert on accounting.accounts;
drop trigger guard_account_identities_mutation on accounting.account_identities;

drop function accounting.validate_statement_mapping_insert();
drop function accounting.validate_account_version_insert();
drop function accounting.guard_account_master_mutation();

drop table accounting.account_statement_mappings;
drop table accounting.accounts;
drop table accounting.account_identities;
