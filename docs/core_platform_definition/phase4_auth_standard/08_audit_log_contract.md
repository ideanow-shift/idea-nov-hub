# 08. Audit Log Contract

## 目的

認証・認可の判断を、利用者・端末・サービスの別を保ったまま事後検証できる共通監査契約を定義する。監査ログは業務履歴の代替ではなく、認証、権限判定、特権アクセスおよび設定変更の証跡である。

## 必須イベント

- `auth.login.succeeded` / `auth.login.failed` / `auth.logout`
- `auth.handoff.issued` / `auth.handoff.exchanged` / `auth.handoff.rejected`
- `identity.resolved` / `identity.resolution_failed` / `identity.ambiguous`
- `authorization.allowed` / `authorization.denied`
- `session.revoked` / `session.expired`
- `service_role.accessed` / `service_role.denied`
- `core_read.executed` / `core_read.denied`
- `role.changed` / `scope.changed` / `assignment.changed`

## 共通フィールド

| 区分 | 必須フィールド |
|---|---|
| 識別 | `event_id`, `event_type`, `occurred_at`, `request_id`, `trace_id` |
| 発生元 | `app_id`, `environment`, `source_ip_hash`, `user_agent_hash` |
| Principal | `principal_type`, `principal_id`, `firebase_uid`（該当時）, `employee_id`（解決時）, `terminal_id`（端末時）, `service_id`（サービス時） |
| 認可 | `action`, `resource_type`, `resource_id`, `corporation_id`, `store_id`, `role`, `scope`, `decision`, `deny_reason_code` |
| セッション | `session_id_hash`, `handoff_jti_hash`, `auth_method`, `token_issuer`, `token_audience` |
| 結果 | `http_status`, `result`, `latency_ms`, `policy_version` |

`PIN`、パスワード、Firebase ID token、Cookie、service role key、handoff codeの原文、メール本文は記録しない。ID・IP等は検索要件を満たす不可逆ハッシュまたはマスキングを用いる。

更新系の`before` / `after`は業務監査側の参照IDまたは機密除去済み差分だけを保持し、認証監査へレコード全文を複製しない。`timestamp`は`occurred_at`、`correlation_id`は分散追跡用`trace_id`の外部表記として扱う。

## 不変条件

1. actorはリクエスト本文から採用せず、検証済みセッションから記録する。
2. denyも成功と同じ粒度で記録し、`deny_reason_code`を必須とする。
3. ログ書込み失敗を業務成功として黙認するかは感度別に定義する。高感度操作はfail closed候補とする。
4. アプリケーション利用者から監査ログの更新・削除を許可しない。
5. service role利用は対象件数とscopeを併記する。

## 保持・閲覧

- 保持期間、法令・人事情報区分、改ざん耐性、閲覧ロール、削除承認者はDecision Item。
- 閲覧は監査担当と限定管理者に分離し、通常運用者には原則与えない。
- 障害調査用ログと長期監査ログを分離し、秘密情報の混入を定期検査する。

## 受入条件

全対象アプリが共通event typeとdeny reasonを出力し、request/trace IDでHUB、交換API、アプリAPI、Core Read Adapterを追跡できること。sandboxで許可・拒否・期限切れ・再利用・scope越境を再現し、機密値が記録されないこと。
