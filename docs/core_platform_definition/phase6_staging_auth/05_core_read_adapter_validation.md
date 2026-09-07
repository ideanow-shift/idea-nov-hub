# Core Read Adapter Validation

synthetic repositoryのみに接続する`StagingCoreReadAdapter`を実装した。

| Operation / rule | Result |
|---|---|
| getEmployeeSummary | Pass |
| getEmployeeRoles | Pass |
| getActiveAssignments | Pass |
| getStore | Pass |
| getCorporation | Pass |
| getApplicationPermissions | Pass |
| getIdentityStatus | Pass |
| active/retired filter | Pass |
| effective date | Pass |
| corporation/store scope | Pass |
| terminal/service separation | Pass |
| unresolved/duplicate identity deny | Pass |
| timeout | Pass: `adapter_timeout` |
| stale data | Pass: `adapter_stale` |
| adapter version | Pass: `staging-v1` |
| revoked role/assignment fresh read | Pass |

live移行にはpublic masterのread-only実装、connection policy、pagination、PII masking、cache invalidation、SLO、DB二重防御が必要。production Coreへは接続していない。
