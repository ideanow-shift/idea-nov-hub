# Preview Implementation Readiness Report

## 判定

Business Fact接続を除き、Store Operations V1 PreviewをImplementation Readyとする。UIはExecutive Dashboard、Store List、Store Detail、Role別初期画面、Permission-aware Scope、全状態をFixtureで確認できる。

## 完了範囲

- UI／Component: PR #33のComponent、Interaction、Responsive仕様を既存Preview surfaceへ適用
- Permission／Role／Store Scope: Server-resolved Projectionを前提とし、Preview Mock Identityの許可集合だけを表示
- API／Projection Contract: `store-sales-projection-v1.1`、`tax_basis=net`、`sales_net`を正式化
- Business Definition: v1.1 Tax Policy Freezeへ適合
- Apple Design: system font、余白、明確なhierarchy、44px target、focus-visible、reduced motionを維持
- Implementation: Mock Adapter／Fixtureのみ。外部requestなし

## 状態

Loading、Empty、403、503／Offline、集計中、準備中、V1対象外、Validation Error、Maintenance、Preview disclaimerを区別する。未接続時にSyntheticへ自動fallbackするProduction動作は持たない。

## 未実装

Business Fact、Accounting Fact、DB、Supabase、Migration、Production接続。これらはCore Business Data Foundation Phase 1完了後の別承認Taskとする。

## 検証結果

- JavaScript構文: PASS
- Store Operations／Store Sales Node test: 261 PASS、0 Fail
- Store Sales Deno test: 4 PASS、0 Fail
- `git diff --check`: PASS
- 禁止path変更: 0件（`supabase/**`、migration、Runtime接続変更なし）
- ブラウザ: Executive Dashboard、Store List、Store Detail、403、503／Offlineを確認
- Responsive: 1366×768、1024×768、768×1024、390×844、320×568を確認。page横overflowなし、1024px未満でcard表示
- Console Error／Warning: 0件
- Preview: 税抜サンプル、非実績、Business Fact／Accounting Fact／Production未接続を明示
