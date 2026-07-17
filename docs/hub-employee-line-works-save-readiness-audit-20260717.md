# HUB employee LINE WORKS destination save readiness audit 2026-07-17

## Result

```yaml
read_ui: present_masked_only
frontend_save_candidate: present_disabled
edge_actions: present
authoritative_rpc_sql: not_found
repository_schema_compatible_with_employee_target: false
production_enable: HOLD
database_mutation: false
```

社員マスタの保存スイッチ`EMPLOYEE_LINE_WORKS_DESTINATION_WRITE_ENABLED`はfalseのまま維持する。現時点でtrueへ変更してはいけない。

## Source inventory

| Source | Bytes | SHA-256 | Fact |
| --- | ---: | --- | --- |
| `portal/master-admin/master-admin.js` | 265092 | `812633406E6434A7DD78BC3E523E6BB42F4AC7307F8BDFA358EF5D3A91926A7B` | 実ID非表示UI、入力検証、保存候補あり。write flagはfalse |
| `supabase/functions/nov-hub-api/index.ts` | 219592 | `7A97285FA1D0A723F665D41084CBD72CF3FB023B325B607B930CEB1AE45102DB` | get/upsert/disable RPC呼出とmaster actionあり |
| `supabase/functions/send-line-works-notifications/index.ts` | 23647 | `78AF103DFD072C5C2C6A6C5E9C1EC11CE94E3D9B06ACC1EC7479112F4F3D254A` | employee primary destinationをUser IDとして解決し、shared channelへfallbackしない |
| `supabase/notification-destinations.sql` | 1682 | `7ACB02FB563F27B15568E4A9E7A3D44947DE218A0A8AA02BF625DBC693BA4D73` | table候補はemployee targetを許可していない |

## Confirmed mismatch

Edgeと送信処理が期待する契約:

```text
os.notification_destinations.target_type = employee
os.notification_destinations.target_id = public.employees.id
os.notification_destinations.purpose = primary
os.get_employee_line_works_destination(...)
os.upsert_employee_line_works_destination(...)
os.disable_employee_line_works_destination(...)
```

リポジトリ上の`supabase/notification-destinations.sql`が許可するtarget type:

```text
store / department / corporation / role / module / global
```

`employee`はcheck constraintに含まれない。また、上記3 RPCのCREATE定義はauthoritative SQLから見つからなかった。このため、次のどちらかが未確定である。

1. production DBには後続migration/RPCが存在するがGit正本へreconcileされていない。
2. production DBにも存在せず、現在のEdge保存routeは実行時に失敗する。

推測でDDLやfrontend flagを変更しない。

## Existing safety boundary

- clientからactor overrideを受け付けない。
- actor employee IDはEdge backendが認証済み社員から解決する。
- master editor権限をbackendで再確認する。
- read responseはmasked値だけを返す。
- User IDは数字のみのchannel IDと区別する。
- 個人宛解決失敗時は店舗・default channelへfallbackしない。

## Required next gate

Core DBのSELECT-only/source reconciliationで以下を確定する。

1. productionのtable constraint、index、RLS、policy、grantの現状。
2. 3 RPCの存在、signature、security definer、fixed search_path、EXECUTE grant。
3. RPC内部で`public.employees.id`を正本にしていること。
4. raw User IDをaudit、response、logへ出さないこと。
5. upsert/disableと変更履歴がtransaction境界内で整合すること。
6. deployed Edge sourceとcanonical Git sourceの一致。

production evidenceが存在する場合はschema/RPCをGitへreconcileし、static fixtureとread-only post-checkを通した後にfrontend write flagを別gateで判断する。存在しない場合はDDL/RPC/RLS/GRANTのCore DB reviewが必要である。

## Stop line

- frontend write flag有効化
- production DDL/RPC/RLS/GRANT
- Edge deploy
- employee notification destination DML
- LINE WORKS実送信
- raw User IDの資料・ログ出力

上記はすべて未実行である。
