# NOV Talent Data Dictionary

NOV Talentの正式名称、正式コード、正式定義の正本である。

## 正本

- 機械可読正本: `nov-talent-data-dictionary.json`
- 人向け仕様: `nov-talent-data-dictionary.md`
- Migration仕様: `migration-spec.md`
- Candidate同一性契約: `candidate-identity-contract.json`
- Human Review証拠: `human-review-evidence.json`
- Migration先区分: `migration-target-mapping.json`
- Snapshot・受領・Rollback契約: 各Migration契約文書
- 現行Version: `1.2.0`

AI、CSV、UI、DB、Platformは機械可読正本に存在する値だけを参照する。未定義値は推測せず、安全停止する。

## Migrationの現在地

- Data Integrity: 完了
- Migration対象行の件数定義: 確定
- 27卒接触Sourceの最新read-only対象件数: 528行
- No.だけの空テンプレート: 13行、Migration対象外
- Migration: `MIGRATION_HOLD`
- Migration契約4件: 仕様確定
- HOLD理由: Migration実行前条件が未完了

Candidate同一性、Human Review証拠構造、移行先区分、Snapshot・受領・Rollbackの仕様は確定した。重複候補6グループはOwner確認により `different_person / keep_separate` として安定IDへ記録済みである。正式Source 2件のprivate read-only dry-runは636対象行、Quarantine 0件でPASSし、Snapshot候補を生成済みである。HOLD解除には、OwnerによるSnapshot受領とMigration実行の別承認が必要である。

- Dry-run report: `migration-dry-run-report.md`
- Snapshot candidate: `migration-dry-run-snapshot.candidate.json`

本ディレクトリの作成・更新だけではSpreadsheet、DB、Productionを変更しない。
