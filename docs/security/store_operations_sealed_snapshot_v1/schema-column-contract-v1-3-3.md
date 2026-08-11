# Schema and Column Contract v1.3.3

The approved instance is an exact, canonical JSON object. It binds Package and
Query Pack hashes, fixed Source/Target object sets, the QP04 Canonical Assignment
relation/column set, Snapshot role scope, RLS/effective privilege evidence,
Stage 0 evidence, and the approval reference.

QP02 Source includes `public.departments`,
`public.employee_organization_assignments`, and
`public.organization_assignment_types`. The approved relation/column set fixes
the fields required to resolve an active, effective `department_head`
assignment. It contains no `auth.users` or Auth-principal dependency.

The instance hash is `SHA-256(canonical(instance without schemaContractHash))`.
Unknown instance fields, a stale Package/Query binding, an object-set mismatch,
or incomplete privilege evidence fails closed.
