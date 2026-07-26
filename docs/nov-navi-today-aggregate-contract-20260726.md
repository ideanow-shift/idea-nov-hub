# NOV NAVI Today Aggregate Contract v1

## Purpose

NOV NAVIのTodayには、各業務アプリが返す個人を特定しない件数だけを表示する。NOV NAVIは業務データの正本、認証情報、権限判定の正本を保持しない。

## Envelope

```json
{
  "schema": "nov-navi-today-v1",
  "aggregates": {
    "schedule": 0,
    "tasks": 0,
    "approvals": 0,
    "thanks": 0,
    "inquiries": 0,
    "growthPoints": 0
  }
}
```

- すべての値は0から1,000,000までの整数だけを許可する。
- 未連携の項目は省略できる。NOV NAVIはその項目を表示しない。
- 未知のキー、個人ID、氏名、メール、token、role、store scope、URL、自由文は拒否する。
- 画面表示はヒントであり、各業務アプリのbackend再検証を置き換えない。

## Source Ownership

| Today field | Owning domain | Meaning |
| --- | --- | --- |
| `schedule` | Attendance | 当日の予定件数 |
| `tasks` | Task Manager | 未完了タスク件数 |
| `approvals` | Decision Hub | 自分に必要な承認件数 |
| `thanks` | IDEA LINK | サンクス受信件数 |
| `inquiries` | NOV Support | 回答確認が必要な件数 |
| `growthPoints` | Growth | 今月の成長ポイント |

## Integration Boundary

この契約はsource/static段階であり、API呼び出し、DB/RPC、Edge deploy、Secret、session transport、権限変更を含まない。実装時はHUB backendが社員状態・ログイン状態・role/scopeを再確認し、集計値だけを返す別gateとする。
