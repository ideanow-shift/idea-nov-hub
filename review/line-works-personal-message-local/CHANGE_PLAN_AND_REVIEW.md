# LINE WORKS personal message — local review and non-executing change plan

Status: LOCAL REVIEW ONLY / NO SEND / NO DB CHANGE / NO DEPLOY

## Approved first-message fixture

- Recipient: `脇田 将樹`本人の社員レコードに紐づく active な `employee / primary` LINE WORKS 個人宛先のみ
- Exact text: `【接続テスト】脇田AI秘書からLINE WORKSへの送信テストです。返信・対応は不要です。`
- Prohibited for this first test: 野方店スタッフ、小林店長、店舗チャンネル、default target、素材未提出・提出依頼の文言

The employee UUID, exact directory record, and masked destination remain unverified. They must be shown in an authenticated preview and confirmed immediately before any future send.

## Local implementation review

### Confirmed safeguards

- Both preview and send actions pass through normal NOV HUB authentication and `assertMasterEditor(employee)`.
- Actor identity is resolved server-side; client actor override fields are rejected.
- Preview reads only the selected employee's `primary` destination and returns only its masked identifier.
- Approval is HMAC signed, expires after five minutes, and is bound to actor, recipient, destination mask, title, and body.
- UI renders recipient, message, and result with DOM `textContent`; secret values and raw destination IDs are not rendered.
- The send action is hard-disabled with `ATOMIC_CLAIM_UNAVAILABLE`.
- The source-only delivery adapter requires an atomic claim, returns duplicates without delivery, and never automatically retries `delivery_unknown`.

### Blocking findings before any enablement

1. The existing notification sender reads `queued`, performs the provider call, then updates status. It has no conditional atomic claim and can double-send under concurrency.
2. Existing batch mode selects almost every queued LINE WORKS notification. A personal row placed in `os.notifications` could be picked up by an unrelated batch worker.
3. Existing target resolution checks explicit/store targets before the employee-personal guard. A personal flow must use a dedicated employee-only resolver and reject channel/default routing before provider delivery.
4. `isVerifiedServiceRoleJwt` trusts a decoded JWT `role` claim without verifying its signature. The sender must not accept this branch. Exact service-role equality or another cryptographically verified internal invocation is required.
5. When no trigger secret exists, the current fallback accepts a successfully authenticated Supabase user. That is too broad for a privileged delivery endpoint and must be removed for this flow.
6. The repository does not contain the authoritative `os.notifications` DDL/status constraint. Altering its status model without inspecting the approved schema could break existing notifications.

## Minimum proposed DB/RPC change (proposal only)

Prefer an isolated table instead of changing `os.notifications`:

- `os.line_works_personal_message_deliveries`
  - UUID primary key / intent ID with a unique constraint
  - actor employee ID, recipient employee ID, destination record ID
  - content fingerprint and approval expiry; no raw secret or unmasked destination in client-visible projections
  - status constrained to `claimed`, `sent`, `failed_pre_delivery`, `delivery_unknown`
  - claimed/sent/completed timestamps, sanitized error code, optional provider message ID
- `os.claim_line_works_personal_message_v1(...)`
  - service-role-only execute permission; revoke from `PUBLIC`, `anon`, and `authenticated`
  - fixed `search_path`, fully qualified objects, strict input validation
  - a single `INSERT ... ON CONFLICT DO NOTHING ... RETURNING` transaction provides the atomic claim
  - validates active employee `primary` destination and approval fingerprint server-side
  - never performs an HTTP/provider call while holding a database transaction or row lock
- Completion RPCs use conditional transitions (`claimed -> sent`, `claimed -> failed_pre_delivery|delivery_unknown`) and reject all other transitions.
- No automatic transition out of `delivery_unknown`; a new human-reviewed approval and intent is required.

This design leaves existing notification status constraints, views, batch workers, and historical rows untouched. No migration file was created because DB/schema/RPC changes are outside the current approved exception.

## Permissions, audit, and safety

- Browser may call only NOV HUB API preview/send actions; it receives neither service-role credentials nor raw LINE WORKS destination IDs.
- NOV HUB API revalidates Master Editor authorization on both preview and send, and re-resolves the employee destination after preview.
- Sender invocation must be internal and cryptographically verified; CORS does not grant authority.
- Audit records actor, recipient, fingerprint, state transitions, timestamps, and sanitized provider outcome, but never secrets or full provider credentials.
- A provider timeout after request dispatch becomes `delivery_unknown`; no retry button or scheduled retry is permitted.
- A definitely pre-dispatch validation/resolution failure becomes `failed_pre_delivery`; any retry still requires a fresh preview and approval.

## Proposed approval and rollout order

1. Owner separately approves the DB/RPC design and migration scope.
2. Owner separately approves implementation push/PR/merge. Review must include schema DDL, grants, sender authentication removal, employee-only routing, and concurrency tests.
3. Merge with the feature flag still OFF.
4. Apply the DB migration to staging only; inspect grants/RLS/advisors and run concurrent claim tests with a fake provider.
5. Deploy the sender and NOV HUB API to staging with delivery still disabled; run authenticated preview and non-send fixtures.
6. Owner approves production migration and production deploy separately; deploy DB first, then sender/API, then UI, all with the flag OFF.
7. Confirm the exact `脇田 将樹` employee record, masked destination, and exact approved text in the authenticated preview.
8. Owner explicitly approves enabling the one-message production gate. Enable only the scoped intent, send once, then disable/close the gate and record the result.

## Rollback

- Immediate: keep/restore the application feature flag to OFF; stop the personal-message sender path without touching existing notification delivery.
- Code: roll back UI/API/sender revisions independently because the proposed table is isolated.
- DB: revoke RPC execute first. Retain audit rows for investigation; drop functions/table only under a separately reviewed rollback migration after retention requirements are satisfied.
- Never convert `delivery_unknown` back to a sendable state during rollback.

## Cost and unresolved items

- No new vendor, OpenAI API, MCP tunnel, or paid service is proposed.
- Incremental Supabase database storage, Edge Function invocations, logging, and egress should be small but depend on the current plan and retention policy.
- LINE WORKS Bot/API entitlement, quota, rate limits, and any charge conditions are not confirmed.
- Still unconfirmed: authoritative production DDL/grants/RLS, actual employee UUID and active destination for 脇田 将樹, provider configuration health, provider idempotency behavior/message ID, deployment target, and production rollback retention requirement.
