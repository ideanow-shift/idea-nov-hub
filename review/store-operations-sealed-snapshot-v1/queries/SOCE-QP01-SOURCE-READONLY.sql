-- SOCE-QP01-SOURCE-READONLY v1.0.0
WITH application_relations AS (
  SELECT relation.oid
  FROM pg_class AS relation
  INNER JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE relation.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
), application_functions AS (
  SELECT routine.oid
  FROM pg_proc AS routine
  INNER JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
  WHERE routine.prokind = 'f'
    AND namespace.nspname IN ('public', 'core')
)
SELECT
  'source'::text AS attestation_side,
  CASE WHEN current_user IS NOT NULL THEN 'verified' ELSE 'unverified' END AS current_user_state,
  current_setting('transaction_read_only')::text AS transaction_read_only,
  current_setting('default_transaction_read_only')::text AS default_transaction_read_only,
  NOT EXISTS (SELECT 1 FROM application_relations WHERE has_table_privilege(current_user, oid, 'INSERT')) AS insert_denied,
  NOT EXISTS (SELECT 1 FROM application_relations WHERE has_table_privilege(current_user, oid, 'UPDATE')) AS update_denied,
  NOT EXISTS (SELECT 1 FROM application_relations WHERE has_table_privilege(current_user, oid, 'DELETE')) AS delete_denied,
  NOT EXISTS (SELECT 1 FROM application_relations WHERE has_table_privilege(current_user, oid, 'TRUNCATE')) AS truncate_denied,
  NOT has_database_privilege(current_user, current_database(), 'CREATE')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_namespace AS namespace
      WHERE namespace.nspname !~ '^pg_'
        AND namespace.nspname <> 'information_schema'
        AND has_schema_privilege(current_user, namespace.oid, 'CREATE')
    ) AS ddl_denied,
  NOT EXISTS (SELECT 1 FROM application_functions WHERE has_function_privilege(current_user, oid, 'EXECUTE')) AS function_write_denied,
  NOT COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), true) AS bypassrls_denied,
  NOT COALESCE((SELECT rolinherit FROM pg_roles WHERE rolname = current_user), true) AS role_inheritance_denied;
