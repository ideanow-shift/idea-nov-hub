# Migration受領チェックリスト

すべて満たした場合だけMigration HOLD解除判定へ進む。

- [x] 正式Sourceだけを使用
- [x] 旧コピー参照0件
- [x] Data Dictionary Version 1.2.0の対象行定義と一致
- [x] Source別期待件数とSnapshot件数が一致
- [x] sealed artifact候補のSHA-256が一致
- [x] GitHub、Markdown、Consoleへの個人情報露出0件
- [x] Quarantine件数と固定理由コード別内訳を明示（0件）
- [x] 17件のHuman Review証拠が存在
- [x] 重複グループの同一人物／別人／保留結果が安定IDへ対応済み
- [x] Candidate同一性結果の合計がMigration対象件数と一致
- [ ] rollback可能な単一transaction設計
- [x] read-only dry-run PASS
- [ ] OwnerがSnapshotを承認
- [ ] 本番書込み前のMigration別承認
- [ ] Permission／RLSの既存契約と一致

チェック結果に不一致、未確認、空欄が1つでもあれば安全停止する。チェックリスト自体は承認ではない。
