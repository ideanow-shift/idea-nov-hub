-- M014-only rollback. Preserve M001-M013, M061, M062 and all Account Master objects.
drop trigger guard_accounting_version_mutation on accounting.accounting_versions;
drop trigger validate_accounting_version_insert on accounting.accounting_versions;
drop trigger guard_measure_contract_mutation on accounting.measure_type_contracts;
drop trigger guard_scenario_contract_mutation on accounting.scenario_contracts;
drop function accounting.account_measure_type_matches(uuid,text,date);
drop function accounting.guard_accounting_version_mutation();
drop function accounting.validate_accounting_version_insert();
drop function accounting.guard_accounting_contract_mutation();
drop table accounting.accounting_versions;
drop table accounting.measure_type_contracts;
drop table accounting.scenario_contracts;
