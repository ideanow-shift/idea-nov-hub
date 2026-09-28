# Identity Resolution Contract

## Canonical identity

canonical employee identityは `public.employees.id` UUID。本人認証keyはFirebase UIDであり、employee code、氏名、email、requestのemployee IDは本人証明に使わない。

```text
verified Firebase sub
→ unique public.employees.firebase_uid
→ employee UUID
→ is_active / retired_on / employment_status
→ employee_login_credentials.login_enabled
→ effective role / assignment
```

## ライブ制約

775人中UID NULL 769、active 190人中UID欠損184、activeでemail/auth_email双方なし104。UID/email重複0。credential 82件、孤立0。active assignment 456件中257件はinactive employeeを参照する。

## Temporary fallback

- email fallback: 2026-12-31までを提案期限とし、正規化後一意、active、login enabled、監査、step-up PINを全て要求する。期限はCTO決定。
- PIN: employee identityの単独恒久証明にしない。移行中のHUB fallback/step-upに限定。
- emailなし社員: 管理者が対面確認してFirebase accountをlinkするか、terminal principalを使う。氏名一致は禁止。
- unresolved/duplicate/collision: 401/403で停止し、最初の一致を採用しない。

## Principal separation

- employee principal: employee UUID + Firebase UID。
- terminal principal: terminal UUID + assigned store。employee UUIDを偽装しない。
- service principal: workload ID + app ID + allowed system action。
- emergency account: 個人に紐づく期限付きbreak-glass。理由、二者承認、全操作監査。

## Lifecycle

異動/兼務はeffective-dated assignment、FCはcorporation/store scope、再入社は同一人物確認後にlink履歴を保持する。Firebase変更は旧UID revoke→二者承認→新UID link。退職・login disableは即時session revoke。identity link操作は `identity_link_admin` のみで、before/after digest、対象、承認者、理由、request/correlation IDを監査する。
