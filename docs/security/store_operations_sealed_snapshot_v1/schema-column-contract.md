# Schema and Column Contract

## Private Approved Contract

The execution input is a private immutable `SOCE-SCHEMA-COLUMN-CONTRACT-v1`.
It contains the approved Source and Target object set, object-set hash,
physical column map, types, nullability, constraints, relations, approved
private Query-registry hash, and a Stage 0 evidence digest. The repository
stores no physical-schema claim as a Production fact.

The logical source set is limited to Canonical Master evidence for corporations,
stores, departments, employees, roles/positions where present, effective
employee-store assignments, legacy/crosswalk relations, and HUB identity
crosswalk evidence. The logical target set is limited to the Canonical Master,
Staging Auth pre-state, consumer-anchor pre-state, and M019 presence/pre-state.

## Contract Requirements

| Rule | Result |
|---|---|
| Contract is approved and hash-valid | Required before a connection opens. |
| Source and Target labels are exact | `idea-nov-core` and `idea-nov-staging`. |
| Stage 0 digest equals the contract digest | Required before Stage 1. |
| Query IDs/order/version/schema/type are exact | Required. |
| Each private Query SQL SHA-256 matches the sealed private registry | Required before QP01. |
| Any object/column/type/constraint/relation mismatch | Stop; no Stage 1; no artifact. |
| Missing or extra expected column | Stop; no fallback. |
| Contract stale, unsigned, or replaced in flight | Stop. |

The contract maps physical fields to the logical fields in the fixed registry
before execution. The runner neither inspects arbitrary schema names nor builds
new SQL from observed columns. A new physical mapping needs a new private
contract, new hashes, review, and a new Owner authorization.

## Population and Auth Boundary

Stage 0/1 only attests source evidence and Target pre-state. It does not decide
which employee receives access, create an `auth.users` subject, create a
consumer-anchor, or bind M019. Sales Department Head remains `UNRESOLVED` until
the required Employee, Position, canonical role, and department facts are all
attested.
