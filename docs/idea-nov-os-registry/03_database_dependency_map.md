# Database Dependency Map

| domain | canonical candidate | consumers | duplication / concern |
| --- | --- | --- | --- |
| Staff | `public.employees` | HUB, Auth mapping, Talent, Expense, Attendance | `core.employees`、アプリ独自社員表、email fallback |
| Store | `public.stores` | HUB, Attendance, Shift, Sales, Finance | `core.stores`、店舗code/name複製 |
| Corporation | `public.corporations` | Management, Finance, HR | `core.corporations`、法人名文字列 |
| Role | `public.roles`, `public.employee_roles` | HUB, IDEA LINK, apps | role名のfrontend判定、scope不足 |
| Assignment | `public.employee_store_assignments`候補 | HR, Attendance, Talent | current store列との二重管理 |
| Portal catalog | `public.portal_apps` | HUB, NOV Navi | static `apps.js/json`、旧GAS URL |
| Login | `public.employee_login_credentials` | HUB PIN | Firebase UID/emailとの複合解決 |
| Notifications | `os.notifications`, `os.nov_hub_notification_inbox` | HUB, Expense, IDEA LINK | delivery state、再送、destination責任 |
| LINE WORKS | `os.notification_destinations` | HUB/notification function | Secret、宛先更新責任 |
| Talent | `nov_talent_*` migrations/tables | Talent UI/APIs | 現職者・人財投資との境界 |
| Task | task manager API tables（ライブ名未確認） | Task Manager | Decision Hubとの重複 |
| Management | financial/classification datasets | Management UI | CSV・会計・店舗実績の正本分散 |

## Core Master独自複製の疑い

- `public` と `core` のemployees/stores/corporationsが併存。監査時にpublicは775/22/6件、coreは各1件。
- 勤怠・シフト・旧GAS/Sheets・教育・営業系は社員名/店舗名/codeを独自保持している可能性が高いが、ライブ確認未実施。
- frontend configやCSVに名称を持つこと自体はcache/referenceとして許容できるが、更新可能な正本として扱う場合は要是正。

## 更新責任の推奨

Core MasterはHUBマスタ管理のみを通常writerとし、各アプリはCore ID参照。財務・勤怠・採用等の業務事実は各domain ownerがwriterとなり、Coreへ逆書込みせず承認済みhandoff APIを使う。

