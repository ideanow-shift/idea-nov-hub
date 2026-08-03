# NOV Talent Data Dictionary

NOV Talentの正式名称、正式コード、正式定義の正本である。

## 正本

- 機械可読正本: `nov-talent-data-dictionary.json`
- 人向け仕様: `nov-talent-data-dictionary.md`
- Migration仕様: `migration-spec.md`
- 現行Version: `1.1.0`

AI、CSV、UI、DB、Platformは機械可読正本に存在する値だけを参照する。未定義値は推測せず、安全停止する。

## Migrationの現在地

- Data Integrity: 完了
- Migration対象行の件数定義: 確定
- 27卒接触Sourceの最新read-only対象件数: 528行
- No.だけの空テンプレート: 13行、Migration対象外
- Migration: `MIGRATION_HOLD`
- HOLD理由: Migration契約の残る4条件が未完了

残る4条件は、シート横断のCandidate同一性、重複判断の安定ID証拠、移行先区分、Sourceスナップショットと受領条件である。

本ディレクトリの作成・更新だけではSpreadsheet、DB、Productionを変更しない。
