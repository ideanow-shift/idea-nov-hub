# Entity Mapping Inventory

## 根拠

- 第13期構造監査: B/S 38 sheet + P/L 38 sheet = 76 sheet。
- B/SとP/Lは同一entity名で対を作るため、承認単位は38件。
- 既存台帳: YAYOI-001〜YAYOI-038の38行。
- 第11期31件、第12期35件、第13期38件という増分履歴とも整合。

## 集計

|分類|件数|
|---|---:|
|総数|38|
|store|26|
|department|5|
|accounting_source_entity|7|
|legal_entity / business_domain / head_office / fc_company|0（source rowとして独立確認できず候補列に保持）|
|Direct|13|
|FC|8|
|unknown / 対象外|17|

## 現行店舗候補との関係

ユーザー前提は直営13店・FC7店の20店。一方、会計sourceにはstore型26件があり、現行店舗数とは一致しない。BASSA名とFC名が併存する6組、およびFC立川の履歴候補が差分の主因であり、自動統合しない。

## 証跡

- [既存38件台帳](../data-and-mapping-approval.md)
- [弥生Entity候補](../../../accounting/yayoi-entity-mapping.csv)
- [effective period候補](../../../accounting/yayoi-entity-effective-periods.csv)
- [第13期シート監査](../../../accounting/yayoi-excel-structure-audit.md)
- [複数年度比較](../../../accounting/accounting-core-phase3-multiyear-comparison.md)
