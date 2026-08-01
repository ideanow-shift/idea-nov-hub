# ADR-002: UUID Governance

## Status

Proposed。

## Decision

店舗、法人、部署、社員のUUIDはentityの永久識別子であり、一度発行・参照された値を変更、再生成、再利用しない。名称、所属、運営主体、状態の変更はUUID変更理由にならない。

## Rules by entity

|Entity|Canonical UUID|生成主体|更新|履歴|
|---|---|---|---|---|
|Store|承認済Store Masterの`store_uuid`|Core Master write serviceのみ|不可|identityは固定、運営・名称変更は履歴へ|
|Corporation / legal entity|承認済Corporation Masterの`corporation_uuid`|Core Master write serviceのみ|不可|名称・状態・法人関係を履歴化|
|Department|承認済Department Masterの`department_uuid`|Core Master write serviceのみ|不可|改組・所属期間を履歴化。実質別組織なら新entityを人間承認|
|Employee|承認済Employee Masterの`employee_uuid`|Core Master write serviceのみ|不可|雇用・所属・roleは履歴化。再雇用時の同一人物判定は人間承認|

UUID生成はDB defaultまたは標準UUID libraryを用いるが、browser、fixture、Spreadsheet、会計import、名称matching処理はProduction UUIDを発行できない。生成は承認済みCreate commandのtransaction内で一度だけ行い、actor・request・approvalを監査する。

## Prohibitions

- UUIDの手入力、推測、名称からの決定的生成
- delete後のUUID再利用
- environment間で別entityに同じUUIDを割り当てること
- source UUIDを検証せずcanonical UUIDへコピーすること
- FK不整合を直すためのUUID上書き
- `public`と`core`間の自動merge
- 会計・Projection・Runtime・UIでのUUID生成
- UUIDだけを画面表示用store codeとして使うこと

## Tokorozawa mismatch

`public.stores`の所沢店UUIDをcanonicalとして保持する。`core.stores`の異なるUUIDも再生成・上書き・削除しない。将来の承認済migrationで次を行う方針とする。

1. 両行が同一実店舗であることをCore Master OwnerとSales Ownerが証跡付きで承認する。
2. `legacy_system + legacy_uuid -> canonical_uuid`のimmutable crosswalkを作る。
3. 全FK consumerを棚卸しし、canonical UUIDへの参照切替をversion付きで行う。
4. crosswalkと旧UUIDを監査・照会用に永久保持する。
5. 重複検知を追加し、同じstore code/source keyに新UUIDを発行させない。

このADRはcrosswalkやデータ変更を実行しない。

## Environment rule

Production UUIDをstaging fixtureへ実データとして複製しない。integration testでidentity互換性が必要な場合は、明示されたsynthetic UUID namespaceとfixture markerを使用する。
