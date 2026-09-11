# Application Impact Matrix

「現行」はsourceで確認できた経路です。live DBのcard URLは未確認を含みます。

| App | 現行起動・認証 | 影響 | 初回canary |
|---|---|---:|---|
| IDEA LINK | 60秒opaque code、app session | 高: 稼働経路を保護 | 不可 |
| Expense Hub | generic/external候補、`hub_context` | 高: live URL/auth未確認 | 不可 |
| Attendance | fallback demo、live経路未確認 | 高 | 不可 |
| Shift | 同一tab、`hub_context` | 高: 店舗運用 | 不可 |
| NOV Talent | local同一tab、HUB session更新 | 高: HR感度 | 不可 |
| NOV Navi | Concierge local、generic context | 中 | 条件付き |
| Management Platform | Firebase/HUB tokenをstorageへ保存 | 最高 | 不可 |
| Environment maintenance | Management系module候補、独立経路未確認 | 高 | 不可 |
| Corporate management | Management app同一tab候補 | 高 | 不可 |
| Decision Hub | dedicated Bearer APIあり、launch未確定 | 高 | 不可 |
| Task Manager | fallback demo、live経路未確認 | 中 | 不可 |
| Concierge | local app、generic context | 中 | 条件付き |
| Education | local override、generic context | 中 | 第二候補 |

推奨初回canaryは業務アプリではなく既存の`hub-context-test`です。synthetic identityのみ、read-only、書込みなしを必須とします。
