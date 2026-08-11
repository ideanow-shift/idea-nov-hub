# Store Operations Sealed Snapshot v1.3.3 Formal Runner Corrective

v1.3.3 is additive. v1.2.0, v1.3.0, v1.3.1, and v1.3.2 remain immutable.

The corrective closes Package–Runner contract drift before credentials or a
database connection can exist:

- QP02 includes `departments`, `employee_organization_assignments`, and
  `organization_assignment_types`, matching the Canonical Assignment relations
  used by QP04.
- The formal runner's exported 31-field Authorization schema is the only source
  used by the generator. Missing, unknown, and mistyped fields fail closed.
- An approved Schema Contract instance binds the Package and Query Pack hashes,
  Source/Target object sets, QP04 relation/column set, role scope, RLS/effective
  privilege evidence, Stage 0 digest, and Owner approval reference.
- Canonical serialization produces one stable Schema Contract SHA-256.
- Zero-connection preflight verifies Package, registry, catalog, allowlist,
  Authorization, Schema Contract, profiles, operator separation, output policy,
  and execution-ledger bindings and returns `EXECUTION_READY` without resolving
  credentials, opening a broker connection, or executing a query.

Auth Subject and `auth.users` remain outside the Snapshot boundary and stay with
AUTH-01. No database, role, permission, credential, or Snapshot action is part of
this corrective.
