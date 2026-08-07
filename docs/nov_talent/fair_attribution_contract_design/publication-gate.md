# Fair KPI Publication Gate

面接、内定、採用および派生率・単価は、以下をすべて満たすまで「集計準備中」です。

## Required gates

- [ ] Fair Attribution ContractがOwner承認済み
- [ ] Candidate–Fair Attributionの永続化・RLS・監査契約が承認済み
- [ ] KPI対象Attributionがすべて`CONFIRMED`
- [ ] Selection Historyが面接・内定の正式Sourceとして承認済み
- [x] Fair成果の採用数を内定数と同義とする業務定義が確定済み
- [ ] 未確認・矛盾・複数候補がHuman Review Queueへ隔離される
- [ ] 1 Candidate / 1 Fair / 1 KPIの重複計上防止がテスト済み
- [ ] 訂正・却下・再確認がappend-only auditへ記録される
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

## Next task after HR response

1. 総務人事部の回答をData Dictionaryと契約へ反映する。
2. Attribution entity、監査、RLS、APIのImplementation Readiness Reviewを行う。
3. private read-only dry-runで既存データの確認可能件数とHuman Review件数を算出する。
4. 明示承認後にStaging限定実装へ進む。
