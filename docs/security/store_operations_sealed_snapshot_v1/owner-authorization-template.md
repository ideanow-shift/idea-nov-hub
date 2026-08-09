# Owner Authorization Template: Sealed Snapshot Read-only Run

Use this template only after Final Review has passed. It authorizes one
read-only Snapshot run and does not authorize any write workflow.

```text
Authorization title: SEALED SNAPSHOT READ-ONLY EXECUTION AUTHORIZATION
Package: store-operations-consumer-enablement-sealed-snapshot-v1
Package version: <approved value>
Package SHA-256: <approved value from execution-package-lock-v1.json>
Query Pack SHA-256: <approved value from execution-package-lock-v1.json>
Schema Contract artifact SHA-256: <approved value from execution-package-lock-v1.json>
Source label: idea-nov-core
Target label: idea-nov-staging
Approved query packs: SOCE-QP01, SOCE-QP02, SOCE-QP03, SOCE-QP04, SOCE-QP05, SOCE-QP06
Public query catalog hash: <approved value>
Private Query-registry hash: <approved value>
Private schema/column contract hash: <approved value>
Source application-schema count: <approved private contract value>
Source application-schema set digest: <approved private contract value>
Target application-schema count: <approved private contract value>
Target application-schema set digest: <approved private contract value>
Run ID: <one new immutable run ID>
Run ID binding: package ID/version/hash, Query Pack hash, Schema Contract hashes, private Query-registry hash, source/target profile reference/fingerprint, broker reference/fingerprint, operator, reviewer, authorized-at, execution window, and sealed-private output policy
Source/Target profile verification: reference, fingerprint, environment, project identity, broker reference, not-before, and expiry all match required
Read-only role expiry: <approved window>
PostgreSQL version policy: major 17; <approved exact/min/max if applicable>
Execution window: <one approved window>
Operator: <approved role/person>
Reviewer: <approved role/person>
Source Read-only Role Owner attestation: <reference>
Target Read-only Role Owner attestation: <reference>
Source/Target effective-role closure attestation: <reference>
Source/Target ownership, TEMP, and application-routine EXECUTE gate attestation: <reference>
Private Broker Owner attestation: <reference>
Private Profile Custodian attestation: <reference>
Artifact retention reference: <approved private policy reference>
Retry: 0
Stop on: any identity, role, schema, hash, sanitizer, validation, or cleanup mismatch
Explicitly excluded: Population, Auth onboarding, consumer-anchor write, M019-Corrective,
access binding, Store Operations connection, Production change
Owner signature/reference: <approval reference>
```

The operator and reviewer must attach only safe evidence: run ID, time, fixed
Query IDs/versions/count, hash matches, PostgreSQL-version gate result,
sanitized outcome, rollback/close/component-cleanup receipt hash/status, local
ephemeral bundle disposition, atomic final commit/revoke result, and revocation
confirmation. Do not
attach a secret, connection string, raw identifier, employee data, or the
private Snapshot payload.
