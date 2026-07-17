# HUB auth platform owner attestation 2026-07-17

## Reviewed source identities

```yaml
- path: supabase/functions/nov-hub-api/index.ts
  bytes: 219592
  sha256: 7A97285FA1D0A723F665D41084CBD72CF3FB023B325B607B930CEB1AE45102DB
- path: docs/hub-pin-idea-link-auth-handoff-design-pack-20260711.md
  bytes: 7225
  sha256: C983459A3B6D8A70EBCE47841764AAEEC4EFFFEB217AE26AD1F10F2713ACC4B4
```

```yaml
owner_role: HUB_HANDOFF_ENDPOINT_SERVICE_OWNER
authority_status: UNATTESTED
authoritative_source_count: 2
cross_source_agreement: true
deployment_or_operation_responsibility: false
incident_and_rollback_responsibility: false
rotation_or_revocation_responsibility: false
shared_accountable_owner_category: NONE
blocking_category: OPERATIONAL_RESPONSIBILITY_EVIDENCE_MISSING
```

```yaml
owner_role: HUB_JWKS_PUBLICATION_AUTHORITY_OWNER
authority_status: UNATTESTED
authoritative_source_count: 0
cross_source_agreement: false
deployment_or_operation_responsibility: false
incident_and_rollback_responsibility: false
rotation_or_revocation_responsibility: false
shared_accountable_owner_category: NONE
blocking_category: AUTHORITATIVE_SOURCE_MISSING
```

```yaml
owner_role: HUB_SIGNING_KEY_LIFECYCLE_OWNER
authority_status: UNATTESTED
authoritative_source_count: 2
cross_source_agreement: false
deployment_or_operation_responsibility: false
incident_and_rollback_responsibility: false
rotation_or_revocation_responsibility: false
shared_accountable_owner_category: NONE
blocking_category: LIFECYCLE_CONTRACT_MISSING
```

既存sourceはHUB backendによるIDEA LINK handoff issue/exchangeと単一HMAC Secret利用を示す。一方、担当主体のdeploy/incident/rollback責任、JWKS publication実装、署名鍵rotation/revocation運用をauthoritative sourceとして固定していない。能力やカテゴリ割当だけではATTESTEDにしない。

実装、deploy、Secret/JWKS操作、DB/network操作は行っていない。
