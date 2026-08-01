# Integration Test

## Automated gates

- EnvironmentごとのAdapter選択
- Production approval未設定時fail closed
- Production HTTPS必須
- Production Synthetic拒否
- GET/no body/no-store
- Role/Scope claimをrequestへ含めない
- Dashboard endpoint
- Store Detail endpoint
- HUB Sessionなしは401
- malformed responseはvalidation error
- 未確定利益null
- 0円利益の誤表示拒否
- sales_managerへのFC混入拒否
- 既存Store Sales regression

## Final source reconciliation

本接続時に総売上、営業利益、営業利益率、客数、新規、既存、単価、技術単価、店販、MID、EC、予算比、前年比、6/12か月、20店舗件数を正式Sourceと一致/不一致で記録する。実金額をテストログへ出さない。

## Sprint 5 result

- Store Operations対象: 244 / 244 PASS
- 全Node対象: 489 tests、474 PASS、既知15 Fail
- Sprint 5起因の新規Fail: 0
- Deno Edge type check: PASS
- Console Error / Warning: 0 / 0
