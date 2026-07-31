# Rollback Plan

## Frontend

1. 異常時はStore Operationsカードを含まない直前確認済みPages artifactへ戻す。
2. 既存\`Deploy NOV HUB to GitHub Pages\`を\`production_approved=true\`で手動実行する。
3. HUB URL、主要既存カード、Store Operations非表示/遮断を確認する。
4. rollback run、SHA、時刻、理由を記録する。

## API

Production APIは今回deployしていない。将来の接続時は、前versionへ戻すかStore Operations production featureをfail closedにし、HUBカードを無効化する。DB rollbackやデータ修正を手順に含めない。

## Trigger

scope逸脱、Mock混入、実値不一致、個人情報取得、利益確定状態不整合、401/403破綻、Console blocking errorのいずれか。
