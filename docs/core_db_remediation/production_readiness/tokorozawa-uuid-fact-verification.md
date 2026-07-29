# Tokorozawa UUID Fact Verification

## Scope and boundary

This is a read-only source and Git audit for Phase 8.5 Production Readiness
Review, Step 1. No database catalog or data query was supplied or executed for
this audit. No database, migration, seed, FK, UUID, deployment, or runtime
change was made.

The purpose is to record what is proven, what is not proven, and the exact
evidence still required before choosing a canonical Tokorozawa UUID.

## Audit target

The requested candidates are `public.stores` and `core.stores`. The checked-out
repository contains extensive committed references to `public.stores`; it does
not contain a committed definition or literal reference to `core.stores`.
That source result is not proof that a `core.stores` object or a Tokorozawa row
does not exist in a database.

## Record facts

| Field | public.stores Tokorozawa row | core.stores Tokorozawa row |
| --- | --- | --- |
| schema_name | `public` is source-defined | NOT_OBSERVED |
| table_name | `stores` is source-defined | NOT_OBSERVED |
| uuid | NOT_OBSERVED; no value is emitted | NOT_OBSERVED; no value is emitted |
| store_id | Column is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| store_no | Column is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| store_code | Runtime output field is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| official_name | Store name column is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| display_name | NOT_OBSERVED | NOT_OBSERVED |
| status | Active flag column is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| created_at | Column is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| updated_at | Column is source-defined; row value NOT_OBSERVED | NOT_OBSERVED |
| source_system | NOT_OBSERVED | NOT_OBSERVED |
| source_record_key | NOT_OBSERVED | NOT_OBSERVED |
| FK reference count for this UUID | NOT_OBSERVED; catalog and data read not performed | NOT_OBSERVED; catalog and data read not performed |
| code reference count for this UUID | NOT_OBSERVED; UUID values are unavailable | NOT_OBSERVED; UUID values are unavailable |
| API reference for this UUID | NOT_OBSERVED; live API was not queried | NOT_OBSERVED; live API was not queried |
| runtime reference for this UUID | NOT_OBSERVED; runtime telemetry was not queried | NOT_OBSERVED; runtime telemetry was not queried |
| current application reference for this UUID | NOT_OBSERVED; live application state was not queried | NOT_OBSERVED; live application state was not queried |

`public.stores` is defined in committed source with `id`, `store_no`,
`store_id`, `store_name`, timestamps, and an active flag. That establishes a
schema-level contract only. It does not identify either Tokorozawa UUID.

## Source reference inventory

The following are committed-source references, not database reference counts.

| Side | Committed source result | Meaning |
| --- | --- | --- |
| public | 19 files contain `public.stores`; at least five SQL files declare a FK to it | Medium evidence that repository contracts use public.stores |
| core | 0 files contain literal `core.stores` | Medium negative source evidence only; not evidence of database absence |
| Tokorozawa names | Present in management fixtures, samples, and display material | Weak name-only evidence; no UUID is present |

Committed SQL references include employee assignment histories, multi-store
assignments, store business profiles, department inquiries, IDEA LINK followups,
and the NOV HUB bootstrap RPC. The bootstrap RPC source joins `public.stores`.
This proves an intended API/runtime contract in source, but not that a specific
Tokorozawa UUID is currently returned or used by a deployed runtime.

## Evidence classification

### Strong evidence: observed count 0

No database FK catalog, live API response, runtime telemetry, or production-like
data reference was read in this audit. Strong evidence is therefore absent.

### Medium evidence: observed count 9

1. `docs/core-employee-ledger-v1-review.md` defines `public.stores`.
2. `supabase/core-assignment-histories.sql` declares and joins a public store FK.
3. `supabase/core-employee-store-assignments.sql` declares a public store FK.
4. `supabase/store-business-profiles.sql` declares a public store FK.
5. `supabase/concierge_20260701_department_inquiries.sql` declares a public store FK.
6. `supabase/idea-link-activity-followups-20260724.sql` declares a public store FK.
7. `supabase/nov-hub-bootstrap-rpc.sql` joins `public.stores`.
8. Git history contains successive public store schema and assignment changes.
9. Source scan found public references and no literal core store references.

### Weak evidence: observed count 3

1. Store-master statements in application documentation.
2. Management CSV fixtures containing a Tokorozawa name.
3. Portal sample/display data containing a Tokorozawa name.

Weak evidence must not decide a UUID.

## Impact and missing facts

The audit cannot determine why the two UUIDs differ, which one was created
first, their timestamps, their source keys, or their actual dependent-row
counts. It also cannot confirm views, function bodies outside committed source,
API usage, or current runtime usage for either UUID.

The existing source-level public-store recommendation is therefore insufficient
for a UUID-level canonical decision.

## Recommendation

**Decision: `unresolved`.**

No canonical Tokorozawa UUID is recommended in this step. The observed Medium
evidence supports `public.stores` as the repository contract candidate, but
there is no Strong evidence for either of the two actual rows. Selecting
`public_uuid_canonical`, `core_uuid_canonical`, or `crosswalk_required` now
would be inference rather than fact verification.

Crosswalk design is deferred. It becomes necessary to propose a minimal
canonical-plus-legacy mapping only after the read-only evidence confirms that
both actual UUIDs have valid, active dependencies or after a public canonical
row is proven.

## Required human confirmation

Use an approved, sealed, read-only database catalog and data audit. It must
return masked UUID prefixes only and capture the following evidence without
changing data:

1. Existence and exact column metadata for both candidate tables.
2. Both Tokorozawa rows, matched by stable business keys rather than name alone.
3. Masked UUID prefix, created and updated timestamps, source system, and source
   record key for each row.
4. Inbound FK dependencies and dependent row counts for each UUID.
5. View, function, and RPC dependency inventory for each UUID.
6. Approved API and runtime evidence showing whether either UUID is currently
   returned or consumed.
7. Git and export provenance mapped to each stable source record key.

Until those seven items exist, no UUID change, crosswalk registration, FK
change, migration execution, or production switch is authorized by this audit.

## Change declaration

No database read was performed by this worktree. No database or source data was
mutated. This artifact contains no full UUID, credential, endpoint, or personal
value.
