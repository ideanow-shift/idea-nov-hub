# Schema and Column Contract v1.3.2

The Source QP04 corrective permits read-only access only to these Canonical
relations and columns:

- `public.employees`: `id`, `employee_id`, `employment_status`, `joined_on`, `retired_on`, `is_active`
- `public.departments`: `id`, `department_name`, `is_active`
- `public.employee_organization_assignments`: `employee_id`, `assignment_type_id`, `target_type`, `department_id`, `effective_from`, `effective_to`, `is_active`
- `public.organization_assignment_types`: `id`, `assignment_code`, `allowed_target_type`, `is_active`

The role receives no Auth, DML, CREATE, Sequence, or Routine capability.
