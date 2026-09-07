# 10. Application Conformance Matrix

凡例: `C` 概ね準拠、`P` 部分準拠、`N` 非準拠、`U` 未確認、`—` 非該当。判定は資料・コード・Phase 3ライブ読取の範囲であり、実環境negative test前の暫定値。

| app | HUB entry | token verification | UID resolution | active check | role | scope | action | service role boundary | audit | migration class | decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| NOV HUB | C | P | P | P | P | P | P | P | U | wrap | Conditional |
| IDEA LINK | P | P | U | U | P | P | U | U | U | wrap | Conditional |
| Expense Hub | N | P | P | P | P | P | P | P | U | migrate | Migration Required |
| 勤怠 | N | P | P | P | P | P | P | U | U | migrate | Migration Required |
| Shift | C | C | C | C | C | C | C | P | P | maintain | Conformant |
| NOV Talent | P | U | U | U | U | U | U | U | U | unknown | Unknown |
| NOV Navi | P | U | U | U | U | U | U | U | U | unknown | Unknown |
| Management Platform | P | P | U | U | P | P | U | U | U | migrate | Conditional |
| 環境整備 | U | U | U | U | U | U | U | U | U | unknown | Unknown |
| 法人経営管理 | U | U | U | U | U | U | U | U | U | unknown | Unknown |
| 店舗営業管理 | — | — | — | — | — | — | — | — | — | new | Blocked |
| 現職者管理 | U | U | U | U | U | U | U | U | U | unknown | Unknown |
| Decision Hub | P | U | U | U | U | U | U | U | U | unknown | Unknown |
| Task Manager | N | N | N | N | N | N | N | N | U | retire | Blocked |
| Concierge | N | P | P | P | P | P | P | U | U | migrate | Migration Required |
| Education | N | P | U | U | U | U | U | U | U | unknown | Unknown |
| LINE WORKS | — | P | — | — | P | P | P | P | U | wrap | Conditional |
| Notification Engine | — | P | — | — | P | P | P | P | U | wrap | Conditional |

## 適合必須条件

`C`には、(1) tokenの署名・issuer・audience・期限確認、(2)一意なIdentity Resolution、(3)server-side actor確定、(4)role×scope×actionのdefault deny、(5)service/terminal/user principal分離、(6)許可・拒否監査、(7)negative test合格が全て必要。

## 優先順位

1. `N`: タスク管理の共有token、勤怠とConciergeの共有/端末認証を利用者本人認証と混同する経路。
2. `P`: HUB/IDEA LINK/Managementのhandoff標準化、Expenseの入口統合。
3. `U`: 高感度または経営判断を扱うアプリから、実装・秘密管理・scope・監査を調査する。

未確認を準拠とみなさない。各アプリownerが証跡URL、検証日、環境、policy versionを追記して初めてGateを更新する。
