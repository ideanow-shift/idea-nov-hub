# Core DB Governance Summary

## Recommendation

Phase 7の推奨は**CONDITIONAL APPROVAL**。Architectureは一貫しているが、人間承認前でありProduction実装gateは閉じたままとする。

## Decisions

- SSoT: `public.stores`の既存UUIDを継承する論理Store Master。consumerの直接table参照は禁止。
- UUID: entity lifetimeで不変。再生成・上書き・再利用禁止。所沢店はpublic UUIDをcanonical候補とし、core UUIDをimmutable crosswalkで残す。
- History: store identityと運営法人・Direct/FC・effective periodを分離。期間重複禁止、訂正はsupersede。
- Identity: official/display/brand/alias、store code/no、legacy/source keyを別責務として管理。
- RLS: enabled + default deny。server-resolved scope。全roleの直接table write禁止。
- API: UI→Runtime→Store API→Core Master Access Port→versioned DB contract→Core DB。
- Migration: expand/migrate/verify/contract、複数owner承認、rehearsal、rollback、version必須。

## Consistency assessment

|Source|Assessment|
|---|---|
|Core Master Audit|20店舗一致、二重SSoT、UUID不一致、history/RLS不足を反映|
|Accounting Core|Core entity複製禁止、UUID参照、immutable/version/lineageと整合|
|Store Sales Runtime|Runtimeを唯一のUI入口として維持し、責務追加なし|
|Entity Approval Board|名称一致だけの自動承認禁止、UUID・期間・owner承認gateと整合|
|Current documented Constitution principles|server-side認可、最小権限、frontend service role禁止と整合|

正式Constitution本文との条項単位照合はHuman Decisionとして残る。

## Implementation gate

ADR承認、Constitution照合、role scope、所沢同一性、Access Port owner、migration/rollback責任者が決定するまで、code、migration、deploy、schema、seed、UUID、DB更新を禁止する。

## Sprint boundary

本成果物はArchitecture Decisionのみであり、DBおよび実装を一切変更していない。
