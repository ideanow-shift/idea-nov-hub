# Fair KPI Publication Gate

面接、内定、採用および派生率・単価は、以下をすべて満たすまで「集計準備中」です。

## Required gates

- [x] Fair Attribution ContractがOwner承認済み
- [x] Candidate–Fair Attributionの永続化・RLS・監査契約が承認済み
- [ ] KPI対象Attributionがすべて`CONFIRMED`
- [x] Selection Historyが面接・内定の正式Sourceとして承認済み
- [x] Fair成果の採用数を内定数と同義とする業務定義が確定済み
- [x] 未確認・矛盾・複数候補がHuman Review Queueへ隔離される
- [x] 1 Candidate / 1 Fair / 1 KPIの重複計上防止がテスト済み
- [x] 訂正・却下・再確認がappend-only auditへ記録される
- [ ] legacy Fair KPI列が正式計算へ混入しない
- [ ] NULL、不明、0が区別される
- [ ] API、Frontend、Validator、Type、E2Eが同一Workspace Contractから生成される
- [ ] 公開前E2Eとrollback確認がPASS

## KPI-specific gates

| KPI | Required facts | Current release state |
|---|---|---|
| 面接数 | CONFIRMED ORIGIN + official INTERVIEW_COMPLETED | 集計準備中 |
| 内定数 | CONFIRMED ORIGIN + official OFFERED | 集計準備中 |
| 採用数（互換名称） | 内定数と同義 | 集計準備中 |
| 面接率 | 面接数 + approved denominator | 集計準備中 |
| 内定率 | 内定数 + approved denominator | 集計準備中 |
| 採用率（互換名称） | 内定率と同義 | 集計準備中 |
| 採用単価（互換名称） | 内定単価と同義 | 集計準備中 |

## Current next gates

1. DB司令塔がSource Hash Contract / Manifestの再現性を正式判定する。
2. `PASS — READY FOR POPULATION`後にOwnerがPENDING Populationを明示承認する。
3. 総務人事部がHuman Review Queueで候補を1件ずつ確認する。
4. Selection Historyの正式FactとCoverageを整備する。
5. legacy Fair KPIの正式Calculator混入を除去する。
6. KPI Contract、E2E、rollbackがPASSした後だけ正式公開する。
