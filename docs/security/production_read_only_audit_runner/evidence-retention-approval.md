# Evidence Retention Approval

## 保存するもの

- run ID、approval reference、runner/manifest/query catalog hash
- Query ID、query count、固定成功/失敗分類
- project identity/read-only guardのpass/fail
- rollback/close確認、実行開始・終了のsanitized timestamp

## 保存しないもの

- connection string、host、project ref、certificate、token、password、service key
- raw SQL response、DB dump、社員/顧客情報、実UUID、実会計金額、policy expression、raw error

保管先はCore DB governanceのアクセス制限付き証跡庫とし、閲覧者は代表者、OS責任者、DB責任者、監査担当に限定する。保存期間は365日、閲覧権限は四半期ごとに棚卸しする。監査credentialは実行後すみやかに失効し、遅くとも24時間以内の失効確認を同じreceiptに記録する。
