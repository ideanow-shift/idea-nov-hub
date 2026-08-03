# Human Review安定ID証拠

## 結果

- 終了Issue ID: 17件
- 証拠構造作成: 17件
- 最終判断を確認できる証拠: 11件
- Owner確認により `different_person` として確定した重複グループ: 6件
- `pending_review`: 0件
- 結果値未記録: 0件
- 現行Queue対象: 0件
- Migrationでmergeを許可できる証拠: 0件
- Migrationで別Candidate維持とする証拠: 6件

17件は `review_id`、`issue_id`、Source区分、個人値を含まない行参照、stable key hint、判断、日時、Role、Queue状態、Migration効果へ対応付けた。

## 判断の扱い

- 旧コピーの未使用テンプレート4件は `excluded_template_row / exclude`
- 正式Sourceで解消確認済みの不足Issueは `resolved / no_action`
- 過去に解消済みの重複Issueは `resolved / no_action`
- 最終6グループはOwnerが `different_person` と正式確定し、旧行番号ではなく `27-CONTACT-DUP-GROUP-*` の安定IDへ `keep_separate` として記録

6グループはMigration dry-runで別Candidateとして維持する。欠番となった過去行を復元せず、自動統合・自動削除・Candidate mergeを許可しない。

個人名、電話番号、email、LINE値は本成果物に含めない。
