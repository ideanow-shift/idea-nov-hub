# Sanitized Result Schema

Only this outer shape may leave the runner. Raw rows, query text, database errors, identifiers, UUIDs, timestamps, and credentials never leave process memory.

```json
{
  "auditPackId": "core-store-master-fact-verification-v1",
  "runnerIntegrity": "pass|fail",
  "projectIdentity": "pass|fail",
  "readOnlySession": "pass|fail|not_started",
  "queryCount": 0,
  "queryResults": [{
    "queryId": "Q01_SCHEMA_CATALOG",
    "status": "pass|fail|skipped",
    "resultCategory": "aggregate_only|metadata_shape_only|safe_stop",
    "sanitizedMetrics": {}
  }],
  "runStatus": "complete|safe_stop",
  "failureCategory": "fixed_category_or_null",
  "mutationExecuted": false,
  "secretExposureDetected": false
}
```

`queryCount` is 0 through 12. UUIDs, if an approved future query needs them, are converted to the first eight characters plus an ellipsis before result construction. The schema validator rejects unknown result fields.
