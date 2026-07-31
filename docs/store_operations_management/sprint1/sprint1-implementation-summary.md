# Sprint 1 Implementation Summary

Store Operations Management V1 Sprint 1を、既存Store Sales Phase 5 UIの置換拡張として実装した。UIはStore Sales Runtimeだけを利用し、Core DB、Supabase、JWT、RLS、Production/Stagingには接続しない。

実装範囲:
- 全店の状況、優先して確認すること、業績を動かした要因、店舗一覧
- 店舗詳細4タブ（サマリー、売上・利益、顧客・リピート、価値・生産性）
- 代表取締役、営業部長、エリアマネージャー、店長のMock Role/Scope
- 20店舗の正式名称と実UUIDとは異なる`mock-store-*`識別子
- 状態フィルター、5種の並び替え、詳細遷移時の一覧状態・スクロール保持
- Desktop/Tablet/Mobileレイアウト、モバイルカードとKPIアコーディオン
- 開発時だけ表示するMock controls

既存再利用: `portal/css/design-system.css`、Store Sales Runtime/Adapter、Runtime error mapping、NOV HUB同一タブ導線、Node標準テスト。
