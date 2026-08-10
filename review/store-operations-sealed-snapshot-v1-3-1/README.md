# Store Operations Sealed Snapshot v1.3.1 Query Corrective

This fixture-only package is the public control plane for a future, separately
approved, read-only Source Snapshot run. It has no database URL, credential,
network client, file-export path, or live execution entrypoint. It carries
only the reviewed, fixed, non-secret SQL text required by its 16 Query IDs.
The immutable v1.2.0 and v1.3.0 packages remain under
`store-operations-sealed-snapshot-v1` and
`store-operations-sealed-snapshot-v1-3`.

v1.3.1 removes the `auth.users` aggregate from
`SOCE-QP06-TARGET-PRESTATE`. Target pre-state is limited to Canonical Master,
consumer-anchor and access-contract partial-population evidence. Auth subject
existence, one-to-one Canonical Employee binding and onboarding state belong
to the separately authorized AUTH-01 server-side boundary.

The runner accepts only the six fixed `SOCE-QP01` through `SOCE-QP06` packs.
Each query's exact UTF-8, BOM-free, LF-terminated SQL artifact is under
`queries/`. The runner rehashes the actual bytes at startup and immediately
before execution. The Broker accepts only Query ID, order, SQL hash and
security-AST hash; it exposes no generic SQL method. Stage 0 must hash-match an approved
Schema/Column Contract before Stage 1 can be invoked.

v1.3.1 preserves the v1.3.0 execution-path Security Contract and does not
require global PUBLIC ACL hardening. PUBLIC-derived TEMP and
routine EXECUTE are recorded, while direct grants remain fail-closed. A fixed
allowlist of relations, columns, function signatures and operator signatures,
`REPEATABLE READ READ ONLY`, exact session identity and runtime no-write
evidence make those ambient PUBLIC capabilities unreachable from this path.

Run the local fixtures only:

```powershell
node review/store-operations-sealed-snapshot-v1-3-1/security-corrective.test.mjs
node review/store-operations-sealed-snapshot-v1-3-1/sealed-snapshot-package.test.mjs
```

The test uses only synthetic records and an in-memory broker. It does not open
source or target connections and does not create a Snapshot artifact.

Run the separate disposable PostgreSQL 17 catalog-semantic test with a local
PostgreSQL 17 binary directory. It creates no network connection, uses a
temporary local data directory and deletes that directory after the test:

```powershell
$env:BDF_PG_BIN = '<PostgreSQL-17-bin>'
node review/store-operations-sealed-snapshot-v1-3-1/local-postgresql17-security.test.mjs
```

This test is a local authoring check. It is not a Source or Target execution
path and cannot create a Snapshot artifact.
