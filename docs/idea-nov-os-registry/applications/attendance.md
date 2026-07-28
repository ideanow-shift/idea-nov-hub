# 勤怠管理

- 目的/利用者: 店舗スタッフの打刻、実績確認、管理者集計。
- 判定: **Stable / 80% / 本番運用あり候補**
- URL/repo: HUB DBカード/別repoとも未一意確認。ワークスペースにDashboard/GAS/多数運用証跡。
- 技術/認証/DB: GAS/HTML/JS + Supabase連携候補; PIN/query token/HUB handoffが混在。
- Core/Table: employee/store、attendance records（正式table未確認）。
- 依存: Core Master、Shift。店舗運用が強く依存。
- 完成: 打刻/管理画面、go-live gate、logout/PIN hardening資料。
- 未完成/不具合: URL query token、source正本、shift record location incident。
- セキュリティ: 店舗共有PIN、token URL露出、hash pepper、service role。
- 推奨: 維持改善。repo/deploy正本を確立。
- 根拠: ワークスペース `attendance-*`, `Dashboard.html`, `docs/rebuild_architecture/01_existing_system_map.md`
- 最終確認: GitHub repo、live URL、DB schema、利用店舗、障害件数。

