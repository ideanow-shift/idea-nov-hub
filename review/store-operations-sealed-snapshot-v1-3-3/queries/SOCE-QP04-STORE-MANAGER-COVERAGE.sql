-- SOCE-QP04-STORE-MANAGER-COVERAGE v1.0.0
SELECT
  md5(a.store_id::text) AS canonical_store_key,
  md5(a.employee_id::text) AS canonical_employee_key,
  'active'::text AS manager_role_state,
  CASE WHEN a.is_active THEN 'active' ELSE 'inactive' END AS assignment_status,
  a.effective_from::text AS effective_from,
  a.effective_to::text AS effective_to
FROM public.employee_store_assignments a
JOIN public.employees e ON e.id = a.employee_id
JOIN public.stores s ON s.id = a.store_id
WHERE a.is_active = true
  AND e.is_active = true
  AND s.is_active = true
  AND a.assignment_type IN ('primary', 'secondary')
ORDER BY md5(a.store_id::text), md5(a.employee_id::text);
