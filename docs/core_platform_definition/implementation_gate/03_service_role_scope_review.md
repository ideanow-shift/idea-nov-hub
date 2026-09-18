# 03 Service Role Scope Review

## 対象と方式

ACTIVE Edge Function 21件のデプロイsourceを一時領域へ取得し、service role、本人確認、actor導出、employee/store scopeを静的確認した。sourceやSecretは変更・出力していない。

## 総括

- 21件中14件がservice role keyを直接使用する。
- DBのservice roleはRLSを迂回するため、Edgeの認可が実質的な唯一の行境界。
- 実装品質は一様ではない。Firebase/Supabase userまたは署名済みHUB sessionからactorを導出する新しいAPIと、共有tokenだけで広いreadを許すAPIが混在する。

## 主な判定

| API | 本人/呼出元確認 | actor | store/record scope | 判定 |
| --- | --- | --- | --- | --- |
| shift-api | 署名済みHUB session、aud/exp、active、login_enabled | token subから上書き | role + scope_type/scope_id。saveはassignmentも確認 | MVP参考にできる |
| nov-hub-api | Firebase検証、payload actor拒否 | server解決 | role/store scopeあり | 条件付き適合 |
| expense-cancel-claim | token検証、payload actor拒否 | server解決 | claim権限/RPC | 適合候補 |
| expense-close-monthly-period | token検証、payload actor拒否 | server解決 | role/action | 適合候補 |
| hr-document-signed-url | token検証、claim/UID整合、payload actor拒否 | server解決 | employee/document/path | 適合候補 |
| decision-hub read/write | 署名session/actor resolver | server解決 | action/scope guard | 条件付き適合 |
| talent read v1/v2 | HUB session verifier | session employee | repository governance | imported moduleのnegative test要 |
| analyze-receipt/PASMO | Supabase user検証→firebase_uid | server解決 | receipt path/owner | UID欠損がBlocker |
| concierge-api | 店舗credential→署名session | session store | store一致checkあり。一部admin actionあり | Legacy認証、MVP共通基盤には不採用 |
| task-manager-api | 共有API token | user actorなし | employee/store scopeなし、directory RPC | 高リスクserver-to-server例外 |
| send-line-works-notifications | platform JWTまたはtrigger secret | user actorなし | notification ID/entity制限。店舗業務scopeではない | internal専用を明記 |

`shift-api` は、HMAC署名、audience/expiry、active/retired、login credential、role/scope、assignment、verified actor上書きを持つ。ただしservice role REST readを使用し、DB Policyによる二重防御はない。店舗営業MVPではこの認可形を再利用候補としつつ、専用Gateway contractとnegative testを先に作る。

## DB関数境界

SECURITY DEFINER 98件、service role実行可能84件。うち29件はactor/employee引数を持ちながら関数definition中にscope/employee_roles markerがない。markerの有無は完全な脆弱性判定ではないが、Edgeが偽actorを渡せる設計では危険である。

特に次は別Security remediation候補:

- `core.dev_seed_employee`: 内部認可なしでCore法人・店舗・employee・roleを作成/更新。
- `core.link_employee_to_auth_user`: email指定だけでcore employeeのUIDを更新。
- anon EXECUTEのSECURITY DEFINERが30件。
- task-manager-apiは共有tokenでstaff directoryを取得し、個人actor/store scopeを持たない。

## 店舗営業MVP必須contract

1. Firebase/HUB tokenをserverで検証し、requestのactorを拒否する。
2. active、retired、login enabledを全て確認する。
3. role/actionに加えてCore UUIDのstore scopeを確認する。
4. assignmentはemployee activeとeffective periodを併用する。
5. service role call前に認可し、DB/RPCにもexpected actor/storeを渡して再検証する。
6. authorization negative testsをCI必須にする。
7. task-manager型共有tokenをuser-facing店舗APIに使わない。

