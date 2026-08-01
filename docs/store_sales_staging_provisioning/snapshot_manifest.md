# Snapshot Manifest and Versioning

## Manifest purpose

The manifest binds one immutable Snapshot artifact to its approved schema, baseline, freshness window, and integrity evidence. It is validated before any Store Operations result is served.

## Required manifest fields

| Field | Purpose |
| --- | --- |
| `format` and `schema_version` | exact parser compatibility |
| `snapshot_version` | immutable release identity |
| `artifact_sha256` | artifact integrity evidence |
| `manifest_sha256` | manifest integrity evidence over canonical serialization excluding itself |
| `approved_at`, `expires_at` | bounded freshness window |
| `store_count`, `direct_count`, `fc_count` | exact 20 / 13 / 7 proof |
| `period_range` | approved aggregate period coverage only |
| `field_allowlist_version` | sanitized projection contract identity |
| `legacy_crosswalk_version` | approved Tokorozawa legacy-reference contract identity |
| `approval_record_id` | opaque human approval reference |
| `signer_category` | approval authority class, never a credential |

## Version policy

Versions use `v1-YYYYMMDD-sequence`. A published version is immutable. Corrections create a new version with a new approval record; they never overwrite an existing artifact. The Sandbox records the active version pointer only after all validation succeeds.

## Hashing

Use SHA-256 over UTF-8 canonical serialized bytes. The extraction environment produces the artifact hash before transfer. The Sandbox recomputes it after receipt, validates the manifest hash, then validates the exact schema and baseline. Hashes identify bytes; they do not authorize an artifact without the approval record and expiry checks.

