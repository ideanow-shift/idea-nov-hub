# Authorization Contract Status

## Status

PR #33はUIのAuthorization境界をFreezeするが、Production Authorization実装の完了を宣言しない。UIはServerが認可済みとして返したRole、Data Scope、Store Scopeだけを使用し、browserのRole、URL、Filter、店舗IDから権限を拡張しない。

## Frozen UI contract

| 利用者 | Store Scope | 初期表示 |
| --- | --- | --- |
| 代表取締役・副社長 | 全20店舗 | 全店Dashboard |
| 営業部長 | 直営13店舗 | 直営Dashboard |
| エリアマネージャー | 有効な担当店舗のみ | 担当店舗Dashboard |
| 店長 | 有効な自店舗のみ | 自店舗詳細 |
| 一般社員 | なし | HUBカード非表示、直接URLは403 |

AM、店長、primary／secondary／兼任店舗のStore Scope正本は、有効期間を満たす`employee_store_assignments`だけとする。assignment未解決、期限切れ、scope外Store IDはdeny-by-defaultとし、Emptyとは区別する。

## External dependencies and release gates

| 項目 | 現在の状態 | UI契約上の扱い | Release前必須Gate |
| --- | --- | --- | --- |
| Application Permission Key | Core Business Data Foundation／Permission Modelの正式Key未発行 | 仮Keyを定義せず、Serverのallow/deny結果だけを消費 | 正式Key、owner、監査証跡の承認 |
| Permission Bundle | Production有効Bundle名と付与証跡が未確定 | 仮Bundleを作らず、Preview aliasをProduction認可に使わない | Bundle名、構成Key、対象actor、付与証跡の承認 |
| 営業部長canonical relation | UI表示は営業部長、Preview aliasは`sales_manager`。Server側relationは外部依存 | V1 Scopeは直営13店舗に固定。`executive`への代替mappingや表示名からの推測は禁止 | canonical Role／department relationとresolver negative testの承認 |
| `employee_store_assignments` Production制約 | Store Scopeの論理正本として確定、Production catalog／期間制約証跡は外部依存 | 有効assignmentのみ。未解決は403 | relation ownership、期間制約、重複・失効・兼任testの承認 |

したがって、UI Contract Freezeは完了、Production Authorization Freezeは未完了であり実装保留とする。上記Gateが完了するまでProduction Releaseは不可である。
