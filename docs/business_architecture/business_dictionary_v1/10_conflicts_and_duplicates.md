# 用語競合・重複

| 競合 | 種別/原因 | v1の扱い |
|---|---|---|
| 会社 / 法人 | 同義利用の可能性 | 法人はCore corporation IDを基準とし、会社はalias化を業務判断 |
| 店舗名 / store_id | 名称揺れ・改名 | 名称matchingをcanonical identityに使わない |
| 社員数 / スタッフ数 / 在籍人数 / 稼働人数 / FTE | 分母が異なる | 別technical keyで保持 |
| 総売上 | 税込/税抜、調整前後が不明 | 定義versionとtax basisを必須化 |
| 商品売上 / 店販売上 | 同義候補 | 正式名を店販売上、商品売上をalias候補 |
| MID売上 / 商品売上（MID抜き） | 重複関係が不明 | source確認までUnknown |
| 総生産性 | 現行式とKPI Contract候補が異なる | 現行式は参考、正式分子・分母はDecision |
| 技術生産性 | 稼働人数/FTE/時間の候補 | 別KPIに分解 |
| 人時売上高 / 実労働売上高 | 同義または異義の可能性 | 労働時間の種類を明示 |
| リピート率 | 来店区分式とcohort式が混在 | 対象cohortと期間をversion化 |
| 新規客 | 全社初回/店舗初回/lookback | 定義承認までNeeds Business Decision |
| 予算比 / 目標達成率 | 同義候補だが予算version不明 | 予算達成率へ統一候補 |
| 営業日 / 暦日 | 深夜跨ぎで期間差 | business day boundaryを必須化 |
| 直営 / FC | 所有・運営・集計法人が異なる | 3法人relationを分離 |
| Spreadsheet名 / DB列名 | 日本語表示、camelCase、snake_case混在 | technical_keyをdictionaryで固定 |

## 検出ルール

- 同名異義、異名同義、式違い、期間違い、税込/税抜混在を別々に検出する。
- 人数分母はtechnical keyまで比較する。
- 表示名による店舗・社員matchingを禁止し、Core IDへmappingする。
- Spreadsheet/DB/API/UIの名称差はaliasで吸収し、canonical keyを増殖させない。
