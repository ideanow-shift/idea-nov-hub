import { hashCanonical } from './canonicalization.mjs';

export const PACKAGE_ID = 'store-operations-consumer-enablement-sealed-snapshot-v1';
export const QUERY_VERSION = '1.0.0';
export const OUTPUT_SCHEMA_VERSION = '1.0.0';

const STRING = Object.freeze(['string']);
const INTEGER = Object.freeze(['integer']);
const BOOLEAN = Object.freeze(['boolean']);
const NULLABLE_STRING = Object.freeze(['null', 'string']);

function freezeTypes(fields) {
  return Object.freeze(Object.fromEntries(Object.entries(fields).map(([column, types]) => [column, Object.freeze([...types])])))
}

const query = (queryId, side, purpose, expectedTypes, canonicalKeyFields) => Object.freeze({
  queryId,
  queryVersion: QUERY_VERSION,
  side,
  purpose,
  expectedColumns: Object.freeze(Object.keys(expectedTypes)),
  expectedTypes: freezeTypes(expectedTypes),
  expectedOutputSchemaVersion: OUTPUT_SCHEMA_VERSION,
  privateSqlOnly: true,
  maximumRows: 500,
  timeoutMs: 5000,
  canonicalKeyFields: Object.freeze(canonicalKeyFields),
});

const pack = (packId, stage, purpose, entries) => Object.freeze({
  packId,
  stage,
  purpose,
  privateSqlOnly: true,
  entries: Object.freeze(entries),
});

// The repository fixes Query ID, Query Version, result schema, and output
// shape. Actual SQL and each SQL SHA-256 stay only in the approved private
// query registry; the runner requires a per-query hash attestation before QP01.
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
    query('SOCE-QP01-SOURCE-READONLY', 'source', 'Mechanically attest source read-only protections', {
      attestation_side: STRING,
      current_user_state: STRING,
      transaction_read_only: STRING,
      default_transaction_read_only: STRING,
      insert_denied: BOOLEAN,
      update_denied: BOOLEAN,
      delete_denied: BOOLEAN,
      truncate_denied: BOOLEAN,
      ddl_denied: BOOLEAN,
      function_write_denied: BOOLEAN,
      bypassrls_denied: BOOLEAN,
      role_inheritance_denied: BOOLEAN,
    }, ['attestation_side']),
    query('SOCE-QP01-TARGET-READONLY', 'target', 'Mechanically attest target read-only protections', {
      attestation_side: STRING,
      current_user_state: STRING,
      transaction_read_only: STRING,
      default_transaction_read_only: STRING,
      insert_denied: BOOLEAN,
      update_denied: BOOLEAN,
      delete_denied: BOOLEAN,
      truncate_denied: BOOLEAN,
      ddl_denied: BOOLEAN,
      function_write_denied: BOOLEAN,
      bypassrls_denied: BOOLEAN,
      role_inheritance_denied: BOOLEAN,
    }, ['attestation_side']),
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

export const getFixedQuery = (queryId) => FIXED_QUERY_REGISTRY.find((entry) => entry.queryId === queryId) ?? null;
export const getPack = (packId) => FIXED_QUERY_PACKS.find((entry) => entry.packId === packId) ?? null;
export const getQueriesForPack = (packId) => FIXED_QUERY_REGISTRY.filter((entry) => entry.packId === packId);

export function publicQueryCatalogShape() {
  return FIXED_QUERY_PACKS.map((entry) => ({
    packId: entry.packId,
    stage: entry.stage,
    queryIds: entry.entries.map(({ queryId }) => queryId),
    outputSchemas: entry.entries.map(({ queryId, queryVersion, side, expectedColumns, expectedTypes, expectedOutputSchemaVersion, canonicalKeyFields, maximumRows, timeoutMs }) => ({
      queryId,
      queryVersion,
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
    && request.sourceProjectLabel === 'idea-nov-core'
    && request.targetProjectLabel === 'idea-nov-staging'
    && request.publicQueryCatalogHash === PUBLIC_QUERY_CATALOG_HASH
    && request.noRetry === true
    && typeof request.runId === 'string'
    && /^run:[A-Za-z0-9._:/-]{1,160}$/.test(request.runId)
    && Array.isArray(request.packIds)
    && request.packIds.length === QUERY_PACK_IDS.length
    && request.packIds.every((packId, index) => packId === QUERY_PACK_IDS[index])
    && typeof request.authorizationReference === 'string'
    && /^approval:[A-Za-z0-9._:/-]{1,160}$/.test(request.authorizationReference));
}
