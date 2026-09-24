# Phase 7 Gate

## 判定

**Conditional Go**

| Gate | 判定 | 理由 |
|---|---|---|
| 現行認証を把握できた | Go | Firebase、PIN、HUB sessionをsource確認 |
| app起動影響を把握できた | Conditional Go | source確認済み、live card値は未確認 |
| 最小変更で接続可能 | Go | IDEA LINK pattern + app flag分岐 |
| rollback可能 | Conditional Go | 設計可能、共通flagは未実装 |
| Phase 6 security contractを満たす | No-Go（現状） | Cookie、asymmetric、UID duplicate deny等が不足 |
| Phase 8 sandbox/staging実装 | Conditional Go | production依存なし、canary限定 |
| 本番有効化・deploy | No-Go | 別Gate |

## Phase 8開始条件

- feature flagは既定OFF。
- `hub-context-test`とsynthetic principalだけを対象。
- production DB、Firebase、Secret、Edgeへ接続・変更しない。
- legacy launchを保持する。
- browser、concurrency、negative、rollback testを実施する。

## Blocker

- 現行live `portal_apps` inventoryと各app owner未確定。
- staging receiver origin / Cookie domain未確定。
- distributed atomic storeとaudit persistenceのstaging資源未確定。
- UID/email重複をdenyできるCore adapter contract未接続。
- flag、incident、rollback、audit owner未指名。
