# Phase 6A Entity Mapping Approval Sprint 結果

## 判定

承認パック作成完了。Production / Staging Supabase接続、migration、deploy、実データ投入、既存会計データ変更は未実施。

## 数値

- 候補総数: 38（第13期B/S 38 + P/L 38のentity pairと一致）
- entity type: store 26、department 5、accounting_source_entity 7、その他4種 0
- Direct / FC / unknown: 13 / 8 / 17
- high / medium / low: 15 / 10 / 13
- proposed / under_review / blocked / unknown: 15 / 10 / 13 / 0
- Core UUID正式確認済み: 0
- effective period正式確認済み: 0（proposed日付あり8）
- 重複候補: 6組
- unresolved: 38
- 一括承認候補: 15
- Blocking: 13

## 成果物

本フォルダのMarkdown 7点、CSV、JSON。JSON schema versionはphase6a-entity-mapping-approval-v1。

## 検証結果

- CSV: 38行、28列
- JSON: schema version v1、38 candidates
- 文書リンク: すべて解決
- secret、実会計金額、ローカル絶対パス: 混入なし
- 既存回帰: 216 / 216 PASS
- `git diff --check`: PASS

## 重要な差分

現行店舗前提20店に対して会計sourceのstore型は26件。直営/FCの併存6組とFC立川の履歴を自動統合せず、人間確認事項にした。FC法人5候補の店舗対応は証跡不足のため全件TBD。

## Git

- Base branch: `feat/store-sales-staging-foundation`
- Base commit: `fad72c2ab403a06d40b278512f3d01589bbf700d`
- Head branch: `chore/store-sales-entity-mapping-approval`
