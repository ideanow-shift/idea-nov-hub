# Core Read Adapter Contract

## Purpose

新規アプリからpublic/core物理schemaを隠し、public.employees/stores/corporationsを当面の正本候補としてversion付きread projectionを返す。Core Masterを更新しない。

## Operations

| operation | input | output |
| --- | --- | --- |
| `resolveIdentity` | verified principal | employee UUID, identity status |
| `getEmployeeSummary` | actor, employee UUID, as_of | masked employee summary |
| `getEmployeeRoles` | actor, employee UUID, app ID, as_of | effective app permissions |
| `getAssignments` | actor, employee UUID, as_of | active store/corp scopes |
| `getStore` | actor, store UUID, as_of | store, corp, FC/direct |
| `getCorporation` | actor, corp UUID | corporation summary |
| `getManagerRelationship` | actor, employee UUID, as_of | explicit relationship |
| `getOrganizationTree` | actor, root scope, as_of | bounded tree |
| `getApplicationPermission` | actor, app/action/resource | allow/deny evidence |

## Contract

- input actorはGateway contextだけ。request actorは禁止。
- outputに `contract_version`, `source_version`, `as_of`, `generated_at`, `stale_after`, `identity_status`。
- defaultでinactive/retiredを除外。監査/HR明示permission時だけ状態付きで返す。
- assignmentはemployee active、effective_from/to、assignment activeを全て評価する。
- cache keyはapp+actor scope+resource+as_of+version。PIIはshared cache禁止。
- stale時はread-only summaryのみ許可し、approve/close/manage_permissionはfail closed。
- immutable snapshotはdigest、source version、as_ofを持つ。
- error: IDENTITY_UNRESOLVED, INACTIVE, OUT_OF_SCOPE, NOT_FOUND, STALE_FOR_ACTION, CONTRACT_VERSION_UNSUPPORTED。
- allow/denyとrestricted readをauditする。
