# Store Operations Monthly Data: Implementation Readiness

## Decision

**BLOCKED for Migration, RLS, and Import Center implementation.** The source
inventory identifies reusable models and a small set of concrete gaps, but two
implementation gates remain open:

1. a fresh, approved Production read-only catalog attestation for the target
   Accounting and Core Master objects; and
2. an approved, reusable server-side canonical HUB session verifier boundary for
   Store Operations.

No Production connection or query was made for this readiness review. Database
mutation, migration, RLS/grant changes, RPC, Edge deployment, UI change, and CSV
import counts are all zero.

## 1. Production catalog readiness

### Available evidence

The repository's prior Core Master audit, dated 2026-07-30, records a read-only
catalog result for `public.stores`, `core.stores`, and employee assignment objects.
It reports 22 physical `public.stores` rows consisting of the approved current 20
stores, Direct 13, FC 7, one headquarters row, and one inactive legacy row. It also
records `public.employee_store_assignments` as a physical table and records no
physical Store UUID crosswalk relation.

This is historical evidence only. It is not a current catalog assertion and does
not establish the physical existence, column shape, keys, indexes, RLS, or grants of
the Accounting Core tables.

### Required read-only attestation before implementation

Use only an approved Production read-only audit role and sealed fixed-query runner.
If its identity profile, approved manifest, or least-privilege role is unavailable,
stop with query count zero. The approved catalog collection must establish, without
exporting raw data:

| Object group | Required catalog facts |
| --- | --- |
| Accounting lifecycle | existence and schema for import batches/files, versions, facts, validation results, approvals, publications, audit logs; columns; PK/FK; indexes; RLS; policies; grants |
| Employee scope | `employee_store_assignments` existence, columns, PK/FK, indexes, RLS/policies/grants, row-count aggregate only |
| Store Master | `public.stores` count/status aggregate, Store ID uniqueness aggregate, corporation relationship, RLS/policies/grants |
| Crosswalk | relation/view/function candidate existence only; no UUID export |
| Consumer projection | approved view/function/API contract candidate and its security owner |

The repository does not currently contain a sealed runner and manifest for this
specific Accounting catalog attestation. A source-only runner/review pack is required
before a Production catalog call can be approved.

## 2. Accounting Core reuse and gaps

### Reusable logical model

`accounting_core/schema.sql` and the review-only PostgreSQL candidate describe the
following lifecycle primitives:

- batch and source-file identity;
- immutable versions and supersession;
- normalized facts and validation results;
- published-only consumer projection;
- publication history and append-only audit evidence; and
- rollback-restore version type.

The seven minimum monthly import/publish objects are: import batch, import file,
version, facts, validation result, publication, and audit log. The Accounting Core
model also contains entity/account mappings, raw values, and approvals. Store
Operations must reuse this lifecycle; it must not create a parallel financial ledger.

### Required alignment before implementation

The reviewed PostgreSQL candidate is under `migrations-proposed/` and ends in
`ROLLBACK`; it is not evidence of a deployed target schema. Subject to fresh catalog
evidence, the minimum additions or alignments are:

| Existing logical object | Gap against the approved monthly contract | Minimum candidate |
| --- | --- | --- |
| `accounting.import_files` | no distinct V1 CSV type/profile field in reviewed candidate | add a controlled `import_profile` or `csv_type` reference; do not infer from filename |
| `accounting.validation_results` | source row is indirect or absent for an early rejection | retain a bounded source row/column reference and masked error code; never retain a raw data dump |
| `accounting.approvals` | reviewed stages are Accounting/Management and do not identify the rollback operation or Representative role | add operation/context and approver-role snapshot, or a constrained equivalent, before rollback enablement |
| `accounting.versions` / `facts` | must model four Yayoi profiles for one all-20-store file per month | approve one profile-to-fact mapping and a group-level publication rule |

### Accounting import receivers

All four V1 inputs belong to the same Accounting lifecycle, not separate tables:

| CSV type | Source | Proposed receiver |
| --- | --- | --- |
| monthly sales | Yayoi Accounting CSV | approved profile -> import file -> version -> published facts |
| monthly profit | Yayoi Accounting CSV | approved profile -> import file -> version -> published facts |
| monthly EC sales | Yayoi Accounting CSV | approved profile -> import file -> version -> published facts |
| monthly product sales | Yayoi Accounting CSV | approved profile -> import file -> version -> published facts |

The actual Yayoi headers and account mapping are unverified. No column name or
account mapping may be fixed until an Accounting owner approves representative,
sanitized source exports.

## 3. Employee Master and AM Store Scope

### Existing implementation candidate

`public.employee_store_assignments` is referenced by `nov-hub-api` and its source
definition supports multiple assignments with `employee_id`, `store_id`,
`assignment_order`, `assignment_type`, `effective_from`, `effective_to`, and
`is_active`. This meets the intended normalized Employee Master shape and is not a
separate AM Master.

### Required decision

The source definition and its current server-side readers treat `effective_to` as
inclusive. The Store History ADR describes `effective_to` as exclusive. Before
implementation, Core Master and Security owners must choose one semantic and apply
it consistently to the monthly-period scope resolver, validation tests, and future
migration. Until then, AM scope must remain deny-by-default.

If the fresh catalog attestation confirms the table is absent or incompatible, the
minimal candidate is one Employee Master relation with the fields above. No columns
need be added to `public.employees` when this normalized relation is approved.

## 4. Store Master and Tokorozawa crosswalk

`public.stores` remains the approved Store Master direction. Current Store
Operations matching uses canonical `store_id`; it must not use names or raw UUIDs.
The prior audit records the 20/13/7 composition, but the current implementation
requires a fresh aggregate recheck before publication is enabled.

No physical UUID crosswalk object is evidenced by the reviewed source. The minimal
placement candidate is a restricted Core Master relation owned outside the Store
Operations schema, with canonical Store UUID, legacy UUID, legacy source, validity
window, reason, approval metadata, and immutable audit fields. It must not be
browser-readable, and no UUID is rewritten.

## 5. Canonical HUB Session readiness

### Identified source behavior

- The canonical browser session uses the `ideaNov.hub.session.v1` session contract
  and sends its token only as an HTTPS Bearer credential.
- `supabase/functions/nov-hub-api/index.ts` contains `verifyHubAppSession` and an
  `authenticate(... authType: "hub_session")` path that checks signature, audience,
  expiry, issued-at, and employee subject.
- The current `store-sales-projection` function instead accepts only synthetic
  staging tokens and resolves synthetic role/scope data.

### Result

The canonical server verifier is **identified but not ready for Store Operations
reuse**. It is an internal `nov-hub-api` implementation, not an approved shared
server module or Store Sales authorization Access Port. Do not copy a signing secret
or make the browser assert role/scope. A Security/Platform decision must choose a
server-to-server authorization boundary or an approved shared verifier package.

Role and scope requirements for the chosen boundary are fixed: employee `403`, AM
uses effective Employee Master assignments only and is deny-by-default when empty,
and all projections are filtered server-side.

## 6. Rollback record and retention

The Accounting Core lifecycle already provides a `rollback_restore` version type,
publication supersession, and append-only audit evidence. Before rollout, enforce
two independent approval records for a rollback: one Accounting approver and one
Representative approver, with operation type, version linkage, decision timestamp,
and reason. A normal Accounting publication must not require Representative approval.

**Retention proposal:** retain monthly import, publication, rollback, and audit
metadata for at least seven years, subject to Accounting and Legal confirmation.
The National Tax Agency states that corporations generally retain books and relevant
records for seven years; confirm the exact classification and electronic-record
requirements for the final artifact set with counsel. [National Tax Agency guidance](https://www.nta.go.jp/taxes/shiraberu/taxanswer/hojin/5930.htm)

## 7. Candidate migration and RLS work

These are planning units only, not executable migrations:

| Candidate | Scope | Precondition |
| --- | --- | --- |
| M1: Accounting lifecycle alignment | port/align Accounting import, version, validation, approval, publication, audit, and consumer projection objects; include controlled four-profile metadata | fresh Accounting catalog + Accounting owner approval |
| M2: Core Master compatibility | add only a missing/incompatible Employee assignment relation and immutable Store UUID crosswalk | fresh Core Master catalog + Core Master owner approval |
| M3: Access security | default-deny RLS/grants and backend-only Access Ports for Accounting, assignments, Store Master, and projection read | canonical session boundary + Security owner approval |

**Migration candidate count: 3.** Each may reduce to no-op or a smaller alignment
after the approved catalog result; none may be applied without a separately reviewed
migration and rollback plan.

**RLS change candidates: 3 policy domains** -- Accounting lifecycle, Core Master
assignment/crosswalk, and Store Master/Projection Access Ports. Exact policy count is
intentionally unresolved until the target catalog, role model, and chosen server
principal are approved.

## Human approvals before implementation

1. Approve a sealed, fixed-query Production catalog attestation for Accounting and
   Core Master objects.
2. Accept/reject actual target compatibility for the seven monthly lifecycle objects.
3. Approve the four Yayoi import profiles from sanitized representative exports.
4. Select inclusive or exclusive `effective_to` semantics.
5. Approve Employee assignment relation ownership and data stewardship.
6. Approve crosswalk placement, identity evidence, and immutability controls.
7. Select the reusable canonical HUB server verifier boundary.
8. Approve RLS/grant design, least-privilege server principal, and negative tests.
9. Approve Accounting-plus-Representative rollback evidence and retention policy.

## Start criterion

Implementation can start only when approvals 1 through 8 are complete and the
catalog attestation confirms a safe migration scope. Approval 9 is required before
rollback can be enabled. Until then, Migration, RLS, Import Center, real Projection,
and deployment remain blocked.
