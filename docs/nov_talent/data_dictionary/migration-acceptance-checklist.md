# Staging Migration受領チェックリスト

すべて満たした場合だけStaging限定Migration実行判定へ進む。Production昇格は別チェックリストと承認を必要とする。

- [x] 正式Sourceだけを使用
- [x] 旧コピー参照0件
- [x] Data Dictionary Version 1.3.0の対象行定義と一致
- [x] Source別期待件数とSnapshot件数が一致
- [x] sealed artifact候補のSHA-256が一致
- [x] GitHub、Markdown、Consoleへの個人情報露出0件
- [x] Quarantine件数と固定理由コード別内訳を明示（0件）
- [x] 17件のHuman Review証拠が存在
- [x] 重複グループの同一人物／別人／保留結果が安定IDへ対応済み
- [x] Candidate同一性結果の合計がMigration対象件数と一致
- [x] rollback可能な単一transaction設計
- [x] read-only dry-run PASS
- [x] Ownerが最新Snapshotを承認
- [x] Staging限定Migration別承認
- [ ] Permission／RLSの既存契約と一致
- [x] Migration照合後のStaging運用開始承認
- [x] Production書込み・自動昇格が禁止されている

チェック結果に不一致、未確認、空欄が1つでもあれば安全停止する。チェックリスト自体は承認ではない。Staging承認はProduction承認を含まない。

2026-08-03の実行前確認では、既存受入schemaが28卒Source区分、運用dataset版管理、旧版復帰を満たさないため安全停止した。schema変更は禁止されているため、書込み0件・rollback不要で終了した。
