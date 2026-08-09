# Store Operations Sealed Snapshot Execution Package v1

**Status:** BLOCKING REPAIR COMPLETE PENDING FINAL REVIEW. This package contains no
database connection, live query, Snapshot extraction, Master Population, Auth
onboarding, consumer-anchor write, M019 change, access binding, or application
connection.

## Purpose

The only approved future path for Store Operations Canonical Master evidence is:

```text
idea-nov-core (source, read only)
  -> sealed private Snapshot artifact
  -> separately approved Canonical Master population in idea-nov-staging
  -> separately approved Auth onboarding and M019-compatible binding
```

The package does not make Staging a second source of truth. `idea-nov-core`
remains the source Canonical Master. A Snapshot is immutable evidence with
explicit source/version/masking/mapping provenance.

## Public Package Boundary

The repository stores only fixed query identifiers, logical result schemas,
hash rules, fail-closed code, synthetic fixtures, and runbooks. It never stores
SQL text, project refs, hosts, credentials, raw source rows, raw UUIDs, Auth
subjects, employee PII, or a local plaintext identity export.

The existing `C01` through `C10` catalog pack is unchanged. `S01` through
`S08` remain a historical conditional template and are not made executable by
this package.

## Components

| Component | Location | Responsibility |
|---|---|---|
| Fixed SOCE packs | `review/store-operations-sealed-snapshot-v1/query-pack-registry.mjs` | Six fixed Packs, 16 Query IDs, Query Version, type/schema contracts, and no SQL text. |
| Deterministic hash | `canonicalization.mjs` | One canonical byte representation and SHA-256. |
| Sanitizer | `sanitizer.mjs` | Public evidence is count/digest/status only. |
| Schema gate | `schema-contract.mjs` | Stage 1 may run only after Stage 0 exactly matches a private approved contract. |
| Sealed runner | `sealed-snapshot-runner.mjs` | Fixed order, per-Query private SQL-hash attestation, run-ID claim, profile expiry, rollback/close, atomic bundle commit, and no caller SQL. |
| Fixture tests | `sealed-snapshot-package.test.mjs` | Synthetic in-memory proof; no database connection. |
| Operational materials | This directory | Human approvals, security contract, and incident steps. |

## Execution State

One later Owner authorization can permit one read-only run only after Final
Review passes and all private prerequisites are supplied. It cannot authorize
any Population, Auth onboarding, consumer-anchor insert, M019-Corrective work,
or Store Operations connection.

See `final-review-checklist.md` and `owner-authorization-template.md`.
