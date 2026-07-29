# Phase 5-5B Staging Session

## Boundary

canonical NOV HUB sessionの`sessionToken/audience/expiresAt`を維持し、Bearer headerだけで送る。URL・consoleへtokenを出さない。

Staging verifier interfaceはissuer、audience、expiry、signature、employee IDを検証後、role/scopeをserver-side解決する。直接URL、logout、revocation候補、401/403/session expiredを対象とする。

## Synthetic Fixture

`stg-synthetic:<role>:<expiry>:synthetic-signature`はlocalhost Staging専用、15分expiry、synthetic marker付き。Productionではenvironment resolverがfixtureを拒否する。これは正式token形式ではない。

## Role Precedence

representative/director/executiveはall_group、department managerは担当範囲、store managerはown store、FC ownerはown FC legal entity、employeeはdeny。兼任時のexecutive優先は正式Directory resolver実装時の必須test。

## Remaining

正式issuer/audience/signature key、revocation、Directory assignment、CORS/origin、logout E2E。
