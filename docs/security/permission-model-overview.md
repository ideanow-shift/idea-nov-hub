# IDEA NOV Permission Model Overview

## Status and scope

This is the single architecture model for HUB, Store Operations, Finance,
Talent, EDU, LINK, and Decision Hub. It is source-only documentation. It does
not change a database, RLS, JWT, API, Runtime, migration, staging, production,
or deployment.

The model replaces role-only and department-only authorization decisions with a
six-layer evaluation. A request is allowed only when every applicable layer
passes. Missing, expired, ambiguous, or unapproved information results in
default deny.

## Six-layer evaluation model

1. **Employee**: an active, linked employee subject with an approved identity
   and employment state.
2. **Role**: one or more active role assignments; a role is capability input,
   never a complete grant by itself.
3. **Organization**: an approved organizational responsibility such as a
   department, store, or FC corporation.
4. **Store Scope**: an approved target set for the requested store context.
5. **Data Scope**: a classified data domain the subject may access.
6. **Action Scope**: the requested operation level for that data domain.

An authorization decision is therefore represented as:

`allow = active_employee AND active_role AND approved_organization AND store_scope_match AND data_scope_match AND action_scope_allows`

The action evaluation must occur at the requested object and business-action
level. A Read grant never implies Create, Update, Delete, Approve, Export, or
Admin.

## Core rules

- Role, department, position, and individual assignment are separate facts.
- Department scope is not inferred from a title such as department head.
- Store scope is not inferred from a data domain or application screen.
- Data access and business-action access are independently evaluated.
- A browser claim or UI state is an input hint only; server-side authorization
  and RLS remain the enforcement boundaries.
- Effective dates apply to employee, role, organization, store, data, and
  action assignments where the corresponding fact is time-bound.
- A service credential is infrastructure capability, not end-user authority.
- All authorization outcomes are auditable as fixed decision categories without
  disclosing unnecessary personal data.

## Existing-source alignment

Inspected source already separates `employee_roles` from effective-dated
individual `employee_store_assignments`. Existing management source resolves
role keys and individual store assignments, but it does not resolve a
department-to-store mapping; it must not be treated as this architecture's
complete implementation. The Phase 8.5 department mapping approval pack also
remains conditional: formal mappings require human approval before use.

## Evaluation order

1. Resolve an active employee server-side.
2. Resolve active role assignment and approved organizational context.
3. Resolve applicable, effective-dated store scope with no implicit expansion.
4. Classify the requested data domain.
5. Evaluate the requested action against the granted action scope.
6. Enforce the resulting bounded predicate in API and RLS, then return only the
   minimum permitted projection.

No layer may be skipped because another layer is broad. Representative,
director, and executive candidates require the same six checks; their proposed
organization and store scope can be broad only after governance approval.

## Decision categories

The future implementation should use stable categories such as
`EMPLOYEE_INACTIVE`, `ROLE_UNAVAILABLE`, `ORGANIZATION_UNAPPROVED`,
`STORE_SCOPE_MISMATCH`, `DATA_SCOPE_DENIED`, and `ACTION_SCOPE_DENIED`. It must
not expose raw policy expressions, role assignments, employee identifiers, or
backend errors to clients.
