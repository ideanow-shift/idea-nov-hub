-- SOCE-QP02-TARGET-SCHEMA-COLUMN-MAP v1.0.0
SELECT
  'target'::text AS attestation_side,
  n.nspname::text AS object_namespace,
  c.relname::text AS object_label,
  c.relkind::text AS object_kind,
  a.attname::text AS column_label,
  format_type(a.atttypid, a.atttypmod)::text AS data_type,
  NOT a.attnotnull AS nullable,
  COALESCE(con.constraint_kind, 'none')::text AS constraint_kind,
  COALESCE(rel.relation_label, 'none')::text AS relation_label
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN LATERAL (
  SELECT CASE con.contype WHEN 'p' THEN 'primary_key' WHEN 'u' THEN 'unique' WHEN 'f' THEN 'foreign_key' ELSE 'other' END AS constraint_kind
  FROM pg_constraint con
  WHERE con.conrelid = c.oid AND a.attnum = ANY (con.conkey)
  ORDER BY con.contype
  LIMIT 1
) con ON true
LEFT JOIN LATERAL (
  SELECT pc.relname::text AS relation_label
  FROM pg_constraint fk
  JOIN pg_class pc ON pc.oid = fk.confrelid
  WHERE fk.conrelid = c.oid AND a.attnum = ANY (fk.conkey) AND fk.contype = 'f'
  ORDER BY pc.relname
  LIMIT 1
) rel ON true
WHERE n.nspname = 'core'
  AND c.relkind IN ('r', 'v')
  AND c.relname IN ('corporations', 'stores', 'departments', 'employees', 'employee_store_assignments')
ORDER BY c.relname, a.attnum;
