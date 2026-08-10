# Store Operations Sealed Snapshot v1.3.2 Canonical Operator Corrective

v1.3.2 is additive. v1.2.0, v1.3.0, and v1.3.1 remain immutable.

The Operator source of truth is the effective join of `public.employees`,
`public.employee_organization_assignments`,
`public.organization_assignment_types`, and `public.departments`.
An employee position or legacy application role does not establish the
Operator. The binding requires one active employee, the approved employee
number, the Sales department, `department_head`, an effective assignment
period, and separation from the Reviewer.

Auth subject existence and onboarding remain AUTH-01 responsibilities.
`auth.users`, Auth subject identifiers, and Auth principal state are not
Operator gates in this package.
