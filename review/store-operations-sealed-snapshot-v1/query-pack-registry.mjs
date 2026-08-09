import { hashCanonical } from './canonicalization.mjs';

export const PACKAGE_ID = 'store-operations-consumer-enablement-sealed-snapshot-v1';

const query = (queryId, side, purpose, expectedColumns, canonicalKeyFields) => Object.freeze({
  queryId,
  side,
  purpose,
  expectedColumns: Object.freeze(expectedColumns),
  canonicalKeyFields: Object.freeze(canonicalKeyFields),
  privateSqlOnly: true,
  maximumRows: 500,
  timeoutMs: 5000,
});

const pack = (packId, stage, purpose, entries) => Object.freeze({
  packId,
  stage,
  purpose,
  privateSqlOnly: true,
  entries: Object.freeze(entries),
});

// The registry contains identifiers and output schemas only. Approved SQL stays
// inside the existing private broker and is never supplied by a caller.
export const FIXED_QUERY_PACKS = Object.freeze([
  pack('SOCE-QP01', 'stage0', 'Environment and project identity attestation', [
    query('SOCE-QP01-SOURCE-IDENTITY', 'source', 'Attest the source profile without exposing its identity values',
      ['attestation_side', 'environment_state', 'project_identity_state', 'region_state', 'profile_state'], ['attestation_side']),
    query('SOCE-QP01-TARGET-IDENTITY', 'target', 'Attest the target profile without exposing its identity values',
      ['attestation_side', 'environment_state', 'project_identity_state', 'region_state', 'profile_state'], ['attestation_side']),
    query('SOCE-QP01-SOURCE-READONLY', 'source', 'Mechanically attest source read-only protections',
      ['attestation_side', 'current_user_state', 'transaction_read_only', 'default_transaction_read_only', 'insert_denied', 'update_denied', 'delete_denied', 'truncate_denied', 'ddl_denied', 'function_write_denied', 'bypassrls_denied', 'role_inheritance_denied'], ['attestation_side']),
    query('SOCE-QP01-TARGET-READONLY', 'target', 'Mechanically attest target read-only protections',
      ['attestation_side', 'current_user_state', 'transaction_read_only', 'default_transaction_read_only', 'insert_denied', 'update_denied', 'delete_denied', 'truncate_denied', 'ddl_denied', 'function_write_denied', 'bypassrls_denied', 'role_inheritance_denied'], ['attestation_side']),
  ]),
  pack('SOCE-QP02', 'stage0', 'Schema and column contract attestation', [
    query('SOCE-QP02-SOURCE-SCHEMA-COLUMN-MAP', 'source', 'Attest the fixed source object and logical-column map',
      ['attestation_side', 'object_namespace', 'object_label', 'object_kind', 'column_label', 'data_type', 'nullable', 'constraint_kind', 'relation_label'], ['attestation_side', 'object_namespace', 'object_label', 'column_label']),
    query('SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP', 'target', 'Attest the fixed target object and logical-column map',
      ['attestation_side', 'object_namespace', 'object_label', 'object_kind', 'column_label', 'data_type', 'nullable', 'constraint_kind', 'relation_label'], ['attestation_side', 'object_namespace', 'object_label', 'column_label']),
  ]),
  pack('SOCE-QP03', 'stage1', 'Corporation and Store classification snapshot', [
    query('SOCE-QP03-CLASSIFICATION-SUMMARY', 'source', 'Validate the six-corporation and official-store baseline',
      ['canonical_corporation_count', 'official_store_count', 'direct_store_count', 'franchise_store_count', 'non_store_row_count', 'duplicate_store_key_count', 'unresolved_store_count', 'orphan_corporation_relation_count', 'unknown_classification_count'], ['official_store_count']),
    query('SOCE-QP03-CANONICAL-STORE-ROWS', 'source', 'Capture private Canonical Store and corporation relationship evidence',
      ['canonical_corporation_key', 'canonical_store_key', 'store_label', 'store_status', 'store_classification', 'corporation_relation_state', 'effective_from', 'effective_to', 'relation_version', 'source_lineage_state'], ['canonical_corporation_key', 'canonical_store_key']),
    query('SOCE-QP03-TOKOROZAWA-LEGACY-RELATION', 'source', 'Attest the legacy relation without exposing raw UUID values',
      ['legacy_relation_state', 'corporation_relation_state', 'duplicate_relation_count', 'unresolved_relation_count', 'effective_from', 'effective_to'], ['legacy_relation_state']),
  ]),
  pack('SOCE-QP04', 'stage1', 'Employee, role, position, department, and assignment evidence', [
    query('SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY', 'source', 'Summarize eligible executive, sales-head, AM, and manager evidence',
      ['representative_candidate_count', 'vice_president_candidate_count', 'sales_department_head_state', 'area_manager_candidate_count', 'store_manager_coverage_count', 'missing_store_manager_count', 'duplicate_store_manager_count', 'orphan_assignment_count'], ['sales_department_head_state']),
    query('SOCE-QP04-AM-ASSIGNMENT-EVIDENCE', 'source', 'Capture only effective source-backed AM assignment evidence',
      ['canonical_employee_key', 'canonical_store_key', 'assignment_kind', 'assignment_status', 'effective_from', 'effective_to', 'relation_version'], ['canonical_employee_key', 'canonical_store_key']),
    query('SOCE-QP04-STORE-MANAGER-COVERAGE', 'source', 'Capture private store-manager coverage evidence for official stores',
      ['canonical_store_key', 'canonical_employee_key', 'manager_role_state', 'assignment_status', 'effective_from', 'effective_to'], ['canonical_store_key', 'canonical_employee_key']),
  ]),
  pack('SOCE-QP05', 'stage1', 'Identity crosswalk and legacy relation evidence', [
    query('SOCE-QP05-IDENTITY-CROSSWALK-SUMMARY', 'source', 'Attest explicit HUB-to-Canonical identity evidence only',
      ['crosswalk_candidate_count', 'email_only_match_count', 'display_name_only_match_count', 'one_to_many_subject_count', 'inactive_employee_count', 'unresolved_crosswalk_count'], ['crosswalk_candidate_count']),
    query('SOCE-QP05-CONSUMER-ANCHOR-SOURCE-EVIDENCE', 'source', 'Capture source evidence for a future purpose-separated anchor',
      ['canonical_employee_key', 'canonical_corporation_key', 'consumer_application', 'purpose', 'evidence_state', 'effective_from', 'effective_to'], ['canonical_employee_key', 'canonical_corporation_key']),
  ]),
  pack('SOCE-QP06', 'stage1', 'Target pre-state attestation', [
    query('SOCE-QP06-TARGET-PRESTATE', 'target', 'Confirm Staging has no partial Core Master, Auth, anchor, or access population',
      ['canonical_corporation_count', 'canonical_store_count', 'canonical_employee_count', 'canonical_role_count', 'canonical_assignment_count', 'identity_crosswalk_count', 'auth_subject_count', 'consumer_anchor_count', 'consumer_access_contract_count', 'partial_population_count', 'duplicate_count', 'orphan_count'], ['canonical_corporation_count']),
    query('SOCE-QP06-M019-PRESENCE', 'target', 'Confirm M019 exists but has no pre-existing consumer binding',
      ['m019_migration_state', 'm019_access_contract_count', 'm019_partial_population_count'], ['m019_migration_state']),
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
    outputSchemas: entry.entries.map(({ queryId, side, expectedColumns, canonicalKeyFields, maximumRows, timeoutMs }) => ({
      queryId,
      side,
      expectedColumns,
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
    && request.noRetry === true
    && Array.isArray(request.packIds)
    && request.packIds.length === QUERY_PACK_IDS.length
    && request.packIds.every((packId, index) => packId === QUERY_PACK_IDS[index])
    && typeof request.authorizationReference === 'string'
    && /^approval:[A-Za-z0-9._:/-]{1,160}$/.test(request.authorizationReference));
}
