# ADR-005: RLS Governance

## Status

Proposed。現行role名称との最終照合はHuman Decision。

## Decision

Core MasterはRLS enabled、default deny、最小権限とする。browserはtableへ直接アクセスせず、serverが認証済みactor、正式role、assignment、effective periodからscopeを解決する。request body、query、NOV HUB context、UI表示だけを認可根拠にしない。

## Role policy

`R`はscope内read、`N`はdeny、`C`は承認済みCore Master command経由のみ。全roleでtableへの直接writeは`N`。

|Role|Store Master read|Store Sales/会計read|Master command|Scope|
|---|---:|---:|---:|---|
|Representative|R|R|C（最終承認権限を別途付与した場合）|all group|
|Executive|R|R|C（Master Steward兼務時のみ）|承認済all groupまたはassigned departments|
|Department|R|R|N|assigned departments/stores|
|Store Manager|R|R（許可指標のみ）|N|own store|
|FC Owner|R|R（許可指標のみ）|N|own FC legal entity|
|Employee|必要最小限のdirectory表示のみ、Store SalesはN|N|N|self/assigned storeの公開属性のみ|

通常業務roleとMaster Steward権限を分離する。RepresentativeやExecutiveであることだけでは直接更新できない。更新commandはCore Master Steward、必要な業務owner、Security/Platformの承認を満たす。

## Data classes

- Public directory attributes: display name、store code、営業状態など承認済み最小集合。
- Restricted master attributes: legal entity、effective period、identity crosswalk、監査情報。
- Financial projection: Accounting/Store Sales側のpolicyに従い、Store Master RLSから独立して制御。
- Sensitive data:社員個人情報、token、会計raw、秘密情報。Store Master responseへ混在させない。

## Enforcement

- `anon`はdeny。
- `authenticated`への広域table grantを避け、version付きaccess function/viewまたはbackend principalに限定。
- service roleをbrowser、Runtime、fixture、ログへ渡さない。
- backend principalも用途別に分離し、任意SQLではなく許可されたcontractだけを実行。
- policyはactive assignmentとeffective periodを検証する。
- cross-store、cross-department、cross-FC、inactive actor、expired sessionをnegative testする。
- read/write deny、policy変更、Master commandを監査する。秘密・金額は監査ログへ記録しない。
- policy 0件の現行`public.stores`は「安全承認済み」とみなさず、API経路とpolicyの設計・検証完了までProduction gateを閉じる。

## Constitution alignment

現行文書で確認できる「server-side認可」「UI非表示は認可ではない」「service roleをfrontendへ置かない」「role/scope自己申告を信用しない」に従う。正式Constitution本文との条項番号照合は承認前gateとする。
