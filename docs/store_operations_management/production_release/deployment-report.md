# Deployment Report

## 結果

Deploy未実施。

main mergeだけでは自動deployされない。さらにmainのStore Operationsは\`featureFlag: "preview"\`であり、Production adapterは\`PRODUCTION_NOT_APPROVED\`としてfail closedする。正式real-data endpointとread-only認証がない状態でPagesだけを公開すると、カードが見えても業務画面を起動できないため実行を停止した。

## 確認済み

- main HEAD: \`75f6a1adfb0252fd60cd97c2662b4fc235f84ab8\`
- PR #13 merge: \`2bbbbdb\`
- PR #14 merge: \`75f6a1a\`
- main HEADに対応するdeploy run: なし
- 直近deploy run: 30671911695（別release branch）
- 公開HUB: HTTP 200
- 公開Store Operations: HTTP 404

## 再開条件

Production Projection endpoint、HUB Session検証、server-side scope、正式Data Source、read-only権限、20店舗SoT、Accounting確定値が承認され、Staging E2Eを通過すること。
