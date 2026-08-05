# Store Sales API Adapter

## Endpoints

- GET /v1/store-sales/dashboard?period=YYYY-MM
- GET /v1/store-sales/stores/{storeId}?period=YYYY-MM

## Request

- Authorization: Bearer HUB Session
- Accept: application/json
- X-Contract-Version: store-sales-projection-v1
- X-Request-ID
- bodyなし
- cache: no-store
- credentials: omit

RoleやScopeをUI入力として送らない。Store detail IDは許可文字だけを受け付け、server側でactor scopeへ再照合する。

401、403、404、408、409、422、500、503をRuntime stateへmappingする。timeout/abortを備え、responseはProjection Contract検証後だけUIへ返す。
