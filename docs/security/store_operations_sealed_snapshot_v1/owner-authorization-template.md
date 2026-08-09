# Owner Authorization Template: Sealed Snapshot Read-only Run

Use this template only after Final Review has passed. It authorizes one
read-only Snapshot run and does not authorize any write workflow.

```text
Authorization title: SEALED SNAPSHOT READ-ONLY EXECUTION AUTHORIZATION
Package: store-operations-consumer-enablement-sealed-snapshot-v1
Source label: idea-nov-core
Target label: idea-nov-staging
Approved query packs: SOCE-QP01, SOCE-QP02, SOCE-QP03, SOCE-QP04, SOCE-QP05, SOCE-QP06
Public query catalog hash: <approved value>
Private query-pack manifest hash: <approved value>
Private schema/column contract hash: <approved value>
Source/Target profile fingerprint verification: all match required
Read-only role expiry: <approved window>
Execution window: <one approved window>
Operator: <approved role/person>
Reviewer: <approved role/person>
Artifact retention reference: <approved private policy reference>
Retry: 0
Stop on: any identity, role, schema, hash, sanitizer, validation, or cleanup mismatch
Explicitly excluded: Population, Auth onboarding, consumer-anchor write, M019-Corrective,
access binding, Store Operations connection, Production change
Owner signature/reference: <approval reference>
```

The operator and reviewer must attach only safe evidence: run ID, time, fixed
query IDs/count, hash matches, sanitized outcome, rollback/close/cleanup status,
and revocation confirmation. Do not attach a secret, connection string, raw
identifier, employee data, or the private Snapshot payload.
