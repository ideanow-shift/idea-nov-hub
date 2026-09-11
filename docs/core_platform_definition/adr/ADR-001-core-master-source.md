# ADR-001 Core Master物理正本

- Status: Needs Decision
- Date: 2026-07-28

## Context

public/coreにemployees、stores、corporationsが並存する。publicは775/22/6件と多数consumer、coreは各1件でID/列が異なる。

## Proposed decision

論理正本をCore Staff/Store/Corporation、当面の物理正本をpublic 3表とする。core同名表は削除せず、直接consumerを増やさない。全新規参照をversion付きCoreReadAdapterへ集約する。

## Consequences

現行互換性を最大化できるが、publicのRLS/品質負債を引き受ける。将来切替はmappingとshadow readを経る。物理統合は別ADR・別変更。
