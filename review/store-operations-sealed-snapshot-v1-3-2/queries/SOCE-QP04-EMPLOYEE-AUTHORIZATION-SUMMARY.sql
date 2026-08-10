-- SOCE-QP04-EMPLOYEE-AUTHORIZATION-SUMMARY v1.0.2
WITH sales_head AS (
  SELECT e.id, e.employee_id
  FROM public.employees e
  JOIN public.employee_organization_assignments a ON a.employee_id = e.id
  JOIN public.organization_assignment_types t ON t.id = a.assignment_type_id
  JOIN public.departments d ON d.id = a.department_id
  WHERE e.is_active = true
    AND e.employment_status = '現職'
    AND (e.joined_on IS NULL OR e.joined_on <= DATE '2026-08-11')
    AND (e.retired_on IS NULL OR e.retired_on >= DATE '2026-08-11')
    AND a.is_active = true
    AND a.target_type = 'department'
    AND a.effective_from <= DATE '2026-08-11'
    AND (a.effective_to IS NULL OR a.effective_to >= DATE '2026-08-11')
    AND t.is_active = true
    AND t.assignment_code = 'department_head'
    AND t.allowed_target_type = 'department'
    AND d.is_active = true
    AND d.department_name = '営業部'
)
SELECT
  0::integer AS representative_candidate_count,
  0::integer AS vice_president_candidate_count,
  (SELECT count(*)::integer FROM sales_head) AS sales_department_head_candidate_count,
  CASE WHEN (SELECT count(*) FROM sales_head) = 1 THEN 'resolved'::text ELSE 'unresolved'::text END AS sales_department_head_state,
  (SELECT id::text FROM sales_head LIMIT 1) AS sales_department_head_employee_key,
  (SELECT employee_id::text FROM sales_head LIMIT 1) AS sales_department_head_employee_number,
  0::integer AS area_manager_candidate_count,
  0::integer AS store_manager_coverage_count,
  0::integer AS missing_store_manager_count,
  0::integer AS duplicate_store_manager_count,
  (SELECT count(*)::integer FROM public.employee_store_assignments a LEFT JOIN public.employees e ON e.id = a.employee_id LEFT JOIN public.stores s ON s.id = a.store_id WHERE e.id IS NULL OR s.id IS NULL) AS orphan_assignment_count;
