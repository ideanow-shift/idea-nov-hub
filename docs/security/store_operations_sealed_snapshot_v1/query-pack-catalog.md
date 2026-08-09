# Fixed Query Pack Catalog

Each query text is a reviewed fixed artifact under
`review/store-operations-sealed-snapshot-v1/queries/`. The registry fixes the
Pack ID, Query ID, Query Version, side, `sqlFile`, `sqlSha256`, logical result
schema, expected scalar types, output-schema version, row cap, and timeout.
It cannot dynamically choose a table or column.

The immutable `SOCE-PRIVATE-QUERY-REGISTRY-v1` binds all 16 definitions to the
same `queryId`, `queryVersion`, `packId`, `sqlFile`, `sqlSha256`,
`expectedColumns`, `expectedTypes`, and `expectedOutputSchemaVersion` values.
The SQL is UTF-8, has no BOM, uses LF only, and ends in exactly one LF. The
runner rehashes the exact bytes at startup and immediately before sending the
same UTF-8 byte stream to the broker. A Pack hash cannot substitute for a
Query hash; a hash mismatch stops before a run claim or connection.

| Pack | Stage | Fixed purpose | Required validation |
|---|---|---|---|
| `SOCE-QP01` | 0 | Source/Target project identity, PostgreSQL version, and read-only-role attestation | Source is Production, Target is Staging, profiles distinct, PostgreSQL major is 17, role is read-only. |
| `SOCE-QP02` | 0 | Schema/column/constraint/relation attestation | Exact match to private approved Schema/Column Contract. |
| `SOCE-QP03` | 1 | Corporation/Store classification and Tokorozawa legacy relation | Six corporations, official 20, direct 13, franchise 7, no duplicate/orphan/unresolved official row. |
| `SOCE-QP04` | 1 | Employee/role/position/department/assignment evidence | Source-backed AM and manager evidence only; sales head may remain `unresolved`. |
| `SOCE-QP05` | 1 | HUB/Canonical identity crosswalk and future consumer-anchor evidence | No email-only, display-name-only, orphan, or one-to-many identity route. |
| `SOCE-QP06` | 1 | Staging pre-state and M019 presence | Canonical Master/Auth/anchor/access counters are zero and M019 is present. |

## Stage 0 / Stage 1 Rule

Stage 0 executes `SOCE-QP01` and then `SOCE-QP02`. It creates a digest from
the private catalog output. Stage 1 is invoked only when the PostgreSQL version
policy, Stage 0 digest, Package Lock, and all 16 Query hashes exactly match
their approved contracts. Stage 1 cannot generate SQL from a live schema, infer a
missing column, fall back to `S01`--`S08`, or substitute an alternative object.

## Domain Boundaries

`SOCE-QP03` explicitly separates official physical stores from headquarters,
legacy, virtual, inactive, test, duplicate, and unresolved rows. It records
the Tokorozawa legacy relation as a relation state, never as a UUID dump.

`SOCE-QP04` does not select employee names, emails, phone numbers, addresses,
or raw Auth subjects. AM scope remains limited to source-backed active
`primary` or `secondary` assignments. `support` and `temporary` never enlarge
scope. Store-manager coverage must identify one active qualifying manager per
official store or stop.

`SOCE-QP05` may produce candidate evidence, not an Auth onboarding or anchor
write. The Representative/Vice President anchor candidates need source-backed
identity and one effective corporation path for each of the six corporations.

The Pack catalog is hash-bound as `SOCE-MANIFEST-v1`; a Pack content hash
mismatch stops before any Stage 1 query.
