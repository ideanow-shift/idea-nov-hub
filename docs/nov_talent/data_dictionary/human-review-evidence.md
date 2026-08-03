# Human Review安定ID証拠

## 結果

- 終了Issue ID: 17件
- 証拠構造作成: 17件
- 完全な終了結果を確認できる証拠: 11件
- 人間確認完了のみで、同一人物／別人／保留の結果値が保存されていない重複グループ: 6件
- 現行Queue対象: 0件
- Migrationでmergeを許可できる証拠: 0件

17件は `review_id`、`issue_id`、Source区分、個人値を含まない行参照、stable key hint、判断、日時、Role、Queue状態、Migration効果へ対応付けた。

## 判断の扱い

- 旧コピーの未使用テンプレート4件は `excluded_template_row / exclude`
- 正式Sourceで解消確認済みの不足Issueは `resolved / no_action`
- 過去に解消済みの重複Issueは `resolved / no_action`
- 最終6グループは完了事実だけを保持し、結果値を推測しないため `OUTCOME_NOT_RECORDED`

`OUTCOME_NOT_RECORDED` の6グループは、Migration前に総務人事部の判断を `same_person`、`different_person`、または判断保留として安定IDへ再記録する必要がある。それまでは `merge_candidate` を許可しない。

個人名、電話番号、email、LINE値は本成果物に含めない。
