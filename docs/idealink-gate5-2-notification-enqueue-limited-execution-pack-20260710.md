# IDEA LINK Gate 5.2 notification enqueue limited execution pack

Date: 2026-07-10

## Purpose

Gate 5.2 adds only the ability to create one scoped LINE WORKS notification queue record for a previously saved IDEA LINK post.

This pack does not approve LINE WORKS sending. It also does not approve batch processing, cleanup, migration, or monthly MVP notification.

## Current gate status

```yaml
gate5_1_notification_preview:
  status: passed
  ok: true
  eligible: true
  reason: ""
  target_configured: true
  notificationEnqueued: false
  lineWorksNotificationSent: false
  existingQueuedRowsTouched: false
  dbMutationExpected: false

gate5_2_enqueue_execution:
  status: pending_core_review

gate5_3_send:
  status: stopped
```

## Approved scope candidate

```yaml
allowed_if_approved:
  action: ideaLinkNotificationEnqueue
  execution_count_max: 1
  target_post_id_count: 1
  os_notifications_insert_max: 1
  module_key: idea_link
  line_works_send: false
  send_line_works_notifications_call: false
  existing_queued_rows_touch: false
  monthly_mvp_queued_touch: false
  secret_change: false
  ddl_rls_grant_rpc_change: false
```

## Proposed API contract

```json
{
  "action": "ideaLinkNotificationEnqueue",
  "postId": "uuid",
  "clientRequestId": "optional-safe-idempotency-key"
}
```

Response candidate:

```json
{
  "ok": true,
  "result": {
    "postId": "uuid",
    "notificationId": "uuid",
    "duplicate": false,
    "notificationEnqueued": true,
    "lineWorksNotificationSent": false,
    "guards": {
      "notificationIdScopedSendRequired": true,
      "existingQueuedRowsTouched": false,
      "lineWorksNotificationSent": false,
      "monthlyMvpQueuedRowsTouched": false
    }
  }
}
```

## Data write candidate

Target table:

```text
os.notifications
```

Insert candidate:

```yaml
module_key: idea_link
channel: line_works
entity_type: line_works_target:store:{store_id}:channel
entity_id: idea_link_posts.id
recipient_employee_id: null
title: サンクスコインが投稿されました
body: generated_safe_line_works_summary
status: queued
error: null
created_at: database_default_or_now
sent_at: null
```

Notes:

- `body` must not include secret values.
- `body` may include the thank-you summary needed for LINE WORKS notification.
- The actual LINE WORKS send is not part of Gate 5.2.
- Gate 5.2 must return `notificationId`.
- Gate 5.3 must send only by that `notificationId`.

## Duplicate prevention candidate

Initial duplicate prevention is API-side only.

Before insert, query `os.notifications` with:

```yaml
module_key: idea_link
channel: line_works
entity_id: postId
entity_type: expected_entity_type
status_in:
  - queued
  - sent
```

If found:

```yaml
insert: false
return:
  duplicate: true
  notificationId: existing_id
```

No unique constraint is added in this gate. If DB-level uniqueness is needed later, it must be a separate DDL gate.

## Target resolution

Use the same read-only target resolution proven in Gate 5.1.

Input:

```yaml
post_id: idea_link_posts.id
```

Read:

```yaml
idea_link_posts:
  - id
  - sender_id
  - receiver_id
  - receiver_store_id
  - receiver_department_id
  - receiver_org_unit_type
  - status
  - visibility
  - category
  - challenge_flag
  - created_at

idea_link_notification_channels:
  - org_unit_type
  - store_id
  - department_id
  - channel_id
  - enabled
```

Do not return or log `channel_id`.

## Preconditions

```yaml
precheck:
  post_exists: true
  post_status: active
  notification_preview_eligible: true
  target_configured: true
  monthly_mvp_queued_count_recorded: true
  line_works_target_queued_count_recorded: true
  secret_values_logged: false
```

## Execution steps if approved later

```yaml
steps:
  - read target post
  - resolve notification channel with Gate 5.1 logic
  - check duplicate os.notifications row for same post/module/entity
  - insert one queued os.notifications row only if duplicate is absent
  - return notificationId
  - do not call send-line-works-notifications
```

## Post-check

```yaml
post_check:
  os_notifications_row_count_delta: +1_or_0_if_duplicate
  returned_notificationId_exists: true
  module_key: idea_link
  channel: line_works
  status: queued_or_existing_sent
  target_entity_expected: true
  monthly_mvp_queued_count: unchanged
  existing_line_works_target_queued_count: unchanged_or_plus_one_only_for_target_post
  line_works_actual_send: false
  send_line_works_notifications_called: false
  secret_change: false
  ddl_rls_grant_rpc_change: false
```

## Stop conditions

Stop before insert if any of these are true:

```yaml
stop_if:
  - post_not_found
  - post_not_active
  - notification_preview_not_eligible
  - target_channel_not_configured
  - more_than_one_post_id_requested
  - batch_or_module_wide_send_requested
  - monthly_mvp_entity_detected
  - send_line_works_notifications_would_be_called
  - existing_queued_rows_would_be_modified
```

## Still stopped

```yaml
still_stopped:
  - Gate 5.2 enqueue execution
  - Gate 5.3 send
  - LINE WORKS actual send
  - send-line-works-notifications invocation
  - queued cleanup / migration / send
  - monthly MVP send
  - Secret change
  - auto trigger
  - DDL / RLS / GRANT / RPC change
```

## CoreOS review request

Please review whether Gate 5.2 may proceed to limited implementation and then one-record enqueue execution under the constraints above.

Requested judgment:

```yaml
questions:
  - Is API-side duplicate prevention acceptable for the first limited enqueue?
  - Is os.notifications insert of one row acceptable after preview eligibility is true?
  - Is entity_type line_works_target:store:{store_id}:channel acceptable for IDEA LINK store channel notifications?
  - Should the body include the thank-you message summary, or should this be deferred to Gate 5.3?
  - What exact post-check SQL/result should be required before Gate 5.3?
```
