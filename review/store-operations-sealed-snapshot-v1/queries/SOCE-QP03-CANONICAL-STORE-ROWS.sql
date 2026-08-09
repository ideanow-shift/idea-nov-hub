-- SOCE-QP03-CANONICAL-STORE-ROWS v1.0.0
SELECT
  md5(s.corporation_id::text) AS canonical_corporation_key,
  md5(s.id::text) AS canonical_store_key,
  s.store_id::text AS store_label,
  CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END AS store_status,
  CASE
    WHEN lower(COALESCE(s.store_type, '')) IN ('direct', 'direct_store', 'company_owned') THEN 'direct'
    WHEN lower(COALESCE(s.store_type, '')) IN ('franchise', 'fc') THEN 'franchise'
    ELSE 'unresolved'
  END AS store_classification,
  CASE WHEN c.id IS NULL THEN 'orphan' ELSE 'effective' END AS corporation_relation_state,
  COALESCE(s.created_at::date::text, 'unknown') AS effective_from,
  NULL::text AS effective_to,
  'source-current'::text AS relation_version,
  'attested'::text AS source_lineage_state
FROM public.stores s
LEFT JOIN public.corporations c ON c.id = s.corporation_id
WHERE s.is_active = true
  AND lower(COALESCE(s.store_type, '')) IN ('direct', 'direct_store', 'company_owned', 'franchise', 'fc')
ORDER BY s.store_id;
