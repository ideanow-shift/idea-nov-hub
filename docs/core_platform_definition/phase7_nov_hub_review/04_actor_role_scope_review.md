# Actor, Role and Scope Review

## 現在

- canonical employee候補は`public.employees.id`で、session `sub`にも使われる。
- Firebase actorはemailを先に、UIDを次に解決する。
- employee active判定は`is_active`とstatus文字列を確認する。
- rolesはactive `employee_roles`から取得する。
- store assignmentsはactive rowを最大10件取得する。
- frontend app visibilityはrole level、tags、department、positionで判定する。

## Gap

- duplicate UID/emailを全件取得してdenyしない。
- email-firstはUID canonical契約と不一致。
- roleの`scope_type` / `scope_id`がactor出力では空。
- assignmentのeffective date、revocation freshnessが不明。
- corporation/store/action/sensitivity/record_state/principal_typeを一つのevaluatorで評価しない。
- terminalとsystem serviceのactor分離を現行HUB flowで確認できない。
- requestのemployee/storeをserver actorから再導出する共通境界がない。

## 必須方針

Phase 8 adapterはFirebase UIDを全件照合し、0件・複数件をdenyします。role、assignment、corporation、storeをserver側Core Read Adapterから取得し、request body/queryのactor scopeを信用しません。一般employee、terminal、serviceは別principalとして解決します。
