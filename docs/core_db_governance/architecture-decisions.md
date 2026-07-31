# Core DB Governance Architecture Decisions

## Status

Phase 7 Architecture Decision Sprintの提案一式。人間承認前は`Proposed`であり、実装許可ではない。

## Decision scope

| ADR | Decision | 推奨 | Status |
|---|---|---|---|
| [ADR-001](./adr-001-store-master-ssot.md) | Store Master SSoT | `public.stores`をcanonical Store Entityとする | Proposed |
| [ADR-002](./adr-002-uuid-governance.md) | UUID Governance | 発行済UUIDを不変とし、再生成・再利用を禁止 | Proposed |
| [ADR-003](./adr-003-store-history-model.md) | Store History | Store Entityと運営履歴を分離 | Proposed |
| [ADR-004](./adr-004-store-identity.md) | Store Identity | 永続識別子、業務コード、名称、source keyを分離 | Proposed |
| [ADR-005](./adr-005-rls-governance.md) | RLS Governance | default deny、server-resolved scope、直接更新禁止 | Proposed |
| [ADR-006](./adr-006-api-governance.md) | API Governance | Runtime→Store API→Core Master Access Port→DB contract | Proposed |
| [ADR-007](./adr-007-migration-policy.md) | Migration Policy | expand/migrate/verify/contract、承認・rollback必須 | Proposed |

## Binding constraints

- Core Master Auditの実測値を事実として扱う。
- Accounting CoreはCore entityを複製せず、canonical UUIDを参照する。
- Store Sales UIはStore Sales Runtimeだけを利用する。
- RuntimeはStore APIのprojection contractだけを利用し、DBやAccounting APIへ直接接続しない。
- actor、role、scopeはserver-sideで解決し、UI表示制御を認可の代替にしない。
- Entity Approval Boardの承認済20店舗を初期照合基準とする。
- UUID、履歴、承認記録は上書き・削除で訂正しない。

## Consistency rule

ADR間で競合した場合は、Identityの永続性、最小権限、履歴保全、version付きcontractの順に安全側へ解釈し、勝手に実装しない。変更にはADR改訂と人間承認が必要。

## Non-goals

本Sprintではcode、migration、deploy、schema、seed、UUID、DBデータ、RLS policyを変更しない。
