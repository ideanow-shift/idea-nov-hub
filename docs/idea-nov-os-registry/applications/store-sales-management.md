# 店舗営業管理

- 目的/利用者: 店長・営業部・エリアMgrの店舗実績、予算、施策管理。
- 判定: **Redesign / 48% / 本番有無未確認**
- URL/repo: 営業部Web/management app内に分散候補。独立repo未確認。
- 技術/認証/DB: CSV/JS/Supabase候補; HUB role。
- Core/Table: stores/employees、sales/budget/menu/customer/repeat。
- 依存: Core、法人経営、営業部Web。経営指標が依存。
- 完成: management側に店舗CSV intake/summary実装。
- 未完成: POS正本、日次/月次締め、営業アクションworkflow。
- 負債: 法人経営・営業部Web・キャンペーンとの境界重複。
- セキュリティ: 他店舗閲覧、売上export。
- 推奨: boundary再設計。既存adapterは維持。
- 根拠: `portal/management-app/store-*.js`, `docs/rebuild_architecture/06_store_sales_rebuild_scope.md`
- 最終確認: POS/会計連携、実利用画面。

