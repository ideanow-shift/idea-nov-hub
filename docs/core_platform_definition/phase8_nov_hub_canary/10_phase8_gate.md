# Phase 8 Gate

## 判定

**Conditional Go**

| Gate | 判定 |
|---|---|
| NOV HUBへ最小変更で追加 | Go |
| 現行loginへの影響なし | Go |
| app cardへの影響なし | Go |
| IDEA LINKへの影響なし | Go |
| legacy launchへの影響なし | Go |
| feature flagで分離 | Go |
| kill switch停止 | Go |
| synthetic canary contract | Go |
| 本番deploy前review | Conditional Go |
| 本番有効化 / deploy | No-Go |

Phase 8では、分離されたsource canaryと49件のtestまで完了しました。実HTTPS browser、分散store、永続audit、staging endpointを完了してから、本番deploy可否を別Gateで判断します。
