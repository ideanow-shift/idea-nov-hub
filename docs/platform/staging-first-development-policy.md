# Staging First Development Policy

## Decision

IDEA NOV OS uses `idea-nov-staging` as the sole completion environment for new Core Business Data Foundation work. Existing Production web applications remain operationally unchanged. Production is a final, separately approved, one-time cutover destination, not a development or rehearsal environment.

## Protected Production Applications

The currently operating NOV HUB, NOV Talent, Thanks Coin, and other live applications are maintained in their current Production state. New Core Business Data Foundation, Store Operations, Finance, Management Platform, and Digital Signage work must not change their Production schemas, functions, secrets, API contracts, runtime configuration, or deployed behavior.

## Staging-First Scope

| Domain | Completion environment | Production rule |
| --- | --- | --- |
| Core Business Data Foundation | `idea-nov-staging` | no Production-first architecture, migration, or data work |
| Store Operations | `idea-nov-staging` | no impact on the published Store Operations preview or other live apps |
| Finance | `idea-nov-staging` | no Production financial schema or API work during development |
| Management Platform | `idea-nov-staging` | no Production integration until final cutover approval |
| Digital Signage | `idea-nov-staging` | no Production dataset or runtime integration until final cutover approval |

## Data Boundary

Existing Production employee, store, corporation, and other masters remain authoritative. Staging may use only an approved minimal snapshot or masked synchronization. It must not receive Production credentials, direct cross-project database access, unmasked personal data, secrets, or unrestricted history. A staging copy is an integration dataset, never a competing system of record.

## Snapshot Governance

Every Production Master Snapshot accepted by Staging must retain immutable metadata: `source_project`, `source_version`, `source_snapshot_at`, `freshness_status`, `artifact_hash`, `masking_policy_version`, `mapping_contract_version`, `source_record_count`, `masked_record_count`, `excluded_record_count`, `created_by_run_id`, and `approval_reference`.

- A Snapshot with an unknown `source_version` or an unapproved mapping contract must not be used.
- `artifact_hash` or `masking_policy_version` mismatch stops intake. Snapshots are immutable: a replacement is a new version and never an overwrite.
- Staging must never write a Master back to the Production system of record.
- `freshness_status` is `current`, `stale`, `expired`, or `invalid`. The day threshold for each status is a domain-owned contract value; `expired` stops use and `stale` is either blocked or visibly warned according to that contract.

## Production Cutover Release Gate

A final cutover is eligible only after each item below has recorded PASS evidence.

1. **Final difference synchronization:** regenerate the approved Snapshot; reconfirm source version, artifact hash, masking-policy version, and Staging difference counts; allow zero unsynchronized differences or only documented Owner-approved exceptions.
2. **Existing Production application regression:** NOV HUB, NOV Talent, Thanks Coin, and every affected live application pass login, Role/Permission, Master reference, principal screen, principal API, write-path, console error/warning, existing record-count, and business-flow checks.
3. **Cutover control:** Owner approval, a verified rollback artifact and procedure, immutable target commit/migration/Function list, fixed monitoring items, immediate rollback conditions, final synchronization PASS, and existing-application regression PASS are all required.
4. **Post-cutover confirmation:** NOV HUB, NOV Talent, Thanks Coin, Core Master, Store Operations, and Finance are healthy; critical errors are zero; Production writes are reconciled; and the Owner records that rollback is not required.

## Delivery Rules

1. Design, implementation, migration rehearsal, authorization verification, data-contract validation, and E2E evidence occur in Staging first.
2. Production-oriented architecture or migration design is prohibited during normal development. Production cutover planning begins only after Staging acceptance is complete and an Owner opens a separate cutover gate.
3. Every staging change is domain-owned, protected by an explicit human approval, and has a verification and rollback record.
4. No automatic promotion or fallback from Staging to Production is permitted.
5. The final Production cutover may occur once only after all required Staging evidence, data-quality approval, security review, operational review, rollback readiness, and Owner approval are complete.
6. Phase 0 Production Attestation is an exceptional, separately approved read-only audit when evidence cannot be obtained from Staging or approved Snapshot metadata. It is not a normal development prerequisite.

## Non-Authorization

This policy does not authorize a Production connection, data extraction, schema change, migration, RLS/grant change, Function deployment, Secret registration, or cutover. It changes development governance only.
