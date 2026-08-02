# Phase 4 Requirements

## Status and Entry Gate

Current status: **WAITING_FOR_DB_CATALOG_APPROVAL**. PR #28 remains Draft.

Phase 4 may start only after a human-approved, read-only target catalog attestation confirms: the target environment identity; the actual Accounting lifecycle objects, keys, indexes, RLS, grants, and publication/audit model; `public.stores`; employee store-assignment capability; the physical location or absence of the Tokorozawa legacy crosswalk; and the canonical server-side HUB Session verifier owner. A missing, conflicting, or unapproved result stops the relevant path before any migration, RLS, grant, or access-port change.

## Work After Catalog Approval

1. Reconcile each Phase 3 reuse candidate with the approved catalog evidence. Mark it reusable, requires a minimal change, or unavailable; do not infer a table from repository SQL alone.
2. Confirm Core Master ownership for employee assignments and the legacy crosswalk, including effective-period and audit semantics.
3. Confirm Accounting ownership for batch, file, version, fact, validation, publication, and audit lifecycle boundaries.
4. Confirm the canonical HUB server-side session verifier and its server-side role and Store Scope inputs. Do not introduce an issuer, browser authority, or mock identity fallback.
5. Produce implementation-specific migration, RLS/grant, endpoint, and rollback review packs from the attested catalog. Each pack requires separate approval before execution.

## Migration Order

1. **Catalog-to-contract reconciliation:** freeze the approved object inventory and exact dependencies; no schema change.
2. **Core Master alignment:** only if the catalog proves a gap, add the Core Master-owned assignment or legacy-crosswalk relation with effective periods and audit ownership. Store Operations must not own either relation.
3. **Accounting lifecycle alignment:** add only the minimum batch/file/version/validation/publication metadata that the confirmed lifecycle lacks. Preserve immutable version numbering and append-only history.
4. **Approval and audit alignment:** add structured command transitions and dual-actor rollback evidence only where the existing audit model cannot represent them.
5. **Published projection access:** create the read-only projection contract only after lifecycle and approval semantics are verified.

Every migration requires a non-production review, forward-only plan, explicit dependency list, rollback procedure, and post-migration catalog verification. No migration is executed under this requirements document.

## RLS and Grant Order

1. Establish server-side principals and deny browser database access by default. No service credential may reach the browser.
2. Apply Core Master read policies needed solely to resolve approved employee Store Scope and legacy-crosswalk relations.
3. Apply Accounting command policies: accounting roles may upload, dry-run, validate, import, review, and publish only through server-side command boundaries.
4. Apply rollback approval policy requiring separate accounting and representative actors, with append-only evidence.
5. Apply published-projection read policies: representative and accounting per approved scope; sales director for direct stores; AM for currently assigned stores; store manager for own store; employee denied.
6. Verify each policy and grant with positive and negative tests, including unassigned AM and ordinary employee rejection, before any endpoint exposes data.

Policy or grant uncertainty is fail-closed. RLS/grant changes require their own security approval and non-production verification; none are performed here.

## Import Center Connection Order

1. Connect `upload` to an approved server-side storage boundary that accepts the permitted Workbook only; retain no browser credential.
2. Connect `dry-run` to the approved parser, fixed sheet mapping, fixed metric mapping, and safe validation metadata. It does not create facts.
3. Connect `validate` to catalog-backed required mappings and lifecycle constraints, with raw Workbook/sheet/row quarantine.
4. Connect `import` only after validation passes; create immutable versioned facts inside the server-side transaction boundary.
5. Connect `review` to safe counts, status, and quarantines, never raw credentials or unrelated personal data.
6. Connect `publish` only for an approved accounting actor; supersede the prior published version atomically for the same period.
7. Connect `rollback` only through separate accounting and representative approvals; restore the single eligible superseded version without deleting history.

Each command must keep fixed inputs, server-side authorization, append-only audit events, no synthetic fallback, and fail-closed behavior.

## Projection Connection Order

1. Materialize or expose only the latest published version for each permitted target period.
2. Resolve actor, role, and Store Scope on the server using the canonical HUB verifier and approved Core Master relations.
3. Return monthly metrics only from the approved normalized facts: revenue, operating profit, EC revenue, and product revenue. Unconfirmed values remain `null`; FC profit remains `unavailable`; headquarters and EC values are not allocated to stores.
4. Verify 20 stores, 13 direct stores, 7 FC stores, crosswalk behavior, period/version selection, and role-scope denial paths.
5. Allow Store Operations to consume the read endpoint only after contract, security, and E2E approval. UI changes are a later, separately approved step.

## Rollback Requirements

1. Maintain forward-only schema migrations; rollback may restore prior application behavior or disable an endpoint, but must not delete audit or version history.
2. For publication rollback, select only the highest `version_number` superseded version for the same target period, require two distinct actors, and record the reason and state transition append-only.
3. If a migration, policy, or projection verification fails, stop the rollout, preserve evidence, disable the affected server-side command or read route, and return to the prior approved non-production state.
4. Any rerun, data repair, or Production activity requires a new approval. No automatic retry, automatic publication, or automatic Sandbox/Production promotion is allowed.

## Required Human Approvals

1. Target database catalog and environment identity attestation.
2. Core Master assignment and Tokorozawa legacy-crosswalk ownership/effective-period decision.
3. Accounting lifecycle reuse and required-minimum-change decision.
4. Canonical HUB Session verifier reuse and server principal decision.
5. RLS/grant security design and dual-approval rollback procedure.
6. Non-production migration, endpoint deployment, and E2E execution window.

## Out of Scope

This document makes no database, migration, RLS, grant, function, UI, Production, or real Workbook change. It does not approve deployment or convert PR #28 from Draft.
