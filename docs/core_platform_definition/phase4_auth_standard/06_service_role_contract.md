# Service Role Contract

## Mandatory rules

1. Browser、static asset、public repository、URL、ログへ出さない。
2. Firebase/HUB/service principal検証後だけ使用する。
3. request actor、employee/store/corporation IDを信用せずserverで再解決する。
4. appごとに専用API境界、許可table/RPC/actionを宣言する。
5. record/store/corporation scopeとstateをservice call直前に再確認する。
6. DB/RPCでもexpected actor/store/versionを再検証する二重防御を設ける。
7. allow/deny、actor、service principal、resource、correlationを監査する。
8. production/staging/dev Secretを分離し、定期・incident rotationを行う。
9. rate limit、request size、idempotency、timeoutを必須化する。
10. errorにSQL、Secret、email、Storage path、signed URLを含めない。

server-to-server例外はworkload identity、固定audience、system_internal scope、allowlisted action、短寿命credential、監査が揃う場合だけ。task-manager型shared tokenをuser-facing APIへ流用しない。

## Live risks

- service roleはBYPASSRLS。
- public Core候補表に広いGRANT。
- SECURITY DEFINER 98件、service実行84件、anon実行30件。
- actor/employee引数がありscope markerなし候補29件。
- `core.dev_seed_employee` と `core.link_employee_to_auth_user` は内部管理者確認なしで更新する。

## Remediation proposal（未実行）

P0: public exposure/Secret scan、dev/link RPC到達性封鎖案、API inventory owner。P1: app専用RPC/API、actor binding、negative tests。P2: GRANT/EXECUTE最小化とDB二重防御。P3: service workload credential分離。各変更は別Security Gate、rollback SQL、live catalog差分を必要とする。
