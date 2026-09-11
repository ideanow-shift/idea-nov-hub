# IDEA NOV Business Dictionary v1 サマリー

## 総合判定

**Conditional Go**。店舗営業管理MVPに必要な用語は網羅したが、売上原本、税基準、生産性分母、顧客cohort、締め等は業務承認前である。Phase 2はCEO・営業部責任者によるBusiness Decisionと定義承認に限定して進められる。

## 集計

| 指標 | 件数 |
|---|---:|
| 全用語 | 140 |
| Confirmed | 4 |
| Proposed | 27 |
| Needs Business Decision | 102 |
| Unknown | 7 |
| Deprecated | 0 |
| Legacy | 0 |
| Spreadsheet対応 | 20 |
| CEO/営業部判断事項 | 15 |

## 重要な境界

- ConfirmedはCore IDで裏付けられる法人、店舗、社員、Core IDの4語だけとした。
- 現行画面の式は参考資料であり、Business ContractとしてConfirmedにはしていない。
- 店舗営業管理Phase 0は別branchの成果物をread-only参照し、このbranchへ混在させていない。
- 「直営店舗 月別店舗比較（2026年）」原本はrepository内で確認できないため、20指標の定義確認状況をNeeds Business DecisionまたはUnknownとした。
- DB、migration、RLS、Secret、UI、Spreadsheet、本番data、deployは変更していない。
