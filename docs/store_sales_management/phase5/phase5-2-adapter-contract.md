# Phase 5-2 Adapter / Projection 契約

## Adapter

- `mock`: localhost限定。既存synthetic fixtureだけを返し、外部通信しない。
- `integration`: HTTPSまたはlocalhostの隔離read-only endpointへGETする。
- `production`: 承認前のため常に起動拒否する。

設定は`adapter-runtime-config.js`に集約し、一般actor向け画面、URL query、localStorageからmodeを変更できない。fixture queryはlocalhostのmockだけで解釈する。キャッシュはPhase 5-2では無効である。

## Response

`meta`の必須値は`sales_period`、`accounting_confirmed_through_period`、`confirmation_state`、`last_updated_at`、`actor_scope`、`reflected_store_count`、`accounting_version_id`、`kpi_definition_set_version`、`projection_version`、`adapter_mode`。

指標は`value`、`display_value`、`unit`、`data_state`、`reason_code`、`period`、`period_mode`、`confirmed_period_label`を持てる。未取得値はnullであり、0へ変換しない。`available`以外は値を公開しない。未知フィールドは将来互換のため許容するが、consumer禁止フィールドは応答のどの階層でも拒否する。

Store Listは`priority_rank`昇順を契約とし、UIは業務状態を再計算しない。Store Detailのactionは最大3件に制限する。

## Validation

- object/array/required field
- `YYYY-MM`、confirmed periodがsales periodより後でないこと
- data state、store status、actor scope enum
- number/null、percentage表示
- duplicate store ID、priority order
- own_storeの複数店舗拒否
- department/franchiseの`actor_scope_key`不一致拒否
- denied actor拒否
- raw provenance、内部ID、service role情報拒否

契約違反は安全な`VALIDATION_ERROR`へ変換し、内部message、stack、raw responseはUIへ出さない。

## Error mapping

| 条件 | code | UI |
|---|---|---|
| timeout | `TIMEOUT` | 通信に時間がかかっています |
| 401 | `UNAUTHORIZED` | セッション切れ・再ログイン |
| 403 | `FORBIDDEN` | アクセス権限がありません |
| 404 | `NOT_FOUND` | 対象店舗または対象月が見つかりません |
| 409 | `VERSION_CONFLICT` | データ更新中です |
| 422 | `VALIDATION_ERROR` | データ確認が必要です |
| 500 | `SERVER_ERROR` | 一時的に取得できません |
| invalid JSON | `MALFORMED_JSON` | Projection応答を確認しています |

