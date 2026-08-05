export const AUDIT_PACK_ID = 'core-master-catalog-attestation-v1';

const readOnly = (queryId, purpose, sql, expectedColumns, sensitiveFields = []) => Object.freeze({
  queryId,
  purpose,
  sql,
  allowedSchemas: ['information_schema', 'pg_catalog', 'public', 'core'],
  expectedColumns,
  maximumRows: 1000,
  timeoutMs: 5000,
  sensitiveFields,
  sanitizationRule: 'fixed-metrics-only',
  resultSchema: 'audit-metadata-v1',
  failureCode: 'AUDIT_QUERY_FAILED',
});

// These statements are immutable review artifacts. The runner never accepts SQL text.
export const FIXED_QUERY_REGISTRY = Object.freeze([
  readOnly('C01_TARGET_RELATIONS', 'Confirm only the five approved Core Master relation names and kinds',
    "SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind AS relation_kind FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') AND c.relkind IN ('r', 'v', 'm') ORDER BY c.relname",
    ['schema_name', 'relation_name', 'relation_kind']),
  readOnly('C02_COLUMN_SHAPE', 'Return column metadata only, never values or defaults',
    "SELECT table_schema AS schema_name, table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') ORDER BY table_name, ordinal_position",
    ['schema_name', 'table_name', 'column_name', 'data_type', 'is_nullable']),
  readOnly('C03_CONSTRAINTS', 'Return primary, foreign, and unique constraint metadata only',
    "SELECT n.nspname AS schema_name, c.relname AS relation_name, CASE co.contype WHEN 'p' THEN 'primary_key' WHEN 'f' THEN 'foreign_key' WHEN 'u' THEN 'unique' END AS constraint_kind, COUNT(att.attname)::bigint AS key_column_count FROM pg_catalog.pg_constraint co JOIN pg_catalog.pg_class c ON c.oid = co.conrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_catalog.pg_attribute att ON att.attrelid = c.oid AND att.attnum = ANY(co.conkey) WHERE n.nspname = 'public' AND c.relname IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') AND co.contype IN ('p', 'f', 'u') GROUP BY n.nspname, c.relname, co.oid, co.contype ORDER BY c.relname, constraint_kind",
    ['schema_name', 'relation_name', 'constraint_kind', 'key_column_count']),
  readOnly('C04_INDEXES', 'Return index count and uniqueness metadata without definitions',
    "SELECT n.nspname AS schema_name, c.relname AS relation_name, COUNT(i.indexrelid)::bigint AS index_count, COUNT(i.indexrelid) FILTER (WHERE idx.indisunique)::bigint AS unique_index_count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_catalog.pg_index idx ON idx.indrelid = c.oid LEFT JOIN pg_catalog.pg_class i ON i.oid = idx.indexrelid WHERE n.nspname = 'public' AND c.relname IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') GROUP BY n.nspname, c.relname ORDER BY c.relname",
    ['schema_name', 'relation_name', 'index_count', 'unique_index_count']),
  readOnly('C05_RLS_POLICIES', 'Return RLS state and policy command counts without policy text',
    "SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relrowsecurity AS rls_enabled, COUNT(p.polname)::bigint AS policy_count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_catalog.pg_policy p ON p.polrelid = c.oid WHERE n.nspname = 'public' AND c.relname IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') GROUP BY n.nspname, c.relname, c.relrowsecurity ORDER BY c.relname",
    ['schema_name', 'relation_name', 'rls_enabled', 'policy_count']),
  readOnly('C06_GRANT_SUMMARY', 'Return approved relation privilege counts without grantee names',
    "SELECT table_schema AS schema_name, table_name AS relation_name, privilege_type, COUNT(*)::bigint AS grant_count FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') GROUP BY table_schema, table_name, privilege_type ORDER BY table_name, privilege_type",
    ['schema_name', 'relation_name', 'privilege_type', 'grant_count']),
  readOnly('C07_ROW_COUNTS', 'Return aggregate row counts only',
    "SELECT 'employees' AS relation_name, COUNT(*)::bigint AS row_count FROM public.employees UNION ALL SELECT 'stores' AS relation_name, COUNT(*)::bigint AS row_count FROM public.stores UNION ALL SELECT 'corporations' AS relation_name, COUNT(*)::bigint AS row_count FROM public.corporations UNION ALL SELECT 'departments' AS relation_name, COUNT(*)::bigint AS row_count FROM public.departments UNION ALL SELECT 'employee_store_assignments' AS relation_name, COUNT(*)::bigint AS row_count FROM public.employee_store_assignments ORDER BY relation_name",
    ['relation_name', 'row_count']),
  readOnly('C08_STATUS_COLUMN_CANDIDATES', 'Identify potential active or effective-date columns without inspecting values',
    "SELECT table_schema AS schema_name, table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') AND column_name IN ('active', 'is_active', 'status', 'effective_from', 'effective_to', 'opened_at', 'closed_at') ORDER BY table_name, ordinal_position",
    ['schema_name', 'table_name', 'column_name', 'data_type', 'is_nullable']),
  readOnly('C09_RELATION_DEPENDENCIES', 'Return dependent view and function counts without definitions',
    "SELECT ref.relname AS relation_name, COUNT(DISTINCT view_cl.oid)::bigint AS view_dependency_count, COUNT(DISTINCT proc.oid)::bigint AS function_dependency_count FROM pg_catalog.pg_class ref JOIN pg_catalog.pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace LEFT JOIN pg_catalog.pg_depend view_dep ON view_dep.refobjid = ref.oid LEFT JOIN pg_catalog.pg_rewrite rw ON rw.oid = view_dep.objid LEFT JOIN pg_catalog.pg_class view_cl ON view_cl.oid = rw.ev_class AND view_cl.relkind IN ('v', 'm') LEFT JOIN pg_catalog.pg_depend proc_dep ON proc_dep.refobjid = ref.oid LEFT JOIN pg_catalog.pg_proc proc ON proc.oid = proc_dep.objid WHERE ref_ns.nspname = 'public' AND ref.relname IN ('employees', 'stores', 'corporations', 'departments', 'employee_store_assignments') GROUP BY ref.relname ORDER BY ref.relname",
    ['relation_name', 'view_dependency_count', 'function_dependency_count']),
  readOnly('C10_READONLY_GUARD_VERIFICATION', 'Verify transaction guard only',
    "SELECT current_setting('transaction_read_only') AS transaction_read_only",
    ['transaction_read_only']),
]);

export const QUERY_IDS = Object.freeze(FIXED_QUERY_REGISTRY.map(({ queryId }) => queryId));
export const getFixedQuery = (queryId) => FIXED_QUERY_REGISTRY.find((query) => query.queryId === queryId) ?? null;
