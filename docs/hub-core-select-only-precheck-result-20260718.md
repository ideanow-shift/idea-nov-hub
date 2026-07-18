# HUB Core SELECT-only precheck result 2026-07-18

## Data Intake catalog

```yaml
status: PASS
required_table_count: 4
required_column_count: 18
present_required_column_count: 18
natural_key_unique_index_table_count: 3
rls_enabled_table_count: 4
rls_forced_table_count: 0
browser_write_privilege_count: 0
business_profile_table_count: 2
mutation_executed: false
raw_output_printed: false
```

The catalog foundation is present for employees, stores, corporations, and the existing change log. This does not approve a write RPC, idempotency table, or production CSV import.

## HR role coverage

```yaml
status: PARTIAL_READY
active_hr_role_definition_count: 2
active_hr_role_assignment_count: 1
distinct_assigned_employee_count: 1
active_assigned_employee_count: 1
login_ready_employee_count: 1
missing_credential_count: 0
login_disabled_count: 0
currently_locked_count: 0
duplicate_active_assignment_group_count: 0
all_scope_assignment_count: 1
mutation_executed: false
personal_values_recorded: false
```

The existing assigned operator is ready, but the aggregate assignment count is insufficient for the planned three-person HR operation. Exact intended operators must be confirmed privately before any role DML. Edge deploy and Pages publish remain on hold until the role assignment gate is resolved.

## LINE WORKS inventory

```yaml
status: SAFE_STOP_RESULT_WRAPPER_MISMATCH
select_attempt_count: 1
mutation_executed: false
raw_output_printed: false
retry_executed: false
```

The SQL completed but the original runner did not recognize the CLI wrapper. The parser was repaired and passed four local wrapper fixtures. A retry requires a fresh one-shot approval.

## Remaining boundaries

- no DDL / INSERT / UPDATE / DELETE
- no role assignment mutation
- no Edge deploy / Pages publish
- no Secret, notification, or external send
- no production CSV import
