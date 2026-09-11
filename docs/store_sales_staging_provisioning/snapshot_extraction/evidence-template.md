# Evidence Template

```yaml
run_id: opaque-run-id
runner_manifest_identity: sha256-only
approval_record_id: opaque-reference
result: PASS | SAFE_STOP
fixed_stop_category: optional-fixed-category
query_ids: [Q01_STORE_MASTER, Q02_ACCOUNTING_CONFIRMED, Q08_LEGACY_CROSSWALK]
query_count: 0
retry_count: 0
row_counts: aggregate-only
unavailable_sources: aggregate-only
artifact_sha256: sha256-only
manifest_sha256: sha256-only
rollback_confirmed: boolean
session_closed: boolean
production_write_count: 0
raw_values_included: false
```

Do not attach SQL, endpoint data, credentials, project identity, raw UUIDs, employee/customer values, or financial amounts.
