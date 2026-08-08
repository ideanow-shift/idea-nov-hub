# Security Findings

| ID | Finding | Severity | Phase 5 response | Production blocker |
|---|---|---:|---|---:|
| SF-01 | Mapのatomicityは単一process限定 | High | consume前deleteをテスト | Yes |
| SF-02 | sandbox HMAC鍵は固定架空値 | High | 外部Secret不使用を保証 | Yes: 非対称鍵・rotation |
| SF-03 | session状態は作成時actor snapshot | High | 更新時state fieldを再判定 | Yes: Core再解決/失効伝播 |
| SF-04 | authorization policyはコード内固定 | High | default denyと境界テスト | Yes: versioned policy/owner |
| SF-05 | auditはformatterのみで非永続 | High | allowlistとdeny eventを検証 | Yes: immutable sink/retention |
| SF-06 | Adapterはsynthetic配列 | Medium | interface分離を検証 | Yes: scoped live implementation |
| SF-07 | Cookieはcontract検査のみ | Medium | secure属性をassert | Yes: browser/CSRF test |
| SF-08 | rate limit、鍵侵害、分散clockは未検証 | High | Phase 5 scope外と明示 | Yes |

## 確認できた防御

- actor、storeのrequest差替えはstable deny reasonで拒否。
- unresolved/duplicate/inactive/retired/login-disabled identityはfail closed。
- terminalをemployeeとして解決せず、serviceによるuser actionを拒否。
- app audience/sessionを分離し、handoff/code/session replayを拒否。
- audit formatterは任意入力フィールドを転記しない。

Phase 3のservice role、GRANT、SECURITY DEFINERリスクは解消していない。本sandboxはservice roleを一切使用していない。
