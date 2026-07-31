# ADR-004: Store Identity

## Status

Proposed。

## Decision

UUID、業務コード、番号、名称、外部source keyは役割を混在させない。canonical relationと履歴relationを合わせて次の契約を満たす。

|Field|Role|必須|一意制約|更新可否|
|---|---|---:|---|---|
|`official_name`|契約・登記・正式運用上の名称|Yes|No|承認付き履歴追加。直接上書き不可|
|`display_name`|UIで利用する短い名称|Yes|No|承認付き履歴追加可|
|`brand_name`|ブランド表記（例 BASSA）|No|No|承認付き履歴追加可|
|`search_alias`|旧名、かな、検索同義語|No|同一store内で重複禁止|追加・無効化可。履歴削除不可|
|`store_code`|OS内部の人間可読・安定code|Yes|全Store MasterでUNIQUE、case-normalized|原則不可。例外はalias/crosswalkを残す|
|`store_no`|業務表示・並び・帳票番号|Yes|有効期間内UNIQUE|承認付き変更可。履歴必須|
|`legacy_code`|旧システムの旧code|No|`source_system + legacy_code + period`で一意|不可。誤登録はsupersede|
|`source_key`|source system固有identity|source mappingにはYes|`source_system + source_key + period`で一意|不可。mapping先変更は承認付きversion|

## Additional rules

- `store_uuid`だけが不変の技術identityであり、全FKはこれを参照する。
- `store_code`はURLやログで利用できるが、認可scopeの根拠にしない。
- `store_no`は数値型に限定せず、先頭0を保持できる文字列とする。
- `official_name`と`display_name`の同値は許容するが、意味は統合しない。
- alias一致だけで自動mappingしない。Entity Approval Boardの人間承認を必要とする。
- 大文字小文字、全半角、空白の正規化ルールはversion化し、source原文を保持する。
- 名前変更やブランド変更で新store UUIDを作らない。

## Current mapping

現行`public.stores.store_id`は`store_code`候補、`store_no`は同名の役割、`store_name`は暫定的にofficial/display両方のsourceとなる。役割分離が完了するまで推測値をProduction表示へ昇格させない。
