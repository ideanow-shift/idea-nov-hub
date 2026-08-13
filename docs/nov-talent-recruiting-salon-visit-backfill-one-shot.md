# Recruiting SALON_VISIT 2027 One-Time Backfill Runbook

Status: preparation only. Migration apply, Edge/Pages deploy, flag enablement, Human Review approval and Backfill execution require separate Owner approval.

## Fixed candidate boundary

- Human Review package candidate SHA-256: `10C87773B376DDDAF044DC1C3E2DD88E68B759E2A237DF0E406A8A563A192540`
- Canonical Staging source digest: `ed954ba2a5553ab645d5050cd8ed036aad6e749435d09a9fcfe256255426c023`
- Source: four fixed active `CONTACTS_27 / SALON_TOUR_COMPLETED / COMPLETED / SALON_TOUR_DATE_1` events
- Cohort: `NEW_GRAD / 2027 / 2026-04-01..2027-03-31`
- Source event grain: four Candidate/visit-date events
- Fact grain: fifteen Candidate/visit-date/store Facts, across eight canonical Stores
- Planning Actual grain: four unique Candidates
- Original Actor: `UNAVAILABLE`; never inferred
- Excluded: assignment preferences, Selection outcomes, Communication state, CONTACT, Spend, Fair and Planning writes

The private Human Review package retains Candidate and Store bindings. The public Operator response and source do not expose Candidate names or IDs, Store UUIDs, token or Actor UUID.

The eight Store UUIDs were SELECT-only reconciled against NOV HUB's Canonical Store master: eight exact rows, eight active rows, eight unique codes, one active business unit and three active bound corporations. The master has no historical effective-period columns, so visit-date evidence remains the Owner-reviewed source package; it is not inferred from current master state. At every hosted preflight, Edge re-reads `masterListStores` with the same HUB Session and requires all eight UUID/code/corporation/business-unit bindings to remain active and exact. Failure is `UNAVAILABLE`, never a partial match.

## Multi-store rule

Three Candidates visited multiple Stores on one date. A single source event is therefore not treated as a single Store visit. The preparation adds a nullable `source_event_id` to the engagement Fact and records one original `SALON_VISIT / COMPLETED` Fact per approved Store. Multiple Facts may share the same source event, while the `(source_event_id, store_id)` original-Fact index rejects duplicate Store bindings.

The following metrics stay distinct:

- source event count: `4`
- store visit Fact count: `15`
- Planning Actual unique Candidate count: `4`
- distinct Store count: `8`

## Exact preflight

The authenticated management UI calls only:

`GET /api/talent/v1/recruiting-actual-facts/backfills/salon-visit-2027/preflight`

The server returns `PASS` only when all fixed source event IDs and Store mappings reproduce the package digest, all source events are active/non-invalidated/completed/Candidate-bound/in-period, the eight Canonical Store bindings are live and exact, there are no additional eligible source events, and no SALON_VISIT completion/void receipt or Human Review Fact exists.

The route is Staging-only, HUB Session protected and restricted to `super_admin`, `backoffice` or `hr.admin`. The dedicated runtime flag only affects `canExecute`; it does not weaken the POST endpoint's independent fail-close checks.

## One-shot execution

After a separate Owner approval, the Operator may send one empty JSON command to:

`POST /api/talent/v1/recruiting-actual-facts/backfills/salon-visit-2027`

The Edge resolves Actor and role from HUB Session, reruns exact preflight and calls only `nov_talent_execute_salon_visit_2027_backfill_v1`. In one database transaction it must append exactly:

- 15 `SALON_VISIT / COMPLETED` Facts with `original_actor_status=UNAVAILABLE`
- 15 `FACT_APPENDED` Audit rows with the executing Actor
- one immutable `COMPLETED` receipt recording 4 source events, 15 Facts and 4 unique Candidates

The transaction-scoped advisory lock, fixed package/source digests, source-event/store unique index and unique receipt prohibit duplicate execution. Count or source mismatch rolls back the entire command. Neither frontend nor Edge retries.

Immediately after the write attempt, operations must return `NOV_TALENT_RECRUITING_ACTUAL_SALON_VISIT_BACKFILL_ENABLED` to OFF. A successful receipt also makes the UI one-shot before the runtime flag is disabled.

## Rollback and append-only void

Before commit, rollback is automatic. After commit, UPDATE/DELETE and physical rollback are prohibited. A separate Owner-approved server-side recovery may call `nov_talent_void_salon_visit_2027_backfill_v1`; no browser route is provided.

The void transaction exact-matches the completed receipt, appends 15 `CANCELLED` correction Facts retaining source-event and Store bindings, appends 15 Audit rows and appends one `VOIDED` receipt. It never changes or deletes the original Facts.

Recruiting Intelligence may release SALON_VISIT Actual only when the completion receipt and effective Facts exactly agree. A missing/mismatched/voided receipt remains unavailable, never formal zero.
