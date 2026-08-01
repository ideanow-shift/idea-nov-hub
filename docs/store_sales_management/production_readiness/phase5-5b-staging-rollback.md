# Phase 5-5B Staging Rollback

## Independent Rollback

| Target | Staging rollback |
|---|---|
| API/UI artifact | 前のimmutable SHA/artifactへ切替 |
| config | versioned configを前版へ戻す |
| secrets | revoke/rotate、前値復元はSecurity承認時のみ |
| synthetic seed | seed version単位で削除・再投入 |
| migration candidate | apply前は破棄、apply後は承認済みdown/forward fix |
| NOV HUB card | Staging feature flag off |
| Runtime mode | stagingをintegration/blockedへ戻す。責務変更なし |
| deployment | traffic停止、前deploymentへ切替 |

## Exercise

detection→containment→rollback→health/scope/contract validation→communication→evidence→postmortem。Production rollbackは設計のみで実行しない。

## Blocking

artifact registry、Staging deployment platform、secret owner、migration backup、RTO/RPO正式承認。
