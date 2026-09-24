# ADR-003 IDEA NOV OS共通認可モデル

- Status: Proposed
- Date: 2026-07-28

## Proposed decision

認可を `role × scope × action × sensitivity × state` で判定し、default denyとする。scopeはCore IDで表し、role名、店舗名、request bodyのactorだけでは許可しない。

## Consequences

app横断の説明可能性とnegative test再利用性が上がる。既存role名のmappingと各業務owner承認が必要。システム管理者へ業務データ閲覧を自動付与しない。
