# Production Go-Live Checklist

## Purpose

Production解除を単一の監査可能なchecklistで判定する。

## Current State

ProductionはNo-Go。以下のproduction gateは**0/29 complete**。prototype合格をproduction完了と数えない。

## Target State

`[ ]`は未完了。evidenceとapproverを併記してから`[x]`へ変更する。

- [ ] Phase 3/4/5 PR依存解決
- [ ] Staging完全分離
- [ ] entity mapping 38/38（100%）承認
- [ ] account group release
- [ ] KPI definition set release
- [ ] 税込rule承認
- [ ] role/scope承認
- [ ] 利益・利益率閲覧範囲承認
- [ ] Accounting migration
- [ ] KPI migration
- [ ] Projection API
- [ ] session integration
- [ ] RLS negative test
- [ ] security review
- [ ] synthetic E2E
- [ ] masked data UAT
- [ ] limited real data UAT
- [ ] performance test
- [ ] rollback rehearsal
- [ ] monitoring
- [ ] alert
- [ ] monthly runbook承認
- [ ] incident responsibility
- [ ] mock fixture production除外
- [ ] production mode解除承認
- [ ] final smoke test
- [ ] CTO承認
- [ ] 経理・営業・Security承認
- [ ] 経営承認

## Confirmed Decisions

必須項目のwaiverを暗黙適用しない。production mode解除は最後のapproval後。

## Proposed Decisions

各項目へevidence URL、commit/artifact SHA、approver role、approved_atを記録する。

## Unknowns

承認者個人、target date、正式release window。

## Blocking Items

全29項目。

## Required Approvers

CTO、Accounting Approver、Sales Owner、Security Owner、Management Approver、Platform Owner。

## Evidence／Source

- [Assessment](production-readiness-assessment.md)
- [Decision Register](decision-register.md)
- [CI/CD Gates](ci-cd-quality-gates.md)

## Exit Criteria

29/29 complete、DEC-GO-001 approved、blocking validation/defect 0、Production smoke合格。
