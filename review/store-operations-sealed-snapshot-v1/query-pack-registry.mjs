import { hashCanonical } from './canonicalization.mjs';
import { OUTPUT_SCHEMA_VERSION, PACKAGE_ID, PACKAGE_VERSION, QUERY_VERSION, READ_ONLY_OUTPUT_SCHEMA_VERSION, READ_ONLY_QUERY_VERSION } from './package-metadata.mjs';

export { OUTPUT_SCHEMA_VERSION, PACKAGE_ID, PACKAGE_VERSION, QUERY_VERSION, READ_ONLY_OUTPUT_SCHEMA_VERSION, READ_ONLY_QUERY_VERSION };

const STRING = Object.freeze(['string']);
const INTEGER = Object.freeze(['integer']);
const BOOLEAN = Object.freeze(['boolean']);
const NULLABLE_STRING = Object.freeze(['null', 'string']);

function freezeTypes(fields) {
  return Object.freeze(Object.fromEntries(Object.entries(fields).map(([column, types]) => [column, Object.freeze([...types])])))
}

const SQL_ARTIFACTS = Object.freeze({
  'SOCE-QP01-SOURCE-IDENTITY': Object.freeze({ sqlFile: 'queries/SOCE-QP01-SOURCE-IDENTITY.sql', sqlSha256: '86e87c348d621f7f3925d4ece71b2a66cd39d2023b11a6994fba37bb2e925d04' }),
  'SOCE-QP01-TARGET-IDENTITY': Object.freeze({ sqlFile: 'queries/SOCE-QP01-TARGET-IDENTITY.sql', sqlSha256: '785279ebff2f5ee5d1415be500f35b9e293ea7b1161418a6b5552ac42631543b' }),
  'SOCE-QP01-SOURCE-READONLY': Object.freeze({ sqlFile: 'queries/SOCE-QP01-SOURCE-READONLY.sql', sqlSha256: '63350ce9ff09dd76bb2899d410f604ed0fe99e97ee31b76bfa95441abd1dc330' }),
  'SOCE-QP01-TARGET-READONLY': Object.freeze({ sqlFile: 'queries/SOCE-QP01-TARGET-READONLY.sql', sqlSha256: '53cf9e42380d2d8afeffdf8fe3bdaf5ba7bc50115d54d292e907720d45351090' }),
  'SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP': Object.freeze({ sqlFile: 'queries/SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP.sql', sqlSha256: '01277f49ed63632ee4e7f582a4d19a14ff7f272008d60dab61eac155bd3b384a' }),
  'SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP': Object.freeze({ sqlFile: 'queries/SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP.sql', sqlSha256: 'd2c1fbf8f4d5daeea7377bd64e93a351b5a65e9e32227054fca253697bf69f0f' }),
  'SOCE-QP03-CLASSIFICATION-SUMMARY': Object.freeze({ sqlFile: 'queries/SOCE-QP03-CLASSIFICATION-SUMMARY.sql', sqlSha256: 'b750ab432439ed34a934b1b77f4707ec37ced710440829f515d7df17919e23c2' }),
  'SOCE-QP03-CANONICAL-STORE-ROWS': Object.freeze({ sqlFile: 'queries/SOCE-QP03-CANONICAL-STORE-ROWS.sql', sqlSha256: 'c5de6499639eef0441e75262179dc34f2310412e6a44c42a3daaf46d3441c95e' }),
  'SOCE-QP03-TOKOROZAWA-LEGACY-RELATION': Object.freeze({ sqlFile: 'queries/SOCE-QP03-TOKOROZAWA-LEGACY-RELATION.sql', sqlSha256: 'ab6f543bbf4486ea571f4a6c6351d7bd9e625e4a0478fc270061962d4d115d28' }),
  'SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY': Object.freeze({ sqlFile: 'queries/SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY.sql', sqlSha256: 'bbd7bddd4a06d88a08916a3e6e6a3567bd8c87b85b4738d76a312bb26413ef04' }),
  'SOCE-QP04-AM-ASSIGNMENT-EVIDENCE': Object.freeze({ sqlFile: 'queries/SOCE-QP04-AM-ASSIGNMENT-EVIDENCE.sql', sqlSha256: 'c2b5a02dda76d00be35730980c32436ac551575eeada83370ab45ef20dc4f62a' }),
  'SOCE-QP04-STORE-MANAGER-COVERAGE': Object.freeze({ sqlFile: 'queries/SOCE-QP04-STORE-MANAGER-COVERAGE.sql', sqlSha256: '68b044999254e0a0905ea5a07527babd48813de2afc0a2b902eecd7f9052a941' }),
  'SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY': Object.freeze({ sqlFile: 'queries/SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY.sql', sqlSha256: '6bb441d0b5d06335e7590f6b6d877a2c4c4f887b56b344aba3d8159fccb5a856' }),
  'SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE': Object.freeze({ sqlFile: 'queries/SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE.sql', sqlSha256: '15e19a8ad920d77a208bd939585fccfc84bdf7a34dc9badb2d4b70d72b5152c0' }),
  'SOCE-QP06-TARGET-PRESTATE': Object.freeze({ sqlFile: 'queries/SOCE-QP06-TARGET-PRESTATE.sql', sqlSha256: 'fb222ae0d1ec955c8bf8ab50a37e929ee9770ecb03fc3233ca3d48e24556ca50' }),
  'SOCE-QP06-M019-PRESENCE': Object.freeze({ sqlFile: 'queries/SOCE-QP06-M019-PRESENCE.sql', sqlSha256: 'ba48dceca9ba918627a01969c65324d8615c46d30b9a76d28f01158b832c426f' }),
});

const query = (queryId, side, purpose, expectedTypes, canonicalKeyFields, { queryVersion = QUERY_VERSION, outputSchemaVersion = OUTPUT_SCHEMA_VERSION } = {}) => Object.freeze({
  queryId,
  queryVersion,
  ...SQL_ARTIFACTS[queryId],
  side,
  purpose,
  expectedColumns: Object.freeze(Object.keys(expectedTypes)),
  expectedTypes: freezeTypes(expectedTypes),
  expectedOutputSchemaVersion: outputSchemaVersion,
  privateSqlOnly: true,
  maximumRows: 500,
  timeoutMs: 5000,
  canonicalKeyFields: Object.freeze(canonicalKeyFields),
});

const READ_ONLY_EVIDENCE_TYPES = Object.freeze({
  attestation_side: STRING,
  current_user_state: STRING,
  current_role_reference: STRING,
  transaction_read_only: STRING,
  default_transaction_read_only: STRING,
  application_schema_count: INTEGER,
  application_schema_set_md5: STRING,
  reachable_role_count: INTEGER,
  settable_role_count: INTEGER,
  inherited_role_count: INTEGER,
  unsafe_reachable_role_count: INTEGER,
  superuser_count: INTEGER,
  createdb_role_count: INTEGER,
  createrole_role_count: INTEGER,
  replication_role_count: INTEGER,
  bypassrls_role_count: INTEGER,
  service_role_count: INTEGER,
  owned_database_count: INTEGER,
  owned_application_schema_count: INTEGER,
  owned_relation_count: INTEGER,
  owned_function_count: INTEGER,
  owned_type_count: INTEGER,
  owned_extension_count: INTEGER,
  effective_temp_privilege_count: INTEGER,
  effective_database_create_count: INTEGER,
  effective_schema_create_count: INTEGER,
  effective_insert_privilege_count: INTEGER,
  effective_update_privilege_count: INTEGER,
  effective_delete_privilege_count: INTEGER,
  effective_truncate_privilege_count: INTEGER,
  effective_references_privilege_count: INTEGER,
  effective_trigger_privilege_count: INTEGER,
  effective_sequence_usage_count: INTEGER,
  effective_sequence_update_count: INTEGER,
  effective_dml_privilege_count: INTEGER,
  effective_sequence_write_count: INTEGER,
  executable_application_routine_count: INTEGER,
  membership_admin_option_count: INTEGER,
  role_closure_checked: BOOLEAN,
  ownership_gate_checked: BOOLEAN,
  temp_gate_checked: BOOLEAN,
  routine_execute_gate_checked: BOOLEAN,
  read_only_role_contract_passed: BOOLEAN,
});

const pack = (packId, stage, purpose, entries) => Object.freeze({
  packId,
  stage,
  purpose,
  privateSqlOnly: true,
  entries: Object.freeze(entries),
});

// The repository fixes Query ID, Query Version, exact SQL artifact path and
// byte hash, result schema, and output shape. The runner rehashes each SQL
// artifact before the claim and immediately before every database execution.
export const FIXED_QUERY_PACKS = Object.freeze([
  pack('SOCE-QP01', 'stage0', 'Environment, PostgreSQL version, and read-only-role attestation', [
    query('SOCE-QP01-SOURCE-IDENTITY', 'source', 'Attest the source profile without exposing identity values', {
      attestation_side: STRING,
      environment_state: STRING,
      project_identity_state: STRING,
      region_state: STRING,
      profile_state: STRING,
      server_version: STRING,
      server_version_num: INTEGER,
    }, ['attestation_side']),
    query('SOCE-QP01-TARGET-IDENTITY', 'target', 'Attest the target profile without exposing identity values', {
      attestation_side: STRING,
      environment_state: STRING,
      project_identity_state: STRING,
      region_state: STRING,
      profile_state: STRING,
      server_version: STRING,
      server_version_num: INTEGER,
    }, ['attestation_side']),
    query('SOCE-QP01-SOURCE-READONLY', 'source', 'Mechanically attest source read-only protections across the effective role closure', READ_ONLY_EVIDENCE_TYPES, ['attestation_side'], {
      queryVersion: READ_ONLY_QUERY_VERSION,
      outputSchemaVersion: READ_ONLY_OUTPUT_SCHEMA_VERSION,
    }),
    query('SOCE-QP01-TARGET-READONLY', 'target', 'Mechanically attest target read-only protections across the effective role closure', READ_ONLY_EVIDENCE_TYPES, ['attestation_side'], {
      queryVersion: READ_ONLY_QUERY_VERSION,
      outputSchemaVersion: READ_ONLY_OUTPUT_SCHEMA_VERSION,
    }),
  ]),
  pack('SOCE-QP02', 'stage0', 'Schema and column contract attestation', [
    query('SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP', 'source', 'Attest the fixed source object and logical-column map', {
      attestation_side: STRING,
      object_namespace: STRING,
      object_label: STRING,
      object_kind: STRING,
      column_label: STRING,
      data_type: STRING,
      nullable: BOOLEAN,
      constraint_kind: STRING,
      relation_label: STRING,
    }, ['attestation_side', 'object_namespace', 'object_label', 'column_label']),
    query('SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP', 'target', 'Attest the fixed target object and logical-column map', {
      attestation_side: STRING,
      object_namespace: STRING,
      object_label: STRING,
      object_kind: STRING,
      column_label: STRING,
      data_type: STRING,
      nullable: BOOLEAN,
      constraint_kind: STRING,
      relation_label: STRING,
    }, ['attestation_side', 'object_namespace', 'object_label', 'column_label']),
  ]),
  pack('SOCE-QP03', 'stage1', 'Corporation and Store classification snapshot', [
    query('SOCE-QP03-CLASSIFICATION-SUMMARY', 'source', 'Validate the six-corporation and official-store baseline', {
      canonical_corporation_count: INTEGER,
      official_store_count: INTEGER,
      direct_store_count: INTEGER,
      franchise_store_count: INTEGER,
      non_store_row_count: INTEGER,
      duplicate_store_key_count: INTEGER,
      unresolved_store_count: INTEGER,
      orphan_corporation_relation_count: INTEGER,
      unknown_classification_count: INTEGER,
    }, ['official_store_count']),
    query('SOCE-QP03-CANONICAL-STORE-ROWS', 'source', 'Capture private Canonical Store and corporation relationship evidence', {
      canonical_corporation_key: STRING,
      canonical_store_key: STRING,
      store_label: STRING,
      store_status: STRING,
      store_classification: STRING,
      corporation_relation_state: STRING,
      effective_from: STRING,
      effective_to: NULLABLE_STRING,
      relation_version: STRING,
      source_lineage_state: STRING,
    }, ['canonical_corporation_key', 'canonical_store_key']),
    query('SOCE-QP03-TOKOROZAWA-LEGACY-RELATION', 'source', 'Attest the legacy relation without exposing raw UUID values', {
      legacy_relation_state: STRING,
      corporation_relation_state: STRING,
      duplicate_relation_count: INTEGER,
      unresolved_relation_count: INTEGER,
      effective_from: STRING,
      effective_to: NULLABLE_STRING,
    }, ['legacy_relation_state']),
  ]),
  pack('SOCE-QP04', 'stage1', 'Employee, role, position, department, and assignment evidence', [
    query('SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY', 'source', 'Summarize eligible executive, sales-head, AM, and manager evidence', {
      representative_candidate_count: INTEGER,
      vice_president_candidate_count: INTEGER,
      sales_department_head_state: STRING,
      area_manager_candidate_count: INTEGER,
      store_manager_coverage_count: INTEGER,
      missing_store_manager_count: INTEGER,
      duplicate_store_manager_count: INTEGER,
      orphan_assignment_count: INTEGER,
    }, ['sales_department_head_state']),
    query('SOCE-QP04-AM-ASSIGNMENT-EVIDENCE', 'source', 'Capture only effective source-backed AM assignment evidence', {
      canonical_employee_key: STRING,
      canonical_store_key: STRING,
      assignment_kind: STRING,
      assignment_status: STRING,
      effective_from: STRING,
      effective_to: NULLABLE_STRING,
      relation_version: STRING,
    }, ['canonical_employee_key', 'canonical_store_key']),
    query('SOCE-QP04-STORE-MANAGER-COVERAGE', 'source', 'Capture private store-manager coverage evidence for official stores', {
      canonical_store_key: STRING,
      canonical_employee_key: STRING,
      manager_role_state: STRING,
      assignment_status: STRING,
      effective_from: STRING,
      effective_to: NULLABLE_STRING,
    }, ['canonical_store_key', 'canonical_employee_key']),
  ]),
  pack('SOCE-QP05', 'stage1', 'Identity crosswalk and legacy relation evidence', [
    query('SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY', 'source', 'Attest explicit HUB-to-Canonical identity evidence only', {
      crosswalk_candidate_count: INTEGER,
      email_only_match_count: INTEGER,
      display_name_only_match_count: INTEGER,
      one_to_many_subject_count: INTEGER,
      inactive_employee_count: INTEGER,
      unresolved_crosswalk_count: INTEGER,
    }, ['crosswalk_candidate_count']),
    query('SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE', 'source', 'Capture source evidence for a future purpose-separated anchor', {
      canonical_employee_key: STRING,
      canonical_corporation_key: STRING,
      consumer_application: STRING,
      purpose: STRING,
      evidence_state: STRING,
      effective_from: STRING,
      effective_to: NULLABLE_STRING,
    }, ['canonical_employee_key', 'canonical_corporation_key']),
  ]),
  pack('SOCE-QP06', 'stage1', 'Target pre-state attestation', [
    query('SOCE-QP06-TARGET-PRESTATE', 'target', 'Confirm Staging has no partial Core Master, Auth, anchor, or access population', {
      canonical_corporation_count: INTEGER,
      canonical_store_count: INTEGER,
      canonical_employee_count: INTEGER,
      canonical_role_count: INTEGER,
      canonical_assignment_count: INTEGER,
      identity_crosswalk_count: INTEGER,
      auth_subject_count: INTEGER,
      consumer_anchor_count: INTEGER,
      consumer_access_contract_count: INTEGER,
      partial_population_count: INTEGER,
      duplicate_count: INTEGER,
      orphan_count: INTEGER,
    }, ['canonical_corporation_count']),
    query('SOCE-QP06-M019-PRESENCE', 'target', 'Confirm M019 exists but has no pre-existing consumer binding', {
      m019_migration_state: STRING,
      m019_access_contract_count: INTEGER,
      m019_partial_population_count: INTEGER,
    }, ['m019_migration_state']),
  ]),
]);

export const QUERY_PACK_IDS = Object.freeze(FIXED_QUERY_PACKS.map(({ packId }) => packId));
export const FIXED_QUERY_REGISTRY = Object.freeze(FIXED_QUERY_PACKS.flatMap(({ packId, stage, entries }) => entries.map((entry) => Object.freeze({ ...entry, packId, stage }))));
export const FIXED_QUERY_IDS = Object.freeze(FIXED_QUERY_REGISTRY.map(({ queryId }) => queryId));

export function assertFixedQueryRegistry(registry = FIXED_QUERY_REGISTRY) {
  const required = ['queryId', 'queryVersion', 'packId', 'sqlFile', 'sqlSha256', 'expectedColumns', 'expectedTypes', 'expectedOutputSchemaVersion', 'side', 'purpose', 'privateSqlOnly', 'maximumRows', 'timeoutMs', 'canonicalKeyFields', 'stage'];
  const valid = Array.isArray(registry) && registry.length === 16
    && new Set(registry.map((entry) => entry.queryId)).size === 16
    && registry.every((entry) => entry && required.every((field) => Object.hasOwn(entry, field))
      && typeof entry.queryVersion === 'string' && entry.queryVersion.length > 0
      && /^queries\/SOCE-QP\d{2}-[A-Z0-9-]+\.sql$/.test(entry.sqlFile)
      && /^[a-f0-9]{64}$/.test(entry.sqlSha256)
      && Array.isArray(entry.expectedColumns) && entry.expectedColumns.length > 0
      && entry.queryVersion === (entry.queryId.endsWith('-READONLY') ? READ_ONLY_QUERY_VERSION : QUERY_VERSION)
      && entry.expectedOutputSchemaVersion === (entry.queryId.endsWith('-READONLY') ? READ_ONLY_OUTPUT_SCHEMA_VERSION : OUTPUT_SCHEMA_VERSION));
  if (!valid) throw Object.assign(new Error('FIXED_QUERY_REGISTRY_REJECTED'), { code: 'FIXED_QUERY_REGISTRY_REJECTED' });
  return true;
}

export const getFixedQuery = (queryId) => FIXED_QUERY_REGISTRY.find((entry) => entry.queryId === queryId) ?? null;
export const getPack = (packId) => FIXED_QUERY_PACKS.find((entry) => entry.packId === packId) ?? null;
export const getQueriesForPack = (packId) => FIXED_QUERY_REGISTRY.filter((entry) => entry.packId === packId);

export function publicQueryCatalogShape() {
  return FIXED_QUERY_PACKS.map((entry) => ({
    packId: entry.packId,
    stage: entry.stage,
    queryIds: entry.entries.map(({ queryId }) => queryId),
    outputSchemas: entry.entries.map(({ queryId, queryVersion, sqlFile, sqlSha256, side, expectedColumns, expectedTypes, expectedOutputSchemaVersion, canonicalKeyFields, maximumRows, timeoutMs }) => ({
      queryId,
      queryVersion,
      sqlFile,
      sqlSha256,
      side,
      expectedColumns,
      expectedTypes,
      expectedOutputSchemaVersion,
      canonicalKeyFields,
      maximumRows,
      timeoutMs,
    })),
  }));
}

export const PUBLIC_QUERY_CATALOG_HASH = hashCanonical(publicQueryCatalogShape());

export function isExactPackRequest(request) {
  return Boolean(request
    && request.executionPackageId === PACKAGE_ID
    && request.packageVersion === PACKAGE_VERSION
    && request.sourceProjectLabel === 'idea-nov-core'
    && request.targetProjectLabel === 'idea-nov-staging'
    && request.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && typeof request.privateQueryPackManifestHash === 'string'
    && /^[a-f0-9]{64}$/.test(request.privateQueryPackManifestHash)
    && request.noRetry === true
    && typeof request.runId === 'string'
    && /^run:[A-Za-z0-9._:/-]{1,160}$/.test(request.runId)
    && Array.isArray(request.packIds)
    && request.packIds.length === QUERY_PACK_IDS.length
    && request.packIds.every((packId, index) => packId === QUERY_PACK_IDS[index])
    && typeof request.authorizationReference === 'string'
    && /^approval:[A-Za-z0-9._:/-]{1,160}$/.test(request.authorizationReference));
}
