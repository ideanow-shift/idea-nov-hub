-- SOCE-QP03-TOKOROZAWA-LEGACY-RELATION v1.0.0
SELECT
  CASE WHEN to_regclass('core.stores') IS NULL THEN 'not_applicable' ELSE 'confirmed' END AS legacy_relation_state,
  CASE WHEN EXISTS (SELECT 1 FROM public.stores WHERE store_id = 'tokorozawa' AND is_active = true) THEN 'effective' ELSE 'unresolved' END AS corporation_relation_state,
  0::integer AS duplicate_relation_count,
  CASE WHEN EXISTS (SELECT 1 FROM public.stores WHERE store_id = 'tokorozawa' AND is_active = true) THEN 0 ELSE 1 END::integer AS unresolved_relation_count,
  'source-current'::text AS effective_from,
  NULL::text AS effective_to;
