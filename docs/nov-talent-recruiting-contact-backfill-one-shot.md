# Recruiting CONTACT 2027 One-Time Backfill Runbook

Status: preparation only. Migration apply, Edge/Pages deploy, flag enablement and Backfill execution require separate Owner approval.

## Fixed approval boundary

- Review state: `APPROVED_FOR_BACKFILL`
- Review package SHA-256: `139D6B1B222CD7A7D820375C08E1B4ACE811FC285ED89E27DD924D2BFB8C9125`
- Canonical Staging source digest: `725cc4b8ae933081dc30fd7ce37179741661d795a20edaed542023b4d3621a77`
- Source: active `CONTACTS_27 / CONTACT_RECORDED / COMPLETED` events for active 2027 Candidates in `2026-04-01..2027-03-31`
- Fact grain: 11 CONTACT events
- Planning Actual grain: 10 unique Candidates
- Original actor: `UNAVAILABLE`; never inferred
- Excluded: SALON_VISIT, APPLICATION, OFFERED, OFFER_ACCEPTED, RECRUITING_SPEND and all B/C candidates

## Exact preflight

The authenticated management UI calls only:

`GET /api/talent/v1/recruiting-actual-facts/backfills/contact-2027/preflight`

The server-side preflight must return `PASS` only when all of these remain exact:

1. Staging project ref is `zgkoofphhivesclehrom`.
2. HUB Session resolves a full Planning administrator role.
3. Review package and canonical source digests match the fixed values.
4. Eligible event count is 11, unique Candidate count is 10 and distinct fingerprint count is 11.
5. Every event is active, non-invalidated, `COMPLETED`, Candidate-bound and in the approved cohort/period.
6. Canonical CONTACT Human Review Facts and completion/void receipts are still zero.
7. The dedicated runtime flag is enabled only under a later Owner execution approval.

The response contains counts, state and digests only. Candidate names, Candidate IDs, token, Actor UUID and DB details are not returned.

## One-shot execution

After a separate Owner approval, the Operator may send one empty JSON command to:

`POST /api/talent/v1/recruiting-actual-facts/backfills/contact-2027`

The Edge resolves Actor and role from HUB Session, reruns the exact preflight, and calls only `nov_talent_execute_contact_2027_backfill_v1`. The database function uses a transaction-scoped advisory lock and inserts exactly:

- 11 CONTACT engagement Facts with `original_actor_status=UNAVAILABLE`
- 11 engagement Audit rows with the current executing Actor
- one immutable `COMPLETED` receipt

Any mismatch or count failure raises an exception. PostgreSQL then rolls back the entire request. There is no retry and no partial-success contract. The unique receipt and source/fingerprint constraints reject duplicate execution.

Immediately after the write attempt, operations must return `NOV_TALENT_RECRUITING_ACTUAL_CONTACT_BACKFILL_ENABLED` to OFF. A successful receipt makes the Operator non-repeatable even before the flag is disabled.

## Rollback and append-only void

Before commit, rollback is automatic and leaves Fact/Audit/receipt counts unchanged.

After commit, physical rollback, UPDATE and DELETE are prohibited. A correction requires a new Owner approval and server-side invocation of `nov_talent_void_contact_2027_backfill_v1` (there is intentionally no browser route in this preparation):

1. Exact-match the `COMPLETED` receipt and verify no prior void.
2. Append 11 `CANCELLED` correction Facts, each referencing its original Fact.
3. Append 11 `CANCELLATION_APPENDED` Audit rows.
4. Append one `VOIDED` receipt referencing the completion receipt.
5. Commit all rows in one transaction; otherwise roll back all rows.

Outcome 3 must release CONTACT Actual only when there is one exact completion receipt, no void receipt, 11 effective COMPLETED Facts and 10 unique Candidates. A missing/mismatched/voided receipt remains `ACTUAL_SOURCE_UNAVAILABLE`, never formal zero.
