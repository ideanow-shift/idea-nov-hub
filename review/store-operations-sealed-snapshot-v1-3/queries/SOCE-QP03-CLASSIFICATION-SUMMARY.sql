-- SOCE-QP03-CLASSIFICATION-SUMMARY v1.0.0
WITH active_store AS (
  SELECT id, store_id, corporation_id, lower(COALESCE(store_type, '')) AS store_type
  FROM public.stores
  WHERE is_active = true
), classified AS (
  SELECT *, CASE
    WHEN store_type IN ('direct', 'direct_store', 'company_owned') THEN 'direct'
    WHEN store_type IN ('franchise', 'fc') THEN 'franchise'
    WHEN store_type IN ('headquarters', 'hq', 'virtual', 'test') THEN 'non_store'
    ELSE 'unresolved'
  END AS classification
  FROM active_store
)
SELECT
  (SELECT count(*)::integer FROM public.corporations WHERE is_active = true) AS canonical_corporation_count,
  count(*) FILTER (WHERE classification IN ('direct', 'franchise'))::integer AS official_store_count,
  count(*) FILTER (WHERE classification = 'direct')::integer AS direct_store_count,
  count(*) FILTER (WHERE classification = 'franchise')::integer AS franchise_store_count,
  count(*) FILTER (WHERE classification = 'non_store')::integer AS non_store_row_count,
  (count(*) - count(DISTINCT store_id))::integer AS duplicate_store_key_count,
  count(*) FILTER (WHERE classification = 'unresolved')::integer AS unresolved_store_count,
  count(*) FILTER (WHERE corporation_id IS NULL)::integer AS orphan_corporation_relation_count,
  count(*) FILTER (WHERE classification NOT IN ('direct', 'franchise', 'non_store', 'unresolved'))::integer AS unknown_classification_count
FROM classified;
