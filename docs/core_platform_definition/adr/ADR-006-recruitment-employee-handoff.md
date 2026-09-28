# ADR-006 採用から現職者管理への移管

- Status: Needs Decision
- Date: 2026-07-28

## Proposed decision

承認済みonboarding caseを唯一の移管入口とし、idempotency keyでcandidate/application/case/employeeを一意linkする。氏名、連絡先、入社予定、予定所属、同意version、必要書類状態のみを目的限定で渡す。

## Consequences

二重employee作成と選考PIIの過剰共有を防ぐ。辞退、延期、再応募、再入社の状態遷移と人事/採用ownerの責任分界が必要。
