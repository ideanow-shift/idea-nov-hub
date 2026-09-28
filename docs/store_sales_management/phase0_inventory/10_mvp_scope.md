# 推奨MVP Scope

## In scope

月次・read-mostlyを基本とする。

1. 店舗別の総売上、技術売上、店販売上
2. 客数と客単価
3. 月次予算、予算差、達成率
4. 前年同月、前年差、前年比
5. スタッフ別売上
6. 店舗ランキング
7. 店長コメント
8. 営業部の全店舗一覧
9. データsource/締め/訂正/鮮度表示
10. 以下を別KPIとして表示
   - 技術売上 ÷ 稼働人数
   - 総売上 ÷ 稼働人数
   - 純売上 ÷ 確定労働時間
   - 純売上 ÷ FTE

主KPIは経営Decision Itemであり、Phase 0では確定しない。

## Out of scope

- AI分析と将来予測
- 日次リアルタイム速報
- 顧客個人情報と詳細CRM
- 高度な新規/リピートcohort
- メニュー詳細分析
- 自動改善指示
- 会計仕訳・決算機能
- NOV HUB/IDEA LINK改修

## MVP acceptance

- 同一sourceを再取込して二重計上しない。
- 締め後訂正を履歴とともに再現できる。
- 店舗、法人、staffがcanonical IDへ解決される。
- 4種の生産性を混同しない。
- 店長は自店舗、area managerは担当店、営業部/経営者は承認scopeのみ見える。
- missing、pending、closed、correctedを区別する。
- 月次合計がsourceおよび財務照合値と説明可能である。
