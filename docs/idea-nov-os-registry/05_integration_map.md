# Integration Map

| source | target | mechanism | status / risk |
| --- | --- | --- | --- |
| NOV HUB | all apps | `portal_apps` URL + `hub_context` | Production。受け側実装差あり |
| Firebase Auth | NOV HUB/Edge | ID token | Production |
| NOV HUB API | Supabase Core | REST/RPC/service role | Production。scope検証が重要 |
| HUB | IDEA LINK | handoff/session bridge | Production候補。旧GAS残存 |
| HUB | Talent | same-origin routes/APIs | Development |
| HUB | Management/Expense/Education | internal/external URL | Mixed |
| Notification Engine | NOV HUB inbox | DB queue/inbox | Development |
| Notification Engine | LINE WORKS | Edge Function | Partial/Production候補 |
| Finance | Yayoi | CSV export/import | Stable候補。正式運用確認要 |
| Sales/Education | shared DB | 不明 | Planned/Unknown |
| Instagram | Meta API候補 | 不明 | Unknown |
| Legacy apps | GAS/Sheets | Web App/Spreadsheet | Retirement direction |

外部連携のSecret owner、更新責任、障害時再送、rate limit、監査保持期間は一元台帳が未確認。

