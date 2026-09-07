# 11. Negative Test Plan

## 共通前提

sandbox専用fixtureを使用し、本番データを更新しない。各ケースはHTTP status、deny reason、監査event、CI自動化可否を記録する。

| ID | 攻撃・異常条件 | Expected | deny reason | Audit event | CI | Sandbox fixture |
|---|---|---|---|---|---:|---|
| NT-00 | token/sessionなし | 401 | `authentication_required` | `authorization.denied` | Yes | anonymous request |
| NT-01 | 署名改ざんtoken | 401 | `invalid_signature` | `auth.handoff.rejected` | Yes | forged token |
| NT-02 | 期限切れtoken/session | 401 | `expired` | `auth.handoff.rejected` | Yes | expired `exp` |
| NT-03 | issuer不一致 | 401 | `invalid_issuer` | `auth.handoff.rejected` | Yes | foreign issuer |
| NT-04 | audience/app不一致 | 401 | `invalid_audience` | `auth.handoff.rejected` | Yes | wrong `aud` |
| NT-05 | handoff code再利用 | 401 | `handoff_replayed` | `auth.handoff.rejected` | Yes | consumed `jti` |
| NT-06 | nonce不一致 | 401 | `nonce_mismatch` | `auth.handoff.rejected` | Yes | wrong nonce |
| NT-07 | bodyのemployee_id偽装 | 403 | `actor_mismatch` | `authorization.denied` | Yes | employee A/B |
| NT-08 | bodyのstore_id越境 | 403 | `scope_denied` | `authorization.denied` | Yes | stores A/B |
| NT-09 | 無所属店舗アクセス | 403 | `assignment_missing` | `authorization.denied` | Yes | no assignment |
| NT-10 | inactive employee | 403 | `employee_inactive` | `identity.resolution_failed` | Yes | inactive user |
| NT-11 | retired employee | 403 | `employee_retired` | `identity.resolution_failed` | Yes | retired user |
| NT-12 | login disabled | 403 | `login_disabled` | `auth.login.failed` | Yes | disabled credential |
| NT-13 | UID重複 | 409/deny | `identity_ambiguous` | `identity.ambiguous` | Yes | duplicate UID fixture |
| NT-14 | UID未解決でemail重複 | 409/deny | `identity_ambiguous` | `identity.ambiguous` | Yes | duplicate email |
| NT-15 | 権限なしaction | 403 | `action_denied` | `authorization.denied` | Yes | viewer writes |
| NT-16 | principal type不一致 | 403 | `principal_type_denied` | `authorization.denied` | Yes | terminal as user |
| NT-17 | 他法人scope | 403 | `corporation_scope_denied` | `authorization.denied` | Yes | corporations A/B |
| NT-18 | service tokenをuser APIへ使用 | 403 | `service_not_allowed` | `service_role.denied` | Yes | service principal |
| NT-19 | service roleで無制限一覧 | 403 | `scope_required` | `service_role.denied` | Yes | missing scope |
| NT-20 | actor欠落の書込み | 403 | `actor_required` | `authorization.denied` | Yes | no delegation |
| NT-21 | revoke後のsession | 401 | `session_revoked` | `auth.handoff.rejected` | Yes | revoked session |
| NT-22 | PIN連続失敗 | 429/lock | `rate_limited` | `auth.login.failed` | Yes | rate-limit clock |
| NT-23 | URL queryへtoken投入 | reject/no log secret | `unsafe_token_transport` | `auth.handoff.rejected` | Yes | query token |
| NT-24 | 監査書込み不能の高感度操作 | deny | `audit_unavailable` | local health alert | Yes | audit sink failure |
| NT-25 | unknown UID | 403 | `identity_unresolved` | `identity.resolution_failed` | Yes | unmapped Firebase user |
| NT-26 | roleなし | 403 | `role_missing` | `authorization.denied` | Yes | employee without role |
| NT-27 | FC ownerが別FC閲覧 | 403 | `corporation_scope_denied` | `authorization.denied` | Yes | FC A/B |
| NT-28 | 店長が別店舗更新 | 403 | `store_scope_denied` | `authorization.denied` | Yes | managers/stores A/B |
| NT-29 | 一般社員が管理者action | 403 | `action_denied` | `authorization.denied` | Yes | employee/manage_permission |
| NT-30 | close後のwrite | 409/403 | `record_closed` | `authorization.denied` | Yes | closed record |
| NT-31 | deleted record操作 | 404/403 | `record_deleted` | `authorization.denied` | Yes | soft-deleted record |
| NT-32 | shared terminalから個人情報閲覧 | 403 | `step_up_required` | `authorization.denied` | Yes | terminal-only session |
| NT-33 | Storage path差し替え | 403 | `storage_scope_denied` | `authorization.denied` | Yes | receipts A/B |
| NT-34 | RPC直接呼出し | 403 | `gateway_required` | `authorization.denied` | Yes | low-privilege DB client |
| NT-35 | retry/duplicate request | same result/no duplicate | `duplicate_request` | `authorization.denied`またはidempotent replay | Yes | repeated idempotency key |

## 合格条件

- 全P0ケースで期待statusとdeny reasonが一致し、データ変更が0件。
- 監査ログにsecret原文がなく、actor、principal type、scope、request IDを追跡可能。
- CIは再現可能な固定fixtureを毎回初期化し、許可ケースと拒否ケースを対で実行。
- P0失敗、deny監査欠落、越境成功のいずれか1件でrolloutを停止する。
