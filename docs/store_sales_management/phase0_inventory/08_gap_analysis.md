# Gap分析

| 領域 | 現状 | 不足 | 優先度 |
|---|---|---|---|
| 売上原本 | 候補のみ | 正式source、owner、format | P0 |
| 業務ルール | 設計項目あり | 税、値引、取消、返品、訂正、締め、営業日 | P0 |
| canonical facts | 設計のみ | transaction/import/reconciliation物理モデル | P0 |
| 予算 | local CSV | 正本、承認、version | P0 |
| KPI | 複数候補 | 分母/分子、確定時点、欠損処理 | P0 |
| 店舗API | actor scope候補 | 実sales read model、placeholder排除 | P0 |
| UI | shellあり | 実データ、状態、コメントworkflow | P1 |
| staff mapping | employee masterあり | external staff ID mapping | P0 |
| area scope | area文字列 | effective assignment | P0 |
| security | service role server利用 | endpointごとのdeny matrix/test | P0 |
| staging | 計画のみ | 分離環境、owner、rollback | P0 |
| tests | local contractあり | 既存失敗3件、business golden tests | P1 |
| daily | 未確認 | daily close/速報 | P2 |
| AI/forecast | 未実装 | data lineage確立後 | P3 |

## 最大Gap

最大Gapは、売上原本と業務上の意味が未確定なこと。これが決まらない限り、画面、DB、KPIを作っても数値の正しさを証明できない。

## 誤再利用を避ける項目

- 財務P/Lの売上を店舗取引原本として流用しない。
- snapshotから取消・返品・訂正履歴を復元しない。
- 店舗名文字列matchingをcanonical keyにしない。
- missingを0としてランキングしない。
- 「生産性」を単一指標に固定しない。
- role名だけでstore/corporation scopeを広げない。
