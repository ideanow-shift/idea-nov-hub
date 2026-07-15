# Classification Snapshot Provider Substrate V1

Status: SOURCE CANDIDATE ONLY. CURRENT PROVIDER NOT READY.

## Non-disruptive substrate

`substrate-up.sql` adds a nullable `classification_snapshot` text column and a
format check that permits only null or canonical `s2:<64 lowercase hex>` values.
Existing rows remain null. No snapshot is generated, no trigger is installed,
and existing business writes are unchanged.

The status reader always returns `SNAPSHOT_PROVIDER_NOT_READY`. The generation
function is a fixed stub returning the same category and no identity. Neither
function receives browser canonical fields, hashes, actor assertions, or
provider readiness booleans. PUBLIC, anon, and authenticated receive no EXECUTE
privilege; direct snapshot-column UPDATE is revoked.

## Future cutover boundary

Canonical CRSNAP2 serialization, SHA-256 identity generation, source ownership,
scope evidence, and atomic version/snapshot binding are not implemented here.
They require all six reviewed provider identities and a DB-owned atomic read.
`cutover-canonical-provider.sql` is intentionally execution-ineligible and must
not be applied.

At a later approved cutover, the DB-owned provider must derive the exact v2.1
field order, bind `classification_version` atomically, populate every snapshot,
verify collision-free round trips, and only then make status READY. Browser
hashes remain comparison inputs and never become provider truth.

## Ownership and collisions

The dedicated owner is exact NOLOGIN and nonprivileged with zero inbound or
outbound membership. Existing unsafe role, column, function overload, owner, or
ACL identity aborts before owner changes. CREATE OR REPLACE is prohibited.

## Rollback

`down.sql` is source-only. Dropping the column would lose future snapshot
identities, so runtime must be disabled and state export/restore semantics
approved before any down execution.

## Current classification

- local source: `LOCAL_REHEARSAL_PASS` eligible after isolated rehearsal
- runtime approved digest: null
- schema applied: false
- canonical provider installed: false
- runtime wired: false
- current ready: false
- production catalog/apply: `PRODUCTION_EVIDENCE_REQUIRED`

