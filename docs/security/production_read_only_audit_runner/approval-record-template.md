# Approval Record Template

```yaml
approval_record_version: production-readonly-audit-v1
run_id: <opaque-run-id>
purpose: <catalog_only_smoke|approved_audit_purpose>
decision:
  D01: APPROVED|REJECTED|REVISION_REQUIRED
  D02: APPROVED|REJECTED|REVISION_REQUIRED
  D03: APPROVED|REJECTED|REVISION_REQUIRED
  D04: APPROVED|REJECTED|REVISION_REQUIRED
  D05: APPROVED|REJECTED|REVISION_REQUIRED
  D06: APPROVED|REJECTED|REVISION_REQUIRED
  D07: APPROVED|REJECTED|REVISION_REQUIRED
  D08: APPROVED|REJECTED|REVISION_REQUIRED
  D09: APPROVED|REJECTED|REVISION_REQUIRED
  D10: APPROVED|REJECTED|REVISION_REQUIRED
approved_query_ids: []
approved_window:
  start_jst: <timestamp>
  duration_minutes_max: 5
  retry: 0
approvers:
  representative: <approved_name_or_role>
  os_owner: <approved_name_or_role>
  db_owner: <approved_name_or_role>
sealed_identities:
  runner_manifest_hash: <sha256>
  query_catalog_hash: <sha256>
  identity_profile_reference: <private-opaque-reference>
receipt_requirements:
  rollback_confirmed: true
  raw_values_included: false
  credential_revoked_within_hours: 24
```

このテンプレートにSecret、host、connection string、実UUID、実会計金額、個人情報を書かない。
