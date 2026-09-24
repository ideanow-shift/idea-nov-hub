# 01 Live Permission Verification

検証日: 2026-07-28 JST  
対象: Supabase `idea-nov-core` (`nkmxevmioczcmnldreyo`, PostgreSQL 17.6)  
方式: Supabase Management APIの `db query --linked` によるカタログSELECT、OpenAPI到達性確認、デプロイ済みEdge sourceの読み取り。DDL/DML、RPC実行、Storage object取得は行っていない。

## 結論

店舗営業管理MVPの本番実装Gateは **No-Go**。現行の直接ブラウザアクセスはAPI Gatewayでsecret key必須となっており抑止されているが、service roleを使うEdge/APIへ認可責任が集中している。Core候補表には行単位Policyがなく、service roleが侵害・誤実装された場合のDB側防御がない。

## RLS / Policy

| Schema | Table数 | RLS有効 | RLS無効 | RLS有効・Policy 0 |
| --- | ---: | ---: | ---: | ---: |
| public | 103 | 103 | 0 | 102 |
| core | 9 | 0 | 9 | 0 |
| finance | 11 | 10 | 1 | 0 |
| hr | 16 | 16 | 0 | 16 |
| os | 8 | 6 | 2 | 4 |
| storage | 8 | 8 | 0 | 7 |

対象別:

| Table | RLS | Policy | 判定 |
| --- | --- | ---: | --- |
| public.employees | ON | 0 | anon/authenticatedはdeny、service roleは迂回 |
| public.stores | ON | 0 | 同上 |
| public.corporations | ON | 0 | 同上 |
| public.employee_roles | ON | 0 | 同上 |
| public.employee_store_assignments | ON | 0 | 同上 |
| public.employee_login_credentials | ON | 0 | 同上 |
| public.hub_app_auth_handoffs | ON | 0 | 同上 |
| core.employees/stores/corporations | OFF | 0 | DB側行制御なし |

## GRANT

- `service_role` はpublicのCore候補表にSELECTに加えてUPDATE/TRUNCATE/TRIGGER/REFERENCESを広く保持する。employee_roles、employee_store_assignments、employee_login_credentials、handoffsにはINSERTもある。
- `service_role.rolbypassrls = true`。RLSはservice role APIのscope誤実装を補完しない。
- `authenticated` はRLSなしの `core.employees`, `core.stores`, `core.corporations` にSELECTを持つ。
- anon/authenticated/service_roleはcore schema USAGEを持つ。
- 現行Gatewayではlegacy anon keyが `Invalid API key`、publishable keyが `Secret API key required` となり、public clientからPostgRESTへ直接到達できなかった。
- secret keyとserver User-Agentではpublic/core/finance/os schemaが到達可能、hrは406だった。これは現在の抑止策であり、DB GRANTを安全にする代替ではない。

## SECURITY DEFINER

| 項目 | 件数 |
| --- | ---: |
| 対象schemaのSECURITY DEFINER | 98 |
| search_path設定なし | 0 |
| anon EXECUTE | 30 |
| authenticated EXECUTE | 30 |
| service_role EXECUTE | 84 |
| actor/employee引数あり、scope markerなしのservice実行関数 | 29 |

`core.dev_seed_employee` と `core.link_employee_to_auth_user` は内部の本人・管理者確認を持たず、coreデータを更新する。現行Gatewayのpublic key拒否により外部anon呼出しは確認できなかったが、anon EXECUTE/USAGEは過剰権限でありCriticalな設定ドリフトリスクである。`core.employee_admin_options` 等は内部で `can_manage_permissions()` を確認する。

## Storage Policy

| Bucket | public | object数 | 対応Policy |
| --- | --- | ---: | --- |
| employee-profile-images | false | 185 | 直接対応Policyなし |
| expense-receipts | false | 4 | SELECT/INSERT/UPDATEの3件 |
| hr-documents-private | false | 0 | 直接対応Policyなし |

`storage.objects` の3 Policyはすべてexpense-receipts向け。own folderは `core.current_employee_id()`、閲覧は `finance.can_view_expense_claim` を使用する。employee-profile-imagesとhr-documents-privateはservice API境界依存で、Storage RLS上の個別Policyはない。

## 最大リスク

**service roleのRLS迂回 + 広いGRANT + Edge/API側scope判定への単一依存**。特にactorをrequestから受けるRPC/API、scope markerのないSECURITY DEFINER、匿名EXECUTEが残る開発用更新関数は、Gateway設定変更やEdge認可欠落時にCore/業務データ全体へ波及する。

