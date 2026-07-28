# シフト管理

- 目的/利用者: 希望休、勤務予定、作成、確定、勤怠への引渡し。
- 判定: **Active Development / 72% / 本番運用あり候補**
- URL/repo: `https://ideanow-shift.github.io/shift/shift_demo.html`; `ideanow-shift/shift`候補、未接続。
- 技術/認証/DB: static/GAS/Supabase RPC候補; HUB/PIN認証混在。
- Core/Table: employee/store、shift draft/confirmed/source（live正式名未確認）。
- 依存: Core Master、Attendance。勤怠実績が確定シフトへ依存。
- 完成: UI、status transition、confirmed source、RLS設計、v46検証資料。
- 未完成: legacy draft再保存、publish gate、sandbox/live差。
- セキュリティ: browser role、source RPC、他店舗scope。
- 推奨: 継続改善、勤怠境界固定。
- 根拠: `portal/js/apps.js`, ワークスペース `attendance-shift-*`, `shift-attendance-record-location-incident-20260712.md`
- 最終確認: remote、live schema、production commit。

