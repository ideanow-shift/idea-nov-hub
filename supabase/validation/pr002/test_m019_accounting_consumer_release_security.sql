-- Synthetic M019 release/security contract test. Entire fixture is rolled back.
begin;

create function pg_temp.expect_failure(p_label text,p_sql text,p_reason text)
returns void language plpgsql as $f$
begin
  begin execute p_sql;
  exception when others then
    if position(p_reason in sqlerrm)>0 then raise notice 'M019_EXPECTED %',p_label; return; end if;
    raise exception 'M019_WRONG_REJECTION % expected=% actual=%',p_label,p_reason,sqlerrm;
  end;
  raise exception 'M019_MISPASS %',p_label;
end $f$;

insert into governance.master_source_snapshots(
  source_snapshot_id,source_system,source_environment,source_version,snapshot_version,
  source_as_of,content_digest,mapping_contract_version,masking_policy_version,
  total_record_count,approval_reference,created_by
) values ('19000000-0000-4000-8000-000000000001','m019-fixture','test','v1','v1',
  '2026-05-01T00:00:00Z',repeat('1',64),'m019-v1','mask-v1',8,'approval:m019','audit:m019');

insert into governance.canonical_entity_registry(canonical_entity_id,entity_type) values
 ('19000000-0000-4000-8000-000000000100','corporation'),
 ('19000000-0000-4000-8000-000000000110','store'),
 ('19000000-0000-4000-8000-000000000111','store'),
 ('19000000-0000-4000-8000-000000000120','department'),
 ('19000000-0000-4000-8000-000000000121','department'),
 ('19000000-0000-4000-8000-000000000130','employee'),
 ('19000000-0000-4000-8000-000000000131','employee'),
 ('19000000-0000-4000-8000-000000000140','assignment'),
 ('19000000-0000-4000-8000-000000000141','assignment'),
 ('19000000-0000-4000-8000-000000000150','corporation_store_relationship');
insert into core.corporation_identities(corporation_id) values ('19000000-0000-4000-8000-000000000100');
insert into core.store_identities(store_id) values
 ('19000000-0000-4000-8000-000000000110'),('19000000-0000-4000-8000-000000000111');
insert into core.department_identities(department_id) values
 ('19000000-0000-4000-8000-000000000120'),('19000000-0000-4000-8000-000000000121');
insert into core.employee_identities(employee_id) values
 ('19000000-0000-4000-8000-000000000130'),('19000000-0000-4000-8000-000000000131');
insert into core.assignment_identities(assignment_id) values
 ('19000000-0000-4000-8000-000000000140'),('19000000-0000-4000-8000-000000000141');
insert into core.corporation_store_relationship_identities(relationship_id)
 values ('19000000-0000-4000-8000-000000000150');

insert into governance.canonical_version_registry(entity_version_id,canonical_entity_id,entity_type,source_snapshot_id) values
 ('19000000-0000-4000-8000-000000000200','19000000-0000-4000-8000-000000000100','corporation','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000210','19000000-0000-4000-8000-000000000110','store','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000211','19000000-0000-4000-8000-000000000111','store','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000220','19000000-0000-4000-8000-000000000120','department','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000221','19000000-0000-4000-8000-000000000121','department','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000230','19000000-0000-4000-8000-000000000130','employee','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000231','19000000-0000-4000-8000-000000000131','employee','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000240','19000000-0000-4000-8000-000000000140','assignment','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000241','19000000-0000-4000-8000-000000000141','assignment','19000000-0000-4000-8000-000000000001'),
 ('19000000-0000-4000-8000-000000000250','19000000-0000-4000-8000-000000000150','corporation_store_relationship','19000000-0000-4000-8000-000000000001');

insert into core.corporations(corporation_version_id,corporation_id,corporation_code,display_name,status,effective_from,effective_to,source_snapshot_id,source_record_digest)
values ('19000000-0000-4000-8000-000000000200','19000000-0000-4000-8000-000000000100','M019','M019 Corp','active','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('2',64));
insert into core.stores(store_version_id,store_id,store_code,display_name,status,effective_from,effective_to,source_snapshot_id,source_record_digest) values
 ('19000000-0000-4000-8000-000000000210','19000000-0000-4000-8000-000000000110','S1','Store 1','active','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('3',64)),
 ('19000000-0000-4000-8000-000000000211','19000000-0000-4000-8000-000000000111','S2','Store 2','active','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('4',64));
insert into core.departments(department_version_id,department_id,department_code,display_name,corporation_id,status,effective_from,effective_to,source_snapshot_id,source_record_digest) values
 ('19000000-0000-4000-8000-000000000220','19000000-0000-4000-8000-000000000120','D1','Dept 1','19000000-0000-4000-8000-000000000100','active','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('5',64)),
 ('19000000-0000-4000-8000-000000000221','19000000-0000-4000-8000-000000000121','D2','Dept 2','19000000-0000-4000-8000-000000000100','active','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('6',64));
insert into core.employees(employee_version_id,employee_id,display_alias,status,primary_department_id,effective_from,effective_to,source_snapshot_id,source_record_digest) values
 ('19000000-0000-4000-8000-000000000230','19000000-0000-4000-8000-000000000130','consumer','active','19000000-0000-4000-8000-000000000120','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('7',64)),
 ('19000000-0000-4000-8000-000000000231','19000000-0000-4000-8000-000000000131','inactive','inactive','19000000-0000-4000-8000-000000000121','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('8',64));
insert into core.employee_store_assignments(assignment_version_id,assignment_id,employee_id,store_id,assignment_role_code,assignment_kind,effective_from,effective_to,status,source_snapshot_id,source_record_digest) values
 ('19000000-0000-4000-8000-000000000240','19000000-0000-4000-8000-000000000140','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000110','canonical.finance','primary','2026-01-01','2027-01-01','active','19000000-0000-4000-8000-000000000001',repeat('9',64)),
 ('19000000-0000-4000-8000-000000000241','19000000-0000-4000-8000-000000000141','19000000-0000-4000-8000-000000000131','19000000-0000-4000-8000-000000000110','canonical.finance','secondary','2026-01-01','2027-01-01','active','19000000-0000-4000-8000-000000000001',repeat('a',64));
insert into core.corporation_store_relationships(relationship_version_id,relationship_id,store_id,corporation_id,relationship_type,operating_model,effective_from,effective_to,source_snapshot_id,source_record_digest)
values ('19000000-0000-4000-8000-000000000250','19000000-0000-4000-8000-000000000150','19000000-0000-4000-8000-000000000110','19000000-0000-4000-8000-000000000100','accounting','direct','2026-01-01','2027-01-01','19000000-0000-4000-8000-000000000001',repeat('b',64));

insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
values ('19000000-0000-4000-8000-000000000300',1,'19000000-0000-4000-8000-000000000900','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000240','corporation','19000000-0000-4000-8000-000000000100','budget','grant','2026-05-01','approval:m019','consumer-v1');

select pg_catalog.set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000900',true);
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $authorized$ begin
  perform * from projection.read_accounting_consumer_v1('publication_status','19000000-0000-4000-8000-000000000100','2026-05-01','budget');
  raise notice 'M019_EXPECTED AUTHORIZED_EMPTY_READ';
end $authorized$;
select pg_temp.expect_failure('RAW_TABLE_SELECT',$q$select * from accounting.accounting_facts$q$,'permission denied');
select pg_temp.expect_failure('RAW_VIEW_SELECT',$q$select * from projection.accounting_corporation_pl_v1$q$,'permission denied');
select pg_temp.expect_failure('PROJECTION_DML',$q$update projection.accounting_corporation_pl_v1 set amount=1$q$,'cannot update view');
select pg_temp.expect_failure('PUBLICATION_WRITE',$q$delete from accounting.publication_releases$q$,'permission denied');
select pg_temp.expect_failure('WRONG_SCENARIO',$q$select * from projection.read_accounting_consumer_v1('publication_status','19000000-0000-4000-8000-000000000100','2026-05-01','previous_year')$q$,'BDF_M019_CONSUMER_REQUEST_INVALID');
select pg_temp.expect_failure('DIRECT_HELPER_ABUSE',$q$select * from accounting.current_consumer_access_contracts('19000000-0000-4000-8000-000000000900','19000000-0000-4000-8000-000000000100','2026-05-01','budget')$q$,'permission denied');
reset role;

select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
set local role authenticated;
select pg_temp.expect_failure('UNAUTHORIZED_ROLE',$q$select * from projection.read_accounting_consumer_v1('publication_status','19000000-0000-4000-8000-000000000100','2026-05-01','budget')$q$,'BDF_M019_AUTHENTICATION_REQUIRED');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);

select pg_catalog.set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000999',true);
set local role authenticated;
select pg_temp.expect_failure('UNAUTHORIZED_CONSUMER',$q$select * from projection.read_accounting_consumer_v1('publication_status','19000000-0000-4000-8000-000000000100','2026-05-01','budget')$q$,'BDF_M019_CONSUMER_ACCESS_DENIED');
reset role;
set local role anon;
select pg_temp.expect_failure('ANON_DENIED',$q$select * from projection.read_accounting_consumer_v1('publication_status','19000000-0000-4000-8000-000000000100','2026-05-01','budget')$q$,'permission denied');
reset role;

select pg_temp.expect_failure('STORE_SCOPE_DENIED',$q$
 insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,store_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
 values('19000000-0000-4000-8000-000000000301',1,'19000000-0000-4000-8000-000000000901','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000240','store','19000000-0000-4000-8000-000000000100','19000000-0000-4000-8000-000000000111','budget','grant','2026-05-01','approval:m019','consumer-v1')$q$,'BDF_M019_STORE_SCOPE_MISMATCH');
select pg_temp.expect_failure('DEPARTMENT_SCOPE_DENIED',$q$
 insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,department_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
 values('19000000-0000-4000-8000-000000000302',1,'19000000-0000-4000-8000-000000000902','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000240','department','19000000-0000-4000-8000-000000000100','19000000-0000-4000-8000-000000000121','budget','grant','2026-05-01','approval:m019','consumer-v1')$q$,'BDF_M019_DEPARTMENT_SCOPE_MISMATCH');
select pg_temp.expect_failure('INACTIVE_EMPLOYEE',$q$
 insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
 values('19000000-0000-4000-8000-000000000303',1,'19000000-0000-4000-8000-000000000903','19000000-0000-4000-8000-000000000131','19000000-0000-4000-8000-000000000241','corporation','19000000-0000-4000-8000-000000000100','budget','grant','2026-05-01','approval:m019','consumer-v1')$q$,'BDF_M019_EMPLOYEE_NOT_ACTIVE');
select pg_temp.expect_failure('INVALID_ASSIGNMENT',$q$
 insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
 values('19000000-0000-4000-8000-000000000304',1,'19000000-0000-4000-8000-000000000904','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000241','corporation','19000000-0000-4000-8000-000000000100','budget','grant','2026-05-01','approval:m019','consumer-v1')$q$,'BDF_M019_CANONICAL_ASSIGNMENT_REQUIRED');
select pg_temp.expect_failure('UPDATE_APPEND_ONLY',$q$update accounting.consumer_access_contracts set evidence_reference='approval:changed'$q$,'BDF_M019_ACCESS_CONTRACT_APPEND_ONLY');
select pg_temp.expect_failure('DELETE_APPEND_ONLY',$q$delete from accounting.consumer_access_contracts$q$,'BDF_M019_ACCESS_CONTRACT_APPEND_ONLY');
select pg_temp.expect_failure('CHAIN_GAP',$q$
 insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
 values('19000000-0000-4000-8000-000000000300',3,'19000000-0000-4000-8000-000000000900','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000240','corporation','19000000-0000-4000-8000-000000000100','budget','revoke','2026-05-02','approval:m019','consumer-v1')$q$,'BDF_M019_ACCESS_CHAIN_INVALID');

insert into accounting.consumer_access_contracts(access_key,decision_sequence,auth_subject_id,employee_id,assignment_version_id,scope_type,corporation_id,scenario_type,decision,effective_at,evidence_reference,contract_version)
values ('19000000-0000-4000-8000-000000000300',2,'19000000-0000-4000-8000-000000000900','19000000-0000-4000-8000-000000000130','19000000-0000-4000-8000-000000000240','corporation','19000000-0000-4000-8000-000000000100','budget','revoke','2026-05-02','approval:m019-revoke','consumer-v1');
select pg_catalog.set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000900',true);
set local role authenticated;
select pg_temp.expect_failure('REVOKED_ACCESS',$q$select * from projection.read_accounting_consumer_v1('publication_status','19000000-0000-4000-8000-000000000100','2026-05-01','budget')$q$,'BDF_M019_CONSUMER_ACCESS_DENIED');
reset role;

rollback;
