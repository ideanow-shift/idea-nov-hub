# 現職者管理

- 目的/利用者: 現職社員のprofile、所属、手続、履歴。本人/人事/管理者。
- 判定: **Redesign / 45% / 一部運用の可能性**
- URL/repo: 独立実体未確認。HUB master、Talent workforce、HR設計に分散。
- 技術/認証/DB: Supabase/HUB/Talent候補。
- Core/Table: employees、employee_store_assignments、employment dates、HR private profile。
- 依存: Core Master、Talent、Attendance、Expense。
- 完成: Core employee ledger/HR access/policy資料、Talent手続実装。
- 未完成: single writer、本人申請、人事承認、退職/異動handoff。
- 負債/セキュリティ: PII表の分散、email/UID、過剰な人事閲覧。
- 推奨: domain boundary再設計。Core Masterを置換しない。
- 根拠: `docs/core-employee-ledger-v1-review.md`, `docs/HUB人事労務管理_分離設計.md`, `supabase/core-*`
- 最終確認: 現行人事運用、独立repo/URL、データowner。

