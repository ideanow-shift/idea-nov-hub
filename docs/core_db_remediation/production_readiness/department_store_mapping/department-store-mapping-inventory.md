# Department to Store Mapping Inventory

## Scope

This is a source-only inventory and approval-pack preparation. It does not
connect to a database, change RLS, create a migration, alter an API, or grant
access. The 13 direct and 7 FC store baseline is owner-provided input for the
approval table; it was not independently verified against a database catalog.

## Existing mapping inventory

No committed source artifact was found for any of the following:

- `department_store_assignments`
- `department_scopes`
- a department-to-store JSON or CSV configuration
- a department-to-store seed or fixture
- a department-to-store RLS policy
- a department-to-store API resolver

The absence is a bounded repository-source result. It is not proof that an
external spreadsheet or an uncommitted database object does not exist.

## Related current contracts

| Contract | Current behavior | Mapping result |
| --- | --- | --- |
| `public.departments` design | Defines BOARD, SALES, EDU, EC, HR, and ACCOUNTING departments | FC department is not defined by this design artifact |
| `public.employee_roles` design | Supports all, corporation, business_unit, department, store, and self scope types | Role scope exists; no department-to-store expansion is defined |
| `employee_store_assignments` | Holds effective-dated individual store assignments | Individual assignment is not a department assignment |
| Management read-only action | Resolves role keys and individual store assignment or primary store | No department mapping is consulted |
| HUB context | Carries department and primary-store values as context hints | Not a server-side authorization source |

## Current API and runtime scope behavior

The deployed-baseline source imports the management read-only handler. Its
all-store role candidates are `super_admin`, `executive`, `backoffice`, and
`accounting`, but this is a role-key rule, not a department rule. Global scope
is accepted only when the relevant role assignment has `scope_type` all/global
and no scope ID.

For area-manager and store-manager roles, the candidate can use effective-dated
individual assignments only when `assignedScopeEnabled` is true. The current
baseline passes it as false, so the fallback is the employee's own active store
for a store manager, or no store scope. Department-manager permissions are empty
in this source contract.

Therefore the current Runtime does not provide a Department to Store Mapping.
It must not be interpreted as authorizing department-wide visibility.

## RLS state relevant to this decision

Committed store profile schemas enable RLS, revoke browser roles, and grant
service-role access. The inspected source does not define a per-department
store-read policy for these tables. The management handler reads through a
server-side service-role gateway and applies its own role and individual-scope
logic. Production policy state remains unverified because no database catalog
read was performed.

## Organizational separation

Department, position, role, and individual assignment remain separate:

- Department: organizational responsibility such as SALES, EDU, EC, HR, or
  ACCOUNTING.
- Position: title such as director, executive officer, department head, area
  manager, or store manager.
- Role: application permission such as executive, accounting, area_manager,
  store_manager, or fc_owner.
- Individual assignment: effective-dated assignment to a particular store.

No department decision in this sprint grants a position or role permission.

## Missing facts and default deny

The following must be confirmed by owners before any access implementation:

1. Formal entity status of an FC department.
2. Department responsibility for direct versus FC stores.
3. Data classification per department, especially finance, people, and education
   data.
4. Effective dates and approval owner for each mapping.
5. A source-of-truth roster for the 20-store direct/FC grouping.

Until approved mappings are materialized through a separately reviewed change,
unmapped departments resolve to no additional store visibility. No fallback to
all stores is permitted.

## Sources inspected

- `docs/core-employee-ledger-v1-review.md`
- `supabase/core-employee-store-assignments.sql`
- `supabase/core-assignment-histories.sql`
- `supabase/functions/nov-hub-api/management_readonly_candidate.ts`
- `supabase/functions/nov-hub-api/index.ts`
- `supabase/store-business-profiles.sql`
- `supabase/corporation-business-profiles.sql`
- `docs/nov-hub-app-context.md`

## Change declaration

No DB, RLS, API, runtime, migration, seed, UUID, staging, or production change
was made.
