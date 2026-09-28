# FTE and Productivity Inventory

| UI項目 | technical_key | 必要原本 | 現在の取得元 | 判定 | 加工方法 | 更新頻度 | 信頼度 | 未確定事項 |
|---|---|---|---|---|---|---|---|---|
| 在籍社員数 | resident_headcount | Core employee/assignment | employeesとmonthly workforce CSV contract | Available | as-of在籍ruleでCOUNT DISTINCT | 月次 | Medium | NULL corporation/storeとinactive assignment品質 |
| 月平均社員数 | average_monthly_headcount | 入退社日＋配属期間 | joined_on/retired_on/assignment history | Derivable | 各営業日の在籍人数平均 | 月次 | Medium-Low | 休職・応援・月中異動の扱い |
| 勤務時間 | actual_labor_hours | 勤怠原本 | 店舗営業用勤怠factなし | Unavailable | 確定勤怠sourceが必要 | 月次 | High | 実労働・休憩・残業 |
| 所定労働時間 | standard_labor_hours | 雇用契約/勤務制度 | 標準時間masterなし | Unavailable | 契約別標準時間が必要 | 月次 | High | 月/人別基準 |
| 時短勤務 | short_time_work | 雇用契約/勤務制度 | 明示fieldを確認できず | Unknown | 契約またはscheduleから判定 | 随時 | Low | 保存先・有効期間 |
| 休職 | leave_period | 社員master | leave_start_date/leave_end_date | Available | 対象月との期間overlap | 随時 | Medium | データ完全性 |
| 月中入社 | mid_month_join | 社員master | joined_on | Available | 対象月内の日付で判定 | 月次 | Medium | 予定日と実入社日の区別 |
| 月中退職 | mid_month_retirement | 社員master | retired_on | Available | 対象月内の日付で判定 | 月次 | Medium | 最終勤務日との区別 |
| 月中異動 | mid_month_transfer | assignment history | employee_assignment_histories effective dates | Derivable | 対象月内のstore変更を抽出 | 月次 | Medium-Low | 履歴完全性 |
| 兼務 | concurrent_assignment | store assignments | employee_store_assignmentsの複数有効row | Derivable | 期間overlapとassignment typeで判定 | 月次 | Medium-Low | 按分rule |
| 応援勤務 | support_assignment | store assignments/勤怠 | support type候補はあるが実勤務時間なし | Derivable | assignment存在までは判定、FTE按分は不可 | 月次 | Low | 実勤務日/時間 |
| FTE | fte | 実労働時間＋標準労働時間 | 双方のcanonical月次dataなし | Unavailable | 実労働時間÷標準労働時間 | 月次 | High | 時短・休職・応援・按分 |
| 総生産性 | total_productivity_fte | 総売上＋FTE | FTE不可 | Unavailable | 税込総売上÷FTE | 月次 | High | FTEとEC按分 |
| 技術生産性 | technical_productivity_fte | 技術売上＋FTE | FTE不可 | Unavailable | 税込技術売上÷FTE | 月次 | High | FTE帰属 |

## FTE conclusion

`FTE = 対象月の確定実労働時間 ÷ 対象月の標準労働時間`の式は採用候補だが、両時間sourceがないため算出不可。

既存Spreadsheetの小数「スタッフ数」は、FTE、月平均人数、在籍日按分、異動按分のいずれでも説明可能だが、原sheet/formulaを確認できないためUnknown。小数だからFTEと推定してはならない。
