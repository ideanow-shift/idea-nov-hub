# Current Authentication Inventory

Unknownは推測で補完しない。`Live verified` はPhase 3 Edge source/DBカタログ確認済み。

| system | entry point | auth method | session / actor | role / scope | service role | legacy | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Supabase Core Platform | API/Edge | secret/service key、DB role | service principal | API依存 | Yes | anon grants | Live verified |
| Core Master管理 | HUB | HUB session/PIN候補 | employee UUID | elevated role | nov-hub-api | PIN | Conditional |
| Firebase Auth | NOV HUB | Google/Firebase ID token | Firebase UID | Coreで解決 | No | email fallback | Production |
| Notification Engine | internal | server-to-server | service principal | system_internal | Yes | shared trigger | Conditional |
| NOV HUB | official entry | Firebase + email/PIN | Firebase/HUB session | Core roles/scopes | Yes | PIN | Production |
| NOV Navi | HUB | HUB context/session | employee候補 | role表示 | Edge候補 | URL context | Conditional |
| IDEA LINK | HUB | HUB handoff/context | Core employee | role/store | nov-hub-api | 旧GAS/PIN | Conditional |
| 1on1 MTG | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| 法人経営管理 | HUB候補 | HUB context候補 | Unknown | corporation未確定 | Unknown | static | Blocked |
| 店舗営業管理 | HUB必須予定 | 未実装 | 未実装 | 未実装 | 未実装 | 重複旧画面 | Blocked |
| Management Platform | HUB | HUB context候補 | employee/store | manager候補 | Edge候補 | static | Migration Required |
| 環境整備 | HUB | Managementと同系 | employee/store | manager候補 | Edge候補 | 重複名称 | Migration Required |
| Task Manager | server/HUB候補 | shared API token | user actorなし | scopeなし | Yes | shared token | Migration Required |
| Decision Hub | HUB | 署名session/actor resolver | server actor | action/scope guard | Yes | auth transport差 | Conditional |
| 現職者管理 | HUB予定 | 未確定 | employee | self/HR | Edge候補 | preview | Blocked |
| 人財投資管理 | HUB候補 | Unknown | Unknown | employee/store | Unknown | Unknown | Unknown |
| NOV Talent | HUB | 署名済みHUB session | session employee | governance module | Yes | v1/v2差 | Conditional |
| 勤怠管理 | HUB/GAS候補 | PIN/query token/独自 | employee/terminal混在 | store候補 | 候補 | GAS/query token | Migration Required |
| Shift | HUB/旧導線 | 署名HUB session + PIN資料 | token sub | active/login/role/store/assignment | Yes | PIN/GAS | Conditional |
| Expense Hub | 独自URL/HUB card | Supabase user/Firebase UID候補 | UID→employee | claim/approval | Yes | 独自URL/session | Migration Required |
| 経理サポート | Unknown | Unknown | Unknown | finance | Unknown | 別checkout | Unknown |
| Education | HUB/旧GAS | GAS/Google session候補 | Unknown | employee/store未確定 | Edge候補 | GAS | Migration Required |
| 営業部Web | HUB card | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| 営業教育DB | HUB card | Unknown/GAS候補 | Unknown | Unknown | Unknown | GAS候補 | Unknown |
| Campaign | HUB card | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| EC・商品管理 | HUB card | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| 棚卸し | HUB card | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| Concierge | HUB/店舗login | 店舗共有ID/password→独自session | terminal/store | store一致、一部admin | Yes | shared credential | Legacy Exception |
| Instagram自動投稿 | Unknown | Unknown/external OAuth候補 | service候補 | Unknown | Unknown | Unknown | Unknown |
| LINE WORKS | internal | platform JWT/trigger secret | service principal | notification/entity | Yes | trigger secret | Conditional |
| NOVA Design System | library | 認証対象外 | none | none | No | none | N/A |

分類: Firebase ID token、署名HUB session、PIN、店舗共有資格情報、query token、shared API token、GAS/Google session、独自session、server principal、Unknownが併存する。新規アプリ独自loginは禁止する。
