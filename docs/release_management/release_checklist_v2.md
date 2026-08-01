# Release Checklist v2

Release ownerは対象ドメインごとに下表を埋める。`PASS`以外が1つでもある場合、最終判定はRelease Readyではない。

| # | 確認項目 | Evidence | Owner | 状態 |
| ---: | --- | --- | --- | --- |
| 1 | 対象データの正本・期間・投入/同期状態が目的に適合する | sanitized receipt / owner review | Data owner | PASS/CONDITIONAL/FAIL/未確認 |
| 2 | データ欠損・隔離・重複・未確定をUIと業務手順が正しく扱う | reconciliation / UI test | Data + Product | PASS/CONDITIONAL/FAIL/未確認 |
| 3 | 開始、日常処理、承認、例外、終了の業務フローが決まっている | procedure + responsible role | Business owner | PASS/CONDITIONAL/FAIL/未確認 |
| 4 | 問い合わせ先、緊急停止、rollback責任者が決まっている | support / rollback record | Operations owner | PASS/CONDITIONAL/FAIL/未確認 |
| 5 | 主要利用者が実務シナリオを完了できる | usability review | Product owner | PASS/CONDITIONAL/FAIL/未確認 |
| 6 | 未接続・未確定・権限不足が誤解なく表示される | desktop/mobile evidence | Product + Security | PASS/CONDITIONAL/FAIL/未確認 |
| 7 | 対象部門が実運用レビューを完了し、懸念を解消した | signed acceptance | Department owner | PASS/CONDITIONAL/FAIL/未確認 |
| 8 | テスト、アクセス境界、secret非掲載、変更範囲、rollbackがPASS | test report / security review | Engineering owner | PASS/CONDITIONAL/FAIL/未確認 |

## 最終欄

```yaml
release: <version>
domain: <NOV_HUB|STORE_OPERATIONS|NOV_TALENT|CORE_DB|ACCOUNTING_CORE>
data_integrity: PASS|CONDITIONAL|FAIL|UNVERIFIED
business_flow: PASS|CONDITIONAL|FAIL|UNVERIFIED
ui_ux: PASS|CONDITIONAL|FAIL|UNVERIFIED
operational_review: PASS|CONDITIONAL|FAIL|UNVERIFIED
development_quality: PASS|CONDITIONAL|FAIL|UNVERIFIED
final_decision: RELEASE_READY|NOT_READY|NO_GO
decision_owner: <role>
evidence_references: []
```

`final_decision: RELEASE_READY`は、5つの値がすべて`PASS`である場合だけ選べる。
