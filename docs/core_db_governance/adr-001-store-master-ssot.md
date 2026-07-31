# ADR-001: Store Master Single Source of Truth

## Status

Proposed — Core Master Owner、Platform Owner、Security Owner、Accounting Owner、Sales Owner、CTOの承認待ち。

## Context

監査では`public.stores`に22件があり、現行店舗20件はEntity Approval BoardおよびGoogle店舗マスター20件と一致した。`core.stores`は所沢店1件のみで、同じstore codeに異なるUUIDを持つ。運営履歴、名称区分、Direct/FC明示列は未整備である。

## Options

|候補|評価|メリット|デメリット|移行コスト|主要リスク|
|---|---|---|---|---|---|
|A `public.stores`|推奨|20店舗と一致、既存NOV HUB/Accounting設計が参照、code・法人FK・timestampが揃う|履歴・名称区分・Direct/FC列が不足、public schema名が責務を示さない|中。互換性を維持しながら履歴・access contractを追加可能|現物理tableへの直接依存を放置すると変更が困難|
|B `core.stores`|不採用|schema名がCore責務を示す、opened/closed列がある|1店舗のみ、既存20店舗・利用系と不一致、所沢UUIDが競合、RLS無効|高。20店舗と全参照先の移行・照合が必要|UUID分断、参照切れ、二重Master継続|
|C 別Master|不採用|理想schemaを新規設計しやすい|第三のUUID体系・三重管理を生みやすい、既存利用系と乖離|最高|移行中のSSoT不明確化、照合・rollback複雑化|

## Decision

`public.stores`の既存UUIDを継承する論理的なStore Masterを唯一のSSoTとして採用する。

これは、consumerが`public.stores`を直接参照してよいという決定ではない。物理配置は当面維持し、version付きCore Master Access Contractの背後に隔離する。将来schemaを変更してもcanonical UUIDとcontractを維持する。

`core.stores`は新規書込み先・fallback・merge先にしない。所沢店の行は証跡として保持し、ADR-002のlegacy alias/crosswalk方針で解決する。廃止や変更は別migration ADRの承認後にのみ行う。

## Consequences

- Accounting Core、Store API、Directory系のstore FKはcanonical `public.stores.id`へ収束させる。
- 20店舗一致を初期baselineとし、本部・inactive店舗は消さず種別と期間で扱う。
- schema名ではなく、承認済みcontractとownerがSSoTを定義する。
- 物理tableの直接参照を段階的に検出・禁止する必要がある。

## Acceptance gate

人間承認、UUID crosswalk承認、history model承認、RLS/API contract承認、全consumer影響調査が完了するまでProduction Master移行は開始しない。
