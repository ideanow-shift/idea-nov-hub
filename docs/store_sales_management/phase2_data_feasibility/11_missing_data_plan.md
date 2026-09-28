# Missing Data Plan

| 優先 | 不足 | 必要な証拠/データ | 完了条件 |
|---:|---|---|---|
| P0 | 店舗売上正式source | 匿名化した公式export 13か月、項目定義、owner | 税込総/技術/店販/MID/ECをstore_idへ一意mapping |
| P0 | EC按分 | 担当店舗key、按分率、未配賦、訂正rule | 配賦合計がEC原本と一致 |
| P0 | 承認予算 | 当初/修正/承認versionとapproval | store×monthで一意なapproved budget |
| P0 | 店舗P/L | 経理の匿名化実file、科目mapping、store sheet mapping | 3か月分を法人P/Lへreconcile |
| P0 | FTE | 確定勤怠、標準時間、時短/休職/応援rule | employee×store×monthの時間とFTEを再現 |
| P1 | repeat集計 | 既存4率のsheet、式、判定期間、owner | 4率の分子・分母・cohort versionを承認 |
| P1 | customer history | privacy設計、customer ID、visit event | cross-store重複とcohortをtest可能 |
| P1 | store scope | store type、area、owner relations | 直営/FC/area filterをCore IDで再現 |
| P1 | data state | import batch、validation result、close/correction | store×periodの状態遷移をaudit可能 |

データ提供はsyntheticまたは匿名化sampleから開始し、本番接続は別Gateとする。
