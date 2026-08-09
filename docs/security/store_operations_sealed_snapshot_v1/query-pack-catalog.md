# Fixed Query Pack Catalog

All query text is a private reviewed artifact. The public registry fixes the
Pack ID, Query ID, Query Version, side, logical result schema, expected scalar
types, output-schema version, row cap, and timeout. It deliberately contains
no SQL and cannot dynamically choose a table or column.

The private immutable `SOCE-PRIVATE-QUERY-REGISTRY-v1` contains all 16
private definitions. Each definition has `queryId`, `queryVersion`, `packId`,
private SQL, `sqlSha256`, `expectedColumns`, `expectedTypes`, and
`expectedOutputSchemaVersion`. SQL never enters this repository, a log, or an
artifact. Its SHA-256 is compared per Query by the broker before any query is
executed; a Pack hash cannot substitute for a Query hash.

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
policy, Stage 0 digest, and all 16 private Query hashes exactly match their
approved contracts. Stage 1 cannot generate SQL from a live schema, infer a
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
