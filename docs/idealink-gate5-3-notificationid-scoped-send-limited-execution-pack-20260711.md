# IDEA LINK Gate 5.3 notificationId scoped send limited execution pack

Date: 2026-07-11

## Purpose

Gate 5.3 sends exactly one queued IDEA LINK LINE WORKS notification by `notificationId`.

This gate does not allow queued-wide, module-wide, channel-wide, cleanup, migration, monthly MVP send, or auto trigger execution.

## Current gate status

```yaml
gate5_1_notification_preview:
  status: passed
  eligible: true
  notificationEnqueued: false
  lineWorksNotificationSent: false

gate5_2_enqueue:
  status: passed
  notificationId: ce3a3cbf-beb7-4d02-ac18-b30f1cf81eb0
  duplicate_smoke: passed
  duplicate_returned_existing_notification_id: true
  lineWorksNotificationSent: false
  monthly_mvp_queued_count: 0
  line_works_target_queued_count: 30

gate5_3_send_execution:
  status: pending_core_review
```

## Approved scope candidate

```yaml
allowed_if_approved:
  action: send-line-works-notifications
  execution_count_max: 1
  required_notification_id: ce3a3cbf-beb7-4d02-ac18-b30f1cf81eb0
  notification_id_required: true
  module_wide_send: false
  channel_wide_send: false
  queued_all_send: false
  monthly_mvp_send: false
  cleanup_migration_send: false
  auto_trigger: false
  secret_change: false
  ddl_rls_grant_rpc_change: false
```

## Function contract

Call the existing LINE WORKS delivery function only with explicit `notificationId`.

Request candidate:

```json
{
  "notificationId": "ce3a3cbf-beb7-4d02-ac18-b30f1cf81eb0"
}
```

Requirements:

- Reject or stop if `notificationId` is missing.
- Process only the specified notification row.
- Do not scan or process all queued rows.
- Do not process monthly MVP rows.
- Do not expose secret values.
- Do not store raw LINE WORKS provider response.

## Preconditions

```yaml
precheck:
  notification_exists: true
  notification_id: ce3a3cbf-beb7-4d02-ac18-b30f1cf81eb0
  module_key: idea_link
  channel: line_works
  status: queued
  entity_type_prefix: line_works_target
  monthly_mvp_queued_count: 0
  line_works_target_queued_count: 30
  line_works_send_already_done: false
```

## Execution steps if approved later

```yaml
steps:
  - SELECT target notification by id
  - confirm module_key = idea_link
  - confirm channel = line_works
  - confirm status = queued
  - confirm entity_type starts with line_works_target
  - invoke scoped delivery for this notificationId only
  - update only this notification row to sent or error
  - do not modify other queued rows
```

## Post-check

```yaml
post_check:
  target_notification_id: ce3a3cbf-beb7-4d02-ac18-b30f1cf81eb0
  target_status: sent_or_error
  target_sent_at_set_if_sent: true
  target_error_sanitized_if_error: true
  monthly_mvp_queued_count: 0
  line_works_target_queued_count: 29_if_sent_or_30_if_error_remains_queued
  other_queued_rows_untouched: true
  raw_line_works_response_saved: false
  secret_values_logged: false
  ddl_rls_grant_rpc_change: false
  auto_trigger_created: false
```

## Stop conditions

Stop before send if any of these are true:

```yaml
stop_if:
  - notificationId_missing
  - notification_not_found
  - module_key_not_idea_link
  - channel_not_line_works
  - status_not_queued
  - entity_type_not_line_works_target
  - function_would_process_more_than_one_row
  - monthly_mvp_row_detected
  - provider_secret_missing_or_changed
  - raw_provider_response_would_be_saved
```

## Still stopped

```yaml
still_stopped:
  - Gate 5.3 actual send execution
  - queued cleanup / migration / send
  - module-wide send
  - channel-wide send
  - monthly MVP send
  - Secret change
  - DDL / RLS / GRANT / RPC change
  - auto trigger
```

## CoreOS review request

Please review whether the single-notification scoped LINE WORKS send may proceed under the constraints above.

Requested judgment:

```yaml
questions:
  - Is notificationId scoped send for ce3a3cbf-beb7-4d02-ac18-b30f1cf81eb0 approved?
  - Is precheck sufficient to prevent queued-wide processing?
  - Should a failed provider send leave the row queued or mark it error?
  - What exact SELECT-only post-check should be required after execution?
```
