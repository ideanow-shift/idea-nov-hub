revoke execute on function projection.read_accounting_consumer_v1(text,uuid,date,text) from authenticated;
revoke usage on schema projection from authenticated;
drop function projection.read_accounting_consumer_v1(text,uuid,date,text);
drop function accounting.current_consumer_access_contracts(uuid,uuid,date,text);
drop trigger guard_consumer_access_contract on accounting.consumer_access_contracts;
drop function accounting.guard_consumer_access_contract();
drop table accounting.consumer_access_contracts;
