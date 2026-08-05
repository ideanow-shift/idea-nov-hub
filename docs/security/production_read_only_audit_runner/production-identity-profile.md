# Private Production Identity Profile

The runner receives only a profile reference and an opaque SHA-256 fingerprint. The private profile is maintained outside Git and contains fingerprints, never raw hostnames, project references, database names, URLs, certificates, tokens, or passwords.

```yaml
profile_version: production-audit-identity-v1
profile_fingerprint: sha256_64_hex
environment: production
required_signals:
  project_ref_fingerprint_match: true
  database_name_fingerprint_match: true
  host_fingerprint_match: true
  organization_project_fingerprint_match: true
  tls_server_identity_match: true
  expected_schema_set_match: true
  expected_extension_set_match: true
  sentinel_metadata_match: true
  nonproduction_denylist_match: false
```

All signals must be exact. An omitted, stale, malformed, or mismatched signal produces `PROJECT_IDENTITY_MISMATCH`; the runner opens no connection and executes zero queries. The profile is approved independently by the Production Platform owner and the Core DB owner.
