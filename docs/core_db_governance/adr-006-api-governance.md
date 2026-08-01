# ADR-006: API Governance

## Status

Proposed。

## Decision

Store Salesのdata pathを次に固定する。

```text
Store Sales UI
  -> Store Sales Runtime
  -> Store Sales API / Projection API
  -> Core Master Access Port
  -> versioned DB contract
  -> canonical Core DB relations
```

UIの唯一の入口はRuntime、Runtimeの唯一の業務データ入口はStore Sales APIである。Store Sales APIも`public.*`や`core.*`のtableへad hoc SQLで直接依存せず、Core Master Ownerが管理するversion付きAccess Portを介する。

## Responsibilities

|Layer|責務|禁止|
|---|---|---|
|UI|Runtime snapshotの表示、操作通知、accessibility|API/DB/Accounting/KPIの直接呼出し、状態・scope判定|
|Runtime|adapter、state、feature flag、error、loading/retry/session、projection切替|DB接続、業務rule、actor scopeの自己決定|
|Store Sales API|session検証、actor/scope解決、Accounting/KPI/Store projectionの組立、contract validation、監査|browser申告scopeの信用、物理table名の公開、任意DB query|
|Core Master Access Port|canonical store/corporation/department解決、effective-date query、最小属性返却|会計/KPI計算、UI専用整形|
|Versioned DB contract|承認済みread model/function、RLS、安定した型と意味|consumer固有ロジック、無version破壊変更|
|Core DB relation|identity・history・constraint・auditの永続化|UI/Runtimeへの直接公開|

## Contract rules

- Access Portは例として`get_store_identity_v1`、`list_stores_for_scope_v1`、`resolve_store_operation_v1(as_of)`のようなversion付き契約を提供する。
- responseは必要最小限とし、物理schema名、内部policy、秘密情報を返さない。
- store UUID、contract version、data version、effective date、request IDでlineageを追跡可能にする。
- 一覧はset-based取得としN+1を禁止する。
- Store APIはAccounting Coreのread adapterとStore Master Access Portを組み合わせるが、raw会計tableを参照しない。
- errorはAPIで安全なdomain errorへ変換し、Runtime stateへmappingする。
- cache keyはactor/scope version、period、store UUID、projection/contract versionを含む。初期はprivate/no-store。

## Access isolation

Store API principalにはAccess Port実行権限だけを与え、`public.stores`、`core.stores`、履歴tableへの一般SELECT/WRITEを付与しない。Access Port内部の実装変更はDB contract test、RLS negative test、consumer contract testを通す。

## Compatibility

Store Sales Runtimeの凍結済み責務は変更しない。Core DBの物理移動や履歴追加はAccess Port内で吸収し、Runtime/UI contractへ漏らさない。
