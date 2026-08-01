# Store Operations Monthly Data Foundation: Implementation Impact Audit

## Decision

**CONDITIONAL PASS for implementation planning.** The merged monthly-data
foundation is sufficiently specific to plan the next implementation sprint. It is
not sufficient to apply a migration or enable an import because the target Supabase
catalog, the approved Yayoi column mapping, and the canonical server-side HUB session
verifier must be confirmed first.

This audit is source-only. No database, migration, RLS, RPC, UI, deployment, or
Yayoi Workbook import was changed.

## Evidence reviewed

| Evidence | Finding | Implementation consequence |
| --- | --- | --- |
| `docs/store_operations_management/monthly_data_foundation/` | V1 defines one all-20-store Yayoi annual-trial-balance workbook profile, four derived logical metrics, Accounting publication, immutable versions, fail-closed validation, and AM deny-by-default. | The implementation must preserve these contracts exactly. |
| `accounting_core/schema.sql` | Contains import batches/files, versions, raw facts, validations, approvals, publications, audit log, immutable published facts, and `accounting_consumer_facts`. | Reuse the Accounting Core logical model; do not create a parallel Store Operations accounting ledger. |
| `accounting_kpi/schema.sql` | Contains published-version projection state and KPI calculation/result controls. | Reuse only after metric definitions and target persistence are approved. |
| `supabase/functions/store-sales-projection/` | Staging function validates synthetic tokens, synthetic store IDs, and produces synthetic projection data. | It cannot be promoted or reused as a real-data source without a separately approved replacement of its synthetic-only path. |
| `supabase/core-employee-store-assignments.sql` | Defines a normalized employee-to-store relation with multiple assignments and effective dates. | It is the preferred physical form for Employee Master AM assignments, subject to target-catalog confirmation and migration approval. |
| Core DB ADRs 001, 002, 005, 006 | `public.stores` is the canonical Store Master direction; Tokorozawa requires a legacy-to-canonical crosswalk; access is server-side and default deny. | No direct browser table access, UUID rewrite, or name-based matching is permitted. |

The reviewed SQL schemas are repository artifacts, not proof that matching objects
exist in the target Supabase project. All physical reuse claims are therefore
conditional on a future catalog verification.

## Required implementation inventory

| Capability | Required persistence / contract | Reuse status | New work after approval |
| --- | --- | --- | --- |
| Master resolution | `public.stores`, Corporation Master, Employee Master through a server-side Access Port | Core Master direction exists in ADRs; target catalog not verified here | Access Port implementation and contract tests |
| Store identifiers | canonical `store_id`; controlled Tokorozawa legacy UUID crosswalk | Crosswalk policy exists; physical crosswalk object is not evidenced | Create/align a crosswalk persistence contract only after owner approval |
| AM Store Scope | multiple effective-dated employee-to-store assignments | `public.employee_store_assignments` is a repository SQL candidate | Verify target object; migrate only if absent; resolve scope server-side |
| Import batch and file history | batch ID, workbook hash, profile and mapping versions, periods, source metadata, actor, timestamps | `accounting_import_batches` and `accounting_import_files` exist in Accounting Core schema | Port/align to target persistence if not already present |
| Version and publication | immutable workbook version, supersession, latest published only | `accounting_versions`, `accounting_publications`, immutable published facts exist in Accounting Core schema | Add the Workbook Profile, mapping-version semantics, and Accounting-only normal publication policy |
| Error isolation | blocking validation results, masked row reference, no partial publication | `accounting_validation_results` exists | Reuse; do not introduce an unbounded raw Workbook, sheet, or row quarantine store |
| Rollback | restore a prior compatible published version without overwrite | Accounting Core contains `rollback_restore` and publication supersession | Add Accounting-plus-Representative approval enforcement and audit evidence |
| Monthly projection | published sales, profit, EC, product data; null/unavailable states | Accounting consumer view/API contract is a source model only | Build a target-backed server read projection with the monthly data contract |
| Import Center | upload, dry-run validation, content review, publish, rollback request/history | No approved operator UI is present in scope | Implement only after server contracts and authorization are approved |

## Tables and migrations

### Do not duplicate

The implementation must not create another Store, Corporation, Employee, accounting
version, or publication master merely for Store Operations. It should reuse the
Accounting Core logical tables where their target Supabase equivalents are verified:

1. `accounting_import_batches`
2. `accounting_import_files`
3. `accounting_versions`
4. `accounting_facts`
5. `accounting_validation_results`
6. `accounting_publications`
7. `accounting_audit_logs`

### Conditional physical additions

The following are required **only when target-catalog verification proves they are
absent or incompatible**:

| Object | Purpose | Count classification |
| --- | --- | --- |
| Employee Master assignment relation compatible with `employee_store_assignments` | multiple AM stores and effective period | one conditional Core Master table; not a separate AM Master |
| Immutable legacy-to-canonical Store UUID crosswalk | controlled Tokorozawa compatibility | one conditional Core Master table |
| Target-backed projection view or server query contract | published monthly Store Operations read model | view/query contract, not a duplicate facts table |

Therefore the audit identifies **zero unconditional new Store Operations ledger
tables**, **two conditional Core Master tables**, and **seven Accounting Core logical
tables to reuse or formally migrate/align**. A migration is required before a target
Supabase implementation if catalog verification does not prove compatible objects
already exist. This audit neither creates nor approves one.

## Import Center scope

The future Import Center is an Accounting-only, server-mediated workflow:

1. Accept one approved Yayoi annual-trial-balance workbook containing P/L sheets
   mapped to the current 20 stores.
2. Compute an immutable workbook hash and create a batch/file record.
3. Validate the Workbook Profile, actual month columns, approved sheet/account
   mappings, `store_id`, and `corporation_id`.
4. Reject the entire file for missing required columns, invalid period, unknown
   store/corporation, duplicate store ID, or a 20/direct-13/FC-7 invariant failure.
5. Store only masked validation evidence and make no partial publication.
6. Let Accounting review and normally publish a validated version.
7. Require Accounting plus Representative approval to create a rollback restore.

The historical structure audit provides a reference profile, but the actual next
workbook must be inventoried in a dry-run and mapped in an approved, versioned
profile. No raw sheet label is a canonical identifier.

## Permission and RLS impact

| Boundary | Required behavior | Change needed later |
| --- | --- | --- |
| Yayoi Workbook upload / dry-run / normalized monthly version publish | Accounting only | server authorization and negative tests |
| Rollback | Accounting plus Representative | dual-approval workflow and audit evidence |
| Projection read | resolved role and effective Store Scope only | server-side scope resolver; browser claim is not authoritative |
| AM | Employee Master assignments effective for the target period; no assignment means deny | server-side assignment query and deny test |
| Employee | `403` for Store Sales | explicit deny test |
| Database access | no browser direct table access; least-privilege server path | RLS/policy and grants are required for any new or aligned objects |

**RLS change is required for implementation**, but it is a future migration and
security-review item. Existing source artifacts do not prove an approved target
policy for the required monthly tables or the `public.stores` Access Port.

## Edge Function and UI impact

### Server functions

Two server-side responsibilities are required after approval:

1. A new or dedicated Accounting Import Center command boundary for validate,
   review, publish, and rollback orchestration. It must not accept arbitrary SQL.
2. A replacement or material revision of `store-sales-projection` to use the
   canonical HUB session verifier and target-backed published projection instead of
   its current synthetic token/data path.

This is a **yes** for Edge Function work. The current synthetic function is useful
only as a staging test surface and cannot satisfy the approved real-data contract.

### UI

This is a **yes** for UI work, but only after server contracts are approved:

- Accounting Import Center: select a Workbook Profile, upload, validation summary,
  publish control, immutable history, and rollback request state.
- Store Operations read UI: render only the server-provided monthly projection,
  show `preparing` as `集計中`, never display unknown values as zero, and show no
  import operator surface to non-Accounting roles.

## Human approvals required

1. Target Supabase catalog evidence for Master, Accounting, assignment, and
   crosswalk objects.
2. The approved Yayoi export samples and a versioned source-column mapping for all
   Workbook Profile and the four derived logical metrics.
3. Accounting owner confirmation that the accounting logical schema is the target
   persistence model, including net/tax semantics and confirmed-period rule.
4. Core Master owner approval that `employee_store_assignments` is the formal
   Employee Master representation for AM Scope, rather than a separate AM Master.
5. Crosswalk owner approval, source evidence, and immutable legacy UUID lifecycle.
6. Security owner approval of the canonical HUB session verifier, server principal,
   RLS/grants, and explicit negative access tests.
7. Accounting and Representative approval details for the rollback authority and
   exceptional-publication evidence.
8. Data retention and masked validation/audit-evidence policy.

## Recommended implementation order

1. Perform target-catalog and canonical HUB-session verification; stop if either is
   unavailable.
2. Freeze the approved Yayoi Workbook Profile, sheet map, and account map from a
   real, approved workbook inventory.
3. Produce one reviewed migration plan for missing/unaligned Accounting, assignment,
   and crosswalk objects, including RLS/grants and rollback.
4. Implement server-side Master/Scope and Accounting published-projection Access
   Ports with contract and negative tests.
5. Implement the Accounting Import Center command boundary and version/publication
   lifecycle.
6. Replace the synthetic Store Sales projection path with the approved real-data
   read path; keep synthetic fixtures strictly test-only.
7. Build the Accounting operator UI and Store Operations read states.
8. Run staging E2E, authorization, import-failure, publication, rollback, and
   no-zero-substitution tests before any release decision.

## Explicit non-actions

No implementation, database mutation, migration, RLS change, RPC, UI change,
deployment, Production operation, or Yayoi Workbook import was performed by this
audit.
