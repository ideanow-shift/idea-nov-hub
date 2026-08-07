# PR002 — M012 Accounting Import Boundary Authoring Release Gate

| Item | Contract |
|---|---|
| Program allocation | ACF-01 = M012 |
| Scope | Accounting namespace, default deny, Import Batch/File and typed Staging boundary |
| Depends on | M001, M009, M011 |
| Excluded | Account Master, Version, Fact, Approval, Publication, Projection, data load |
| Apply status | Not authorized |

## Artifacts

- Forward: `supabase/migrations/20260806223721_m012_bdf_accounting_import_boundary.sql`
- Rollback: `supabase/rollback/pr002/m012_bdf_accounting_import_boundary.rollback.sql`
- Validation: `supabase/validation/pr002/validate_m012.sql`
- DB lifecycle test: `supabase/validation/pr002/test_m012_lifecycle.sql`
- DB constraint test: `supabase/validation/pr002/test_m012_constraints.sql`
- Static contract test: `tests/bdf-pr002-m012-contract.test.mjs`

## Contract

M012 creates exactly one responsibility boundary with three tables:

1. `accounting.import_batches` — immutable source/version/hash/period and `received → validating → validated/rejected` lifecycle.
2. `accounting.import_files` — sanitized logical file metadata and `received → validating → validated/rejected` lifecycle.
3. `accounting.import_staging_lines` — typed, digest-based quarantine candidates with `received → valid/invalid/excluded` validation outcome.

The schema stores no raw payload, binary source, credential, Production internal ID or PII. Canonical candidate amounts are tax-exclusive. Typed evidence includes source tax basis/category/rate, rate-source version, rounding mode/scope/unit and rounding difference. Unknown tax or rounding evidence cannot pass normalization. NULL and formally confirmed zero are distinct. Same source version, source digest, batch file, or stable source line cannot be registered twice. A Batch cannot reach `validated` until at least one File and Staging line exist and every member passes. Promotion is fail-closed until M014 supplies the Accounting Version boundary.

All tables use enabled and forced RLS. PUBLIC, anon, authenticated and service_role have no direct privileges. M012 creates no Consumer projection or command grant. The mutation guard is `security invoker`, fixes `search_path=''`, permits only `received` on INSERT, protects source lineage, restricts UPDATE to the formal transition matrix and prohibits DELETE.

## Rollback

Rollback is authorized only for a fresh non-Production rehearsal or explicitly approved empty, unpublished Staging state. It removes triggers, the guard function, Staging/File/Batch tables and finally the Accounting schema. It uses no CASCADE and cannot modify PR001 objects.

## Authoring acceptance

- [x] Only M012 exists; M013–M019 absent.
- [x] Three-table import boundary and exact dependencies defined.
- [x] Stable source/version/line uniqueness defined.
- [x] Tax-exclusive, NULL/zero and fail-closed status contracts defined.
- [x] Source fields immutable; DELETE rejected.
- [x] Default deny, forced RLS and zero Consumer grants defined.
- [x] Rollback/Validation/Static test synchronized.
- [x] Independent Migration Review PASS.
- [x] Fresh non-Production DB forward/validation/rollback/reapply PASS.
- [x] Commit/push/Draft PR authorization.
- [ ] Merge authorization.
- [ ] Explicit idea-nov-staging Apply authorization.

## Current decision

`FRESH DB REHEARSAL PASS — COMMIT AND DRAFT PR AUTHORIZED`. This package does not authorize merge, idea-nov-staging Apply, Production connection or data load.

## Fresh DB negative-test contract

The rehearsal must fail closed for: direct Batch INSERT as validating/validated/rejected/promoted/superseded; direct File INSERT as validating/validated/rejected; direct Staging INSERT as valid/invalid/excluded; invalid UPDATE transitions; duplicate Batch source version; duplicate Batch digest; duplicate File hash; duplicate stable line; orphan File; orphan Staging line; invalid tax basis; invalid rounding mode; negative File count; empty Batch validation; zero-File validation; unvalidated File; invalid Staging line; File/Staging record-count mismatch; pre-M014 promotion; immutable Batch/File/Staging lineage UPDATE; DELETE; and unauthorized role access. It must also prove valid received-to-validated transitions, excluded-line handling, exact rollback residue zero and clean reapply.

## Fresh DB rehearsal evidence

The authorized disposable non-Production Supabase project was used exclusively for PR002 M012 synthetic verification. No Production or idea-nov-staging connection, snapshot, personal data or accounting business data was used.

| Check | Result |
|---|---|
| Forward migration | M001-M012 12/12 PASS |
| M012 validation | PASS |
| Lifecycle DB test | 17/17 PASS |
| Constraint DB test | 21/21 PASS |
| Static contract tests | 42/42 PASS (PR001 30 + M012 12) |
| RLS / grants | enabled + forced 3/3; forbidden direct grants 0 |
| Unauthorized role test | anon/authenticated/service_role denied |
| Fixture residue | Batch/File/Staging Line 0 |
| Rollback | M012-M001 12/12 PASS; CASCADE 0 |
| Rollback residue | BDF schema/relation/function 0 |
| Reapply | M001-M012 12/12 PASS |
| Initial/reapply catalog | hash and 157 catalog tokens identical |
| Reapply validation | Validation, Lifecycle and Constraint tests PASS |

Supabase advisors reported only informational default-deny/no-policy notices and unused-index observations expected for an empty rehearsal database. These do not weaken the explicit zero-grant, forced-RLS contract.
