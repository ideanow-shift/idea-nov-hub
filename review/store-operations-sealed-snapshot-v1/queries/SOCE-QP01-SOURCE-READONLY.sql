-- SOCE-QP01-SOURCE-READONLY v1.1.0
WITH RECURSIVE
role_paths AS (
  SELECT
    role.oid AS role_oid,
    0 AS depth,
    true AS inherited_path,
    true AS settable_path,
    false AS admin_path,
    ARRAY[role.oid]::oid[] AS role_path
  FROM pg_roles AS role
  WHERE role.rolname = current_user

  UNION ALL

  SELECT
    membership.roleid AS role_oid,
    path.depth + 1 AS depth,
    path.inherited_path AND membership.inherit_option AS inherited_path,
    path.settable_path AND membership.set_option AS settable_path,
    path.admin_path OR membership.admin_option AS admin_path,
    path.role_path || membership.roleid AS role_path
  FROM role_paths AS path
  INNER JOIN pg_auth_members AS membership ON membership.member = path.role_oid
  WHERE NOT membership.roleid = ANY(path.role_path)
    AND (membership.inherit_option OR membership.set_option OR membership.admin_option)
),
role_closure AS (
  SELECT
    role_oid,
    bool_or(inherited_path) AS inherited_path,
    bool_or(settable_path) AS settable_path,
    bool_or(admin_path) AS admin_path
  FROM role_paths
  GROUP BY role_oid
),
role_attributes AS (
  SELECT
    closure.role_oid,
    closure.inherited_path,
    closure.settable_path,
    closure.admin_path,
    role.rolname,
    role.rolsuper,
    role.rolcreatedb,
    role.rolcreaterole,
    role.rolreplication,
    role.rolbypassrls
  FROM role_closure AS closure
  INNER JOIN pg_roles AS role ON role.oid = closure.role_oid
),
application_schemas AS (
  SELECT namespace.oid, namespace.nspname, namespace.nspowner
  FROM pg_namespace AS namespace
  WHERE namespace.nspname !~ '^pg_'
    AND namespace.nspname <> 'information_schema'
),
application_schema_summary AS (
  SELECT
    count(*)::integer AS application_schema_count,
    md5(COALESCE(jsonb_agg(nspname ORDER BY nspname)::text, '[]')) AS application_schema_set_md5
  FROM application_schemas
),
application_relations AS (
  SELECT relation.oid, relation.relowner, relation.relkind
  FROM pg_class AS relation
  INNER JOIN application_schemas AS namespace ON namespace.oid = relation.relnamespace
  WHERE relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
),
application_routines AS (
  SELECT routine.oid, routine.proowner
  FROM pg_proc AS routine
  INNER JOIN application_schemas AS namespace ON namespace.oid = routine.pronamespace
  WHERE routine.prokind IN ('f', 'p', 'a', 'w')
),
application_types AS (
  SELECT data_type.oid, data_type.typowner
  FROM pg_type AS data_type
  INNER JOIN application_schemas AS namespace ON namespace.oid = data_type.typnamespace
),
role_risk AS (
  SELECT
    role.role_oid,
    (
      role.rolsuper
      OR role.rolcreatedb
      OR role.rolcreaterole
      OR role.rolreplication
      OR role.rolbypassrls
      OR EXISTS (
        SELECT 1
        FROM pg_database AS database
        WHERE database.datname = current_database()
          AND database.datdba = role.role_oid
      )
      OR EXISTS (
        SELECT 1
        FROM application_schemas AS namespace
        WHERE namespace.nspowner = role.role_oid
      )
      OR EXISTS (
        SELECT 1
        FROM application_relations AS relation
        WHERE relation.relowner = role.role_oid
      )
      OR EXISTS (
        SELECT 1
        FROM application_routines AS routine
        WHERE routine.proowner = role.role_oid
      )
      OR EXISTS (
        SELECT 1
        FROM application_types AS data_type
        WHERE data_type.typowner = role.role_oid
      )
      OR EXISTS (
        SELECT 1
        FROM pg_extension AS extension
        WHERE extension.extowner = role.role_oid
      )
      OR has_database_privilege(role.role_oid, current_database(), 'TEMPORARY')
      OR has_database_privilege(role.role_oid, current_database(), 'CREATE')
      OR EXISTS (
        SELECT 1
        FROM application_schemas AS namespace
        WHERE has_schema_privilege(role.role_oid, namespace.oid, 'CREATE')
      )
      OR EXISTS (
        SELECT 1
        FROM application_relations AS relation
        CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS privilege(privilege_name)
        WHERE has_table_privilege(role.role_oid, relation.oid, privilege.privilege_name)
      )
      OR EXISTS (
        SELECT 1
        FROM application_relations AS relation
        WHERE relation.relkind = 'S'
          AND (
            has_sequence_privilege(role.role_oid, relation.oid, 'USAGE')
            OR has_sequence_privilege(role.role_oid, relation.oid, 'UPDATE')
          )
      )
      OR EXISTS (
        SELECT 1
        FROM application_routines AS routine
        WHERE has_function_privilege(role.role_oid, routine.oid, 'EXECUTE')
      )
      OR role.admin_path
      OR EXISTS (
        SELECT 1
        FROM pg_auth_members AS membership
        WHERE membership.member = role.role_oid
          AND membership.admin_option
      )
    ) AS unsafe
  FROM role_attributes AS role
),
privilege_counts AS (
  SELECT
    (SELECT count(*)::integer FROM role_closure) AS reachable_role_count,
    (SELECT count(*)::integer FROM role_closure WHERE settable_path) AS settable_role_count,
    (SELECT count(*)::integer FROM role_closure WHERE inherited_path) AS inherited_role_count,
    (SELECT count(*)::integer FROM role_risk WHERE unsafe) AS unsafe_reachable_role_count,
    (SELECT count(*)::integer FROM role_attributes WHERE rolsuper) AS superuser_count,
    (SELECT count(*)::integer FROM role_attributes WHERE rolcreatedb) AS createdb_role_count,
    (SELECT count(*)::integer FROM role_attributes WHERE rolcreaterole) AS createrole_role_count,
    (SELECT count(*)::integer FROM role_attributes WHERE rolreplication) AS replication_role_count,
    (SELECT count(*)::integer FROM role_attributes WHERE rolbypassrls) AS bypassrls_role_count,
    (SELECT count(*)::integer FROM role_attributes WHERE rolname = 'service_role') AS service_role_count,
    (SELECT count(*)::integer FROM pg_database AS database INNER JOIN role_attributes AS role ON role.role_oid = database.datdba WHERE database.datname = current_database()) AS owned_database_count,
    (SELECT count(*)::integer FROM application_schemas AS namespace INNER JOIN role_attributes AS role ON role.role_oid = namespace.nspowner) AS owned_application_schema_count,
    (SELECT count(*)::integer FROM application_relations AS relation INNER JOIN role_attributes AS role ON role.role_oid = relation.relowner) AS owned_relation_count,
    (SELECT count(*)::integer FROM application_routines AS routine INNER JOIN role_attributes AS role ON role.role_oid = routine.proowner) AS owned_function_count,
    (SELECT count(*)::integer FROM application_types AS data_type INNER JOIN role_attributes AS role ON role.role_oid = data_type.typowner) AS owned_type_count,
    (SELECT count(*)::integer FROM pg_extension AS extension INNER JOIN role_attributes AS role ON role.role_oid = extension.extowner) AS owned_extension_count,
    (SELECT count(*)::integer FROM role_attributes AS role WHERE has_database_privilege(role.role_oid, current_database(), 'TEMPORARY')) AS effective_temp_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role WHERE has_database_privilege(role.role_oid, current_database(), 'CREATE')) AS effective_database_create_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_schemas AS namespace WHERE has_schema_privilege(role.role_oid, namespace.oid, 'CREATE')) AS effective_schema_create_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE has_table_privilege(role.role_oid, relation.oid, 'INSERT')) AS effective_insert_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE has_table_privilege(role.role_oid, relation.oid, 'UPDATE')) AS effective_update_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE has_table_privilege(role.role_oid, relation.oid, 'DELETE')) AS effective_delete_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE has_table_privilege(role.role_oid, relation.oid, 'TRUNCATE')) AS effective_truncate_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE has_table_privilege(role.role_oid, relation.oid, 'REFERENCES')) AS effective_references_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE has_table_privilege(role.role_oid, relation.oid, 'TRIGGER')) AS effective_trigger_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE relation.relkind = 'S' AND has_sequence_privilege(role.role_oid, relation.oid, 'USAGE')) AS effective_sequence_usage_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation WHERE relation.relkind = 'S' AND has_sequence_privilege(role.role_oid, relation.oid, 'UPDATE')) AS effective_sequence_update_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) AS privilege(privilege_name) WHERE has_table_privilege(role.role_oid, relation.oid, privilege.privilege_name)) AS effective_dml_privilege_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_relations AS relation CROSS JOIN (VALUES ('USAGE'), ('UPDATE')) AS privilege(privilege_name) WHERE relation.relkind = 'S' AND has_sequence_privilege(role.role_oid, relation.oid, privilege.privilege_name)) AS effective_sequence_write_count,
    (SELECT count(*)::integer FROM role_attributes AS role CROSS JOIN application_routines AS routine WHERE has_function_privilege(role.role_oid, routine.oid, 'EXECUTE')) AS executable_application_routine_count,
    (SELECT count(*)::integer FROM role_attributes AS role INNER JOIN pg_auth_members AS membership ON membership.member = role.role_oid WHERE membership.admin_option) AS membership_admin_option_count
)
SELECT
  'source'::text AS attestation_side,
  'verified'::text AS current_user_state,
  md5(current_user::text) AS current_role_reference,
  current_setting('transaction_read_only')::text AS transaction_read_only,
  current_setting('default_transaction_read_only')::text AS default_transaction_read_only,
  schema.application_schema_count,
  schema.application_schema_set_md5,
  counts.reachable_role_count,
  counts.settable_role_count,
  counts.inherited_role_count,
  counts.unsafe_reachable_role_count,
  counts.superuser_count,
  counts.createdb_role_count,
  counts.createrole_role_count,
  counts.replication_role_count,
  counts.bypassrls_role_count,
  counts.service_role_count,
  counts.owned_database_count,
  counts.owned_application_schema_count,
  counts.owned_relation_count,
  counts.owned_function_count,
  counts.owned_type_count,
  counts.owned_extension_count,
  counts.effective_temp_privilege_count,
  counts.effective_database_create_count,
  counts.effective_schema_create_count,
  counts.effective_insert_privilege_count,
  counts.effective_update_privilege_count,
  counts.effective_delete_privilege_count,
  counts.effective_truncate_privilege_count,
  counts.effective_references_privilege_count,
  counts.effective_trigger_privilege_count,
  counts.effective_sequence_usage_count,
  counts.effective_sequence_update_count,
  counts.effective_dml_privilege_count,
  counts.effective_sequence_write_count,
  counts.executable_application_routine_count,
  counts.membership_admin_option_count,
  true AS role_closure_checked,
  true AS ownership_gate_checked,
  true AS temp_gate_checked,
  true AS routine_execute_gate_checked,
  (
    counts.unsafe_reachable_role_count = 0
    AND counts.superuser_count = 0
    AND counts.createdb_role_count = 0
    AND counts.createrole_role_count = 0
    AND counts.replication_role_count = 0
    AND counts.bypassrls_role_count = 0
    AND counts.service_role_count = 0
    AND counts.owned_database_count = 0
    AND counts.owned_application_schema_count = 0
    AND counts.owned_relation_count = 0
    AND counts.owned_function_count = 0
    AND counts.owned_type_count = 0
    AND counts.owned_extension_count = 0
    AND counts.effective_temp_privilege_count = 0
    AND counts.effective_database_create_count = 0
    AND counts.effective_schema_create_count = 0
    AND counts.effective_insert_privilege_count = 0
    AND counts.effective_update_privilege_count = 0
    AND counts.effective_delete_privilege_count = 0
    AND counts.effective_truncate_privilege_count = 0
    AND counts.effective_references_privilege_count = 0
    AND counts.effective_trigger_privilege_count = 0
    AND counts.effective_sequence_usage_count = 0
    AND counts.effective_sequence_update_count = 0
    AND counts.effective_dml_privilege_count = 0
    AND counts.effective_sequence_write_count = 0
    AND counts.executable_application_routine_count = 0
    AND counts.membership_admin_option_count = 0
  ) AS read_only_role_contract_passed
FROM privilege_counts AS counts
CROSS JOIN application_schema_summary AS schema;
