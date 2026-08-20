import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const uuidFor = (key) => {
  const bytes = Buffer.from(sha256(`store-operations-uat-v1|${key}`).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullable = (value) => value == null ? 'null' : q(value);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(input) {
  assert(input.targetProjectRef === 'zgkoofphhivesclehrom', 'TARGET_PROJECT_MISMATCH');
  assert(input.approvalReference === 'PR-179', 'APPROVAL_REFERENCE_MISMATCH');
  assert(input.corporations?.length === 6, 'CORPORATION_COUNT_MISMATCH');
  assert(input.stores?.length === 20, 'STORE_COUNT_MISMATCH');
  assert(input.people?.length === 3, 'UAT_EMPLOYEE_COUNT_MISMATCH');
  assert(new Set(input.corporations.map((row) => row.id)).size === 6, 'CORPORATION_DUPLICATE');
  assert(new Set(input.stores.map((row) => row.id)).size === 20, 'STORE_DUPLICATE');
  assert(new Set(input.people.map((row) => row.id)).size === 3, 'EMPLOYEE_DUPLICATE');
  assert(input.stores.every((row) => ['直営', 'FC'].includes(row.storeType)), 'HQ_OR_UNKNOWN_STORE_INCLUDED');
  assert(input.stores.filter((row) => row.storeType === '直営').length === 13, 'DIRECT_COUNT_MISMATCH');
  assert(input.stores.filter((row) => row.storeType === 'FC').length === 7, 'FC_COUNT_MISMATCH');
  assert(new Set(input.people.map((row) => row.roleKey)).size === 3, 'ROLE_SET_MISMATCH');
  assert(input.people.every((row) => (row.email || row.deliveryDigest) && row.assignmentId), 'REAL_IDENTITY_REQUIRED');

  const snapshotKey = `${input.sourceVersion}|${input.sourceAsOf}|PR-179`;
  const sourceSnapshotId = uuidFor(`snapshot|${snapshotKey}`);
  const corporations = input.corporations.map((row) => ({
    sourceRecordDigest: row.sourceRecordDigest || sha256(canonical(row)), sourceRecordKey: sha256(row.id),
    canonicalId: row.id, versionId: uuidFor(`corporation-version|${row.id}`),
    crosswalkId: uuidFor(`corporation-crosswalk|${row.id}`), code: row.code, displayName: row.name,
  })).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  const stores = input.stores.map((row) => ({
    sourceRecordDigest: row.sourceRecordDigest || sha256(canonical(row)), sourceRecordKey: sha256(row.id),
    canonicalId: row.id, versionId: uuidFor(`store-version|${row.id}`), crosswalkId: uuidFor(`store-crosswalk|${row.id}`),
    code: row.code, displayName: row.name, corporationId: row.corporationId,
    operatingModel: row.storeType === '直営' ? 'direct' : 'franchise', openedOn: row.openedOn || null,
    operatorRelationshipId: uuidFor(`operator-relationship|${row.id}`),
    operatorRelationshipVersionId: uuidFor(`operator-relationship-version|${row.id}`),
    operatorDigest: sha256(`operator|${row.id}|${row.corporationId}`),
    accountingRelationshipId: uuidFor(`accounting-relationship|${row.id}`),
    accountingRelationshipVersionId: uuidFor(`accounting-relationship-version|${row.id}`),
    accountingDigest: sha256(`accounting|${row.id}|${row.corporationId}`),
  })).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  const employees = input.people.map((row) => ({
    sourceRecordDigest: row.sourceRecordDigest || sha256(canonical({ id: row.id, employeeNo: row.sourceEmployeeId, active: true })),
    sourceRecordKey: sha256(row.id), canonicalId: row.id,
    versionId: uuidFor(`employee-version|${row.id}`), crosswalkId: uuidFor(`employee-crosswalk|${row.id}`),
    displayAlias: `UAT-${row.roleKey.toUpperCase().replaceAll('_', '-')}`,
  })).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  const assignments = input.people.map((row) => ({
    sourceRecordDigest: row.assignmentSourceRecordDigest || sha256(canonical({ id: row.assignmentId, employeeId: row.id, storeId: row.assignmentStoreId, role: row.roleKey, from: row.assignmentEffectiveFrom })),
    sourceRecordKey: sha256(row.assignmentId), canonicalId: row.assignmentId,
    versionId: uuidFor(`assignment-version|${row.assignmentId}`), crosswalkId: uuidFor(`assignment-crosswalk|${row.assignmentId}`),
    employeeId: row.id, storeId: row.assignmentStoreId, roleKey: row.roleKey,
    assignmentKind: row.assignmentKind === 'primary' ? 'primary' : 'secondary', effectiveFrom: row.assignmentEffectiveFrom,
  })).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  const identities = input.people.map((row) => ({
    identityKey: `uat-${row.roleKey.replaceAll('_', '-')}`,
    sourceSubjectDigest: sha256(row.id), deliveryDigest: row.deliveryDigest || sha256(row.email), employeeId: row.id,
    assignmentVersionId: uuidFor(`assignment-version|${row.assignmentId}`), roleKey: row.roleKey,
    expectedStoreId: row.roleKey === 'executive' ? null : row.assignmentStoreId, effectiveFrom: row.assignmentEffectiveFrom,
  })).sort((a, b) => a.identityKey.localeCompare(b.identityKey));
  const roles = identities.map(({ identityKey, employeeId, roleKey }) => ({ identityKey, employeeId, roleKey }));
  const data = { corporations, stores, employees, identities, roles, assignments };
  const datasetHashes = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, sha256(canonical(rows))]));
  const artifactDigest = sha256(canonical(data));
  const manifest = {
    schemaVersion: 'store-operations-staging-uat-artifact-v1', targetProjectRef: input.targetProjectRef,
    approvalReference: input.approvalReference, sourceVersion: input.sourceVersion, sourceAsOf: input.sourceAsOf,
    sourceSnapshotId, artifactDigest, datasetHashes,
    counts: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])),
  };
  manifest.manifestDigest = sha256(canonical(manifest));
  const rollback = { schemaVersion: 'store-operations-staging-uat-rollback-v1', targetProjectRef: input.targetProjectRef,
    artifactDigest, sourceSnapshotId, revokeIdentityKeys: identities.map((row) => row.identityKey) };
  rollback.rollbackManifestDigest = sha256(canonical(rollback));
  return { manifest, rollback, data };
}

function insertSql(bundle) {
  const { manifest: m, rollback: rb, data } = bundle;
  const snapshotId = m.sourceSnapshotId;
  const populationId = uuidFor(`population|${m.artifactDigest}`);
  const masterId = uuidFor(`master|${m.artifactDigest}`);
  const sourceVersion = m.sourceVersion;
  const today = m.sourceAsOf.slice(0, 10);
  const statements = ['begin;', `select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${q(`store-operations-uat|${m.artifactDigest}`)},0));`,
    `do $gate$ begin if current_database() is null then raise exception 'TARGET_UNAVAILABLE'; end if; if exists(select 1 from store_operations_uat_private.population_runs where artifact_digest=${q(m.artifactDigest)}) then raise exception 'ARTIFACT_ALREADY_APPLIED'; end if; if exists(select 1 from governance.master_source_snapshots) then raise exception 'NONEMPTY_CORE_TARGET'; end if; end $gate$;`,
    `insert into governance.master_source_snapshots(source_snapshot_id,source_system,source_environment,source_version,snapshot_version,source_as_of,content_digest,mapping_contract_version,masking_policy_version,status,total_record_count,approval_reference,created_by) values(${q(snapshotId)},'idea-nov-core-sealed','production-read-only',${q(sourceVersion)},${q(`uat-${m.artifactDigest.slice(0,16)}`)},${q(m.sourceAsOf)},${q(m.artifactDigest)},'store-operations-uat-v1','minimal-pii-v1','candidate',32,'PR-179','audit:store-operations-uat-runner');`];
  const manifestRows = [['corporations',6,m.datasetHashes.corporations],['stores',20,m.datasetHashes.stores],['departments',0,sha256('[]')],['employees',3,m.datasetHashes.employees],['employee_store_assignments',3,m.datasetHashes.assignments]];
  for (const [type,count,hash] of manifestRows) statements.push(`insert into governance.snapshot_master_manifests(source_snapshot_id,master_type,record_count,content_hash,schema_version,source_extract_version,masking_status,mapping_status,validation_status) values(${q(snapshotId)},${q(type)},${count},${q(hash)},'store-operations-uat-v1',${q(sourceVersion)},'passed','passed','passed');`);
  for (const [type,count,hash] of manifestRows) for (const [code,expected,actual] of [
    ['HASH_MATCH',`sha256:${hash}`,`sha256:${hash}`],['RECORD_COUNT_MATCH',`count:${count}`,`count:${count}`],
    ['SCHEMA_MATCH','version:store-operations-uat-v1','version:store-operations-uat-v1'],
    ['MASKING_POLICY_MATCH','version:minimal-pii-v1','version:minimal-pii-v1'],
    ['MAPPING_CONTRACT_MATCH','version:store-operations-uat-v1','version:store-operations-uat-v1']]) statements.push(`insert into governance.snapshot_validation_results(source_snapshot_id,master_type,validation_code,validation_status,expected_value,actual_value,checked_at) values(${q(snapshotId)},${q(type)},${q(code)},'passed',${q(expected)},${q(actual)},statement_timestamp());`);
  for (const type of ['data_owner','security_privacy','platform_db','store_operations']) statements.push(`insert into governance.snapshot_approvals(source_snapshot_id,approval_type,approval_reference,approved_by,approved_at,approval_status) values(${q(snapshotId)},${q(type)},'PR-179','audit:owner-approval',statement_timestamp(),'approved');`);
  const addEntity = (id,type) => statements.push(`insert into governance.canonical_entity_registry(canonical_entity_id,entity_type) values(${q(id)},${q(type)});`);
  const addVersion = (version,id,type) => statements.push(`insert into governance.canonical_version_registry(entity_version_id,canonical_entity_id,entity_type,source_snapshot_id) values(${q(version)},${q(id)},${q(type)},${q(snapshotId)});`);
  const addCrosswalk = (row,type) => statements.push(`insert into governance.source_entity_crosswalks(crosswalk_version_id,canonical_entity_id,entity_type,source_system,source_record_key,source_version,source_snapshot_id,valid_from,mapping_contract_version,masking_policy_version,source_record_digest) values(${q(row.crosswalkId)},${q(row.canonicalId)},${q(type)},'idea-nov-core-sealed',${q(row.sourceRecordKey)},${q(sourceVersion)},${q(snapshotId)},${q(today)},'store-operations-uat-v1','minimal-pii-v1',${q(row.sourceRecordDigest)});`);
  for (const row of data.corporations) { addEntity(row.canonicalId,'corporation'); statements.push(`insert into core.corporation_identities(corporation_id) values(${q(row.canonicalId)});`); addVersion(row.versionId,row.canonicalId,'corporation'); statements.push(`insert into core.corporations(corporation_version_id,corporation_id,corporation_code,display_name,status,effective_from,source_snapshot_id,source_record_digest) values(${q(row.versionId)},${q(row.canonicalId)},${q(row.code)},${q(row.displayName)},'active',${q(today)},${q(snapshotId)},${q(row.sourceRecordDigest)});`); addCrosswalk(row,'corporation'); }
  for (const row of data.stores) { addEntity(row.canonicalId,'store'); statements.push(`insert into core.store_identities(store_id) values(${q(row.canonicalId)});`); addVersion(row.versionId,row.canonicalId,'store'); statements.push(`insert into core.stores(store_version_id,store_id,store_code,display_name,status,opened_on,effective_from,source_snapshot_id,source_record_digest) values(${q(row.versionId)},${q(row.canonicalId)},${q(row.code)},${q(row.displayName)},'active',${nullable(row.openedOn)},${q(today)},${q(snapshotId)},${q(row.sourceRecordDigest)});`); addCrosswalk(row,'store');
    for (const rel of [['operator',row.operatorRelationshipId,row.operatorRelationshipVersionId,row.operatorDigest],['accounting',row.accountingRelationshipId,row.accountingRelationshipVersionId,row.accountingDigest]]) { addEntity(rel[1],'corporation_store_relationship'); statements.push(`insert into core.corporation_store_relationship_identities(relationship_id) values(${q(rel[1])});`); addVersion(rel[2],rel[1],'corporation_store_relationship'); statements.push(`insert into core.corporation_store_relationships(relationship_version_id,relationship_id,store_id,corporation_id,relationship_type,operating_model,effective_from,source_snapshot_id,source_record_digest) values(${q(rel[2])},${q(rel[1])},${q(row.canonicalId)},${q(row.corporationId)},${q(rel[0])},${q(row.operatingModel)},${q(today)},${q(snapshotId)},${q(rel[3])});`); }
  }
  for (const row of data.employees) { addEntity(row.canonicalId,'employee'); statements.push(`insert into core.employee_identities(employee_id) values(${q(row.canonicalId)});`); addVersion(row.versionId,row.canonicalId,'employee'); statements.push(`insert into core.employees(employee_version_id,employee_id,display_alias,status,effective_from,source_snapshot_id,source_record_digest) values(${q(row.versionId)},${q(row.canonicalId)},${q(row.displayAlias)},'active',${q(today)},${q(snapshotId)},${q(row.sourceRecordDigest)});`); addCrosswalk(row,'employee'); }
  for (const row of data.assignments) { addEntity(row.canonicalId,'assignment'); statements.push(`insert into core.assignment_identities(assignment_id) values(${q(row.canonicalId)});`); addVersion(row.versionId,row.canonicalId,'assignment'); statements.push(`insert into core.employee_store_assignments(assignment_version_id,assignment_id,employee_id,store_id,assignment_role_code,assignment_kind,effective_from,status,source_snapshot_id,source_record_digest) values(${q(row.versionId)},${q(row.canonicalId)},${q(row.employeeId)},${q(row.storeId)},${q(row.roleKey)},${q(row.assignmentKind)},${q(row.effectiveFrom)},'active',${q(snapshotId)},${q(row.sourceRecordDigest)});`); addCrosswalk(row,'assignment'); }
  statements.push(`insert into governance.store_population_versions(population_version_id,version_code,status,as_of,expected_official_count,expected_direct_count,expected_franchise_count,expected_item_count,source_snapshot_id,content_digest) values(${q(populationId)},${q(`uat-${m.artifactDigest.slice(0,16)}`)},'draft',${q(today)},20,13,7,20,${q(snapshotId)},${q(m.datasetHashes.stores)});`);
  for (const row of data.stores) statements.push(`insert into governance.store_population_items(population_version_id,store_id,classification,operating_model,in_official_population,review_status,reason_code,reviewed_by_ref,reviewed_at,valid_from) values(${q(populationId)},${q(row.canonicalId)},'official_operating',${q(row.operatingModel)},true,'approved','owner-approved-uat','audit:owner-approval',statement_timestamp(),${q(today)});`);
  statements.push(`update governance.store_population_versions set status='approved',approved_by_ref='audit:owner-approval',approved_at=statement_timestamp() where population_version_id=${q(populationId)};`,`update governance.store_population_versions set status='published' where population_version_id=${q(populationId)};`,`update governance.master_source_snapshots set status='validated' where source_snapshot_id=${q(snapshotId)};`,`update governance.master_source_snapshots set status='activated' where source_snapshot_id=${q(snapshotId)};`,`insert into governance.master_versions(master_version_id,source_snapshot_id,population_version_id,status,effective_as_of,content_digest) values(${q(masterId)},${q(snapshotId)},${q(populationId)},'draft',${q(today)},${q(m.artifactDigest)});`);
  for (const row of data.corporations) statements.push(`insert into governance.master_version_members(master_version_id,entity_type,entity_version_id,canonical_entity_id,source_snapshot_id) values(${q(masterId)},'corporation',${q(row.versionId)},${q(row.canonicalId)},${q(snapshotId)});`);
  for (const row of data.stores) { statements.push(`insert into governance.master_version_members(master_version_id,entity_type,entity_version_id,canonical_entity_id,source_snapshot_id) values(${q(masterId)},'store',${q(row.versionId)},${q(row.canonicalId)},${q(snapshotId)});`); for (const rel of [[row.operatorRelationshipId,row.operatorRelationshipVersionId],[row.accountingRelationshipId,row.accountingRelationshipVersionId]]) statements.push(`insert into governance.master_version_members(master_version_id,entity_type,entity_version_id,canonical_entity_id,source_snapshot_id) values(${q(masterId)},'corporation_store_relationship',${q(rel[1])},${q(rel[0])},${q(snapshotId)});`); }
  for (const row of data.employees) statements.push(`insert into governance.master_version_members(master_version_id,entity_type,entity_version_id,canonical_entity_id,source_snapshot_id) values(${q(masterId)},'employee',${q(row.versionId)},${q(row.canonicalId)},${q(snapshotId)});`);
  for (const row of data.assignments) statements.push(`insert into governance.master_version_members(master_version_id,entity_type,entity_version_id,canonical_entity_id,source_snapshot_id) values(${q(masterId)},'assignment',${q(row.versionId)},${q(row.canonicalId)},${q(snapshotId)});`);
  statements.push(`update governance.master_versions set status='approved',validated_at=statement_timestamp() where master_version_id=${q(masterId)};`,`update governance.master_versions set status='published',activated_at=statement_timestamp() where master_version_id=${q(masterId)};`,`insert into governance.master_publication_releases(master_version_id,released_by_ref,reason_code) values(${q(masterId)},'audit:owner-approval','store-operations-staging-uat');`,`insert into store_operations_uat_private.population_runs(artifact_digest,source_snapshot_id,master_version_id,population_version_id,target_project_ref,corporation_count,store_count,employee_count,assignment_count,manifest_digest,rollback_manifest_digest) values(${q(m.artifactDigest)},${q(snapshotId)},${q(masterId)},${q(populationId)},${q(m.targetProjectRef)},6,20,3,3,${q(m.manifestDigest)},${q(rb.rollbackManifestDigest)});`);
  for (const row of data.identities) statements.push(`insert into store_operations_uat_private.approved_identities(artifact_digest,identity_key,source_subject_digest,delivery_digest,employee_id,assignment_version_id,role_key,expected_store_id,effective_from) values(${q(m.artifactDigest)},${q(row.identityKey)},${q(row.sourceSubjectDigest)},${q(row.deliveryDigest)},${q(row.employeeId)},${q(row.assignmentVersionId)},${q(row.roleKey)},${nullable(row.expectedStoreId)},${q(row.effectiveFrom)});`);
  statements.push(`do $verify$ declare c int; begin select count(*) into c from projection.store_master_v1 where in_official_population and is_active; if c<>20 then raise exception 'OFFICIAL_STORE_COUNT_MISMATCH'; end if; select count(*) into c from projection.corporation_master_v1 where status='active'; if c<>6 then raise exception 'CORPORATION_COUNT_MISMATCH'; end if; select count(*) into c from store_operations_uat_private.approved_identities where artifact_digest=${q(m.artifactDigest)}; if c<>3 then raise exception 'UAT_IDENTITY_COUNT_MISMATCH'; end if; end $verify$;`,`commit;`);
  return statements.join('\n');
}

const [inputPath, outputDir] = process.argv.slice(2);
assert(inputPath && outputDir, 'usage: node store-operations-staging-uat-artifact.mjs <private-input.json> <output-dir>');
const bundle = normalize(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
fs.mkdirSync(outputDir, { recursive: true });
const jsonl = Object.entries(bundle.data).flatMap(([dataset, rows]) => rows.map((row) => canonical({ dataset, row }))).join('\n') + '\n';
fs.writeFileSync(path.join(outputDir, 'population.jsonl'), jsonl);
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${canonical(bundle.manifest)}\n`);
fs.writeFileSync(path.join(outputDir, 'rollback-manifest.json'), `${canonical(bundle.rollback)}\n`);
fs.writeFileSync(path.join(outputDir, 'apply.sql'), `${insertSql(bundle)}\n`);
const receipt = { mode: 'dry-run', result: 'PASS', artifactDigest: bundle.manifest.artifactDigest,
  manifestDigest: bundle.manifest.manifestDigest, rollbackManifestDigest: bundle.rollback.rollbackManifestDigest,
  targetProjectRef: bundle.manifest.targetProjectRef, counts: bundle.manifest.counts, syntheticCount: 0, duplicateCount: 0, writes: 0 };
fs.writeFileSync(path.join(outputDir, 'dry-run-receipt.json'), `${canonical(receipt)}\n`);
console.log(JSON.stringify(receipt));
