# HUB HR three-operator role assignment design pack 2026-07-18

## Current aggregate evidence

```yaml
active_hr_role_definition_count: 2
active_hr_role_assignment_count: 1
distinct_assigned_employee_count: 1
login_ready_employee_count: 1
duplicate_active_assignment_group_count: 0
all_scope_assignment_count: 1
planned_operator_count: 3
readiness: PARTIAL_READY
```

The current assignment population is insufficient for the planned three-person HR operation. Personal identifiers are intentionally excluded from this pack.

## Proposed limited DML shape

The future executor must receive the intended employee identifiers through an approved private input boundary. It must not embed names, email addresses, or employee IDs in SQL, Git, logs, or documents.

1. Resolve each private target to exactly one active, login-ready `public.employees` row.
2. Resolve exactly one active `public.roles` row for the approved HR role key.
3. Refuse existing duplicate active assignments.
4. Insert only missing all-scope assignments with `scope_type='all'` and `scope_id=null`.
5. Maximum resulting distinct active HR operators: 3.
6. Do not change existing non-HR roles or application roles.
7. Record only safe category, actor, result, and aggregate delta in the existing change log.

## Fail-close conditions

- private target count is not exactly 3
- any target is missing, inactive, login-disabled, or locked
- role definition is missing, inactive, or duplicated
- duplicate active assignment groups are present
- resulting distinct operator count is not exactly 3
- any unrelated role assignment would change

## Separate gates

1. Private target precheck, SELECT-only.
2. Sealed assignment DML review.
3. Production assignment DML, maximum two missing assignments.
4. Aggregate post-check.
5. Clean Edge Master Admin allowlist deploy.
6. Portal Pages publish and read-only role smoke.

No role DML, Edge deploy, Pages publish, Secret change, or employee master update is executed by this design pack.
