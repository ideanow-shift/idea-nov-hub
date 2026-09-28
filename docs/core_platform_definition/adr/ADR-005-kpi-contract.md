# ADR-005 KPI共通定義

- Status: Needs Decision
- Date: 2026-07-28

## Proposed decision

KPIを名称ではなく、式、分子、分母、粒度、期間、timezone、税、丸め、source、確定時点、versionで識別する。0除算はNULL、訂正はversion更新とする。生産性の主KPI候補は純売上÷確定労働時間。

## Consequences

店舗営業と法人経営の数値再現性が上がる。営業・経理がMVP KPI、分母、配賦を承認するまでAcceptedにしない。
