# NOV Talent Data Dictionary

NOV Talentの正式名称、正式コード、正式定義の正本である。

## 正本

- 機械可読正本: `nov-talent-data-dictionary.json`
- 人向け仕様: `nov-talent-data-dictionary.md`
- Migration仕様: `migration-spec.md`
- Candidate同一性契約: `candidate-identity-contract.json`
- Human Review証拠: `human-review-evidence.json`
- Migration先区分: `migration-target-mapping.json`
- Staging先行運用契約: `staging-operations-contract.json`
- Staging Candidate Versioned Dataset schema: `staging-candidate-versioned-dataset-schema.json`
- Platform環境運用方針: `platform-environment-policy.md`
- Snapshot・受領・Rollback契約: 各Migration契約文書
- 現行Version: `1.3.0`

AI、CSV、UI、DB、Platformは機械可読正本に存在する値だけを参照する。未定義値は推測せず、安全停止する。

## Migrationの現在地

- Data Integrity: 完了
- Migration対象行の件数定義: 確定
- 27卒接触Sourceの最新read-only対象件数: 528行
- No.だけの空テンプレート: 13行、Migration対象外
- Staging Migration: `STAGING_DATASET_ACTIVE`
- Staging UI Runtime: `STAGING_RUNTIME_READY_FOR_PUBLICATION`
- Production Migration: `PRODUCTION_MIGRATION_HOLD`
- Migration契約4件: 仕様確定
- Staging schema/API: Candidate Versioned DatasetはACTIVE、read-only APIはRemote Stagingへ適用済み
- Production保留理由: Staging運用検証とProduction昇格別承認が未完了

Candidate同一性、Human Review証拠構造、移行先区分、Snapshot・受領・Rollbackの仕様は確定した。重複候補6グループはOwner確認により `different_person / keep_separate` として安定IDへ記録済みである。最新正式Sourceのread-only再受領は636対象行でPASSした。Candidate専用Versioned DatasetはRemote StagingでACTIVE、read-only APIとRole Guardは接続済みである。Production昇格は未実施である。

- Dry-run report: `migration-dry-run-report.md`
- Snapshot candidate: `migration-dry-run-snapshot.candidate.json`
- Latest staging snapshot: `staging-migration-snapshot.candidate.json`
- Staging execution result: `staging-migration-execution-result.json`

本ディレクトリの作成・更新だけではSpreadsheet、DB、Productionを変更しない。

## Platform環境

- Production: `idea-nov-core`
- Staging: `idea-nov-staging`
- Supabase ProjectはProduction 1つ、Staging 1つとし、追加Projectを作成しない。
- 新規システムは共通Staging内でschema、Function namespace、Storage、Dataset、Migration owner、Permission boundaryを分離する。
