# Fixed Query Pack Catalog v1.3.1 Corrective

This additive catalog supersedes the v1.3.0 QP06 definition only. The v1.2.0
and v1.3.0 catalogs and packages remain immutable. All other Query IDs,
ordering, purposes, result schemas and Security Contract controls are retained.

| Pack | Stage | Fixed purpose | Required validation |
|---|---|---|---|
| `SOCE-QP01` | 0 | Source/Target identity and effective read-only Role attestation | Unchanged from v1.3.0. |
| `SOCE-QP02` | 0 | Schema/column/constraint/relation attestation | Unchanged from v1.3.0. |
| `SOCE-QP03` | 1 | Corporation/Store classification and legacy relation | Unchanged from v1.3.0. |
| `SOCE-QP04` | 1 | Employee and assignment evidence | Unchanged from v1.3.0. |
| `SOCE-QP05` | 1 | Canonical identity crosswalk and future consumer-anchor evidence | Unchanged from v1.3.0. |
| `SOCE-QP06` | 1 | Target Canonical Master, consumer-anchor and access-contract pre-state; M019 presence | All partial-population counters are zero and M019 is present. No Auth schema or Auth subject is queried. |

`SOCE-QP06-TARGET-PRESTATE` returns only these zero-gated logical fields:

- Canonical corporation, store, employee, role and assignment counts;
- identity-crosswalk and consumer-anchor counts;
- consumer-access-contract and partial-population counts;
- duplicate and orphan counts.

It does not access `auth.users`, expose an Auth subject count, or decide Auth
onboarding. Auth subject existence, one-to-one Canonical Employee binding and
onboarding state are verified later by the separately authorized AUTH-01
server-side boundary.

The private registry, SQL byte hash, AST hash, relation and column allowlist,
public catalog hash, Schema Contract and Package Lock are regenerated together.
An old QP06 shape or an extra Auth field fails closed.
