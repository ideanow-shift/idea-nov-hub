-- SOCE-QP04-AM-ASSIGNMENT-EVIDENCE v1.0.0
SELECT
  md5(a.employee_id::text) AS canonical_employee_key,
  md5(a.store_id::text) AS canonical_store_key,
  a.assignment_type::text AS assignment_kind,
  CASE WHEN a.is_active THEN 'active' ELSE 'inactive' END AS assignment_status,
  a.effective_from::text AS effective_from,
  a.effective_to::text AS effective_to,
  'source-current'::text AS relation_version
FROM public.employee_store_assignments a
JOIN public.employees e ON e.id = a.employee_id
WHERE a.is_active = true
  AND e.is_active = true
  AND a.assignment_type IN ('primary', 'secondary')
ORDER BY md5(a.employee_id::text), md5(a.store_id::text);
