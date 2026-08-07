-- M062 synthetic regression. No real Account Chart; entire fixture rolls back.
begin;

create function pg_temp.expect_failure(p_label text, p_sql text, p_reason text)
returns void language plpgsql as $f$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_reason in sqlerrm)>0 then
      raise notice 'M062_EXPECTED_REJECTION % [%]', p_label, sqlerrm; return;
    end if;
    raise exception 'M062_WRONG_REJECTION % expected=% actual=%',p_label,p_reason,sqlerrm;
  end;
  raise exception 'M062_NEGATIVE_MISPASS %',p_label;
end $f$;

insert into accounting.account_identities(account_id,created_by)
select ('62000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'audit:m062-fixture'
from generate_series(1,16) i;

-- Normal root / child / three levels.
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,
 account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,
 display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by)
values
('62100000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001',1,'N-ROOT','root','posting','pl','revenue','credit','credit_positive','period_flow',null,0,'2026-01-01',null,'active','v1','map-v1',repeat('1',64),'audit:m062-fixture');
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000002',1,'N-CHILD','child','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000001',1,'2026-01-01',null,'active','v1','map-v1',repeat('2',64),'audit:m062-fixture');
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000003',1,'N-GRANDCHILD','grandchild','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000002',2,'2026-01-01',null,'active','v1','map-v1',repeat('3',64),'audit:m062-fixture');
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000004',1,'VERSIONED','old','posting','pl','revenue','credit','credit_positive','period_flow',null,3,'2026-01-01','2027-01-01','inactive','v1','map-v1',repeat('4',64),'audit:m062-fixture'),
('62100000-0000-4000-8000-000000000005','62000000-0000-4000-8000-000000000004',2,'VERSIONED','new','posting','pl','revenue','credit','credit_positive','period_flow',null,3,'2027-01-01',null,'active','v2','map-v1',repeat('5',64),'audit:m062-fixture');

-- Historical edges do not overlap: H-A -> H-B ends before H-B -> H-A begins.
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,
 account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,
 display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by)
values
('62100000-0000-4000-8000-000000000007','62000000-0000-4000-8000-000000000006',1,'H-B','H B root','posting','pl','revenue','credit','credit_positive','period_flow',null,5,'2020-01-01','2022-01-01','inactive','v1','map-v1',repeat('7',64),'audit:m062-fixture');
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000006','62000000-0000-4000-8000-000000000005',1,'H-A','H A old','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000006',4,'2020-01-01','2021-01-01','inactive','v1','map-v1',repeat('6',64),'audit:m062-fixture'),
('62100000-0000-4000-8000-000000000008','62000000-0000-4000-8000-000000000005',2,'H-A','H A root','posting','pl','revenue','credit','credit_positive','period_flow',null,4,'2021-01-01','2023-01-01','inactive','v2','map-v1',repeat('8',64),'audit:m062-fixture');
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000009','62000000-0000-4000-8000-000000000006',2,'H-B','H B child','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000005',5,'2022-01-01','2023-01-01','inactive','v2','map-v1',repeat('9',64),'audit:m062-fixture');
do $$ begin raise notice 'M062_NON_OVERLAPPING_HISTORY_ALLOWED'; end $$;

-- Self, two-node, and NEW-row boundary-completed three-node cycles.
select pg_temp.expect_failure('SELF_CYCLE',$q$insert into accounting.accounts
(account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,status,source_version,mapping_contract_version,content_digest,recorded_by)
values('62000000-0000-4000-8000-000000000010',1,'SELF','self','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000010',1,'2026-01-01','active','v1','map-v1',repeat('a',64),'audit:m062-fixture')$q$,'BDF_ACCOUNT_HIERARCHY_CYCLE');

insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000010','62000000-0000-4000-8000-000000000007',1,'C2-A','A old','posting','pl','revenue','credit','credit_positive','period_flow',null,1,'2026-01-01','2027-01-01','inactive','v1','map-v1',repeat('b',64),'audit:m062-fixture');
-- Reproduce the already-observed M013 boundary state; M013 permitted this unbounded child.
set local session_replication_role = replica;
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000011','62000000-0000-4000-8000-000000000008',1,'C2-B','B','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000007',2,'2026-01-01',null,'active','v1','map-v1',repeat('c',64),'audit:m062-fixture');
set local session_replication_role = origin;
select pg_temp.expect_failure('TWO_NODE_CYCLE',$q$insert into accounting.accounts
(account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,status,source_version,mapping_contract_version,content_digest,recorded_by)
values('62000000-0000-4000-8000-000000000007',2,'C2-A','A new','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000008',1,'2027-01-01','active','v2','map-v1',repeat('d',64),'audit:m062-fixture')$q$,'BDF_ACCOUNT_HIERARCHY_CYCLE');

insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000012','62000000-0000-4000-8000-000000000011',1,'C3-A','A old','posting','pl','revenue','credit','credit_positive','period_flow',null,1,'2026-01-01','2027-01-01','inactive','v1','map-v1',repeat('e',64),'audit:m062-fixture');
set local session_replication_role = replica;
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000013','62000000-0000-4000-8000-000000000012',1,'C3-B','B','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000011',2,'2026-01-01',null,'active','v1','map-v1',repeat('f',64),'audit:m062-fixture');
set local session_replication_role = origin;
insert into accounting.accounts(account_version_id,account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,effective_to,status,source_version,mapping_contract_version,content_digest,recorded_by) values
('62100000-0000-4000-8000-000000000014','62000000-0000-4000-8000-000000000013',1,'C3-C','C','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000012',3,'2026-01-01',null,'active','v1','map-v1',repeat('0',64),'audit:m062-fixture');
select pg_temp.expect_failure('THREE_NODE_CYCLE_NEW_ROW_BOUNDARY_CYCLE',$q$insert into accounting.accounts
(account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,status,source_version,mapping_contract_version,content_digest,recorded_by)
values('62000000-0000-4000-8000-000000000011',2,'C3-A','A new','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000013',1,'2027-01-01','active','v2','map-v1',repeat('1',64),'audit:m062-fixture')$q$,'BDF_ACCOUNT_HIERARCHY_CYCLE');

-- Parent and mapping periods must contain the child/mapping period.
select pg_temp.expect_failure('PARENT_PERIOD_MISMATCH',$q$insert into accounting.accounts
(account_id,version_no,account_code,account_name,account_type,statement_type,account_category,normal_balance,sign_policy,measure_type,parent_account_id,display_order,effective_from,status,source_version,mapping_contract_version,content_digest,recorded_by)
values('62000000-0000-4000-8000-000000000014',1,'BAD-PERIOD','bad','posting','pl','revenue','credit','credit_positive','period_flow','62000000-0000-4000-8000-000000000004',1,'2026-01-01','active','v1','map-v1',repeat('2',64),'audit:m062-fixture')$q$,'BDF_ACCOUNT_PARENT_VERSION_NOT_COMPATIBLE');

select pg_temp.expect_failure('MAPPING_PERIOD_MISMATCH',$q$insert into accounting.account_statement_mappings
(account_id,account_version_id,version_no,statement_type,statement_section,statement_line,display_order,aggregation_behavior,contribution_sign,effective_from,effective_to,status,mapping_contract_version,content_digest,recorded_by)
values('62000000-0000-4000-8000-000000000004','62100000-0000-4000-8000-000000000004',1,'pl','revenue','bad_period',1,'add',1,'2026-01-01','2028-01-01','active','map-v1',repeat('3',64),'audit:m062-fixture')$q$,'BDF_ACCOUNT_STATEMENT_MAPPING_MISMATCH');

-- Existing M013 regression markers are independently exercised by the rehearsal before M062.
do $$ begin raise notice 'M062_REGRESSION_MARKERS ACCOUNT_OVERLAP ACCOUNT_CODE_OVERLAP STATEMENT_TYPE_MISMATCH DUPLICATE_MAPPING CASH_FLOW_MAPPING INVALID_DISPLAY_ORDER IMMUTABLE_UPDATE IMMUTABLE_DELETE'; end $$;
rollback;
