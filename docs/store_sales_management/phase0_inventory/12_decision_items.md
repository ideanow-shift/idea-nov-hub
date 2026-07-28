# Decision Items

| ID | 判断事項 | 選択肢/確認 | Owner候補 | Gate |
|---|---|---|---|---|
| DI-01 | 正式売上原本 | POS/SalonAnswer/Salon Board/Reservia/CSV/Spreadsheet | CTO + 営業責任者 | Blocker |
| DI-02 | 金額基準 | 税込/税抜、税率、端数 | 経理責任者 | Blocker |
| DI-03 | 売上定義 | gross/net、値引前後 | 経理 + 営業 | Blocker |
| DI-04 | 取消/返品 | 発生日/処理日、マイナス計上 | 経理 | Blocker |
| DI-05 | 訂正 | 上書き禁止、version、承認 | CTO + 経理 | Blocker |
| DI-06 | 締め | daily/monthly close、再open | 営業 + 経理 | Blocker |
| DI-07 | 営業日 | timezone、深夜跨ぎ | 営業 | Blocker |
| DI-08 | 客数 | 会計/伝票/来店/顧客のどれか | 営業 | Blocker |
| DI-09 | 技術/店販/指名 | source category mapping | 営業 | Blocker |
| DI-10 | 予算正本 | Spreadsheet/DB、承認version | 経営者 | Blocker |
| DI-11 | 主KPI | 4種から選ぶか並列維持 | 経営者 | Decision |
| DI-12 | FTE/労働時間 | divisor、確定勤怠、欠損 | 人事 + 営業 | Blocker |
| DI-13 | area scope | area masterと担当期間 | 営業責任者 | Blocker |
| DI-14 | 店長コメント | 編集者、締め、履歴 | 営業責任者 | P1 |
| DI-15 | staging | Phase 10案の承認、cost/owner | CTO/経営者 | Blocker |
| DI-16 | rollback owner | data、API、UIの責任者 | CTO | Blocker |
| DI-17 | Phase 1範囲 | contract/fixture/read-onlyに限定 | CTO | Decision |

## KPIの扱い

人員生産性、稼働人員生産性、時間生産性、FTE生産性は別KPIである。時間生産性だけを主KPIにはしない。主KPI、ランキングへの採用、欠損時の表示は経営判断とする。

## 推奨する初期判断

Phase 1は月次CSVを暫定transportとして採用してもよいが、「CSVそのものが正本」なのか「POSからの公式exportが正本」なのかを明記する。名前matchingは禁止し、external ID mappingを必須にする。
