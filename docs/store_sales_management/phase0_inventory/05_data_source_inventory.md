# データ元棚卸し

## 結論

**店舗売上の正式原本はUnknown**。リポジトリ内で、現行運用の正本、export owner、締め時刻、再取得方法まで確定できる証拠はなかった。

| 候補 | 確認結果 | 判定 |
|---|---|---|
| POS | 設計資料に候補記載。製品・実接続は未確認 | Unknown |
| SalonAnswer | 再構築資料に候補記載。正式採用は未確認 | Unknown |
| サロンボード | 接続・format・運用証拠なし | Unknown |
| リザービア | 接続・format・運用証拠なし | Unknown |
| CSV | local validatorとtemplateが存在 | Reuse/Extend |
| Spreadsheet | 予算等の想定記述あり。売上正本かは未確認 | Unknown |
| 手入力 | P/L quick intake/local previewあり。本番売上入力ではない | 限定Reuse |
| 外部API | 稼働中のsales API integrationを確認できず | Unknown |
| GAS | legacy資産の記述あり。現行売上経路は未確認 | Unknown |

## 現在確認できるCSV契約

- 月次予算: period、corporation、store、total sales plan、profit plan
- 客数/売上summary: store、month、visit count、total/technical/product sales、average spendの候補
- 人員: store、month、resident headcount、working headcount
- メニュー: store、month、category、menu、service count、sales
- repeat、visit cohortの補助contract

これらはブラウザ内でのsanitized previewであり、正式なimport contract、immutable source、approval、rollbackを備えた本番pipelineではない。

## Phase 1で収集する証拠

1. 正式システム名とdata owner
2. 匿名化した同一月の実export 2回分
3. 項目定義、timezone、営業日境界、税込/税抜
4. 取消・返品・値引き・訂正の表現
5. transaction/order/customer/staff/storeの外部ID
6. 締め済み判定と再出力時の差分
7. 欠損、重複、再送時の扱い

正式原本が決まるまでDB schemaを確定しない。
