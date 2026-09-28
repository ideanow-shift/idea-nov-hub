# 年次監査チェックリスト

## Governance

- [ ] 本規程、抽出承認書、投入承認書、緊急停止手順が現行Runner/契約と一致する。
- [ ] 権限マトリクスの責任者・委任者が最新である。
- [ ] 抽出・投入・停止の承認記録が完全である。

## Access and security

- [ ] 一時read-only Roleに余分な権限、継承、BYPASSRLS、期限切れ資格情報がない。
- [ ] 既存資格情報・`service_role`を利用した実績がない。
- [ ] 秘密情報、接続文字列、個人情報、実UUID、実会計金額が証跡・GitHub・成果物に存在しない。
- [ ] 緊急停止と資格情報失効を机上演習した。

## Data quality

- [ ] 各Snapshotで20店舗、直営13、FC7、crosswalk、hash、expiryを確認した。
- [ ] confirmed利益、未確定`null`、FC利益`unavailable`、AM deny-by-defaultを確認した。
- [ ] Q03-Q07のSource承認状況と`unavailable`表示が整合している。

## Evidence and lifecycle

- [ ] run ID、Query count、rollback/close、artifact/manifest hash、結果区分が保存されている。
- [ ] 期限切れSnapshotが有効化されていない。
- [ ] active版と直前の承認済み版のrollback可否を確認した。
- [ ] 監査結果、是正事項、責任者、期限を記録した。
