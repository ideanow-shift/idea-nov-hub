# Sprint 2 Integration Inventory

## Phase 2A判定

PASS。基準は未mergeの `feature/store-operations-v1-sprint1` HEAD `47938c5`。Sprint 2はこのHEADから派生した。

| 対象 | 既存資産 | 判定 |
|---|---|---|
| Runtime | `portal/store-sales/runtime/` | 再利用 |
| Runtime Adapter | mock / Projection adapter | 再利用 |
| Store API | `GET /v1/store-sales/dashboard`、`GET /v1/store-sales/stores/:id` | 再利用 |
| Contract | `store-sales-projection-v1` | 維持 |
| Accounting | `accounting_core/`、published version境界 | 変更なし |
| KPI | `accounting_kpi/`、active definition set境界 | 変更なし |
| Staging Foundation | `supabase/functions/store-sales-projection/` | 再利用 |
| Feature Flag | preview/mock/integration/staging/production | 再利用 |
| Identity/Scope | Synthetic token verifier、server scope resolver | Role整合のみ |

既存Syntheticは15直営・5FC、閉店除外後19店舗、仮名であり、正式20店舗と不一致だった。DBやUUIDを変更せずFixtureだけを13直営・7FCへ整合した。
