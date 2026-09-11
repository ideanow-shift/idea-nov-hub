# Phase 8 Implementation Plan

1. interfaceとsynthetic fixtureをproduction codeから分離して追加。
2. app単位flagを既定OFFで追加し、legacy launchを保存。
3. Phase 6のasymmetric verifier、atomic store、session、adapter、auditをNOV HUB adapterへ接続。
4. `hub-context-test` issuer/exchange receiverをlocal/stagingに実装。
5. UID duplicate、inactive/retired/login-disabled、terminal/service分離を検証。
6. real browserでCookie、CSRF、Origin、URL/storage非残存を検証。
7. concurrency、replay、revoke、audit failureを検証。
8. rollback drill後にGate資料を更新。

## 明示的非対象

本番deploy、production Secret、DB migration、RLS/GRANT変更、Firebase変更、業務appのwrite、legacy削除は含みません。

## Exit criteria

全negative test成功、production依存ゼロ、flag OFF時の回帰ゼロ、canary rollback成功、未解決identityのdefault deny、秘密・PIIのログ非出力が必要です。
