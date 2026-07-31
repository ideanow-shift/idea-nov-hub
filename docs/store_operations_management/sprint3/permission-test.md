# Sprint 3 Permission Test

確認対象:

- representative: 全店・直営・FC
- sales_manager: 直営のみ
- area_manager: 担当店舗のみ
- store_manager: 自店舗のみ
- 存在しないRole、Store ID、scope改ざん
- unauthorized / forbidden / emptyの分離
- invalid projection、productionでのMock Identity拒否

結果: Store Operations対象テストはPASS。Permission Model、JWT、RLS、UUIDは未変更。
