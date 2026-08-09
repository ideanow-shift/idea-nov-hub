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

The repository stores fixed query identifiers, reviewed fixed SQL artifacts,
logical result schemas, hash rules, fail-closed code, synthetic fixtures, and
runbooks. It never stores project refs, hosts, credentials, raw source rows,
raw UUIDs, Auth subjects, employee PII, or a local plaintext identity export.

The 16 SQL artifacts are static, UTF-8, BOM-free, LF-only reviewed files. They
contain no dynamic assembly point, connection detail, secret, token, or real
record value. The runner hashes the exact byte sequence at startup and again
immediately before sending it to the broker.

## Windows Checkout Byte Stability

The Package Lock covers filesystem bytes, including the package's nested
`.gitattributes`. That nested file cannot apply attributes to itself. The
repository-root `.gitattributes` therefore narrowly fixes only
`review/store-operations-sealed-snapshot-v1/**` and its nested attributes file
to `text eol=lf`. This preserves the reviewed byte contract on Windows when
`core.autocrlf=true`; it is not a local Git configuration workaround.

Before Final Review, run the fresh-checkout fixture below. It creates only
temporary local Git repositories and worktrees, checks the `true`, `false`,
and `input` autocrlf cases, verifies all 29 locked package artifacts and all
16 SQL artifacts against their existing hashes, and proves that a deliberate
CRLF mutation is rejected.

```powershell
node tests/store-operations-sealed-snapshot-eol-integrity.test.mjs
```

Any filesystem-byte mismatch remains `PACKAGE_INTEGRITY_REJECTED`. The runner
does not normalize bytes, update a hash at runtime, or downgrade a mismatch to
a warning.

The existing `C01` through `C10` catalog pack is unchanged. `S01` through
`S08` remain a historical conditional template and are not made executable by
this package.

## Components

| Component | Location | Responsibility |
|---|---|---|
| Fixed SOCE packs | `review/store-operations-sealed-snapshot-v1/query-pack-registry.mjs` and `queries/` | Six fixed Packs, 16 Query IDs, Query Version, SQL path/hash, and type/schema contracts. |
| Package lock | `execution-package-lock-v1.json` | Ordered hash lock over all execution-affecting modules and all 16 SQL artifacts. |
| Deterministic hash | `canonicalization.mjs` | One canonical byte representation and SHA-256. |
| Sanitizer | `sanitizer.mjs` | Public evidence is count/digest/status only. |
| Schema gate | `schema-contract.mjs` | Stage 1 may run only after Stage 0 exactly matches a private approved contract. |
| Sealed runner | `sealed-snapshot-runner.mjs` | Fixed order, package/query-byte rehash, run-ID package binding, profile verification, local ephemeral bundle, cleanup receipt, atomic final commit, and no caller SQL. |
| Fixture tests | `sealed-snapshot-package.test.mjs` | Synthetic in-memory proof; no database connection. |
| PostgreSQL 17 semantic test | `local-postgresql17-role-test.mjs` | Disposable local catalog/Role proof only; no Source or Target connection. |
| Operational materials | This directory | Human approvals, security contract, and incident steps. |

## Execution State

One later Owner authorization can permit one read-only run only after Final
Review passes and all private prerequisites are supplied. It cannot authorize
any Population, Auth onboarding, consumer-anchor insert, M019-Corrective work,
or Store Operations connection.

See `final-review-checklist.md` and `owner-authorization-template.md`.
