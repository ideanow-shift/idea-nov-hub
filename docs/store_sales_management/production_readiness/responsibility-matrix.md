# Production Readiness Responsibility Matrix

## Purpose

個人名を推測せず、Production Readinessの責任をRACIで固定する。

## Current State

役割候補のみ。個人assignment、代理、on-callはUnknown。

## Target State

R=Responsible、A=Accountable、C=Consulted、I=Informed。複数Aは最終承認までに単一または共同承認規則を決める。

| Activity | CTO | Platform | Accounting Owner/Approver | Management | Sales | Core Master | Security | UAT | Incident Cmd | FC Rep |
|---|---|---|---|---|---|---|---|---|---|---|
| Staging | A | R | C | I | C | I | C | I | I | I |
| migration | I | R | A/C | I | I | C | C | I | I | I |
| entity mapping | I | I | R | A | R | R | C | C | I | C |
| account group/KPI | I | C | R | A | C | I | C | C | I | I |
| 税込rule | I | C | R/A | C | C | I | C | C | I | I |
| role/scope・利益 | A | C | C | R | R | C | C | C | I | C |
| RLS/secrets | I | R | C | I | I | C | A | I | C | I |
| deploy | A | R | I | I | I | I | C | C | I | I |
| UAT | I | C | C | C | R | C | C | A | I | R |
| monitoring/monthly | I | R | A/R | C | C | I | C | C | C | I |
| incident | I | R | C | I | C | I | C | C | A | I |
| production approval | A | C | A | A | A | I | A | C | I | I |

## Confirmed Decisions

担当者名は承認されるまでTBD。実施者と承認者を可能な限り分離する。

## Proposed Decisions

各roleにprimary/delegateを割当て、DEC-OPS/UAT/INC/GOへ同期する。

## Unknowns

個人、代理、勤務時間外対応、FC Representativeの範囲。

## Blocking Items

Accountable roleの個人assignment、職務分離、incident on-call。

## Required Approvers

CTO、各functional owner。

## Evidence／Source

- [Decision Register](decision-register.md)
- [Monthly Runbook](monthly-accounting-runbook.md)

## Exit Criteria

全activityにR/Aが存在し、個人・代理・連絡経路・承認権限が記録される。
