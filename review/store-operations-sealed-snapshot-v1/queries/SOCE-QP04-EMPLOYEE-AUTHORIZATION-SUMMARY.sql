-- SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY v1.0.0
SELECT
  0::integer AS representative_candidate_count,
  0::integer AS vice_president_candidate_count,
  'unresolved'::text AS sales_department_head_state,
  0::integer AS area_manager_candidate_count,
  0::integer AS store_manager_coverage_count,
  0::integer AS missing_store_manager_count,
  0::integer AS duplicate_store_manager_count,
  (SELECT count(*)::integer FROM public.employee_store_assignments a LEFT JOIN public.employees e ON e.id = a.employee_id LEFT JOIN public.stores s ON s.id = a.store_id WHERE e.id IS NULL OR s.id IS NULL) AS orphan_assignment_count;
