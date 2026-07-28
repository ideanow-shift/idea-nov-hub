# Supabase Core Platform

- 目的/利用者: IDEA NOV OSのCore DB、RPC、Storage、Edge基盤。全アプリ。
- 判定: **Production / 82% / 本番運用あり**
- URL/repo: project ref `nkmxevmioczcmnldreyo`（README記載）/ HUB repo。
- 技術/認証/DB: Supabase Postgres/Edge/Storage; Firebase tokenをEdgeで検証する構成。
- Core/Table: public employees/stores/corporations/roles/employee_rolesを現行物理正本候補。
- 連携: Firebase、GitHub Pages、LINE WORKS、各Webアプリ。
- 更新責任: Core DB owner（氏名未確認）。
- 完成: HUB通常運用、migrations、複数Edge Function。
- 未完成: `public`対`core`正本ADR、live RLS/GRANT総監査。
- 負債/セキュリティ: service role、SECURITY DEFINER、CORS、複数ID体系。
- 推奨: 維持・hardening。置換しない。
- 根拠: `supabase/`, `docs/core_platform_definition/`, `README.md`
- 最終確認: live catalog、backup/DR、Secret rotation、cost/SLA。

