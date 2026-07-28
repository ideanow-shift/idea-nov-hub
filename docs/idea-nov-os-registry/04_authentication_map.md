# Authentication Map

| system group | observed auth | status | concern |
| --- | --- | --- | --- |
| NOV HUB | Firebase Google + email/PIN、Edge session | Production | UID/email/PINの一意解決 |
| Master Admin | HUB session + elevated roles | Stable | platform adminと業務データ閲覧の分離 |
| IDEA LINK | HUB context/handoff + Core roles | Production | 旧GAS/PIN導線との併存 |
| Talent | shared HUB session候補、API auth module | Development | write APIのactor/scopeライブ検証 |
| Management | HUB context/静的frontend候補 | Development | CSV/import/法人scope |
| Expense | HUB通知連携、独自公開URL | Stable | 独自sessionとHUB identityの対応 |
| Attendance/Shift | PIN/query token/独自方式の資料あり | Mixed | URL token、店舗共有資格情報 |
| Education/legacy GAS | GAS/旧URLの可能性 | Legacy/Mixed | Google sessionとCore roleの不一致 |
| Unknown cards | 未確認 | Unknown | deny by default |

## 標準

Firebase ID token → Edgeで署名/issuer/audience/expiry検証 → UIDをemployeeへ一意解決 → active状態 → role × scope × action → DB/RPC → audit。

## service role注意

- `nov-hub-api`、Talent、Concierge、LINE WORKS通知などEdge Functionはservice roleを使う可能性がある。
- service roleの存在自体は問題ではないが、request bodyのemployee/store/corporation IDをそのまま信用するとRLSを迂回する。
- ライブSecret値、RLS、GRANT、SECURITY DEFINER `search_path`、CORS allowlistは今回未確認。
- 静的配信物へのservice role混入はrepository scanと公開asset scanを継続すべき。

