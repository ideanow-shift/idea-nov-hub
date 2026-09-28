# 06 MVP Go / No-Go

## 判定

**店舗営業管理MVP: No-Go（実装開始不可）**

設計探索、fixture準備、Decision会議は進められるが、新Webアプリ、DB変更、本番write/deployは開始しない。

## Gate評価

| Gate | 結果 | 根拠 |
| --- | --- | --- |
| ライブ権限把握 | Pass | RLS/Policy/GRANT/Definer/Storageを取得 |
| service role境界 | Fail | RLS迂回、広いGRANT、API実装差、DB二重防御なし |
| Identity一意性 | Partial | UID/email重複0、孤立FK 0 |
| Identity充足 | Fail | UID NULL 769、active UIDなし184、active email系なし104 |
| Core Master候補 | Conditional | public 3表が実データ正本候補。NULL/scope残存あり |
| 売上Business Contract | Fail | source、税、調整、close、営業日未承認 |
| KPI Contract | Fail | 4KPIの分母/主表示が未決定 |
| role/scope/action | Fail | 店舗営業用承認行列とnegative test未完成 |
| 検証環境 | Fail | production非書込sandbox/fixture証跡なし |
| rollback | Fail | owner未指名、rehearsalなし |

## Core Master承認可否

- **物理正本候補としては承認準備可**: public.employees/stores/corporationsは775/22/6件、業務ID重複0、主要FK孤立0。
- **無条件Acceptedは不可**: active 184人のUID欠損、104人のemail系欠損、300人のcorporation NULL、329人のprimary store NULL、inactive employeeを参照するactive assignment 257件がある。
- core同名表は1/1/1件で、core corporationはpublic対応なし。非正本・将来候補の方針を維持する。

## 残Blocker

1. service role/APIごとの最小権限、actor/store scope、DB側再検証。
2. anonymous EXECUTEのSECURITY DEFINER 30件、特にdev/link更新関数の別Security対応。
3. active employeeのidentity link移行計画。
4. inactive employeeに残るactive assignmentの業務意味とscope除外。
5. 売上原本、税、値引、取消、返品、訂正、締め、営業日。
6. Core Read Adapterとimmutable Snapshot contract。
7. 店舗営業role/scope/actionとnegative tests。
8. sandbox、synthetic fixture、rollback owner/rehearsal。
9. 4生産性KPIの正式分母と主表示の経営判断。
10. 実token `sub` とhandoff employee ID不一致の計測。

## 再Gate条件

SS-01〜14とKPI-02〜07を承認し、sandboxで他店舗ID・偽actor・inactive/retired・期限切れtoken・close後write・Storage path差替えを100%拒否する。Core baseline差分0、snapshot再計算digest一致、rollback rehearsal完了後に再判定する。

